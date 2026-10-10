const { Client } = require('pg');

async function addArchivedStatus() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'marketplace',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add 'archived' to products_status_enum
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'archived' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'products_status_enum')
        ) THEN
          ALTER TYPE products_status_enum ADD VALUE 'archived';
          RAISE NOTICE 'Added archived status to enum';
        ELSE
          RAISE NOTICE 'archived status already exists';
        END IF;
      END $$;
    `);

    console.log('✅ Successfully added archived status to products_status_enum');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addArchivedStatus();
