const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'admin',
  password: 'admin',
  database: 'marketplace'
});

async function checkDefaultTheme() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query("SELECT key, value FROM settings WHERE key = 'default-theme'");
    
    if (result.rows.length === 0) {
      console.log('No default-theme setting found in database');
    } else {
      console.log('Found default-theme setting:');
      console.log('Key:', result.rows[0].key);
      console.log('Value length:', result.rows[0].value?.length);
      console.log('Value preview:', result.rows[0].value?.substring(0, 100));
      console.log('\nFull value:', result.rows[0].value);
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    await client.end();
  }
}

checkDefaultTheme();
