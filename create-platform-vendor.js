const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'marketplace',
  user: 'postgres',
  password: 'postgres',
});

async function createPlatformVendor() {
  const client = await pool.connect();
  try {
    // First, get the super admin user
    const userResult = await client.query(
      'SELECT id, email, "firstName", "lastName" FROM users WHERE role = $1 LIMIT 1',
      ['super_admin']
    );
    
    if (userResult.rows.length === 0) {
      console.error('❌ No super admin user found. Please create a super admin user first.');
      return;
    }
    
    const superAdmin = userResult.rows[0];
    console.log('✅ Found super admin user:', superAdmin.email);
    
    // Then create the platform vendor using super admin's ID
    const query = `
      INSERT INTO vendors (
        id,
        "storeName",
        slug,
        description,
        "vendorType",
        status,
        "commissionRate",
        "shippingCost",
        "userId",
        "createdAt",
        "updatedAt"
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Marketplace',
        'marketplace-platform',
        'Official marketplace products managed by administrators',
        'business',
        'active',
        0.00,
        0.00,
        $1,
        NOW(),
        NOW()
      ) ON CONFLICT (id) DO NOTHING
      RETURNING id, "storeName", slug, status;
    `;
    
    const result = await client.query(query, [superAdmin.id]);
    
    if (result.rows.length > 0) {
      console.log('✅ Platform vendor created successfully:');
      console.log(result.rows[0]);
      console.log('');
      console.log('📝 Important: Use this vendor ID in frontend:');
      console.log('   PLATFORM_VENDOR_ID = "00000000-0000-0000-0000-000000000001"');
    } else {
      console.log('ℹ️ Platform vendor already exists, checking...');
      const checkResult = await client.query(
        'SELECT id, "storeName", slug, status, "userId" FROM vendors WHERE id = $1',
        ['00000000-0000-0000-0000-000000000001']
      );
      if (checkResult.rows.length > 0) {
        console.log(checkResult.rows[0]);
        console.log('');
        console.log('📝 Platform vendor is ready to use:');
        console.log('   PLATFORM_VENDOR_ID = "00000000-0000-0000-0000-000000000001"');
      }
    }
  } catch (error) {
    console.error('❌ Error creating platform vendor:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createPlatformVendor();
