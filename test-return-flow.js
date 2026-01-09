const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
let authToken = '';
let adminToken = '';
let orderId1 = '';
let productId1 = '';
let productId2 = '';
let product1 = null;
let product2 = null;

// Helper to log section headers
function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

// Helper to log results
function logResult(message, data) {
  console.log(`✓ ${message}`);
  if (data) console.log('  Data:', JSON.stringify(data, null, 2));
}

// Helper to log errors
function logError(message, error) {
  console.error(`✗ ${message}`);
  if (error.response) {
    console.error('  Status:', error.response.status);
    console.error('  Data:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('  Error:', error.message);
  }
}

async function setup() {
  logSection('SETUP - Login & Get Products');
  
  try {
    // Login as test user
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@marketplace.com',
      password: 'test'
    });
    authToken = loginRes.data.access_token || loginRes.data.token;
    adminToken = authToken; // Use same token for both
    logResult('User logged in', { 
      email: 'test@marketplace.com',
      hasToken: !!authToken,
      tokenStart: authToken ? authToken.substring(0, 20) : 'NO TOKEN'
    })

    // Get specific products
    const productsRes = await axios.get(`${API_URL}/products?limit=50`);
    product1 = productsRes.data.products.find(p => p.name === 'Ring Light with Tripod');
    product2 = productsRes.data.products.find(p => p.name === 'Laptop Stand Aluminum');
    
    if (!product1 || !product2) {
      console.error('\n⚠️  Products not found!');
      console.error('Available products:', productsRes.data.products.map(p => p.name).join(', '));
      throw new Error('Required products not found');
    }
    
    productId1 = product1.id;
    productId2 = product2.id;
    
    // Restore stock to seed values if needed
    if (product1.stockQuantity !== 2 || product2.stockQuantity !== 10) {
      console.log('  Restoring stock to seed values...');
      await axios.patch(`${API_URL}/products/${productId1}`, 
        { stockQuantity: 2 },
        { headers: { Authorization: `Bearer ${adminToken}` }}
      );
      await axios.patch(`${API_URL}/products/${productId2}`, 
        { stockQuantity: 10 },
        { headers: { Authorization: `Bearer ${adminToken}` }}
      );
      product1.stockQuantity = 2;
      product2.stockQuantity = 10;
      console.log('  ✓ Stock restored');
    }
    
    logResult('Got products', { 
      product1: product1.name,
      product2: product2.name,
      stock1: product1.stockQuantity,
      stock2: product2.stockQuantity,
      price1: product1.price,
      price2: product2.price
    });
  } catch (error) {
    logError('Setup failed', error);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  Backend is not running! Please start it with: .\\restart-services.ps1\n');
    }
    process.exit(1);
  }
}

