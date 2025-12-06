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

async function updateBusinessNames() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected!\n');

    // Update businessName to be the same as storeName if it's empty
    const result = await AppDataSource.query(`
      UPDATE vendors 
      SET "businessName" = "storeName"
      WHERE "businessName" IS NULL OR "businessName" = ''
    `);
    
    console.log(`✅ Updated ${result[1]} vendors with businessName\n`);

    // Show all vendors
    const vendors = await AppDataSource.query(`
      SELECT id, "storeName", "businessName", subdomain 
      FROM vendors
    `);
    
    console.log('All vendors:');
    console.table(vendors);
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateBusinessNames();
