#!/usr/bin/env node

/**
 * Runs a simple-physical-product ZIP through ProductsExcelService against
 * whatever DATABASE_URL points at. Boots the real Nest application context, so
 * this is the exact code path the admin import endpoint uses.
 *
 *   DATABASE_URL='postgres://…' NODE_ENV=production \
 *     node import-catalogue.js <zip>            # dry run — writes nothing
 *   DATABASE_URL='postgres://…' NODE_ENV=production \
 *     node import-catalogue.js <zip> --commit   # actually import
 *
 * Remaining env (JWT_SECRET, CLOUDINARY_*, …) is read from render-backend.env;
 * an inline DATABASE_URL is NOT overridden by it (dotenv leaves set vars alone).
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'render-backend.env') });

const { NestFactory } = require('@nestjs/core');

async function main() {
  const [zipPath, flag] = process.argv.slice(2);
  if (!zipPath) {
    console.error('usage: node import-catalogue.js <zip> [--commit]');
    process.exit(1);
  }
  const dryRun = flag !== '--commit';
  const buffer = fs.readFileSync(zipPath);

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_PROJECT_REF')) {
    throw new Error('Set a real DATABASE_URL in the environment before running this.');
  }

  const { AppModule } = require('./dist/app.module');
  const { ProductsExcelService } = require('./dist/modules/products/products-excel.service');

  console.log(`\n${dryRun ? '— DRY RUN (nothing is written) —' : '— COMMIT —'}`);
  console.log(`zip: ${zipPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  console.log(`db:  ${process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}\n`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const svc = app.get(ProductsExcelService);

  const started = Date.now();
  const result = await svc.importSimplePhysicalZip(null, buffer, { dryRun });
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log('─'.repeat(60));
  console.log(`dryRun:  ${result.dryRun}`);
  console.log(`created: ${result.created}`);
  console.log(`updated: ${result.updated}`);
  console.log(`errors:  ${result.errors.length}   (${secs}s)`);
  if (result.errors.length) {
    console.log('\nERRORS:');
    result.errors.forEach((e) => console.log('  • ' + e));
  }
  console.log('─'.repeat(60));

  await app.close();
  process.exit(result.errors.length > 0 && dryRun ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
