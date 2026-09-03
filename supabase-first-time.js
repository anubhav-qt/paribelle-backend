#!/usr/bin/env node

/**
 * One-shot bootstrap for a FRESH Supabase Postgres database.
 *
 * Run this exactly once, on the first deploy against a brand-new Supabase
 * project (no data to migrate). It:
 *
 *   1. Builds the entire current schema directly from the TypeORM entities
 *      (`synchronize(true)` — drops anything already there first).
 *   2. Baselines the migration history: every migration bundled in this build
 *      is recorded in the `migrations` table as already-applied, so the normal
 *      `render:start` boot (which runs `run-migrations.js`) does NOT try to
 *      replay historical schema changes that step 1 already produced.
 *
 * After this succeeds, switch the Render startCommand back to `npm run
 * render:start` and never run this again — it is destructive.
 *
 * Data-only historical migrations (backfills, de-dupes, settings seeds) are
 * no-ops on an empty DB, so baselining them past is correct; the regular
 * seed scripts populate default rows.
 */

const { AppDataSource } = require('./dist/database/data-source');

async function main() {
  console.log('🔌 Connecting to database...');
  await AppDataSource.initialize();
  console.log('✅ Connected');

  console.log('🏗️  Building schema from entities (synchronize, drop existing)...');
  await AppDataSource.synchronize(true);
  console.log('✅ Schema created');

  console.log('📌 Baselining migration history...');
  const qr = AppDataSource.createQueryRunner();
  await qr.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      "timestamp" bigint NOT NULL,
      name character varying NOT NULL
    )
  `);

  let baselined = 0;
  for (const migration of AppDataSource.migrations) {
    const name = migration.constructor.name; // e.g. CreateVendorPagesTable1733673600000
    const digits = name.replace(/\D/g, '');
    const timestamp = digits ? parseInt(digits.slice(-13), 10) : Date.now();
    const existing = await qr.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
    if (existing.length === 0) {
      await qr.query('INSERT INTO migrations("timestamp", name) VALUES ($1, $2)', [timestamp, name]);
      console.log(`   • ${name}`);
      baselined++;
    }
  }
  await qr.release();
  console.log(`✅ Baselined ${baselined} migration(s)`);

  await AppDataSource.destroy();
  console.log('👋 Supabase first-time setup complete.');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Supabase first-time setup failed:', error);
  process.exit(1);
});
