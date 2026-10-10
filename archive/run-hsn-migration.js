const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    user: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully');

    const sqlFile = path.join(__dirname, 'src', 'migrations', 'create-hsn-codes-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Running HSN codes migration...');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await client.query(statement);
      }
    }
    
    console.log('✅ HSN codes migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
