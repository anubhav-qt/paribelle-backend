#!/usr/bin/env node
console.log('======================================');
console.log('🚀 Production Startup Wrapper');
console.log('======================================');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('Environment:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET');
console.log('======================================\n');

// Check if dist/main.js exists
const fs = require('fs');
const path = require('path');

// Try multiple possible locations for dist/main.js
const possiblePaths = [
  path.join(process.cwd(), 'dist', 'main.js'),           // Current directory
  path.join(__dirname, 'dist', 'main.js'),               // Same as script location
  path.join(process.cwd(), '..', 'dist', 'main.js'),     // Parent directory
];

let mainPath = null;
for (const checkPath of possiblePaths) {
  console.log('Checking for main.js at:', checkPath);
  if (fs.existsSync(checkPath)) {
    mainPath = checkPath;
    console.log('✅ dist/main.js found at:', mainPath);
    break;
  }
}

if (!mainPath) {
  console.error('❌ FATAL: dist/main.js does not exist in any expected location!');
  console.error('Checked locations:');
  possiblePaths.forEach(p => console.error('  -', p));
  console.error('Build may have failed. Check build logs.');
  console.error('\n📂 Current directory contents:');
  console.error(fs.readdirSync(process.cwd()));
  process.exit(1);
}

console.log('📦 File size:', fs.statSync(mainPath).size, 'bytes');
console.log('\n🔵 Loading application...\n');

// Load the main application
try {
  require(mainPath);
} catch (error) {
  console.error('\n❌ FATAL ERROR loading application:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\n🔍 This is a missing module error.');
    console.error('Missing module:', error.message);
  }
  
  process.exit(1);
}
