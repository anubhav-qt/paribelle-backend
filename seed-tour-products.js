const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

const tours = [
  { name: 'Kerala Backwaters Houseboat - 5 Days', destination: 'Kerala', duration: 5, price: 35000 },
  { name: 'Rajasthan Heritage Tour - 10 Days', destination: 'Rajasthan', duration: 10, price: 45000 },
  { name: 'Goa Beach Paradise - 4 Days', destination: 'Goa', duration: 4, price: 25000 },
  { name: 'Himalayan Trekking Adventure - 7 Days', destination: 'Himalayas', duration: 7, price: 38000 },
  { name: 'Golden Triangle Tour - 6 Days', destination: 'Delhi-Agra-Jaipur', duration: 6, price: 32000 },
  { name: 'Ladakh Bike Expedition - 12 Days', destination: 'Ladakh', duration: 12, price: 55000 },
  { name: 'Andaman Island Hopping - 6 Days', destination: 'Andaman', duration: 6, price: 42000 },
  { name: 'Kashmir Valley Tour - 5 Days', destination: 'Kashmir', duration: 5, price: 36000 },
  { name: 'South India Temple Circuit - 8 Days', destination: 'Tamil Nadu', duration: 8, price: 34000 },
  { name: 'Northeast Explorer - 9 Days', destination: 'Assam-Meghalaya', duration: 9, price: 41000 },
  { name: 'Mumbai City & Beaches - 4 Days', destination: 'Mumbai', duration: 4, price: 28000 },
  { name: 'Uttarakhand Spiritual Journey - 7 Days', destination: 'Uttarakhand', duration: 7, price: 33000 },
  { name: 'Rann of Kutch Festival - 3 Days', destination: 'Gujarat', duration: 3, price: 22000 },
  { name: 'Sikkim Monastery Tour - 6 Days', destination: 'Sikkim', duration: 6, price: 37000 },
  { name: 'Coorg Coffee Plantation - 4 Days', destination: 'Karnataka', duration: 4, price: 26000 },
  { name: 'Varanasi & Khajuraho - 5 Days', destination: 'Uttar Pradesh', duration: 5, price: 29000 },
  { name: 'Madhya Pradesh Wildlife Safari - 6 Days', destination: 'Madhya Pradesh', duration: 6, price: 39000 },
  { name: 'Mysore Palace & Gardens - 3 Days', destination: 'Mysore', duration: 3, price: 21000 },
  { name: 'Jaisalmer Desert Safari - 5 Days', destination: 'Rajasthan', duration: 5, price: 31000 },
  { name: 'Shimla Manali Honeymoon - 6 Days', destination: 'Himachal Pradesh', duration: 6, price: 34000 },
  { name: 'Pondicherry French Quarter - 3 Days', destination: 'Pondicherry', duration: 3, price: 19000 },
  { name: 'Hampi Heritage Walk - 4 Days', destination: 'Karnataka', duration: 4, price: 24000 },
  { name: 'Munnar Tea Estates - 4 Days', destination: 'Kerala', duration: 4, price: 27000 },
  { name: 'Ooty Hill Station - 3 Days', destination: 'Tamil Nadu', duration: 3, price: 20000 },
  { name: 'Amritsar Golden Temple - 3 Days', destination: 'Punjab', duration: 3, price: 23000 },
  { name: 'Darjeeling Tea & Trains - 5 Days', destination: 'West Bengal', duration: 5, price: 30000 },
  { name: 'Sundarbans Wildlife - 4 Days', destination: 'West Bengal', duration: 4, price: 32000 },
  { name: 'Udaipur City of Lakes - 4 Days', destination: 'Rajasthan', duration: 4, price: 28000 },
  { name: 'Konark Sun Temple & Beaches - 3 Days', destination: 'Odisha', duration: 3, price: 22000 },
  { name: 'Spiti Valley Adventure - 10 Days', destination: 'Himachal Pradesh', duration: 10, price: 48000 }
];

