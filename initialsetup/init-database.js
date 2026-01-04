#!/usr/bin/env node

/**
 * ============================================================
 * Marketplace Backend Database Initialization Script (Node.js)
 * ============================================================
 * This Node.js script initializes the database for first-time deployment
 * ============================================================
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

// Helper function to print colored text
function print(text, color = 'white') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

// Parse DATABASE_URL if provided (Render/Heroku style)
let parsedConfig = {};
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    parsedConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  } catch (error) {
    console.error('Warning: Could not parse DATABASE_URL:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  host: process.env.DB_HOST || parsedConfig.host || 'localhost',
  port: parseInt(process.env.DB_PORT || parsedConfig.port || '5432'),
  user: process.env.DB_USERNAME || parsedConfig.user || 'admin',
  password: process.env.DB_PASSWORD || parsedConfig.password || 'admin',
  database: process.env.DB_DATABASE || parsedConfig.database || 'marketplace',
  createDatabase: args.includes('--create-database') || args.includes('-c'),
};

// Override with command line arguments if provided
args.forEach((arg, index) => {
  if (arg === '--host' && args[index + 1]) config.host = args[index + 1];
  if (arg === '--port' && args[index + 1]) config.port = parseInt(args[index + 1]);
  if (arg === '--user' && args[index + 1]) config.user = args[index + 1];
  if (arg === '--password' && args[index + 1]) config.password = args[index + 1];
  if (arg === '--database' && args[index + 1]) config.database = args[index + 1];
});

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Marketplace Database Initialization Script

Usage:
  node init-database.js [options]

Options:
  --host <host>         Database host (default: localhost or DB_HOST from .env)
  --port <port>         Database port (default: 5432 or DB_PORT from .env)
  --user <user>         Database user (default: admin or DB_USERNAME from .env)
  --password <password> Database password (default: admin or DB_PASSWORD from .env)
  --database <database> Database name (default: marketplace or DB_DATABASE from .env)
  --create-database, -c Create database if it doesn't exist
  --force, -f           Force reinitialization (drops existing tables)
  --help, -h            Show this help message

Environment Variables:
  You can also set configuration via .env file:
  DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
  
  Or use DATABASE_URL (Render/Heroku style):
  DATABASE_URL=postgresql://user:pass@host:port/database

Examples:
  node init-database.js
  node init-database.js --create-database
  node init-database.js --force --create-database
  node init-database.js --host localhost --user admin --password secret --database marketplace -c

Notes:
  - Script will skip initialization if tables already exist (safe for CI/CD)
  - Use --force to drop and recreate all tables (WARNING: data loss!)
  - Perfect for Render, Heroku, Railway, and other PaaS platforms
`);
  process.exit(0);
}

async function createDatabase() {
  console.log('\n========================================');
  console.log('🚀 Marketplace Database Initialization');
  console.log('========================================\n');
  
  print('\n========================================', 'cyan');
  print('🚀 Marketplace Database Initialization', 'cyan');
  print('========================================\n', 'cyan');

  print('📋 Configuration:', 'white');
  print(`   Host: ${config.host}`, 'gray');
  print(`   Port: ${config.port}`, 'gray');
  print(`   User: ${config.user}`, 'gray');
  print(`   Database: ${config.database}`, 'gray');
  console.log('');

  // Create database if requested
  if (config.createDatabase) {
    print(`🏗️  Creating database '${config.database}'...`, 'yellow');
    
    const client = new Client({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: 'postgres', // Connect to default postgres database
    });

    try {
      await client.connect();
      await client.query(`CREATE DATABASE ${config.database}`);
      print('✅ Database created successfully!', 'green');
      await client.end();
    } catch (error) {
      if (error.code === '42P04') {
        print('⚠️  Database already exists.', 'yellow');
        print('   Continuing with initialization...', 'gray');
      } else {
        print('❌ Failed to create database!', 'red');
        print(`   Error: ${error.message}`, 'red');
        process.exit(1);
      }
    }
    console.log('');
  }

  // Check database connection
  print('🔍 Checking database connection...', 'yellow');
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    print('✅ Database connection successful!', 'green');
    console.log('');
  } catch (error) {
    print(`❌ Cannot connect to database '${config.database}'`, 'red');
    print(`   Error: ${error.message}`, 'red');
    if (!config.createDatabase) {
      print('   Try running with --create-database flag to create it.', 'yellow');
    }
    process.exit(1);
  }

  // Check if tables already exist (skip if database is already initialized)
  print('🔍 Checking if database is already initialized...', 'yellow');
  try {
    const checkTables = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `);
    
    const tableCount = parseInt(checkTables.rows[0].count);
    
    if (tableCount > 0) {
      print(`⚠️  Database already has ${tableCount} tables`, 'yellow');
      print('   Skipping initialization to prevent data loss.', 'gray');
      console.log('');
      
      if (args.includes('--force') || args.includes('-f')) {
        print('🔥 --force flag detected. Proceeding with reinitialization...', 'yellow');
        print('⚠️  WARNING: This will DROP all existing tables!', 'red');
        console.log('');
      } else {
        print('✅ Database is already initialized. Nothing to do!', 'green');
        console.log('');
        print('💡 Tip: Use --force flag to reinitialize (will drop all data)', 'gray');
        await client.end();
        process.exit(0);
      }
    } else {
      print('✅ Database is empty. Proceeding with initialization...', 'green');
      console.log('');
    }
  } catch (error) {
    print('⚠️  Could not check existing tables. Proceeding anyway...', 'yellow');
    console.log('');
  }

  // Read and execute SQL script
  const scriptPath = path.join(__dirname, 'init-database.sql');
  
  if (!fs.existsSync(scriptPath)) {
    print(`❌ SQL script not found: ${scriptPath}`, 'red');
    await client.end();
    process.exit(1);
  }

  print('🔧 Running database initialization script...', 'yellow');
  print(`   Script: ${scriptPath}`, 'gray');
  console.log('');

  try {
    const sqlScript = fs.readFileSync(scriptPath, 'utf8');
    
    // Execute the main SQL script
    await client.query(sqlScript);
    
    // Add password reset fields migration
    print('🔧 Adding password reset fields...', 'yellow');
    const passwordResetPath = path.join(__dirname, '..', 'add-password-reset-fields.sql');
    if (fs.existsSync(passwordResetPath)) {
      const passwordResetSql = fs.readFileSync(passwordResetPath, 'utf8');
      await client.query(passwordResetSql);
      print('✅ Password reset fields added', 'green');
    } else {
      // Fallback: inline SQL
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
        ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;
        
        CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
      `);
      print('✅ Password reset fields added (inline)', 'green');
    }
    console.log('');
    
    // Add default marketplace pages (Privacy, Terms)
    print('🔧 Creating default marketplace pages...', 'yellow');
    await client.query(`
      INSERT INTO marketplace_pages (title, slug, page_type, content, status, show_in_navigation)
      VALUES 
        (
          'Privacy Policy',
          'privacy-policy',
          'privacy',
          E'# Privacy Policy\\n\\n**Last Updated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\\n\\n## 1. Introduction\\n\\nWelcome to our marketplace. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.\\n\\n## 2. Information We Collect\\n\\nWe collect information that you provide directly to us, including:\\n\\n- Name, email address, and contact information\\n- Billing and shipping addresses\\n- Payment information (processed securely)\\n- Account credentials and profile information\\n- Communications with customer support\\n- Reviews, ratings, and feedback\\n\\n## 3. How We Use Your Information\\n\\nWe use the information we collect to:\\n\\n- Process and fulfill your orders\\n- Provide customer service and support\\n- Send order confirmations and updates\\n- Personalize your shopping experience\\n- Improve our products and services\\n- Detect and prevent fraud\\n\\n## 4. Contact Us\\n\\nIf you have questions about this Privacy Policy, please contact us.',
          'published',
          true
        ),
        (
          'Terms of Service',
          'terms-of-service',
          'terms',
          E'# Terms of Service\\n\\n**Last Updated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\\n\\n## 1. Acceptance of Terms\\n\\nBy accessing and using this marketplace platform, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms of Service, please do not use our services.\\n\\n## 2. Use of the Platform\\n\\n### 2.1 Eligibility\\n\\nYou must be at least 18 years old to use our services. By using our platform, you represent and warrant that you meet this age requirement.\\n\\n### 2.2 Account Registration\\n\\nTo access certain features, you may be required to create an account. You agree to:\\n\\n- Provide accurate, current, and complete information\\n- Maintain the security of your password\\n- Accept responsibility for all activities under your account\\n- Notify us immediately of any unauthorized access\\n\\n## 3. Purchases and Payments\\n\\nWhen you place an order through our marketplace, you agree to pay all charges at the prices then in effect. All payments are processed securely through our payment providers.\\n\\n## 4. Contact Us\\n\\nIf you have questions about these Terms of Service, please contact us.',
          'published',
          true
        )
      ON CONFLICT (slug) DO NOTHING;
    `);
    print('✅ Default marketplace pages created', 'green');
    console.log('');
    
    print('========================================', 'green');
    print('✅ Database Initialization Complete!', 'green');
    print('========================================', 'green');
    console.log('');
    
    print('📊 Database schema created successfully with:', 'white');
    print('   ✓ Core tables (users, categories, addresses)', 'gray');
    print('   ✓ Vendor tables (vendors, pages, blog posts)', 'gray');
    print('   ✓ Product tables (products, variants)', 'gray');
    print('   ✓ Order tables (orders, order items, payments)', 'gray');
    print('   ✓ Invoice tables (invoices, invoice items)', 'gray');
    print('   ✓ Review tables (product & vendor reviews)', 'gray');
    print('   ✓ Settings tables (platform, homepage, footer)', 'gray');
    print('   ✓ Location tables (cities, sub-locations)', 'gray');
    print('   ✓ Performance indexes', 'gray');
    console.log('');
    
    print('📝 Next steps:', 'cyan');
    print('   1. Update .env file with database credentials:', 'white');
    print(`      DB_HOST=${config.host}`, 'gray');
    print(`      DB_PORT=${config.port}`, 'gray');
    print(`      DB_USERNAME=${config.user}`, 'gray');
    print('      DB_PASSWORD=your_password', 'gray');
    print(`      DB_DATABASE=${config.database}`, 'gray');
    console.log('');
    print('   2. (Optional) Seed initial data:', 'white');
    print('      npm run seed', 'gray');
    console.log('');
    print('   3. Start your backend server:', 'white');
    print('      npm run dev', 'gray');
    console.log('');
    
    print('🎉 Setup complete! Your marketplace is ready to launch!', 'green');
    console.log('');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    print('❌ Database initialization failed!', 'red');
    print(`   Error: ${error.message}`, 'red');
    
    if (error.position) {
      const lines = sqlScript.split('\n');
      const errorLine = sqlScript.substring(0, error.position).split('\n').length;
      print(`   Near line ${errorLine}:`, 'yellow');
      print(`   ${lines[errorLine - 1]}`, 'gray');
    }
    
    await client.end();
    process.exit(1);
  }

  await client.end();
}

// Run the script
createDatabase().catch(error => {
  console.error('\n❌ FATAL ERROR: Database initialization failed!');
  console.error(`Error: ${error.message}`);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
