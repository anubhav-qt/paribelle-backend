#!/usr/bin/env node

/**
 * Inserts the global root categories the storefront homepage shows
 * (vendor_id NULL, no parent). Idempotent — skips any slug that already
 * exists. Products can be attached later.
 *
 * Run as a Render One-Off Job against the service (DATABASE_URL is present):
 *   node seed-root-categories.js
 */

const { AppDataSource } = require('./dist/database/data-source');
const { Category } = require('./dist/modules/categories/category.entity');

const ROOT_CATEGORIES = [
  { name: 'Kurtis', slug: 'kurtis', sortOrder: 0 },
  { name: 'Jewellery', slug: 'jewellery', sortOrder: 1 },
];

async function main() {
  console.log('🔌 Connecting...');
  await AppDataSource.initialize();
  const repo = AppDataSource.getTreeRepository(Category);

  for (const { name, slug, sortOrder } of ROOT_CATEGORIES) {
    const existing = await repo.findOne({ where: { slug } });
    if (existing) {
      console.log(`• ${slug} already exists (${existing.id}) — skipped`);
      continue;
    }
    const category = repo.create({
      name,
      slug,
      sortOrder,
      isActive: true,
      vendorId: null, // global — shown on the root storefront
    });
    const saved = await repo.save(category);
    console.log(`✅ created ${slug} (${saved.id})`);
  }

  await AppDataSource.destroy();
  console.log('👋 Done.');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
