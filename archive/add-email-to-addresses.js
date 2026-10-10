const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

async function addEmailColumn() {
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'addresses' AND column_name = 'email'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Email column already exists in addresses table');
      return;
    }
    
    // Add email column
    await client.query(`
      ALTER TABLE addresses
      ADD COLUMN email VARCHAR(255)
    `);
    
    console.log('✅ Successfully added email column to addresses table');
    
    // Show updated table structure
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'addresses'
      ORDER BY ordinal_position
    `);
    
    console.log('\nUpdated addresses table structure:');
    console.table(columnsResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

addEmailColumn();
