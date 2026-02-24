#!/usr/bin/env node

/**
 * Check Admin User Login Credentials
 * Verifies admin user exists and password is correct
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function checkAdmin() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
  }
  
  console.log('🔗 DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000, // 10 second timeout
  });

  try {
    console.log('🔍 Connecting to database...');
    console.log('   Using SSL connection...');
    console.log('   Timeout: 10 seconds');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('\n📧 Checking admin user: ajaniljoshijobs@gmail.com');
    
    const result = await client.query(
      `SELECT id, email, "firstName", "lastName", role, status, 
              "emailVerifiedAt", password 
       FROM users 
       WHERE email = $1`,
      ['ajaniljoshijobs@gmail.com']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Admin user NOT found in database!');
      console.log('   Run: npm run seed');
      await client.end();
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('✅ Admin user found!');
    console.log('   ID:', user.id);
    console.log('   Name:', `${user.firstName} ${user.lastName}`);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Email Verified:', user.emailVerifiedAt ? '✅ Yes' : '❌ No');
    
    if (!user.emailVerifiedAt) {
      console.log('\n⚠️  EMAIL NOT VERIFIED!');
      console.log('   Fixing now...');
      await client.query(
        `UPDATE users SET "emailVerifiedAt" = NOW() WHERE id = $1`,
        [user.id]
      );
      console.log('   ✅ Email marked as verified');
    }
    
    // Test password
    console.log('\n🔐 Testing password: Admin@123');
    const passwordMatch = await bcrypt.compare('Admin@123', user.password);
    
    if (passwordMatch) {
      console.log('   ✅ Password matches!');
    } else {
      console.log('   ❌ Password does NOT match!');
      console.log('   Resetting password to: Admin@123');
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      await client.query(
        `UPDATE users SET password = $1 WHERE id = $2`,
        [hashedPassword, user.id]
      );
      console.log('   ✅ Password reset successfully');
    }
    
    console.log('\n✅ Admin credentials are now valid:');
    console.log('   Email:    ajaniljoshijobs@gmail.com');
    console.log('   Password: Admin@123');
    
    await client.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    console.error('Full error:', JSON.stringify(error, null, 2));
    
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
    process.exit(1);
  }
}

checkAdmin();
