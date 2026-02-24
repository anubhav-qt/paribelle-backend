#!/usr/bin/env node

/**
 * Seed Admin User - Render First-Time Setup
 * Creates the super admin user for the marketplace
 */

const { execSync } = require('child_process');

async function seedAdmin() {
  console.log('👤 Creating admin user...');
  
  try {
    // Run the compiled JavaScript from dist folder
    execSync('node dist/scripts/seed-admin.js', {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    console.log('✅ Admin user seeded successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    process.exit(1);
  }
}

seedAdmin();