function generateDepartures(tourName, duration, basePrice) {
  const departures = [];
  const today = new Date();
  
  // Generate 4 departures over the next 6 months
  for (let i = 1; i <= 4; i++) {
    const departureDate = new Date(today);
    departureDate.setDate(departureDate.getDate() + (i * 30) + Math.floor(Math.random() * 15));
    
    const returnDate = new Date(departureDate);
    returnDate.setDate(returnDate.getDate() + duration);
    
    departures.push({
      id: `dep-${Date.now()}-${i}`,
      departureDate: departureDate.toISOString().split('T')[0],
      returnDate: returnDate.toISOString().split('T')[0],
      availableSeats: 20,
      bookedSeats: Math.floor(Math.random() * 5), // Random bookings 0-4
      pricePerPerson: basePrice, // Use the tour's base price
      status: 'available'
    });
  }
  
  return departures;
}

function generateItinerary(tourName, duration) {
  const itinerary = [];
  
  for (let day = 1; day <= duration; day++) {
    const isFirstDay = day === 1;
    const isLastDay = day === duration;
    
    itinerary.push({
      day: day,
      title: isFirstDay ? 'Arrival & Check-in' : isLastDay ? 'Departure' : `Day ${day} - Exploration`,
      description: isFirstDay 
        ? 'Arrive at destination, meet your guide, transfer to hotel and check-in. Evening briefing and welcome dinner.'
        : isLastDay
        ? 'Breakfast at hotel, check-out and transfer to airport/railway station. Tour ends with beautiful memories.'
        : `Full day of sightseeing and activities. Visit local attractions, cultural sites, and experience authentic local cuisine.`,
      activities: isFirstDay
        ? ['Airport/Station pickup', 'Hotel check-in', 'Welcome briefing', 'Welcome dinner']
        : isLastDay
        ? ['Breakfast', 'Check-out', 'Transfer to departure point', 'End of tour']
        : ['Morning sightseeing', 'Lunch at local restaurant', 'Afternoon activities', 'Evening free time'],
      meals: isFirstDay
        ? ['Dinner']
        : isLastDay
        ? ['Breakfast']
        : ['Breakfast', 'Lunch', 'Dinner'],
      accommodation: isLastDay ? null : '4-star hotel with modern amenities'
    });
  }
  
  return itinerary;
}

function generateImages(count) {
  const images = [];
  for (let i = 1; i <= count; i++) {
    images.push(`https://picsum.photos/seed/tour${Math.random().toString(36).substring(7)}/1200/800`);
  }
  return images;
}

