import { DataSource } from 'typeorm';
import { City } from '../modules/locations/entities/city.entity';
import { SubLocation } from '../modules/locations/entities/sub-location.entity';

export async function seedLocations(dataSource: DataSource) {
  const cityRepo = dataSource.getRepository(City);
  const subLocationRepo = dataSource.getRepository(SubLocation);

  console.log('🌍 Seeding locations...');

  // Indian Cities with popular areas
  const locationsData = [
    {
      city: { name: 'Mumbai', state: 'Maharashtra', country: 'India' },
      subLocations: [
        { name: 'Andheri', zipCode: '400053' },
        { name: 'Bandra', zipCode: '400050' },
        { name: 'Powai', zipCode: '400076' },
        { name: 'Malad', zipCode: '400064' },
        { name: 'Borivali', zipCode: '400066' },
        { name: 'Goregaon', zipCode: '400063' },
        { name: 'Vile Parle', zipCode: '400056' },
      ],
    },
    {
      city: { name: 'Delhi', state: 'Delhi', country: 'India' },
      subLocations: [
        { name: 'Connaught Place', zipCode: '110001' },
        { name: 'Karol Bagh', zipCode: '110005' },
        { name: 'Lajpat Nagar', zipCode: '110024' },
        { name: 'Dwarka', zipCode: '110075' },
        { name: 'Rohini', zipCode: '110085' },
        { name: 'Saket', zipCode: '110017' },
      ],
    },
    {
      city: { name: 'Bangalore', state: 'Karnataka', country: 'India' },
      subLocations: [
        { name: 'Koramangala', zipCode: '560034' },
        { name: 'Indiranagar', zipCode: '560038' },
        { name: 'Whitefield', zipCode: '560066' },
        { name: 'HSR Layout', zipCode: '560102' },
        { name: 'Electronic City', zipCode: '560100' },
        { name: 'Marathahalli', zipCode: '560037' },
      ],
    },
    {
      city: { name: 'Pune', state: 'Maharashtra', country: 'India' },
      subLocations: [
        { name: 'Koregaon Park', zipCode: '411001' },
        { name: 'Hinjewadi', zipCode: '411057' },
        { name: 'Wakad', zipCode: '411057' },
        { name: 'Viman Nagar', zipCode: '411014' },
        { name: 'Kharadi', zipCode: '411014' },
      ],
    },
    {
      city: { name: 'Hyderabad', state: 'Telangana', country: 'India' },
      subLocations: [
        { name: 'HITEC City', zipCode: '500081' },
        { name: 'Gachibowli', zipCode: '500032' },
        { name: 'Banjara Hills', zipCode: '500034' },
        { name: 'Jubilee Hills', zipCode: '500033' },
        { name: 'Kondapur', zipCode: '500084' },
      ],
    },
    {
      city: { name: 'Chennai', state: 'Tamil Nadu', country: 'India' },
      subLocations: [
        { name: 'T Nagar', zipCode: '600017' },
        { name: 'Adyar', zipCode: '600020' },
        { name: 'Velachery', zipCode: '600042' },
        { name: 'Anna Nagar', zipCode: '600040' },
        { name: 'OMR', zipCode: '600097' },
      ],
    },
    {
      city: { name: 'Kolkata', state: 'West Bengal', country: 'India' },
      subLocations: [
        { name: 'Salt Lake', zipCode: '700091' },
        { name: 'Park Street', zipCode: '700016' },
        { name: 'Howrah', zipCode: '711101' },
        { name: 'New Town', zipCode: '700156' },
      ],
    },
  ];

  // Seed cities and sub-locations
  for (const locationData of locationsData) {
    // Check if city already exists
    let city = await cityRepo.findOne({
      where: { name: locationData.city.name },
    });

    if (!city) {
      city = cityRepo.create(locationData.city);
      city = await cityRepo.save(city);
      console.log(`✅ Created city: ${city.name}`);
    } else {
      console.log(`ℹ️  City already exists: ${city.name}`);
    }

    // Seed sub-locations for this city
    for (const subLocData of locationData.subLocations) {
      const existingSubLoc = await subLocationRepo.findOne({
        where: { name: subLocData.name, city: { id: city.id } },
      });

      if (!existingSubLoc) {
        const subLocation = subLocationRepo.create({
          ...subLocData,
          city,
        });
        await subLocationRepo.save(subLocation);
        console.log(`  ✅ Created sub-location: ${subLocData.name}`);
      }
    }
  }

  console.log('✅ Location seeding completed!');
}
