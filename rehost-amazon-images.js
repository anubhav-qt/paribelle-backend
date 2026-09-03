#!/usr/bin/env node

/**
 * Copies every Amazon CDN image referenced by the pulled listings into our own
 * Cloudinary account, so the storefront never hotlinks m.media-amazon.com
 * (their bandwidth, and the URLs rot).
 *
 * Writes a { amazonUrl: cloudinaryUrl } map that build-amazon-import.js reads
 * as its optional 4th argument. Resumable: an existing map file is loaded and
 * URLs already in it are skipped, so a re-run only fills the gaps.
 *
 *   node rehost-amazon-images.js <amazon-listings-raw.xlsx> <url-map.json>
 *
 * Cloudinary credentials are read from render-backend.env (falls back to the
 * process environment).
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: path.join(__dirname, '..', 'render-backend.env') });
require('dotenv').config(); // let a real .env override, if present

const FOLDER = 'marketplace/products/paribelle-amazon';
const CONCURRENCY = 6;
const MAX_WIDTH = 1600;

function configureCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error('CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET are not set (looked in render-backend.env).');
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
  return cloud_name;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A stable public_id per source URL, so a re-run overwrites rather than
 *  duplicating, and the same photo shared by several variants uploads once. */
function publicIdFor(url) {
  const tail = url.split('/').pop().replace(/\.[a-z]+$/i, '');
  return `${FOLDER}/${tail}`;
}

async function download(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt < 4) {
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
      return download(url, attempt + 1);
    }
    throw err;
  }
}

async function rehostOne(url) {
  const raw = await download(url);
  const compressed = await sharp(raw)
    .resize(MAX_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: publicIdFor(url), overwrite: true, resource_type: 'image', format: 'jpg' },
        (err, result) => (err || !result ? reject(err || new Error('no result')) : resolve(result.secure_url)),
      )
      .end(compressed);
  });
}

async function collectUrls(listingsPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(listingsPath);
  const sheet = wb.getWorksheet('Listings');
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (c, i) => (headers[i] = String(c.value ?? '').trim()));
  const iImg = headers.indexOf('_Images');
  const iStatus = headers.indexOf('status');
  const iType = headers.indexOf('_ProductType');

  const urls = new Set();
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (String(row.getCell(iStatus).value) !== 'Active') continue;
    if (String(row.getCell(iType).value) === 'PANTS') continue; // excluded from the import
    String(row.getCell(iImg).value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//.test(s))
      .forEach((u) => urls.add(u));
  }
  return [...urls];
}

async function main() {
  const [listingsPath, mapPath] = process.argv.slice(2);
  if (!listingsPath || !mapPath) {
    console.error('usage: node rehost-amazon-images.js <listings.xlsx> <url-map.json>');
    process.exit(1);
  }

  const cloudName = configureCloudinary();
  console.log(`Cloudinary: ${cloudName} · folder ${FOLDER}`);

  const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : {};
  const already = Object.keys(map).length;

  const all = await collectUrls(listingsPath);
  const todo = all.filter((u) => !map[u]);
  console.log(`${all.length} unique images · ${already} already done · ${todo.length} to upload`);

  let done = 0;
  let failed = 0;
  const queue = [...todo];

  const worker = async () => {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      try {
        map[url] = await rehostOne(url);
        done += 1;
      } catch (err) {
        failed += 1;
        console.warn(`  ✗ ${url} — ${err.message}`);
      }
      if ((done + failed) % 20 === 0 || done + failed === todo.length) {
        console.log(`  ${done + failed}/${todo.length}  (${failed} failed)`);
        fs.writeFileSync(mapPath, JSON.stringify(map, null, 2)); // checkpoint
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));

  console.log(`\nWrote ${mapPath}`);
  console.log(`  ${Object.keys(map).length}/${all.length} images mapped`);
  if (failed) console.log(`  ${failed} failed — re-run to retry just those`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
