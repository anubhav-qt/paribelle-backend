#!/usr/bin/env node

/**
 * Initialize Database for Render - SQL-based approach
 * Faster and more reliable than TypeORM synchronization
 */

const { execSync } = require('child_process');

async function initDatabase() {
  console.log('🗄️  Initializing database with SQL script...');
  
  try {
    // Use the existing init-database.js which reads SQL file
    execSync('node initialsetup/init-database.js', {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        SKIP_CREATE_DB: 'true' // Skip CREATE DATABASE command on Render
      }
    });
    
    console.log('✅ Database initialized successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

initDatabase();
