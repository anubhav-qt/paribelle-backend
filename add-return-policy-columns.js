const { Client } = require('pg');
require('dotenv').config();

async function addReturnPolicyColumns() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add columns to vendors table
    console.log('Adding return policy columns to vendors table...');
    await client.query(`
      ALTER TABLE vendors 
      ADD COLUMN IF NOT EXISTS return_policy_days INTEGER DEFAULT 7,
      ADD COLUMN IF NOT EXISTS allow_returns BOOLEAN DEFAULT true;
    `);

    // Update existing vendors
    const vendorResult = await client.query(`
      UPDATE vendors 
      SET return_policy_days = 7, allow_returns = true 
      WHERE return_policy_days IS NULL OR allow_returns IS NULL
      RETURNING id, store_name, return_policy_days, allow_returns;
    `);
    console.log(`✅ Updated ${vendorResult.rowCount} vendors with default return policy`);

    // Add columns to platform_settings table
    console.log('Adding return policy columns to platform_settings table...');
    await client.query(`
      ALTER TABLE platform_settings 
      ADD COLUMN IF NOT EXISTS default_return_policy_days INTEGER DEFAULT 7,
      ADD COLUMN IF NOT EXISTS allow_vendor_custom_return_policy BOOLEAN DEFAULT true;
    `);

    // Update existing platform settings
    const settingsResult = await client.query(`
      UPDATE platform_settings 
      SET default_return_policy_days = 7, allow_vendor_custom_return_policy = true 
      WHERE default_return_policy_days IS NULL OR allow_vendor_custom_return_policy IS NULL
      RETURNING id, default_return_policy_days, allow_vendor_custom_return_policy;
    `);
    console.log(`✅ Updated ${settingsResult.rowCount} platform settings with default return policy`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Vendors can now set custom return policies in their dashboard');
    console.log('2. Platform admin can configure default return policy in settings');
    console.log('3. Return button will be disabled based on vendor-specific policies');

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

addReturnPolicyColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
