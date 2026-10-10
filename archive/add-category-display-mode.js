const { Client } = require('pg');
require('dotenv').config();

async function addCategoryDisplayMode() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add categoryDisplayMode column to vendors table
    const addColumnQuery = `
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS "categoryDisplayMode" VARCHAR(10) DEFAULT 'sidebar';
    `;
    
    await client.query(addColumnQuery);
    console.log('✅ Column categoryDisplayMode added to vendors table');

    // Verify the column was added
    const verifyQuery = `
      SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_name = 'vendors' AND column_name = 'categoryDisplayMode';
    `;
    
    const result = await client.query(verifyQuery);
    console.log('Verification:', result.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

addCategoryDisplayMode();
