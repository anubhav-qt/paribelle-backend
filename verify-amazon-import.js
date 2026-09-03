#!/usr/bin/env node
/** Checks a filled import workbook against the rules the importer and the
 *  storefront variant selector both depend on. */
const ExcelJS = require('exceljs');

async function sheetRows(sheet) {
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (headers[i] = String(c.value ?? '').trim()));
  const out = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const o = {};
    let any = false;
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue;
      const v = row.getCell(c).value;
      o[headers[c]] = v === null || v === undefined ? '' : String(v).trim();
      if (o[headers[c]]) any = true;
    }
    if (any) out.push({ ...o, __row: r });
  }
  return out;
}

const attrKeys = (s) =>
  s.split(',').map((p) => p.split(':')[0].trim()).filter(Boolean).sort().join('|');
const attrVal = (s, key) => (s.match(new RegExp(`${key}:\\s*([^,]+)`)) ?? [])[1]?.trim() ?? '';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  console.log('Sheets:', wb.worksheets.map((w) => w.name).join(', '));

  const products = await sheetRows(wb.getWorksheet('Products'));
  const variants = await sheetRows(wb.getWorksheet('Variants'));
  console.log(`Products: ${products.length}   Variants: ${variants.length}`);

  const errors = [];
  const warnings = [];
  const codes = new Set(products.map((p) => p['Product Code']));
  if (codes.size !== products.length) errors.push('duplicate Product Codes');

  for (const p of products) {
    if (!p['Product Code']) errors.push(`row ${p.__row}: blank Product Code`);
    if (!p['Product Name']) errors.push(`row ${p.__row}: blank Product Name`);
    if (p['Product Name'].length > 70) warnings.push(`row ${p.__row}: name is ${p['Product Name'].length} chars`);
    if (/paribelle|jikra/i.test(p['Product Name'])) warnings.push(`row ${p.__row}: brand still in name`);
    if (p.Category !== 'Kurtis' && p.Category !== 'Jewellery') errors.push(`row ${p.__row}: bad Category "${p.Category}"`);
    if (!(parseFloat(p.Price) > 0)) errors.push(`row ${p.__row}: bad Price`);
    if (p['Compare At Price'] && parseFloat(p['Compare At Price']) <= parseFloat(p.Price)) {
      errors.push(`row ${p.__row}: Compare At Price <= Price`);
    }
    if (!p.Images) errors.push(`row ${p.__row}: no Images`);
    if (!p.Description || p.Description.length < 40) warnings.push(`row ${p.__row}: thin Description`);
  }

  const seen = new Set();
  const byProduct = new Map();
  for (const v of variants) {
    const pc = v['Product Code'];
    if (!byProduct.has(pc)) byProduct.set(pc, []);
    byProduct.get(pc).push(v);

    if (!codes.has(pc)) errors.push(`variant row ${v.__row}: unknown Product Code "${pc}"`);
    const vc = v['Variant Code'];
    if (seen.has(vc)) errors.push(`variant row ${v.__row}: duplicate Variant Code "${vc}"`);
    seen.add(vc);
    if (!vc.startsWith(pc)) errors.push(`variant row ${v.__row}: "${vc}" not prefixed with "${pc}"`);
    if (v.Active !== 'YES' && v.Active !== 'NO') errors.push(`variant row ${v.__row}: Active "${v.Active}"`);
    if (!(parseInt(v.Stock, 10) >= 5)) errors.push(`variant row ${v.__row}: Stock ${v.Stock} below minimum 5`);
    if (!(parseFloat(v.Price) > 0)) errors.push(`variant row ${v.__row}: bad Price`);
  }

  // The storefront selector only yields a variant once EVERY axis has a value,
  // so all variants of a product must declare the same attribute keys.
  for (const [pc, vs] of byProduct) {
    const shapes = new Set(vs.map((v) => attrKeys(v.Attributes)));
    if (shapes.size > 1) errors.push(`${pc}: inconsistent variant axes — ${[...shapes].join('  vs  ')}`);
  }

  // A colour that carries no photographs defeats the whole point of the change.
  for (const [pc, vs] of byProduct) {
    const colours = new Set(vs.map((v) => attrVal(v.Attributes, 'Colour')).filter(Boolean));
    if (colours.size > 1) {
      for (const v of vs) if (!v.Images) errors.push(`variant row ${v.__row}: multi-colour product ${pc} but no Images`);
      // Each colour should have its own distinct photographs.
      const perColour = new Map();
      for (const v of vs) {
        const c = attrVal(v.Attributes, 'Colour');
        if (!perColour.has(c)) perColour.set(c, new Set());
        perColour.set(c, perColour.get(c).add(v.Images));
      }
      const firstImages = [...perColour.values()].map((s) => [...s][0]);
      if (new Set(firstImages).size === 1 && firstImages.length > 1) {
        warnings.push(`${pc}: every colour shares the same photographs`);
      }
    }
  }

  for (const p of products) {
    if (!byProduct.has(p['Product Code']) && p.Stock === '') {
      errors.push(`row ${p.__row}: ${p['Product Code']} has no variants and no Stock`);
    }
    if (byProduct.has(p['Product Code']) && p.Stock !== '') {
      errors.push(`row ${p.__row}: ${p['Product Code']} has variants but Stock="${p.Stock}"`);
    }
  }

  const multi = [...byProduct].filter(([, vs]) => new Set(vs.map((v) => attrVal(v.Attributes, 'Colour')).filter(Boolean)).size > 1);
  console.log(`\nMulti-colour products: ${multi.length}/${products.length}`);
  console.log(`Total stock: ${variants.reduce((s, v) => s + (parseInt(v.Stock, 10) || 0), 0)}`);

  console.log('\n--- product names ---');
  products.slice(0, 12).forEach((p) => console.log(`  ${p['Product Code']}  ${p['Product Name']}`));

  const sample = multi[0];
  if (sample) {
    const p = products.find((x) => x['Product Code'] === sample[0]);
    console.log(`\n--- ${p['Product Code']} "${p['Product Name']}" ---`);
    console.log(`  Attributes: ${p.Attributes}`);
    sample[1].slice(0, 6).forEach((v) =>
      console.log(`  ${v['Variant Code'].padEnd(20)} ${v.Attributes.padEnd(32)} ₹${v.Price}  stock ${String(v.Stock).padEnd(4)} img ${v.Images.split(',').length}`),
    );
    const colours = [...new Set(sample[1].map((v) => attrVal(v.Attributes, 'Colour')))];
    console.log(`  colours: ${colours.join(', ')}`);
  }

  console.log(errors.length ? `\n❌ ${errors.length} error(s):` : '\n✅ No errors.');
  errors.slice(0, 20).forEach((e) => console.log('  ' + e));
  if (errors.length > 20) console.log(`  ...and ${errors.length - 20} more`);

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`);
    warnings.slice(0, 15).forEach((w) => console.log('  ' + w));
    if (warnings.length > 15) console.log(`  ...and ${warnings.length - 15} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
