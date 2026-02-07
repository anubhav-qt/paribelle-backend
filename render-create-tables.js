#!/usr/bin/env node

/**
 * Create Tables from TypeORM Entities - Render First-Time Setup
 * Creates all tables based on entity definitions
 */

const { execSync } = require('child_process');

async function createTables() {
  console.log('🏗️  Creating database tables from entities...');
  
  try {
    // Use TypeORM synchronize to create tables
    execSync('npx ts-node -r tsconfig-paths/register src/scripts/create-tables.ts', {
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
