const { Client } = require('pg');
require('dotenv').config();

async function addCascadeDelete() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'marketplace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop the existing foreign key constraint
    console.log('Dropping existing foreign key constraint...');
    await client.query(`
      ALTER TABLE "reviews" 
      DROP CONSTRAINT IF EXISTS "FK_9482e9567d8dcc2bc615981ef44"
    `);
    console.log('✓ Dropped existing constraint');

    // Add the foreign key constraint with CASCADE delete
    console.log('Adding CASCADE delete constraint...');
    await client.query(`
      ALTER TABLE "reviews" 
      ADD CONSTRAINT "FK_9482e9567d8dcc2bc615981ef44" 
      FOREIGN KEY ("product_id") 
      REFERENCES "products"("id") 
      ON DELETE CASCADE
    `);
    console.log('✓ Added CASCADE delete constraint');

    console.log('\n✅ Migration completed successfully!');
    console.log('Reviews will now be automatically deleted when a product is deleted.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addCascadeDelete();
