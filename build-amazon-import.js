#!/usr/bin/env node

/**
 * Fills the Paribelle import template with the Amazon catalogue pulled by
 * oms/scripts/amazon-listings-to-xlsx.ts.
 *
 * The template's own products.xlsx is loaded and its worked-example rows are
 * replaced, so header styling, the Active dropdown and the Instructions sheet
 * survive — what comes out is the same file a vendor would have edited by hand.
 *
 * Model: ONE product per design. Colour and Size are both variant axes, and
 * each colour's photographs ride on its own variant rows, so picking a colour
 * on the storefront swaps the gallery. (Colour used to be split into separate
 * products purely because variants could not carry images; they can now.)
 *
 *   node build-amazon-import.js <amazon-listings-raw.xlsx> <template.zip> <out.xlsx>
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');

const CATEGORY = 'Kurtis'; // the importer accepts only "Kurtis" or "Jewellery"

/** Standalone bottoms — not kurtis, so they stay out of this import. */
const EXCLUDED_PRODUCT_TYPES = new Set(['PANTS']);

/** Never show a size as sold out on a brand-new catalogue. */
const MIN_STOCK = 5;

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', 'Free Size', 'One Size'];

/* ------------------------------------------------------------------ names -- */

/** Brands to strip from the front of a title. JIKRA JAIPUR is Paribelle's
 *  former trading name, so those listings are ours too. */
const BRANDS = [/^jikra\s+jaipur\b/i, /^paribelle\b/i];

/**
 * SEO filler that reads as clutter on a premium product page.
 *
 * The possessive pattern deliberately has no trailing `\b`: at least one
 * listing reads "Women'sRust Orange …" with no space, and a word boundary
 * refuses to match before the capital R. (A `(?![a-z])` lookahead does not
 * help either — under the `i` flag `[a-z]` matches uppercase too.) Requiring
 * the apostrophe keeps it from biting into any other word.
 */
