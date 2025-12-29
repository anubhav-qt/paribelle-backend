// Run GST and Invoice Fields Migration
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_DATABASE || 'marketplace',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add-gst-invoice-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: add-gst-invoice-fields.sql');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully');
    
    // Verify columns
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('hsnCode', 'gstRate', 'priceType', 'hasVariants')
    `);
    
    console.log('\n✅ Verified new product columns:', result.rows.map(r => r.column_name));
    
    const hsnCount = await client.query('SELECT COUNT(*) FROM hsn_codes');
    console.log(`✅ HSN codes master table has ${hsnCount.rows[0].count} entries`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
