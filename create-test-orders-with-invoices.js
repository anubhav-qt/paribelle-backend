const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'marketplace',
  user: 'postgres',
  password: 'admin',
});

async function createTestOrders() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get a vendor and customer
    const vendorResult = await client.query(`
      SELECT id FROM vendors LIMIT 1
    `);
    
    const customerResult = await client.query(`
      SELECT id FROM users WHERE role = 'customer' LIMIT 1
    `);

    if (vendorResult.rows.length === 0) {
      console.log('❌ No vendors found. Please create a vendor first.');
      return;
    }

    const vendorId = vendorResult.rows[0].id;
    const customerId = customerResult.rows.length > 0 ? customerResult.rows[0].id : null;

    console.log(`📦 Creating test orders for vendor: ${vendorId}`);

    // Create 3 test orders with delivered + paid status
    for (let i = 1; i <= 3; i++) {
      const orderNumber = `TEST-ORDER-${Date.now()}-${i}`;
      
      const orderResult = await client.query(`
        INSERT INTO orders (
          "orderNumber", subtotal, tax, discount, "shippingCost", total,
          status, "paymentStatus", "vendorId", "userId",
          "shippingName", "shippingEmail", "shippingPhone",
          "shippingAddress", "shippingCity", "shippingState",
          "shippingPostalCode", "shippingCountry",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, 100.00, 18.00, 0, 50.00, 168.00,
          'delivered', 'paid', $2, $3,
          'Test Customer', 'customer@test.com', '+1234567890',
          '123 Test St', 'Test City', 'Test State',
          '12345', 'India',
          NOW(), NOW()
        ) RETURNING id
      `, [orderNumber, vendorId, customerId]);

      const orderId = orderResult.rows[0].id;
      console.log(`✅ Created order: ${orderNumber} (${orderId})`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Successfully created 3 test orders!');
    console.log('📋 All orders have status="delivered" and payment_status="paid"');
    console.log('🎯 Now you can run Auto-Generate Invoices');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestOrders();
