#!/usr/bin/env node

/**
 * Drop All Tables - Render First-Time Setup
 * WARNING: This deletes ALL data in the database!
 */

const { Client } = require('pg');

async function dropAllTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🗑️  Connecting to database...');
    await client.connect();
    
    console.log('⚠️  WARNING: Dropping all tables!');
    
    // Drop all tables in public schema
    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ All tables dropped successfully');
    
    await client.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error dropping tables:', error.message);
    try {
      await client.end();
    } catch (e) {}
    process.exit(1);
  }
}

dropAllTables();
