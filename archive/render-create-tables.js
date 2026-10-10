#!/usr/bin/env node

/**
 * Create Tables from TypeORM Entities - Render First-Time Setup
 * Creates all tables based on entity definitions
 */

const { execSync } = require('child_process');

async function createTables() {
  console.log('🏗️  Creating database tables from entities...');
  
  try {
    // Use compiled JavaScript from dist folder
    execSync('node dist/scripts/create-tables.js', {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    console.log('✅ Tables created successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  }
}

createTables();
