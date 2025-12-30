const { Client } = require('pg');
require('dotenv').config();

async function checkTable() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    user: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'hsn_codes'
      ORDER BY ordinal_position
    `);
    
    console.log('HSN Codes table columns:');
    console.table(result.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTable();
