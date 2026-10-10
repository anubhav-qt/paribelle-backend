import { Client } from 'pg';

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'marketplace',
});

async function updateVendorLocations() {
  await client.connect();
  console.log('✓ Database connected\n');

  // Get all vendors
  const vendorsResult = await client.query(
    'SELECT id, "storeName" FROM vendors ORDER BY "createdAt"'
  );
  const vendors = vendorsResult.rows;
  console.log(`📦 Found ${vendors.length} vendors`);

  if (vendors.length === 0) {
    console.log('❌ No vendors found');
    await client.end();
    return;
  }

  // Get all cities with their sublocations
  const citiesResult = await client.query(`
    SELECT c.id, c.name, c.state, c.country,
           json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL) as sublocations
    FROM cities c
    LEFT JOIN sub_locations s ON s."cityId" = c.id
    GROUP BY c.id, c.name, c.state, c.country
    ORDER BY c.name
  `);
  const cities = citiesResult.rows;
  console.log(`📍 Found ${cities.length} cities\n`);

  if (cities.length === 0) {
    console.log('❌ No cities found. Please run seed-locations script first.');
    await client.end();
    return;
  }

  // Leave the first vendor without location for testing
  const vendorToSkip = vendors[0];
  console.log(`⚠️  Leaving vendor "${vendorToSkip.storeName}" WITHOUT location for testing\n`);

  // Update remaining vendors with locations
  let updatedCount = 0;
  for (let i = 1; i < vendors.length; i++) {
    const vendor = vendors[i];
    
    // Distribute vendors across cities
    const cityIndex = (i - 1) % cities.length;
    const city = cities[cityIndex];
    
    // Select a sublocation from the city
    let subLocationId = null;
    let subLocationName = '';
    if (city.sublocations && city.sublocations.length > 0) {
      const subLocIndex = (i - 1) % city.sublocations.length;
      subLocationId = city.sublocations[subLocIndex].id;
      subLocationName = city.sublocations[subLocIndex].name;
    }

    // Update vendor
    await client.query(
      `UPDATE vendors 
       SET "cityId" = $1, 
           "subLocationId" = $2, 
           city = $3, 
           state = $4, 
           country = $5
       WHERE id = $6`,
      [city.id, subLocationId, city.name, city.state, city.country || 'India', vendor.id]
    );
    
    console.log(`  ✓ "${vendor.storeName}" -> ${city.name}${subLocationName ? ` / ${subLocationName}` : ''}`);
    updatedCount++;
  }

  console.log(`\n✅ Successfully updated ${updatedCount} vendor(s) with locations`);
  console.log(`📍 1 vendor left without location for testing purposes`);

  // Show final results
  console.log('\n📋 Final vendor locations:');
  const results = await client.query(`
    SELECT v."storeName", c.name as city, s.name as sublocation
    FROM vendors v
    LEFT JOIN cities c ON c.id = v."cityId"
    LEFT JOIN sub_locations s ON s.id = v."subLocationId"
    ORDER BY v."createdAt"
  `);
  
  results.rows.forEach((row, idx) => {
    const location = row.city ? `${row.city}${row.sublocation ? ` / ${row.sublocation}` : ''}` : '❌ No location';
    console.log(`  ${idx + 1}. ${row.storeName}: ${location}`);
  });

  await client.end();
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
