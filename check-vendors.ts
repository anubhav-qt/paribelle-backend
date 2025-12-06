import { DataSource } from 'typeorm';
import { Vendor } from './src/modules/vendors/vendor.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'marketplace',
  entities: [Vendor],
  synchronize: false,
});

async function checkVendors() {
  await AppDataSource.initialize();
  console.log('Database connected!');

  const vendorRepo = AppDataSource.getRepository(Vendor);
  
  const allVendors = await vendorRepo.find();
  console.log(`\nTotal vendors: ${allVendors.length}`);
  
  allVendors.forEach((vendor, index) => {
    console.log(`\n${index + 1}. ${vendor.storeName}`);
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Business Name: ${vendor.businessName || 'N/A'}`);
    console.log(`   Subdomain: ${vendor.subdomain || 'NOT SET'}`);
    console.log(`   Status: ${vendor.status}`);
  });

  const vendorsWithSubdomain = allVendors.filter(v => v.subdomain);
  console.log(`\n\nVendors with subdomain: ${vendorsWithSubdomain.length}`);
  
  await AppDataSource.destroy();
}

checkVendors().catch(console.error);
