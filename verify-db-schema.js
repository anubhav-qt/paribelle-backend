#!/usr/bin/env node

/**
 * Verify Database Schema - Check all required columns exist
 */

const { Client } = require('pg');

async function verifySchema() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    console.log('🔍 Connecting to database...');
    await client.connect();
    
    console.log('✅ Connected');
    console.log('\n📋 Checking critical columns...\n');
    
    const checks = [
      { table: 'vendors', column: 'city_id', description: 'Vendor location (city)' },
      { table: 'vendors', column: 'sub_location_id', description: 'Vendor location (sub)' },
      { table: 'categories', column: 'vendor_id', description: 'Category vendor relation' },
      { table: 'users', column: 'email_verified_at', description: 'Email verification' },
      { table: 'users', column: 'first_name', description: 'User first name' },
      { table: 'products', column: 'vendor_id', description: 'Product vendor relation' },
    ];
    
    let allGood = true;
    
    for (const check of checks) {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.column]);
      
      if (result.rows.length > 0) {
        console.log(`✅ ${check.table}.${check.column} - ${result.rows[0].data_type}`);
      } else {
        console.log(`❌ ${check.table}.${check.column} - MISSING!`);
        allGood = false;
      }
    }
    
    console.log('\n📊 Checking data...\n');
    
    // Check users
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`Users: ${usersResult.rows[0].count}`);
    
    // Check products
    const productsResult = await client.query('SELECT COUNT(*) as count FROM products');
    console.log(`Products: ${productsResult.rows[0].count}`);
    
    // Check categories
    const categoriesResult = await client.query('SELECT COUNT(*) as count FROM categories');
    console.log(`Categories: ${categoriesResult.rows[0].count}`);
    
    // Check vendors
    const vendorsResult = await client.query('SELECT COUNT(*) as count FROM vendors');
    console.log(`Vendors: ${vendorsResult.rows[0].count}`);
    
    // Check admin user
    console.log('\n🔐 Checking admin user...\n');
    const adminResult = await client.query(`
      SELECT email, first_name, last_name, role, status, email_verified_at 
      FROM users 
      WHERE email = 'admin@marketplace.com'
    `);
    
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log('✅ Admin user exists:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Verified: ${admin.email_verified_at ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log('❌ Admin user NOT found!');
      allGood = false;
    }
    
    await client.end();
    
    if (allGood) {
      console.log('\n✅ All checks passed! Ready to deploy to Render.');
      process.exit(0);
    } else {
      console.log('\n❌ Some checks failed. Review the issues above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

verifySchema();
