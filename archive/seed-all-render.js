#!/usr/bin/env node

/**
 * Render Production Seed Script
 * Seeds the database with admin user + all product types
 * Run this on Render deployment to populate the database
 */

const { execSync } = require('child_process');

console.log('🌱 ========================================');
console.log('🌱 Starting Render Database Seeding');
console.log('🌱 ========================================\n');

const seeds = [
  { name: 'Admin User & Platform Settings', script: 'dist/database/seed-runner.js' },
  { name: 'Platform Settings', script: 'seed-platform-settings.js' },
  { name: 'Custom Pages', script: 'seed-custom-pages.js' },
  { name: 'Physical Products', script: 'seed-physical-products.js' },
  { name: 'Tour Products', script: 'seed-tour-products.js' },
  { name: 'Service Products', script: 'seed-service-products.js' }
];

let successful = 0;
let failed = 0;

for (const seed of seeds) {
  console.log(`\n📦 Seeding: ${seed.name}...`);
  try {
    execSync(`node ${seed.script}`, { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    console.log(`✅ ${seed.name} seeded successfully`);
    successful++;
  } catch (error) {
    console.warn(`⚠️  ${seed.name} seeding failed (may already exist): ${error.message}`);
    failed++;
    // Continue with other seeds even if one fails
  }
}

console.log('\n🌱 ========================================');
console.log(`🌱 Seeding Summary: ${successful} succeeded, ${failed} skipped/failed`);
console.log('🌱 ========================================\n');

// Don't exit with error code - allow app to start even if some seeds fail
process.exit(0);
