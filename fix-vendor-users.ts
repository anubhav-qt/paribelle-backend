import { DataSource } from 'typeorm';
import { User, UserRole } from './src/modules/users/user.entity';
import { Vendor } from './src/modules/vendors/vendor.entity';

async function fixVendorUsers() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'marketplace_db',
    entities: [User, Vendor],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected');

  const userRepository = dataSource.getRepository(User);
  const vendorRepository = dataSource.getRepository(Vendor);

  // Get all vendors
  const vendors = await vendorRepository.find({ relations: ['user'] });
  console.log(`Found ${vendors.length} vendors`);

  for (const vendor of vendors) {
    if (vendor.userId) {
      const user = await userRepository.findOne({ where: { id: vendor.userId } });
      if (user && !user.vendorId) {
        user.vendorId = vendor.id;
        await userRepository.save(user);
        console.log(`✅ Updated ${user.email} with vendorId: ${vendor.id}`);
      } else if (user && user.vendorId) {
        console.log(`ℹ️  ${user.email} already has vendorId: ${user.vendorId}`);
      }
    }
  }

  // Verify
  const vendorUsers = await userRepository.find({ 
    where: { role: UserRole.VENDOR_ADMIN },
    relations: ['vendor']
  });
  
  console.log('\n📋 Vendor Users Status:');
  for (const user of vendorUsers) {
    console.log(`  ${user.email}: vendorId = ${user.vendorId || 'NULL'}`);
  }

  await dataSource.destroy();
  console.log('\n✅ Done!');
}

fixVendorUsers().catch(console.error);
