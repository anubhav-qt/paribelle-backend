#!/usr/bin/env node

/**
 * Check if admin user exists in production database
 */

const { AppDataSource } = require('./dist/database/data-source');

async function checkAdmin() {
  console.log('🔍 Checking for admin user...');
  
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');
    
    const userRepository = AppDataSource.getRepository('User');
    const admin = await userRepository.findOne({ 
      where: { email: 'ajaniljoshijobs@gmail.com' } 
    });
    
    if (admin) {
      console.log('✅ Admin user EXISTS');
      console.log('   Email:', admin.email);
      console.log('   Role:', admin.role);
      console.log('   Email Verified:', admin.emailVerifiedAt ? 'YES' : 'NO');
      console.log('   Status:', admin.status);
    } else {
      console.log('❌ Admin user DOES NOT EXIST');
      console.log('   You need to run: npm run seed');
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAdmin();
