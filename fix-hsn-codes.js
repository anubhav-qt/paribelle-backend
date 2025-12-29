const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read and execute the migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'fix-hsn-codes-null-values.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Running migration: fix-hsn-codes-null-values.sql');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully');

    // Verify the fix
    const result = await client.query('SELECT COUNT(*) as count FROM hsn_codes WHERE code IS NULL');
    console.log(`✅ Verified: ${result.rows[0].count} rows with null code (should be 0)`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
