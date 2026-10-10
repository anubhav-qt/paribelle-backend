import { DataSource } from 'typeorm';
import { City } from '../modules/locations/entities/city.entity';
import { SubLocation } from '../modules/locations/entities/sub-location.entity';
import { Vendor } from '../modules/vendors/vendor.entity';
import { User } from '../modules/users/user.entity';
import { Product } from '../modules/products/product.entity';
import { Category } from '../modules/categories/category.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'marketplace',
  entities: [City, SubLocation, Vendor, User, Product, Category],
  synchronize: false,
});

async function updateVendorLocations() {
  await AppDataSource.initialize();
  console.log('✓ Database connected');

  const cityRepository = AppDataSource.getRepository(City);
  const vendorRepository = AppDataSource.getRepository(Vendor);

  // Get all vendors
  const vendors = await vendorRepository.find();
  console.log(`\n📦 Found ${vendors.length} vendors`);

  if (vendors.length === 0) {
    console.log('❌ No vendors found');
    await AppDataSource.destroy();
    return;
  }

  // Get available cities with sublocations
  const cities = await cityRepository.find({ relations: ['subLocations'] });
  console.log(`📍 Found ${cities.length} cities`);

  if (cities.length === 0) {
    console.log('❌ No cities found. Please run seed-locations script first.');
    await AppDataSource.destroy();
    return;
  }

  // Leave the first vendor without location for testing
  const vendorToSkip = vendors[0];
  console.log(`\n⚠️  Leaving vendor "${vendorToSkip.storeName}" (${vendorToSkip.id}) WITHOUT location for testing\n`);

  // Update remaining vendors with locations
  let updatedCount = 0;
  for (let i = 1; i < vendors.length; i++) {
    const vendor = vendors[i];
    
    // Distribute vendors across cities
    const cityIndex = (i - 1) % cities.length;
    const city = cities[cityIndex];
    
    // Select a sublocation from the city
    let subLocation: SubLocation | null = null;
    if (city.subLocations && city.subLocations.length > 0) {
      const subLocIndex = (i - 1) % city.subLocations.length;
      subLocation = city.subLocations[subLocIndex];
    }

    // Update vendor
    vendor.cityId = city.id;
    if (subLocation) {
      vendor.subLocationId = subLocation.id;
    }
    vendor.city = city.name;
    if (city.state) {
      vendor.state = city.state;
    }
    vendor.country = city.country || 'India';

    await vendorRepository.save(vendor);
    
    console.log(`  ✓ "${vendor.storeName}" -> ${city.name}${subLocation ? ` / ${subLocation.name}` : ''}`);
    updatedCount++;
  }

  console.log(`\n✅ Successfully updated ${updatedCount} vendor(s) with locations`);
  console.log(`📍 1 vendor left without location for testing purposes`);

  await AppDataSource.destroy();
}

updateVendorLocations()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
