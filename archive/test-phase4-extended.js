const API_BASE = 'https://paribelle-backend.onrender.com/api/v1';

async function runExtendedTests() {
  console.log('====================================================');
  console.log('🧪 PHASE 4 EXTENDED EDGE-CASE & INVARIANT TESTS');
  console.log(`Target: ${API_BASE}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(desc, fn) {
    process.stdout.write(`⏳ ${desc} ... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. Admin Login
  let adminToken = '';
  await assert('1.1 Admin Authentication', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@paribelle.com', password: 'mbr0UALs1MnVGKWe@6' }),
    });
    const data = await res.json();
    adminToken = data.access_token;
  });

  // 2. Create Two Distinct Customers (Customer A and Customer B)
  let custAToken = '', custAUser = null;
  let custBToken = '', custBUser = null;

  await assert('1.2 Multi-Tenant Customer Provisioning (Customer A & Customer B)', async () => {
    const resA = await fetch(`${API_BASE}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `custA.${Date.now()}@gmail.com`,
        name: 'Customer Alpha',
        googleId: `gid-a-${Date.now()}`,
      }),
    });
    const dataA = await resA.json();
    custAToken = dataA.token;
    custAUser = dataA.user;

    const resB = await fetch(`${API_BASE}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `custB.${Date.now()}@gmail.com`,
        name: 'Customer Beta',
        googleId: `gid-b-${Date.now()}`,
      }),
    });
    const dataB = await resB.json();
    custBToken = dataB.token;
    custBUser = dataB.user;
  });

  // 3. Fetch Product & Variants
  let product = null;
  let variants = [];
  await assert('2.1 Get Multi-Variant Product for Testing', async () => {
    const res = await fetch(`${API_BASE}/products?limit=10`);
    const data = await res.json();
    const products = data.products || data;
    for (const p of products) {
      const vRes = await fetch(`${API_BASE}/products/${p.id}/variants`);
      if (vRes.ok) {
        const vData = await vRes.json();
        if (vData && vData.length >= 2) {
          product = p;
          variants = vData;
          break;
        }
      }
    }
  });

  // Helper to place and deliver an order for a customer
  async function placeAndDeliverOrder(token, user) {
    const orderPayload = {
      items: [
        {
          productId: product.id,
          variantId: variants[0]?.id || null,
          quantity: 1,
          price: Number(product.price) || 999,
        },
      ],
      shippingAddress: {
        fullName: user.firstName + ' ' + (user.lastName || ''),
        phone: '9876543210',
        email: user.email,
        addressLine1: 'Test Address Line 1',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        postalCode: '302001',
      },
      paymentMethod: 'cod',
      subtotal: Number(product.price) || 999,
      shippingCost: 0,
      tax: 0,
      totalAmount: Number(product.price) || 999,
    };

    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });
    const raw = await res.json();
    const order = Array.isArray(raw) ? raw[0] : raw;

    // Transition to Delivered & Paid
    await fetch(`${API_BASE}/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'delivered' }),
    });
    await fetch(`${API_BASE}/orders/${order.id}/payment-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    });

    return order;
  }

  // 4. Test Inspection Failure Path
  let failOrder = null;
  let failExchange = null;
  await assert('3.1 Exchange Lifecycle: Failed Quality Inspection Outcome', async () => {
    failOrder = await placeAndDeliverOrder(custAToken, custAUser);
    const itemId = (failOrder.items || failOrder.orderItems)[0].id;

    // Customer requests exchange
    const reqRes = await fetch(`${API_BASE}/orders/${failOrder.id}/items/${itemId}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
      body: JSON.stringify({
        quantity: 1,
        reason: 'Size exchange test',
        exchangeVariantId: variants[1].id,
        videoUrl: 'https://res.cloudinary.com/hyo0zt6j/video/upload/sample.mp4',
        courierChargePaymentMethod: 'cod',
      }),
    });
    failExchange = await reqRes.json();

    // Admin approves
    await fetch(`${API_BASE}/exchanges/${failExchange.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Mark in-transit
    await fetch(`${API_BASE}/exchanges/${failExchange.id}/in-transit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
      body: JSON.stringify({ trackingNumber: 'AWB-FAIL-TEST-123' }),
    });

    // Admin records FAILED inspection
    const inspectRes = await fetch(`${API_BASE}/exchanges/${failExchange.id}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        result: 'failed',
        notes: 'Item returned damaged / missing original security tags.',
      }),
    });
    if (!inspectRes.ok) throw new Error(`Inspection endpoint failed: HTTP ${inspectRes.status}`);

    // Verify exchange status is terminal rejected
    const excListRes = await fetch(`${API_BASE}/orders/${failOrder.id}/exchanges`, {
      headers: { Authorization: `Bearer ${custAToken}` },
    });
    const excList = await excListRes.json();
    const currentExc = excList.find(e => e.id === failExchange.id);
    if (!currentExc || currentExc.status !== 'rejected') {
      throw new Error(`Expected status 'rejected', got ${currentExc?.status}`);
    }
  });

  // 5. Test Direct Rejection at Request Stage
  await assert('3.2 Exchange Lifecycle: Admin Rejection at Request Stage', async () => {
    const rejOrder = await placeAndDeliverOrder(custAToken, custAUser);
    const itemId = (rejOrder.items || rejOrder.orderItems)[0].id;

    // Customer requests exchange
    const reqRes = await fetch(`${API_BASE}/orders/${rejOrder.id}/items/${itemId}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
      body: JSON.stringify({
        quantity: 1,
        reason: 'Exchange request test',
        exchangeVariantId: variants[1].id,
        videoUrl: 'https://res.cloudinary.com/hyo0zt6j/video/upload/sample.mp4',
        courierChargePaymentMethod: 'cod',
      }),
    });
    const exc = await reqRes.json();

    // Admin directly rejects
    const rejRes = await fetch(`${API_BASE}/exchanges/${exc.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Item video does not show clear tags' }),
    });
    if (!rejRes.ok) throw new Error(`Reject failed: HTTP ${rejRes.status}`);

    const excListRes = await fetch(`${API_BASE}/orders/${rejOrder.id}/exchanges`, {
      headers: { Authorization: `Bearer ${custAToken}` },
    });
    const excList = await excListRes.json();
    const currentExc = excList.find(e => e.id === exc.id);
    if (!currentExc || currentExc.status !== 'rejected') {
      throw new Error(`Expected status 'rejected', got ${currentExc?.status}`);
    }
  });

  // 6. Security: IDOR Cross-Tenant Isolation
  await assert('4.1 Security IDOR: Customer B cannot view Customer A exchanges', async () => {
    const res = await fetch(`${API_BASE}/orders/${failOrder.id}/exchanges`, {
      headers: { Authorization: `Bearer ${custBToken}` },
    });
    if (res.status !== 404 && res.status !== 403) {
      throw new Error(`Expected 404/403, got HTTP ${res.status}`);
    }
  });

  // 7. Cancellation Policy Enforcements
  await assert('5.1 Cancellation Policy: Customer cannot cancel a DELIVERED order', async () => {
    const res = await fetch(`${API_BASE}/orders/${failOrder.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
      body: JSON.stringify({ reason: 'Changed mind after delivery' }),
    });
    if (res.status !== 400 && res.status !== 403) {
      throw new Error(`Expected HTTP 400/403, got HTTP ${res.status}`);
    }
  });

  console.log('\n====================================================');
  console.log(`🏁 EXTENDED TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runExtendedTests().catch(err => {
  console.error('Crash:', err);
  process.exit(1);
});
