const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'marketplace',
  user: 'postgres',
  password: 'admin123',
});

async function getOrderDirect(orderId) {
  try {
    const orderQuery = `
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'productName', oi.product_name,
            'productSku', oi.product_sku,
            'quantity', oi.quantity,
            'price', oi.price,
            'subtotal', oi.subtotal,
            'total', oi.total
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = $1
      GROUP BY o.id
    `;
    
    const result = await pool.query(orderQuery, [orderId]);
    
    if (result.rows.length > 0) {
      console.log('✅ Order found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
      return result.rows[0];
    } else {
      console.log('❌ Order not found');
      return null;
    }
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

// Get order ID from command line
const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node get-order-direct.js <order-id>');
  process.exit(1);
}

getOrderDirect(orderId);
