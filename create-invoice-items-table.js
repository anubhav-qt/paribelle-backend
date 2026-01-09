const { Client } = require('pg');
const fs = require('fs');

async function createTable() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'marketplace',
    user: 'postgres',
    password: 'marketplace',
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const sql = fs.readFileSync('add-invoice-items-table.sql', 'utf8');
    await client.query(sql);
    
    console.log('✅ invoice_items table created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createTable();
