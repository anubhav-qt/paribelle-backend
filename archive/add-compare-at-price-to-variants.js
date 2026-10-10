const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'marketplace',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function addCompareAtPriceColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Adding compareAtPrice column to product_variants table...');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'product_variants' 
      AND column_name = 'compareAtPrice'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ compareAtPrice column already exists');
      return;
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE product_variants 
      ADD COLUMN IF NOT EXISTS "compareAtPrice" DECIMAL(10,2) NULL
    `);
    
    console.log('✅ compareAtPrice column added successfully');
    
    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'product_variants' 
      AND column_name = 'compareAtPrice'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Column verified:', verifyResult.rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Error adding compareAtPrice column:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addCompareAtPriceColumn()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
