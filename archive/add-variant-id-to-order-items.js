const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'marketplace' });
c.connect()
  .then(() => c.query(`
    ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS variant_id UUID
      REFERENCES product_variants(id) ON DELETE SET NULL
  `))
  .then(() => c.query(`
    CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id)
  `))
  .then(() => {
    console.log('variant_id column added to order_items successfully');
    c.end();
  })
  .catch(e => { console.error(e.message); c.end(); });
