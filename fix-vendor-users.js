const { Client } = require('pg');
require('dotenv').config();

async function fixVendorUsers() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'marketplace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Fix vendor admin users without vendorId
    const updateResult = await client.query(`
      UPDATE users 
      SET vendor_id = vendors.id
      FROM vendors
      WHERE users.id = vendors.user_id
        AND users.role = 'vendor_admin'
        AND users.vendor_id IS NULL
    `);

    console.log(`✅ Fixed ${updateResult.rowCount} vendor admin users`);

    // Verify the fix
    const verifyResult = await client.query(`
      SELECT 
        u.id as user_id,
        u.email,
        u.role,
        u.vendor_id,
        v.id as vendor_id_from_vendors,
        v.store_name
      FROM users u
      LEFT JOIN vendors v ON u.id = v.user_id
      WHERE u.role = 'vendor_admin'
      ORDER BY u.created_at DESC
    `);

    console.log('\n📊 Vendor Admin Users Status:');
    console.table(verifyResult.rows);

    await client.end();
    console.log('\n✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

fixVendorUsers();
