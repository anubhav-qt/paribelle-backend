#!/usr/bin/env node

/**
 * Builds the Kurtis mega-menu tree and files every existing Kurtis product
 * into it.
 *
 *   Kurtis
 *     By Style      -> Top Only | Co-ord Sets | 3 Piece
 *     By Occasion   -> Casual   | Formal      | Festive
 *
 * "By Style" / "By Occasion" are group headers only (no products, not links).
 * Each product gains one style leaf and one occasion leaf; its existing
 * "Kurtis" membership is kept. Idempotent: existing slugs and existing
 * product<->category links are skipped, so it is safe to re-run.
 *
 * Run as a Render One-Off Job against the API service (DATABASE_URL present):
 *   node seed-kurti-subcategories.js
 *
 * The mapping below was derived from each product's name / description /
 * Style + Occasion attributes on 2026-09. New products added later still need
 * to be filed by hand (or this script extended).
 */

const { AppDataSource } = require('./dist/database/data-source');
const { Category } = require('./dist/modules/categories/category.entity');
const { Product } = require('./dist/modules/products/product.entity');

const GROUPS = [
  {
    name: 'By Style',
    slug: 'by-style',
    sortOrder: 0,
    leaves: [
      { name: 'Top Only', slug: 'top-only', sortOrder: 0 },
      { name: 'Co-ord Sets', slug: 'co-ord-sets', sortOrder: 1 },
      { name: '3 Piece', slug: '3-piece', sortOrder: 2 },
    ],
  },
  {
    name: 'By Occasion',
    slug: 'by-occasion',
    sortOrder: 1,
    leaves: [
      { name: 'Casual', slug: 'casual', sortOrder: 0 },
      { name: 'Formal', slug: 'formal', sortOrder: 1 },
      { name: 'Festive', slug: 'festive', sortOrder: 2 },
    ],
  },
];

// sku -> { style: <leaf slug>, occasion: <leaf slug> }
const MAPPING = {
  'PB-001': { style: '3-piece', occasion: 'festive' },
  'PB-002': { style: '3-piece', occasion: 'festive' },
  'PB-003': { style: '3-piece', occasion: 'festive' },
  'PB-004': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-005': { style: '3-piece', occasion: 'festive' },
  'PB-007': { style: '3-piece', occasion: 'festive' },
  'PB-009': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-010': { style: '3-piece', occasion: 'festive' },
  'PB-011': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-012': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-013': { style: '3-piece', occasion: 'festive' },
  'PB-014': { style: 'co-ord-sets', occasion: 'casual' },
  'PB-015': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-016': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-017': { style: '3-piece', occasion: 'casual' },
  'PB-018': { style: '3-piece', occasion: 'casual' },
  'PB-020': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-022': { style: 'co-ord-sets', occasion: 'casual' },
  'PB-023': { style: '3-piece', occasion: 'casual' },
  'PB-024': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-025': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-027': { style: '3-piece', occasion: 'casual' },
  'PB-028': { style: 'co-ord-sets', occasion: 'casual' },
  'PB-029': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-030': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-033': { style: 'co-ord-sets', occasion: 'festive' },
  'PB-034': { style: 'co-ord-sets', occasion: 'festive' },
};

async function upsertChild(treeRepo, { name, slug, sortOrder }, parent) {
  const existing = await treeRepo.findOne({ where: { slug } });
  if (existing) {
    console.log(`  - ${slug} exists (${existing.id})`);
    return existing;
  }
  const saved = await treeRepo.save(
    treeRepo.create({ name, slug, sortOrder, isActive: true, vendorId: null, parent }),
  );
  console.log(`  + ${slug} created (${saved.id})`);
  return saved;
}

async function main() {
  console.log('Connecting...');
  await AppDataSource.initialize();
  const treeRepo = AppDataSource.getTreeRepository(Category);
  const productRepo = AppDataSource.getRepository(Product);

  const kurtis = await treeRepo.findOne({ where: { slug: 'kurtis' } });
  if (!kurtis) throw new Error('Root category "kurtis" not found - run seed-root-categories.js first.');

  console.log('\nBuilding tree under Kurtis:');
  const leafBySlug = {};
  for (const group of GROUPS) {
    const groupCat = await upsertChild(treeRepo, group, kurtis);
    for (const leaf of group.leaves) {
      leafBySlug[leaf.slug] = await upsertChild(treeRepo, leaf, groupCat);
    }
  }

  console.log('\nFiling products:');
  let linked = 0;
  let missing = 0;
  for (const [sku, { style, occasion }] of Object.entries(MAPPING)) {
    const product = await productRepo.findOne({ where: { sku }, relations: ['categories'] });
    if (!product) {
      console.log(`  ? ${sku} not found - skipped`);
      missing += 1;
      continue;
    }
    const want = [leafBySlug[style], leafBySlug[occasion]].filter(Boolean);
    const haveIds = new Set((product.categories || []).map((c) => c.id));
    const toAdd = want.filter((c) => !haveIds.has(c.id));
    if (toAdd.length === 0) {
      console.log(`  = ${sku} already filed`);
      continue;
    }
    product.categories = [...(product.categories || []), ...toAdd];
    await productRepo.save(product);
    console.log(`  > ${sku} -> ${toAdd.map((c) => c.slug).join(', ')}`);
    linked += 1;
  }

  console.log(`\nDone. ${linked} product(s) filed, ${missing} missing.`);
  await AppDataSource.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
