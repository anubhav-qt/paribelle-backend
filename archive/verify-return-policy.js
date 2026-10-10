const { Client } = require('pg');
require('dotenv').config();

async function verifyReturnPolicy() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    
    // Check vendors
    const vendors = await client.query(`
      SELECT id, store_name, return_policy_days, allow_returns 
      FROM vendors 
      LIMIT 5;
    `);
    console.log('✅ Vendors with return policy:');
    console.table(vendors.rows);

    // Check platform settings
    const settings = await client.query(`
      SELECT id, default_return_policy_days, allow_vendor_custom_return_policy 
      FROM platform_settings 
      LIMIT 1;
    `);
    console.log('\n✅ Platform settings:');
    console.table(settings.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

verifyReturnPolicy();
