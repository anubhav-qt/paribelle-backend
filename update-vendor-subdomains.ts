import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'marketplace',
  synchronize: false,
});

async function updateVendorSubdomains() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected!\n');

    // Check current state
    const currentVendors = await AppDataSource.query(`
      SELECT id, "storeName", "businessName", subdomain, slug 
      FROM vendors 
      LIMIT 5
    `);
    
    console.log('Current vendor data (first 5):');
    console.table(currentVendors);

    // Update vendors to have subdomains based on their slug
    const result1 = await AppDataSource.query(`
      UPDATE vendors 
      SET subdomain = LOWER(REPLACE(slug, ' ', '-'))
      WHERE subdomain IS NULL AND slug IS NOT NULL
    `);
    
    console.log(`\n✅ Updated ${result1[1]} vendors using slug`);

    // For vendors without slugs or still without subdomain, use storeName
    const result2 = await AppDataSource.query(`
      UPDATE vendors 
      SET subdomain = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("storeName", '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'))
      WHERE subdomain IS NULL
    `);
    
    console.log(`✅ Updated ${result2[1]} vendors using storeName\n`);

    // Verify the update
    const updatedVendors = await AppDataSource.query(`
      SELECT id, "storeName", "businessName", subdomain, status 
      FROM vendors
    `);
    
    console.log('Updated vendor data (all vendors):');
    console.table(updatedVendors);

    console.log(`\n✅ All done! Total vendors: ${updatedVendors.length}`);
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateVendorSubdomains();