async function seedTourProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Delete only existing tour products
    console.log('\n🗑️  Deleting existing tour products...');
    const deleteResult = await client.query("DELETE FROM products WHERE product_type = 'booking' AND attributes->'tour' IS NOT NULL");
    console.log(`   Deleted ${deleteResult.rowCount} tour products`);
    
    // Delete all existing bookings
    console.log('🗑️  Deleting all existing bookings...');
    const deleteBookings = await client.query('DELETE FROM bookings');
    console.log(`   Deleted ${deleteBookings.rowCount} bookings\n`);

    // Get vendor
    const vendorResult = await client.query(
      "SELECT id FROM vendors WHERE store_name = 'Adventure Tours' LIMIT 1"
    );
    
    let vendorId;
    if (vendorResult.rows.length === 0) {
      console.log('Creating tour vendor...');
      
      // First, get or create a user for the vendor
      let userId;
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = 'tours@adventure.com' LIMIT 1"
      );
      
      if (userResult.rows.length === 0) {
        const newUser = await client.query(
          `INSERT INTO users (email, password, first_name, last_name, role)
           VALUES ('tours@adventure.com', '$2a$10$dummyhashedpassword123456789012345678901234567890', 'Adventure', 'Tours', 'vendor')
           RETURNING id`
        );
        userId = newUser.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
      }
      
      const newVendor = await client.query(
        `INSERT INTO vendors (user_id, store_name, slug, description, contact_email, contact_phone, status, kyc_status)
         VALUES ($1, 'Adventure Tours', 'adventure-tours', 'Premium tour packages across India', 'tours@adventure.com', '9876543210', 'active', 'approved')
         RETURNING id`,
        [userId]
      );
      vendorId = newVendor.rows[0].id;
    } else {
      vendorId = vendorResult.rows[0].id;      // Update KYC status to approved
      await client.query(
        "UPDATE vendors SET kyc_status = 'approved' WHERE id = $1",
        [vendorId]
      );    }

    console.log(`Using vendor ID: ${vendorId}`);
    console.log('\n✈️  Creating 30 tour packages...\n');

    for (let i = 0; i < tours.length; i++) {
      const tour = tours[i];
      const departures = generateDepartures(tour.name, tour.duration, tour.price);
      const itinerary = generateItinerary(tour.name, tour.duration);
      const images = generateImages(5);
      
      const slug = tour.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const description = `Explore ${tour.destination} with our expertly curated ${tour.duration}-day tour package. Experience local culture, cuisine, and breathtaking landscapes with experienced guides. All-inclusive package with accommodation, meals, and transportation. Perfect for families, couples, and solo travelers.`;
      
      const shortDescription = `${tour.duration}-day tour to ${tour.destination} - All-inclusive package`;

      const tourAttributes = {
        tour: {
          tourMode: true,
          departures: departures,
          itinerary: itinerary,
          details: {
            destinations: [tour.destination],
            difficulty: ['Easy', 'Moderate', 'Challenging'][Math.floor(Math.random() * 3)],
            groupSize: { min: 4, max: 20 },
            ageRange: '5-80 years',
            languages: ['English', 'Hindi'],
            pickupLocation: `${tour.destination} Airport/Railway Station`,
            inclusions: [
              'Accommodation in 4-star hotels',
              'Daily breakfast, lunch, and dinner',
              'All transfers and transportation',
              'Professional tour guide',
              'Entrance fees to monuments',
              'Travel insurance'
            ],
            exclusions: [
              'International flights',
              'Personal expenses',
              'Tips and gratuities',
              'Alcoholic beverages',
              'Optional activities'
            ],
            accommodation: '4-star hotels',
            transportation: 'Private AC vehicle',
            pickupPoints: [],
            dropPoints: []
          },
          additionalInfo: [
            'Passport required for identification',
            'Comfortable walking shoes recommended',
            'Weather-appropriate clothing',
            'Camera and binoculars suggested',
            'Travel insurance recommended'
          ]
        }
      };

      await client.query(
        `INSERT INTO products (
          vendor_id, name, slug, description, short_description, price, compare_at_price,
          product_type, sku, images, status, average_rating, review_count,
          attributes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
        [
          vendorId,
          tour.name,
          slug,
          description,
          shortDescription,
          tour.price,
          Math.floor(tour.price * 1.15), // Compare at price
          'booking',
          `TOUR-${slug.toUpperCase().substring(0, 10)}-${Math.floor(Math.random() * 999) + 1}`,
          images,
          'active',
          (Math.random() * 1 + 4).toFixed(1), // Rating between 4.0 and 5.0
          Math.floor(Math.random() * 150) + 50, // Review count
          JSON.stringify(tourAttributes)
        ]
      );

      console.log(`✅ ${i + 1}. ${tour.name} - ${tour.duration} days (${departures.length} departures)`);
    }

    console.log('\n🎉 Successfully created 30 tour packages!\n');
    console.log('You can now test tour bookings with departures, itineraries, and seat management.');

  } catch (error) {
    console.error('Error seeding tour products:', error);
  } finally {
    await client.end();
  }
}

seedTourProducts();
