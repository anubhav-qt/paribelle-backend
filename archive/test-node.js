#!/usr/bin/env node

// Absolute minimal test - no imports, just direct output
process.stdout.write('=== NODE.JS TEST START ===\n');
process.stdout.write(`Node version: ${process.version}\n`);
process.stdout.write(`Platform: ${process.platform}\n`);
process.stdout.write(`Arch: ${process.arch}\n`);
process.stdout.write(`CWD: ${process.cwd()}\n`);
process.stdout.write(`ENV PORT: ${process.env.PORT || 'not set'}\n`);

// Check if dist/main.js exists
const fs = require('fs');
const path = require('path');
const mainPath = path.join(process.cwd(), 'dist', 'main.js');

process.stdout.write(`\nChecking for main.js...\n`);
process.stdout.write(`Path: ${mainPath}\n`);

if (fs.existsSync(mainPath)) {
  const stats = fs.statSync(mainPath);
  process.stdout.write(`✅ dist/main.js EXISTS\n`);
  process.stdout.write(`   Size: ${stats.size} bytes\n`);
  process.stdout.write(`   Modified: ${stats.mtime}\n`);
  
  // Try to read first 500 bytes
  const fd = fs.openSync(mainPath, 'r');
  const buffer = Buffer.alloc(500);
  fs.readSync(fd, buffer, 0, 500, 0);
  fs.closeSync(fd);
  
  process.stdout.write(`\nFirst 500 bytes of main.js:\n`);
  process.stdout.write(buffer.toString('utf8'));
  process.stdout.write(`\n=== END PREVIEW ===\n`);
} else {
  process.stderr.write(`❌ dist/main.js DOES NOT EXIST\n`);
  process.exit(1);
}

process.stdout.write('\n=== NODE.JS TEST COMPLETE ===\n');
process.stdout.write('Now attempting to require dist/main.js...\n\n');