const NOISE = [
  /\bwomen(?:'|’)s/gi,
  /\bwomens?\b/gi,
  /\bfor\s+women\b/gi,
  /\bladies\b/gi,
  /\bstylish\b/gi, /\btrendy\b/gi, /\belegant\b/gi, /\bbeautiful\b/gi,
  /\blatest\b/gi, /\bnew\b/gi, /\bdesigner\b/gi, /\bpremium\b/gi,
  /\bsmart\b/gi, /\bself\b/gi,
  /\bcasual\s+wear\b/gi, /\bethnic\s+wear\b/gi, /\bparty\s+wear\b/gi,
  /\b60x60\b/gi,
];

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** Words that must keep a fixed casing rather than be title-cased. */
const FIXED_CASE = {
  'coord': 'Co-ord', 'co-ord': 'Co-ord', 'coords': 'Co-ord',
  'a-line': 'A-Line', 'aline': 'A-Line',
  '3/4': '3/4', 'liva': 'LIVA', 'kurti': 'Kurti', 'kurta': 'Kurta',
};

function titleCase(text) {
  return text
    .split(/\s+/)
    .map((word, i) => {
      const bare = word.toLowerCase();
      if (FIXED_CASE[bare]) return FIXED_CASE[bare];
      if (i > 0 && SMALL_WORDS.has(bare)) return bare;
      // Preserve intentional inner capitals and hyphenated compounds.
      return bare.replace(/(^|[-/])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}

/**
 * Amazon titles are keyword-stuffed for search: brand prefix, "Women's",
 * pipe-separated feature lists, repeated colour names. Strip all of that back
 * to the garment itself.
 */
/**
 * @param raw          the Amazon item name, colour/size already lifted off
 * @param colourWords  every colour seen anywhere in the catalogue, longest
 *                     first, so "Rust Orange" is removed before "Rust"
 */
function cleanName(raw, colourWords = []) {
  let s = String(raw || '').trim();

  // Everything after a pipe or double-slash is an SEO tail.
  s = s.split(/\s*(?:\||\/\/)\s*/)[0];

  // Some listings paste the whole title twice, brand and all. Cut at the
  // second brand mention.
  const second = s.search(/(?<=.{10})\b(paribelle|jikra\s+jaipur)\b/i);
  if (second > 0) s = s.slice(0, second);

  for (const brand of BRANDS) s = s.replace(brand, '');
  for (const noise of NOISE) s = s.replace(noise, ' ');

  // Everything past the first comma is a descriptor list ("…, Red and Black,
  // Ethnic Floral Print"). The garment is the part before it; the rest is
  // already carried by the description and the variant attributes.
  s = s.split(',')[0];

  // Colour is a variant axis now, so it has no business in the product name.
  for (const colour of colourWords) {
    s = s.replace(new RegExp(`\\b${colour.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\b`, 'gi'), ' ');
  }

  s = s.replace(/\((?:[^)]*)\)\s*$/, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  // Tidy connectives orphaned by the removals above.
  s = s.replace(/\s+(?:with|and|in)\s*$/i, '');
  s = s.replace(/^(?:with|and|in)\s+/i, '');
  s = s.replace(/^[-–,:;\s]+|[-–,:;\s]+$/g, '');

  return titleCase(s) || 'Kurti Set';
}

function cleanColour(raw) {
  const s = String(raw || '').trim().replace(/\s{2,}/g, ' ');
  if (!s) return '';
  return titleCase(s);
}

/* ------------------------------------------------------------ attributes -- */

const FABRICS = [
  'Khadi Cotton', 'Cotton Flex', 'Cotton Silk', 'Chanderi', 'Muslin', 'Georgette',
  'Viscose', 'Rayon', 'Crepe', 'Linen', 'Silk', 'Cotton',
];
const SLEEVES = [
  ['Sleeveless', /sleeveless/i],
  ['Three-Quarter', /(3\/4|three[- ]quarter)/i],
  ['Short', /short sleeve/i],
  ['Full', /(full sleeve|long sleeve)/i],
];
const OCCASIONS = [
  ['Festive', /festive|festival|ajrakh|anarkali|embroider/i],
  ['Wedding', /wedding|bridal/i],
  ['Daily', /daily|everyday|casual|printed|print\b/i],
];
const STYLES = [
  ['Co-ord Set', /co-?ord/i],
  ['Kurta Set', /kurta\s+(pant|palazzo|set)|suit|dupatta/i],
  ['Anarkali', /anarkali/i],
  ['Kurti', /kurti|kurta/i],
];

function pick(list, text) {
  for (const entry of list) {
    if (Array.isArray(entry)) {
      if (entry[1].test(text)) return entry[0];
    } else if (new RegExp(`\\b${entry.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      return entry;
    }
  }
  return null;
}

/** Filter facets for the category sidebar. Colour is deliberately absent — it
 *  lives on the variants now, and the filter builder reads those. */
function productAttributes(sourceText) {
  const parts = [];
  const fabric = pick(FABRICS, sourceText);
  if (fabric) parts.push(`Fabric: ${fabric}`);
  const style = pick(STYLES, sourceText);
  if (style) parts.push(`Style: ${style}`);
  const sleeve = pick(SLEEVES, sourceText);
  if (sleeve) parts.push(`Sleeve: ${sleeve}`);
  const occasion = pick(OCCASIONS, sourceText);
  if (occasion) parts.push(`Occasion: ${occasion}`);
  return parts.join(', ');
}

/* ---------------------------------------------------------- descriptions -- */

/** Amazon descriptions carry marketplace boilerplate and shouting. Tidy them
 *  into something that reads on a boutique product page. */
function cleanDescription(raw, name) {
  let s = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/\b(amazon|flipkart|meesho)\b/gi, '');
  // Sentence-case any all-caps shouting.
  s = s.replace(/\b[A-Z]{4,}\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase());
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length < 40) {
    return `${name} — crafted in breathable fabric with a considered finish, cut for an easy, everyday drape.`;
  }
  if (s.length > 900) s = s.slice(0, 900).replace(/\s+\S*$/, '') + '…';
  return s;
}

/* ------------------------------------------------------------------ read -- */

async function readSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = wb.getWorksheet(sheetName) ?? wb.worksheets[0];
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value ?? '').trim();
  });
  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj = {};
    let any = false;
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue;
      const v = row.getCell(c).value;
      const s = v === null || v === undefined
        ? ''
        : String(typeof v === 'object' && v.result !== undefined ? v.result : v).trim();
      obj[headers[c]] = s;
      if (s) any = true;
    }
    if (any) rows.push(obj);
  }
  return rows;
}

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'X';

/* ------------------------------------------------------------------ main -- */

async function main() {
  const [listingsPath, templateZip, outPath] = process.argv.slice(2);
  if (!listingsPath || !templateZip || !outPath) {
    console.error('usage: node build-amazon-import.js <listings.xlsx> <template.zip> <out.xlsx>');
    process.exit(1);
  }

  const all = await readSheet(listingsPath, 'Listings');
  const active = all.filter((r) => r.status === 'Active');
  const kept = active.filter((r) => !EXCLUDED_PRODUCT_TYPES.has(r._ProductType));
  console.log(`Read ${all.length} rows · ${active.length} Active · ${active.length - kept.length} excluded as PANTS`);
  console.log(`${kept.length} listings to import`);

  // Colour vocabulary straight from the catalogue, longest phrase first so
  // "Rust Orange" is stripped from a name before a bare "Rust" can bite off
  // half of it. Names are cleaned against this, so it must exist first.
  const colourWords = [...new Set(
    kept.flatMap((r) => [r._ParsedColour, r._CatalogColour])
      .map((c) => String(c || '').trim())
      .filter(Boolean),
  )].sort((a, b) => b.length - a.length);
  console.log(`Colour vocabulary: ${colourWords.length} terms`);

  // ── group by DESIGN (cleaned name), colour is now an axis ──────────────
  const groups = new Map();
  for (const row of kept) {
    const name = cleanName(row._ParsedBaseTitle || row['item-name'], colourWords);
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { name, listings: [] });
    groups.get(key).listings.push(row);
  }
  console.log(`Grouped into ${groups.size} products`);

  // ── open the real template and clear its example rows ──────────────────
  const zip = new AdmZip(templateZip);
  const entry = zip.getEntry('products.xlsx');
  if (!entry) throw new Error('template ZIP has no products.xlsx');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(entry.getData());
  const productSheet = wb.getWorksheet('Products');
  const variantSheet = wb.getWorksheet('Variants');

  /**
   * Reading a workbook back off disk drops the `key` each column was defined
   * with, so addRow({ productCode: ... }) silently writes an empty row. Rows
   * are therefore built positionally, against the header text in row 1.
   */
  const headerOf = (sheet) => {
    const headers = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col] = String(cell.value ?? '').trim();
    });
    return headers;
  };
  const productHeaders = headerOf(productSheet);
  const variantHeaders = headerOf(variantSheet);

  const writeRows = (sheet, headers, records) => {
    records.forEach((record, i) => {
      const row = sheet.getRow(i + 2);
      for (let c = 1; c < headers.length; c++) {
        if (!headers[c]) continue;
        const v = record[headers[c]];
        row.getCell(c).value = v === undefined || v === '' ? null : v;
      }
      row.commit();
    });
    const firstUnused = records.length + 2;
    if (sheet.rowCount >= firstUnused) sheet.spliceRows(firstUnused, sheet.rowCount - firstUnused + 1);
  };

  // ── build rows ─────────────────────────────────────────────────────────
  const productRecords = [];
  const variantRecords = [];
  const usedVariantCodes = new Set();
  const notes = { mergedDuplicates: 0, defaultedSize: [], defaultedColour: [], stockRaised: 0 };
  let seq = 0;

  for (const group of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    seq += 1;
    const productCode = `PB-${String(seq).padStart(3, '0')}`;

    const hasColourAxis = group.listings.some((l) => (l._ParsedColour || l._CatalogColour || '').trim());
    const hasSizeAxis = group.listings.some((l) => l._ParsedSize);

    // Collapse to one entry per (colour, size); the same combination is listed
    // more than once on Amazon when a SKU was relisted.
    const combos = new Map();
    for (const l of group.listings) {
      let colour = cleanColour(l._ParsedColour || l._CatalogColour);
      let size = l._ParsedSize;
      if (hasColourAxis && !colour) { colour = 'Assorted'; notes.defaultedColour.push(`${productCode} ${group.name}`); }
      if (hasSizeAxis && !size) { size = 'Free Size'; notes.defaultedSize.push(`${productCode} ${group.name}`); }

      const key = `${colour}|${size}`;
      const images = String(l._Images || '').split(',').map((s) => s.trim()).filter(Boolean);
      const existing = combos.get(key);
      if (existing) {
        notes.mergedDuplicates += 1;
        existing.stock += num(l.quantity);
        existing.price = Math.min(existing.price, num(l.price) || existing.price);
        existing.mrp = Math.max(existing.mrp, num(l['maximum-retail-price']));
        if (images.length > existing.images.length) existing.images = images;
      } else {
        combos.set(key, {
          colour, size,
          stock: num(l.quantity),
          price: num(l.price),
          mrp: num(l['maximum-retail-price']),
          images,
          description: l['item-description'] || '',
        });
      }
    }

    const entries = [...combos.values()].sort(
      (a, b) => a.colour.localeCompare(b.colour) || SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
    );

    const prices = entries.map((e) => e.price).filter((p) => p > 0);
    const price = prices.length ? Math.min(...prices) : 0;
    const mrp = Math.max(0, ...entries.map((e) => e.mrp));

    // Default gallery: the richest image set in the group, so the listing card
    // and an un-chosen product page both show a real photograph.
    const richest = entries.reduce((best, e) => (e.images.length > best.images.length ? e : best), entries[0]);
    const description = entries.map((e) => e.description).find((d) => d && d.length > 40) ?? '';
    const sourceText = `${group.name} ${group.listings.map((l) => l['item-name']).join(' ')}`;

    productRecords.push({
      'Product Code': productCode,
      'Product Name': group.name,
      'Category': CATEGORY,
      'Price': price,
      'Stock': '', // every product here carries variants
      'Images': richest.images.join(', '),
      'Description': cleanDescription(description, group.name),
      'Compare At Price': mrp > price ? mrp : '',
      'Attributes': productAttributes(sourceText),
    });

    for (const e of entries) {
      const bits = [];
      if (hasColourAxis) bits.push(`Colour: ${e.colour}`);
      if (hasSizeAxis) bits.push(`Size: ${e.size}`);

      let variantCode = `${productCode}-${hasColourAxis ? slug(e.colour) + '-' : ''}${(e.size || 'OS').replace(/\s+/g, '')}`;
      let n = 2;
      const base = variantCode;
      while (usedVariantCodes.has(variantCode)) variantCode = `${base}-${n++}`;
      usedVariantCodes.add(variantCode);

      const stock = Math.max(MIN_STOCK, e.stock);
      if (stock !== e.stock) notes.stockRaised += 1;

      variantRecords.push({
        'Product Code': productCode,
        'Variant Code': variantCode,
        'Attributes': bits.join(', '),
        'Price': e.price || price,
        'Compare At Price': e.mrp > (e.price || price) ? e.mrp : '',
        'Stock': stock,
        'Active': 'YES',
        'Images': e.images.join(', '),
      });
    }
  }

  writeRows(productSheet, productHeaders, productRecords);
  writeRows(variantSheet, variantHeaders, variantRecords);

  // Re-apply the Active dropdown; the template only covered its example rows.
  for (let row = 2; row <= variantRecords.length + 1; row++) {
    variantSheet.getCell(row, 7).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['"YES,NO"'],
    };
  }

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  await wb.xlsx.writeFile(outPath);

  const colours = new Set(variantRecords.map((v) => (v.Attributes.match(/Colour: ([^,]+)/) ?? [])[1]).filter(Boolean));
  console.log(`\nWrote ${outPath}`);
  console.log(`  Products: ${productRecords.length}`);
  console.log(`  Variants: ${variantRecords.length}`);
  console.log(`  Distinct colours: ${colours.size}`);
  console.log(`  Duplicate (colour,size) combos merged: ${notes.mergedDuplicates}`);
  console.log(`  Variants raised to minimum stock ${MIN_STOCK}: ${notes.stockRaised}`);
  if (notes.defaultedColour.length) console.log(`  Colour defaulted to "Assorted": ${notes.defaultedColour.length}`);
  if (notes.defaultedSize.length) console.log(`  Size defaulted to "Free Size": ${notes.defaultedSize.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
