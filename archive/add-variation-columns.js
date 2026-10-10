const { DataSource } = require('typeorm');

async function addVariationColumns() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();

    console.log('Adding product variation columns...');

    // Add columns
    await queryRunner.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS "isParent" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "parentProductId" uuid,
      ADD COLUMN IF NOT EXISTS "variationAttributes" jsonb,
      ADD COLUMN IF NOT EXISTS "variationThemes" text[];
    `);

    console.log('✓ Columns added successfully');

    // Add foreign key
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'FK_products_parent'
        ) THEN
          ALTER TABLE products 
          ADD CONSTRAINT FK_products_parent 
          FOREIGN KEY ("parentProductId") 
          REFERENCES products(id) 
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    console.log('✓ Foreign key added successfully');

    // Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_PRODUCTS_PARENT_ID" 
      ON products("parentProductId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_PRODUCTS_IS_PARENT" 
      ON products("isParent");
    `);

    console.log('✓ Indexes added successfully');
    console.log('\n✅ Product variation schema updated successfully!');

    await queryRunner.release();
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    process.exit(1);
  }
}

addVariationColumns();
