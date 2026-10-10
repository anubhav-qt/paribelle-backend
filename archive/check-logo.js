const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkLogo() {
  try {
    const result = await pool.query("SELECT key, value FROM settings WHERE key = 'marketplace_logo'");
    console.log('Logo setting:', JSON.stringify(result.rows, null, 2));
    
    const nameResult = await pool.query("SELECT key, value FROM settings WHERE key = 'marketplace_name'");
    console.log('Name setting:', JSON.stringify(nameResult.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkLogo();
