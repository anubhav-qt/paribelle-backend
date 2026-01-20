#!/usr/bin/env node

/**
 * Production Migration Runner
 * Runs compiled migrations from dist folder
 */

const { AppDataSource } = require('./dist/database/data-source');

async function runMigrations() {
  console.log('🔧 Initializing database connection...');
  
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
    
    console.log('🔄 Running pending migrations...');
    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`✅ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`  - ${migration.name}`);
      });
    }
    
    await AppDataSource.destroy();
    console.log('✅ Migration process completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
