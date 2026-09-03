#!/usr/bin/env node

/**
 * Writes the exact ZIP that GET /products/template-simple/download serves, so
 * the template can be inspected offline without standing up the API.
 *
 * generateSimpleTemplate() touches none of the service's injected
 * dependencies, so the prototype is invoked directly rather than constructing
 * the Nest provider.
 *
 *   node dump-import-template.js [out.zip]
 */
const fs = require('fs');
const { ProductsExcelService } = require('./dist/modules/products/products-excel.service');

async function main() {
  const out = process.argv[2] || 'products-template-simple.zip';
  const svc = Object.create(ProductsExcelService.prototype);
  const buf = await svc.generateSimpleTemplate();
  fs.writeFileSync(out, buf);
  console.log(`Wrote ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
