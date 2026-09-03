#!/usr/bin/env node
/** Surfaces judgement calls the cleanup pass needs to make. */
const ExcelJS = require('exceljs');

async function rows(sheet) {
  const h = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (h[i] = String(c.value ?? '').trim()));
  const out = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const o = {};
    let any = false;
    for (let c = 1; c < h.length; c++) {
      if (!h[c]) continue;
      const v = row.getCell(c).value;
      o[h[c]] = v == null ? '' : String(v).trim();
      if (o[h[c]]) any = true;
    }
    if (any) out.push(o);
  }
  return out;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const products = await rows(wb.getWorksheet('Products'));
  const variants = await rows(wb.getWorksheet('Variants'));

  console.log('=== duplicate size within a product ===');
  const bySize = new Map();
  for (const v of variants) {
    const k = `${v['Product Code']}|${v.Attributes}`;
    if (!bySize.has(k)) bySize.set(k, []);
    bySize.get(k).push(v);
  }
  const dups = [...bySize].filter(([, vs]) => vs.length > 1);
  console.log(`${dups.length} product/size pairs listed more than once`);
  dups.slice(0, 10).forEach(([k, vs]) => {
    const name = products.find((p) => p['Product Code'] === k.split('|')[0])?.['Product Name'] ?? '';
    console.log(`  ${k.padEnd(24)} x${vs.length}  prices ${vs.map((v) => v.Price).join('/')}  ${name.slice(0, 55)}`);
  });
  if (dups.length > 10) console.log(`  ...and ${dups.length - 10} more`);

  console.log('\n=== brand in product name ===');
  const brands = new Map();
  for (const p of products) {
    const first = p['Product Name'].split(/\s+/).slice(0, 2).join(' ');
    const b = /paribelle/i.test(p['Product Name']) ? 'Paribelle' : first;
    brands.set(b, (brands.get(b) ?? 0) + 1);
  }
  [...brands].sort((a, b) => b[1] - a[1]).forEach(([b, n]) => console.log(`  ${String(n).padStart(3)}  ${b}`));

  console.log('\n=== longest / suspicious names ===');
  [...products]
    .sort((a, b) => b['Product Name'].length - a['Product Name'].length)
    .slice(0, 5)
    .forEach((p) => console.log(`  ${p['Product Code']} (${p['Product Name'].length}) ${p['Product Name'].slice(0, 105)}`));

  console.log('\n=== products with only one size ===');
  const count = new Map();
  for (const v of variants) count.set(v['Product Code'], (count.get(v['Product Code']) ?? 0) + 1);
  const singles = products.filter((p) => (count.get(p['Product Code']) ?? 0) <= 1);
  console.log(`${singles.length} of ${products.length}`);
  singles.slice(0, 8).forEach((p) => console.log(`  ${p['Product Code']}  ${p['Product Name'].slice(0, 70)}`));

  console.log('\n=== price spread within a product ===');
  const spread = products
    .map((p) => {
      const vs = variants.filter((v) => v['Product Code'] === p['Product Code']).map((v) => parseFloat(v.Price));
      if (vs.length < 2) return null;
      const lo = Math.min(...vs), hi = Math.max(...vs);
      return hi > lo ? { p, lo, hi } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.hi - b.lo - (a.hi - a.lo));
  console.log(`${spread.length} products price differently per size`);
  spread.slice(0, 6).forEach((s) => console.log(`  ${s.p['Product Code']}  ₹${s.lo}–₹${s.hi}  ${s.p['Product Name'].slice(0, 55)}`));

  console.log('\n=== missing description ===');
  console.log(`${products.filter((p) => !p.Description || p.Description.length < 30).length} products`);
})();
