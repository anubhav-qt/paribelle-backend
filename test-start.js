#!/usr/bin/env node

// Absolute simplest test
console.log('TEST 1: Script started');
process.stdout.write('TEST 2: stdout write\n');
process.stderr.write('TEST 3: stderr write\n');

console.log('Node version:', process.version);
console.log('CWD:', process.cwd());
console.log('PORT:', process.env.PORT);

setTimeout(() => {
  console.log('TEST 4: After 1 second');
  process.exit(0);
}, 1000);