async function createOrders() {
  logSection('STEP 1 - Create One Order with 2 qty of Each Product');
  
  try {
    // Calculate order totals
    const qty1 = 2, qty2 = 2;
    const price1 = Number(product1.price);
    const price2 = Number(product2.price);
    const subtotal = (price1 * qty1) + (price2 * qty2);
    const shippingCost = 50;
    const tax = subtotal * 0.18; // 18% GST already in MRP
    const totalAmount = subtotal + shippingCost;

    console.log('Order calculation:', { price1, price2, qty1, qty2, subtotal, shippingCost, totalAmount });

    // Create order with 2 items (qty 2 each) with calculated prices
    const order1Res = await axios.post(`${API_URL}/orders`, {
      items: [
        { productId: productId1, quantity: qty1, price: price1 },
        { productId: productId2, quantity: qty2, price: price2 }
      ],
      subtotal,
      shippingCost,
      tax,
      totalAmount,
      shippingAddress: {
        fullName: 'Test User',
        addressLine1: '123 Test St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
        phoneNumber: '9876543210'
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    orderId1 = order1Res.data.id || (Array.isArray(order1Res.data) ? order1Res.data[0].id : null);
    logResult('Order created', { orderId: orderId1, total: totalAmount });
    
    console.log('\n📋 Order Details:');
    console.log('   Order ID:', orderId1);
    console.log('   Order Number:', order1Res.data.orderNumber || (Array.isArray(order1Res.data) ? order1Res.data[0].orderNumber : 'N/A'));
    console.log('   Status:', order1Res.data.status || (Array.isArray(order1Res.data) ? order1Res.data[0].status : 'N/A'));
    console.log('   Subtotal:', order1Res.data.subtotal || (Array.isArray(order1Res.data) ? order1Res.data[0].subtotal : 'N/A'));
    console.log('   Total:', order1Res.data.total || (Array.isArray(order1Res.data) ? order1Res.data[0].total : 'N/A'));
    console.log('   Items Count:', order1Res.data.items?.length || (Array.isArray(order1Res.data) ? order1Res.data[0].items?.length : 0));

    // Mark order as delivered
    try {
      const statusRes = await axios.patch(`${API_URL}/orders/${orderId1}/status`, 
        { status: 'delivered' },
        { headers: { Authorization: `Bearer ${adminToken}` }}
      );
      logResult('Order marked as delivered');
      console.log('\n📦 Status Update Response:');
      console.log('   New Status:', statusRes.data.status);
      console.log('   Delivered At:', statusRes.data.deliveredAt);
    } catch (statusError) {
      logError('Failed to update status, trying to continue anyway...', statusError);
      // Don't exit, try to continue
    }

  } catch (error) {
    logError('Failed to create order', error);
    process.exit(1);
  }
}

async function requestReturns() {
  logSection('STEP 2 - Request Returns (1 qty of each item) - ALL IN ONE STEP');
  
  try {
    // Get order items
    console.log('\n🔍 Fetching order details...');
    let orderRes;
    try {
      orderRes = await axios.get(`${API_URL}/orders/${orderId1}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
    } catch (getError) {
      console.log('⚠️  Full order fetch failed, trying simpler query...');
      throw getError;
    }
    
    console.log('📦 Order fetched successfully');
    console.log('Order data:', JSON.stringify({
      id: orderRes.data.id,
      status: orderRes.data.status,
      deliveredAt: orderRes.data.deliveredAt,
      itemsCount: orderRes.data.items?.length,
      items: orderRes.data.items?.map(i => ({ id: i.id, name: i.productName, qty: i.quantity, price: i.price }))
    }, null, 2));
    
    const orderItems = orderRes.data.items;

    if (!orderItems || orderItems.length === 0) {
      throw new Error('Order has no items');
    }

    // Prepare return requests for all items at once
    console.log('\n🔄 Preparing return requests for all items...');
    const returnRequests = orderItems.map(item => ({
      orderItemId: item.id,
      quantity: 1,
      reason: 'defective',
      customerNotes: 'Item is damaged',
      productName: item.productName,
      originalQty: item.quantity,
      price: item.price
    }));

    console.log('Items to return:', JSON.stringify(returnRequests.map(r => ({
      itemId: r.orderItemId,
      product: r.productName,
      returnQty: r.quantity,
      originalQty: r.originalQty
    })), null, 2));

    // Request all returns in a single API call
    console.log('\n📤 Submitting all return requests in one call...');
    const returnRes = await axios.post(`${API_URL}/orders/${orderId1}/returns/bulk-request`, {
      items: returnRequests
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    logResult(`All returns requested successfully`);
    console.log('\n✅ Bulk Return Response:', JSON.stringify(returnRes.data, null, 2));

  } catch (error) {
    console.log('\n❌ Error occurred at:', error.config?.url || 'unknown');
    console.log('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    logError('Failed to request returns', error);
    
    console.log('\n💡 Suggestion: Check if bulk-request endpoint exists or use individual requests');
    
    process.exit(1);
  }
}

async function approveReturns() {
  logSection('STEP 3 - Admin Approves All Returns');
  
  try {
    // Approve all returns
    const approveRes = await axios.post(`${API_URL}/orders/${orderId1}/returns/approve-all`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    logResult('All returns approved');
    console.log('\n✅ Approval Response:', JSON.stringify(approveRes.data, null, 2));

    // Check order status
    const orderStatus = await axios.get(`${API_URL}/orders/${orderId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('\n📋 Order Status After Approval:');
    console.log('   Status:', orderStatus.data.status);
    console.log('   Items with returns:', orderStatus.data.items?.filter(i => i.returnStatus).length || 0);

  } catch (error) {
    logError('Failed to approve returns', error);
    process.exit(1);
  }
}

async function confirmReturns() {
  logSection('STEP 4 - Admin Confirms All Returns Received');
  
  try {
    // Get initial stock quantities
    const initialStock = await axios.get(`${API_URL}/products?limit=50`);
    const initialProduct1 = initialStock.data.products.find(p => p.id === productId1);
    const initialProduct2 = initialStock.data.products.find(p => p.id === productId2);
    const initialProduct1Stock = initialProduct1?.stockQuantity;
    const initialProduct2Stock = initialProduct2?.stockQuantity;
    
    console.log('\n📦 Stock BEFORE confirming returns:');
    console.log('   ', initialProduct1?.name, ':', initialProduct1Stock);
    console.log('   ', initialProduct2?.name, ':', initialProduct2Stock);

    // Confirm all returns
    const confirmRes = await axios.post(`${API_URL}/orders/${orderId1}/returns/confirm-all`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    logResult('All returns confirmed (stock should increase by 1 for each product)');
    console.log('\n✅ Confirmation Response:', JSON.stringify(confirmRes.data, null, 2));

    // Check final stock quantities
    const finalStock = await axios.get(`${API_URL}/products?limit=50`);
    const finalProduct1 = finalStock.data.products.find(p => p.id === productId1);
    const finalProduct2 = finalStock.data.products.find(p => p.id === productId2);
    const finalProduct1Stock = finalProduct1?.stockQuantity;
    const finalProduct2Stock = finalProduct2?.stockQuantity;
    
    console.log('\n📦 Stock AFTER confirming returns:');
    console.log('   ', finalProduct1?.name, ':', finalProduct1Stock, `(${initialProduct1Stock} → ${finalProduct1Stock}, change: ${finalProduct1Stock - initialProduct1Stock})`);
    console.log('   ', finalProduct2?.name, ':', finalProduct2Stock, `(${initialProduct2Stock} → ${finalProduct2Stock}, change: ${finalProduct2Stock - initialProduct2Stock})`);
    
    const product1Correct = finalProduct1Stock === initialProduct1Stock + 1;
    const product2Correct = finalProduct2Stock === initialProduct2Stock + 1;
    
    console.log('\n✅ Stock Validation:');
    console.log('   ', finalProduct1?.name, ':', product1Correct ? '✓ CORRECT (+1)' : '✗ INCORRECT (expected +1)');
    console.log('   ', finalProduct2?.name, ':', product2Correct ? '✓ CORRECT (+1)' : '✗ INCORRECT (expected +1)');

  } catch (error) {
    logError('Failed to confirm returns', error);
    process.exit(1);
  }
}

async function checkInvoices() {
  logSection('STEP 5 - Check Invoices & Credit Notes');
  
  try {
    // Get order invoices
    const order = await axios.get(`${API_URL}/orders/${orderId1}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const invoices = order.data.invoices || [];
    const creditNotes = invoices.filter(inv => inv.invoiceNumber?.startsWith('CN-'));
    
    console.log('\n📄 Invoice Summary:');
    console.log('   Total Invoices:', invoices.length);
    console.log('   Credit Notes:', creditNotes.length);
    
    if (creditNotes.length > 0) {
      console.log('\n💳 Credit Note Details:');
      creditNotes.forEach((cn, idx) => {
        console.log(`\n   Credit Note #${idx + 1}:`);
        console.log('      Number:', cn.invoiceNumber);
        console.log('      Type:', cn.type);
        console.log('      Total:', cn.total);
        console.log('      Notes:', cn.notes);
        console.log('      Items:', JSON.stringify(cn.items, null, 6));
      });
    } else {
      console.log('   ⚠️  No credit notes found');
    }

  } catch (error) {
    logError('Failed to check invoices', error);
  }
}

async function cleanup() {
  logSection('CLEANUP - Restoring Stock to Seed Values');
  
  try {
    // Restore stock to original seed values
    await axios.patch(`${API_URL}/products/${productId1}`, 
      { stockQuantity: 2 },
      { headers: { Authorization: `Bearer ${adminToken}` }}
    );
    await axios.patch(`${API_URL}/products/${productId2}`, 
      { stockQuantity: 10 },
      { headers: { Authorization: `Bearer ${adminToken}` }}
    );
    logResult('Stock restored to seed values (Ring Light: 2, Laptop Stand: 10)');
  } catch (error) {
    logError('Failed to restore stock (non-critical)', error);
  }
}

async function runTest() {
  console.log('\n🧪 TESTING RETURN FLOW\n');
  
  try {
    await setup();
    await createOrders();
    await requestReturns();
    await approveReturns();
    await confirmReturns();
    await checkInvoices();
    
    logSection('✅ TEST COMPLETED');
    console.log('\nVerify that:');
    console.log('1. Stock quantities increased by 1 for each product (Ring Light: 2→0→1, Laptop Stand: 10→8→9)');
    console.log('2. Credit notes show only returned items in notes');
    console.log('3. Order status updated to "returned"');
    console.log('4. Credit note amounts match returned item values (1 qty of each)\n');
  } finally {
    // Always run cleanup, even if test fails
    await cleanup();
  }
}

runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
