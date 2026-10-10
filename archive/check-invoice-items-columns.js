const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'root',
  database: 'marketplace',
});

async function checkColumns() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'invoice_items'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 invoice_items table columns:');
    console.log('==================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkColumns();
