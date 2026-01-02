/**
 * Script to fix settings values that have been double-quoted
 * This removes extra quotes from string values in the settings table
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function fixQuotedSettings() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking for settings with quoted values...');
    
    // Get all settings
    const result = await client.query('SELECT id, key, value FROM settings');
    
    let fixedCount = 0;
    
    for (const row of result.rows) {
      const { id, key, value } = row;
      
      // Check if value is a string that starts and ends with quotes
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"') && value.length > 2) {
        try {
          // Parse the JSON string to remove quotes
          const parsed = JSON.parse(value);
          
          // Only update if it's now a simple string (not an object or array)
          if (typeof parsed === 'string') {
            await client.query(
              'UPDATE settings SET value = $1 WHERE id = $2',
              [parsed, id]
            );
            console.log(`✅ Fixed setting: ${key}`);
            console.log(`   Old value: ${value}`);
            console.log(`   New value: ${parsed}`);
            fixedCount++;
          }
        } catch (e) {
          // Skip if parsing fails
          console.log(`⚠️  Could not parse setting: ${key}`);
        }
      }
    }
    
    if (fixedCount > 0) {
      console.log(`\n✨ Fixed ${fixedCount} setting(s) with quoted values`);
    } else {
      console.log('\n✅ No settings needed fixing - all values are clean!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing settings:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
fixQuotedSettings()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
