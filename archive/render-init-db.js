#!/usr/bin/env node

/**
 * Initialize Database for Render - SQL-based approach with SSL support
 * Faster and more reliable than TypeORM synchronization
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  console.log('🗄️  Initializing database with SQL script...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Create client with SSL support for cloud databases (Neon, Render, etc.)
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Neon and most cloud PostgreSQL providers
    }
  });

  try {
    console.log('🔗 Connecting to database with SSL...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Check if tables already exist
    console.log('🔍 Checking if database is already initialized...');
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(tableCheck.rows[0].count);
    
    if (tableCount > 0) {
      console.log(`⚠️  Database already has ${tableCount} tables`);
      console.log('   Skipping initialization (use render:drop first if you want to reset)');
      await client.end();
      process.exit(0);
    }

    // Read and execute SQL file
    console.log('📄 Reading SQL initialization script...');
    const sqlPath = path.join(__dirname, 'initialsetup', 'init-database.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ SQL file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remove database creation commands (Render already provides the database)
    const cleanSQL = sql
      .replace(/CREATE DATABASE.*?;/gi, '')
      .replace(/\\c\s+\w+;/gi, ''); // Remove \c database commands
    
    console.log('🚀 Executing SQL script...');
    console.log('   This may take 30-60 seconds...');
    
    // Execute the SQL (it's one large script)
    await client.query(cleanSQL);
    
    console.log('✅ Database initialized successfully');
    
    // Verify tables were created
    const verifyCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const newTableCount = parseInt(verifyCheck.rows[0].count);
    console.log(`✅ Created ${newTableCount} tables`);
    
    await client.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('Stack:', error.stack);
    
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
    
    process.exit(1);
  }
}

initDatabase();
