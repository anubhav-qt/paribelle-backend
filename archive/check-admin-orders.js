const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'marketplace',
});

async function checkOrders() {
  try {
    console.log('=== Checking Recent Orders ===\n');
    
    // Get recent orders
    const ordersResult = await pool.query(`
      SELECT o.id, o.order_number, o.user_id, o.vendor_id, o.status, o.total, o.created_at,
             u.email as user_email, u.role as user_role
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${ordersResult.rows.length} recent orders:\n`);
    
    ordersResult.rows.forEach((order, index) => {
      console.log(`${index + 1}. Order ${order.order_number}`);
      console.log(`   User: ${order.user_email} - Role: ${order.user_role}`);
      console.log(`   User ID: ${order.user_id}`);
      console.log(`   Total: ₹${order.total}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Created: ${order.created_at}`);
      console.log('');
    });
    
    // Check if there are any admin users
    console.log('\n=== Admin/Super Admin Users ===\n');
    const adminsResult = await pool.query(`
      SELECT id, email, role
      FROM users
      WHERE role = 'super_admin'
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${adminsResult.rows.length} admin users:\n`);
    adminsResult.rows.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.email} - Role: ${admin.role} - ID: ${admin.id}`);
    });
    
    // Check orders for each admin
    if (adminsResult.rows.length > 0) {
      console.log('\n=== Orders by Admin Users ===\n');
      for (const admin of adminsResult.rows) {
        const adminOrdersResult = await pool.query(`
          SELECT order_number, status, total, created_at
          FROM orders
          WHERE user_id = $1
          ORDER BY created_at DESC
        `, [admin.id]);
        
        console.log(`${admin.email}: ${adminOrdersResult.rows.length} orders`);
        if (adminOrdersResult.rows.length > 0) {
          adminOrdersResult.rows.forEach(order => {
            console.log(`  - ${order.order_number}: ₹${order.total} (${order.status}) - ${order.created_at}`);
          });
        }
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkOrders();
