const API_BASE = 'https://paribelle-backend.onrender.com/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 STARTING PHASE 4 E2E TEST SUITE (ADMIN & EXCHANGES)');
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
  let adminUser = null;
  await assert('1.1 Admin Authentication (/auth/login)', async () => {
    // try seeded passwords
    const passwords = ['mbr0UALs1MnVGKWe@6', 'Admin@123'];
    let res, data;
    for (const pwd of passwords) {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@paribelle.com', password: pwd }),
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
    }
    if (!data || !data.access_token) {
      throw new Error(`Login failed with status ${res?.status}: ${JSON.stringify(await res?.text())}`);
    }
    adminToken = data.access_token;
    adminUser = data.user;
    if (adminUser.role !== 'super_admin' && adminUser.role !== 'admin') {
      throw new Error(`Expected admin role, got ${adminUser.role}`);
    }
  });

  // 2. Admin Stats Aggregation
  let productStats = null;
  let orderStats = null;
  await assert('1.2 Admin Product Stats Aggregation (GET /products/admin/stats)', async () => {
    const res = await fetch(`${API_BASE}/products/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    productStats = await res.json();
    if (typeof productStats.total !== 'number' || typeof productStats.active !== 'number') {
      throw new Error(`Invalid stats shape: ${JSON.stringify(productStats)}`);
    }
    console.log(`[Total: ${productStats.total}, Active: ${productStats.active}, Low Stock: ${productStats.lowStock || 0}, Out of Stock: ${productStats.outOfStock || 0}]`);
  });

  await assert('1.3 Admin Order Stats Aggregation (GET /orders/admin/stats)', async () => {
    const res = await fetch(`${API_BASE}/orders/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    orderStats = await res.json();
    if (typeof orderStats.ordersToday !== 'number' && typeof orderStats.total !== 'number') {
      throw new Error(`Invalid order stats: ${JSON.stringify(orderStats)}`);
    }
    console.log(`[Orders Today: ${orderStats.ordersToday}]`);
  });

  // 3. Category CRUD
  let createdCategory = null;
  const testCatSlug = `test-cat-${Date.now()}`;
  await assert('2.1 Admin Category Creation (POST /categories)', async () => {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Phase 4 Automated Test Category',
        slug: testCatSlug,
        description: 'Temporary category created during automated Phase 4 QA run',
        displayMode: 'both',
        isActive: true,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    createdCategory = await res.json();
    if (!createdCategory.id) throw new Error('No category ID returned');
  });

  await assert('2.2 Admin Category Update (PUT /categories/:id)', async () => {
    const res = await fetch(`${API_BASE}/categories/${createdCategory.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        description: 'Updated description for Phase 4 QA',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  });

  // 4. Customer Authentication for End-to-End Shopping & Privilege Tests
  let customerToken = '';
  let customerUser = null;
  const customerEmail = `qa.paribelle.tester.${Date.now()}@gmail.com`;

  await assert('3.1 Customer Authentication (Google OAuth Flow /auth/google-login)', async () => {
    const res = await fetch(`${API_BASE}/auth/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        name: 'QA PariBelle Tester',
        googleId: `gid-${Date.now()}`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    customerToken = data.token || data.access_token;
    customerUser = data.user;
    if (!customerToken || !customerUser?.id) {
      throw new Error(`Customer auth failed to return token: ${JSON.stringify(data)}`);
    }
  });

  // 5. Security & Boundary Enforcement (Non-admin privilege rejection)
  await assert('4.1 Security: Customer blocked from Admin Categories CRUD (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/categories/${createdCategory.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ name: 'Hacked Category' }),
    });
    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected 403/401, received HTTP ${res.status}`);
    }
  });

  await assert('4.2 Security: Customer blocked from Admin Stats (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/products/admin/stats`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected 403/401, received HTTP ${res.status}`);
    }
  });

  await assert('4.3 Security: Customer blocked from query /orders?vendorId=... (403 Forbidden)', async () => {
    const res = await fetch(`${API_BASE}/orders?vendorId=some-vendor-id`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected 403 Forbidden, got HTTP ${res.status}`);
    }
  });

  // 6. Product Selection & Variant Inspection
  let testProduct = null;
  let testVariants = [];
  await assert('5.1 Fetch Products and Multi-Variant Structure', async () => {
    const res = await fetch(`${API_BASE}/products?limit=10`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const products = data.products || data;
    // find a product with variants
    for (const p of products) {
      const vRes = await fetch(`${API_BASE}/products/${p.id}/variants`);
      if (vRes.ok) {
        const variants = await vRes.json();
        if (variants && variants.length >= 2) {
          testProduct = p;
          testVariants = variants;
          break;
        }
      }
    }
    if (!testProduct || testVariants.length < 2) {
      // fallback to first product
      testProduct = products[0];
      const vRes = await fetch(`${API_BASE}/products/${testProduct.id}/variants`);
      testVariants = vRes.ok ? await vRes.json() : [];
    }
    if (!testProduct) throw new Error('No products found in catalog');
    console.log(`[Selected: "${testProduct.name}" (ID: ${testProduct.id}), Variants: ${testVariants.length}]`);
  });

  // 7. Order Placement & State Machine Progression
  let createdOrder = null;
  let orderItemId = null;
  const orderedVariant = testVariants[0] || null;
  const exchangeTargetVariant = testVariants[1] || null;

  await assert('6.1 Place End-to-End Order (POST /orders)', async () => {
    const orderPayload = {
      items: [
        {
          productId: testProduct.id,
          variantId: orderedVariant?.id || null,
          quantity: 1,
          price: Number(testProduct.price) || 999,
        },
      ],
      shippingAddress: {
        fullName: 'QA Customer',
        phone: '9876543210',
        email: customerEmail,
        addressLine1: '123 Test Street, Civil Lines',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        postalCode: '302001',
      },
      paymentMethod: 'cod',
      subtotal: Number(testProduct.price) || 999,
      shippingCost: 0,
      tax: 0,
      totalAmount: Number(testProduct.price) || 999,
      notes: 'Automated Phase 4 Test Order',
    };

    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const raw = await res.json();
    createdOrder = Array.isArray(raw) ? raw[0] : raw;
    if (!createdOrder?.id) throw new Error(`No order returned: ${JSON.stringify(raw)}`);
    const items = createdOrder.items || createdOrder.orderItems || [];
    orderItemId = items[0]?.id;
    console.log(`[Order ID: ${createdOrder.id}, Status: ${createdOrder.status}, Item ID: ${orderItemId}]`);
  });

  // 8. Order Status Progression (Admin)
  await assert('6.2 Order Status Transition: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED (with tracking)', async () => {
    // 1. Confirm
    let res = await fetch(`${API_BASE}/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    if (!res.ok) throw new Error(`Failed to confirm: HTTP ${res.status} ${await res.text()}`);

    // 2. Processing
    res = await fetch(`${API_BASE}/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'processing' }),
    });
    if (!res.ok) throw new Error(`Failed to process: HTTP ${res.status} ${await res.text()}`);

    // 3. Shipped
    res = await fetch(`${API_BASE}/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'shipped', reason: 'Dispatched via BlueDart AWB-8899001' }),
    });
    if (!res.ok) throw new Error(`Failed to ship: HTTP ${res.status} ${await res.text()}`);
  });

  await assert('6.3 Order Delivery & Payment Settlement (SHIPPED -> DELIVERED & Mark PAID)', async () => {
    // 1. Delivered
    let res = await fetch(`${API_BASE}/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'delivered' }),
    });
    if (!res.ok) throw new Error(`Failed to mark delivered: HTTP ${res.status}`);

    // 2. Payment Status Paid
    res = await fetch(`${API_BASE}/orders/${createdOrder.id}/payment-status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ paymentStatus: 'paid' }),
    });
    if (!res.ok) throw new Error(`Failed to mark payment paid: HTTP ${res.status}`);
  });

  // 9. GST Tax Invoice Verification
  await assert('7.1 GST Invoice Verification & PDF Route (GET /invoices)', async () => {
    const res = await fetch(`${API_BASE}/invoices?customerId=${customerUser.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const invoices = await res.json();
    console.log(`[Customer Invoices Count: ${Array.isArray(invoices) ? invoices.length : (invoices.invoices?.length || 0)}]`);
  });

  // 10. Exchange Lifecycle Testing
  let createdExchange = null;
  if (exchangeTargetVariant && orderItemId) {
    await assert('8.1 Customer Submits Exchange Request (POST /orders/.../exchange)', async () => {
      const exchangePayload = {
        quantity: 1,
        reason: 'Size too small, requesting larger variant',
        exchangeVariantId: exchangeTargetVariant.id,
        videoUrl: 'https://res.cloudinary.com/hyo0zt6j/video/upload/sample.mp4',
        customerNotes: 'Item is unused with original tags attached',
        courierChargePaymentMethod: 'cod',
      };

      const res = await fetch(`${API_BASE}/orders/${createdOrder.id}/items/${orderItemId}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify(exchangePayload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      createdExchange = await res.json();
      if (!createdExchange.id) throw new Error('No exchange ID returned');
      console.log(`[Exchange ID: ${createdExchange.id}, Status: ${createdExchange.status}]`);
    });

    await assert('8.2 Admin Reviews & Approves Exchange (POST /exchanges/:id/approve)', async () => {
      const res = await fetch(`${API_BASE}/exchanges/${createdExchange.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });

    await assert('8.3 Transit: Customer/Courier Marks In-Transit (POST /exchanges/:id/in-transit)', async () => {
      const res = await fetch(`${API_BASE}/exchanges/${createdExchange.id}/in-transit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ trackingNumber: 'RET-TRACK-998811' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });

    await assert('8.4 Admin Quality Inspection (PASSED) (POST /exchanges/:id/inspection)', async () => {
      const res = await fetch(`${API_BASE}/exchanges/${createdExchange.id}/inspection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          result: 'passed',
          notes: 'Tags intact, fabric unworn and verified in pristine condition.',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });

    await assert('8.5 Admin Ships Replacement Variant (POST /exchanges/:id/ship-replacement)', async () => {
      const res = await fetch(`${API_BASE}/exchanges/${createdExchange.id}/ship-replacement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ trackingNumber: 'REPL-DISPATCH-7766' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });
  } else {
    console.log('⚠️ Skipping multi-variant exchange flow (single variant product found). Testing direct rejection policy.');
  }

  // 11. Testing Policy Rejection & Boundary Invariants
  await assert('8.6 Policy: Direct Return/Refund Endpoint Refuses with Exchange Policy (HTTP 400)', async () => {
    const res = await fetch(`${API_BASE}/orders/${createdOrder.id}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400 with policy message, got ${res.status}`);
    const data = await res.json();
    if (!data.message || !data.message.includes('exchange')) {
      throw new Error(`Unexpected message: ${data.message}`);
    }
  });

  // 12. Cleanup Test Category
  if (createdCategory) {
    await assert('9.1 Cleanup Temporary Test Category (DELETE /categories/:id)', async () => {
      const res = await fetch(`${API_BASE}/categories/${createdCategory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test runner crash:', err);
  process.exit(1);
});
