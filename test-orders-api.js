const fetch = require('node-fetch');

async function testOrdersAPI() {
  try {
    // Get token from backend logs or check what token the admin is using
    console.log('Testing Orders API for super admin...\n');
    
    // First, login as admin to get the token
    const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ajaniljoshijobs@gmail.com',
        password: 'Admin@123',
      }),
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('Login response:', JSON.stringify(loginData, null, 2));
    console.log('\nLogin successful!');
    console.log('User:', loginData.user?.email, '- Role:', loginData.user?.role);
    
    const token = loginData.accessToken || loginData.access_token || loginData.token;
    
    // Now fetch orders
    console.log('Fetching orders for this user...\n');
    const ordersResponse = await fetch('http://localhost:3001/api/v1/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!ordersResponse.ok) {
      throw new Error(`Orders fetch failed: ${ordersResponse.status}`);
    }
    
    const orders = await ordersResponse.json();
    console.log(`Found ${orders.length} orders:\n`);
    
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ${order.orderNumber}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   Items: ${order.items?.length || 0}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log('');
    });
    
    // Also test the admin endpoint
    console.log('Now testing admin/all endpoint...\n');
    const adminOrdersResponse = await fetch('http://localhost:3001/api/v1/orders/admin/all', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!adminOrdersResponse.ok) {
      throw new Error(`Admin orders fetch failed: ${adminOrdersResponse.status}`);
    }
    
    const adminOrders = await adminOrdersResponse.json();
    console.log(`Admin view found ${adminOrders.length} orders:\n`);
    
    adminOrders.forEach((order, index) => {
      console.log(`${index + 1}. Order ${order.orderNumber}`);
      console.log(`   User: ${order.user?.email}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: ₹${order.total}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOrdersAPI();
