#!/usr/bin/env node

/**
 * Production Seed Runner
 * Seeds the database with initial admin user
 */

const { execSync } = require('child_process');

async function runSeed() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Run the TypeScript seed file using ts-node
    execSync('node -r ts-node/register -r tsconfig-paths/register src/database/seed-runner.ts', {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    console.log('✅ Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runSeed();
