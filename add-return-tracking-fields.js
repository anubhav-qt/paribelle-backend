const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addReturnTrackingFields() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Add return tracking fields to orders table...');
    
    // Add return approval timestamp
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP NULL;
    `);
    console.log('✓ Added return_approved_at column');
    
    // Add return rejection timestamp
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_rejected_at TIMESTAMP NULL;
    `);
    console.log('✓ Added return_rejected_at column');
    
    // Add return rejection reason
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_rejection_reason TEXT NULL;
    `);
    console.log('✓ Added return_rejection_reason column');
    
    // Add comments
    await client.query(`
      COMMENT ON COLUMN orders.return_approved_at IS 'Timestamp when return request was approved by admin';
      COMMENT ON COLUMN orders.return_rejected_at IS 'Timestamp when return request was rejected by admin';
      COMMENT ON COLUMN orders.return_rejection_reason IS 'Admin reason for rejecting the return request';
    `);
    console.log('✓ Added column comments');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addReturnTrackingFields();
