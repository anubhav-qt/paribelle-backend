const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

async function checkInvoices() {
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Check recent orders
    const ordersResult = await client.query(`
      SELECT id, order_number, status, payment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('Recent Orders:');
    console.table(ordersResult.rows);
    
    // Check invoices for these orders
    const invoicesResult = await client.query(`
      SELECT i.id, i.invoice_number, i.type, i.status, o.order_number
      FROM invoices i
      JOIN orders o ON i.order_id = o.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `);
    
    console.log('\nRecent Invoices:');
    console.table(invoicesResult.rows);
    
    // Check if delivered order has invoice
    const deliveredCheck = await client.query(`
      SELECT o.id, o.order_number, o.status, 
             COUNT(i.id) as invoice_count
      FROM orders o
      LEFT JOIN invoices i ON i.order_id = o.id
      WHERE o.status = 'delivered'
      GROUP BY o.id, o.order_number, o.status
    `);
    
    console.log('\nDelivered Orders with Invoice Count:');
    console.table(deliveredCheck.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkInvoices();
