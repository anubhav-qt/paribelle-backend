const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

const services = [
  // Daily booking services
  { name: 'Yoga & Meditation Class', type: 'daily', price: 500, capacity: 30, category: 'Wellness' },
  { name: 'Swimming Pool Access', type: 'daily', price: 300, capacity: 50, category: 'Sports' },
  { name: 'Gym Membership - Day Pass', type: 'daily', price: 400, capacity: 40, category: 'Fitness' },
  { name: 'Photography Studio Rental', type: 'daily', price: 3000, capacity: 5, category: 'Services' },
  { name: 'Conference Room Booking', type: 'daily', price: 5000, capacity: 20, category: 'Business' },
  { name: 'Art Workshop', type: 'daily', price: 1200, capacity: 15, category: 'Education' },
  { name: 'Cooking Class', type: 'daily', price: 1500, capacity: 12, category: 'Education' },
  { name: 'Dance Studio Rental', type: 'daily', price: 2000, capacity: 25, category: 'Entertainment' },
  { name: 'Tennis Court Booking', type: 'daily', price: 800, capacity: 4, category: 'Sports' },
  { name: 'Spa Day Package', type: 'daily', price: 3500, capacity: 10, category: 'Wellness' },
  { name: 'Golf Course Access', type: 'daily', price: 2500, capacity: 40, category: 'Sports' },
  { name: 'Rock Climbing Session', type: 'daily', price: 900, capacity: 20, category: 'Sports' },
  { name: 'Pottery Making Class', type: 'daily', price: 1000, capacity: 10, category: 'Art' },
  { name: 'Music Studio Booking', type: 'daily', price: 2500, capacity: 5, category: 'Entertainment' },
  { name: 'Badminton Court', type: 'daily', price: 600, capacity: 4, category: 'Sports' },
  
  // Hourly booking services
  { name: 'Personal Training Session', type: 'hourly', price: 800, capacity: 1, category: 'Fitness' },
  { name: 'Massage Therapy', type: 'hourly', price: 1200, capacity: 1, category: 'Wellness' },
  { name: 'Private Tutor - Math', type: 'hourly', price: 600, capacity: 1, category: 'Education' },
  { name: 'Language Classes', type: 'hourly', price: 700, capacity: 5, category: 'Education' },
  { name: 'Music Lessons - Piano', type: 'hourly', price: 900, capacity: 1, category: 'Music' },
  { name: 'Guitar Lessons', type: 'hourly', price: 800, capacity: 1, category: 'Music' },
  { name: 'Photography Session', type: 'hourly', price: 1500, capacity: 1, category: 'Services' },
  { name: 'Career Counseling', type: 'hourly', price: 1000, capacity: 1, category: 'Consulting' },
  { name: 'Legal Consultation', type: 'hourly', price: 2000, capacity: 1, category: 'Professional' },
  { name: 'Financial Planning', type: 'hourly', price: 1800, capacity: 1, category: 'Professional' },
  { name: 'Makeup Artist Booking', type: 'hourly', price: 1500, capacity: 1, category: 'Beauty' },
  { name: 'Hair Styling Service', type: 'hourly', price: 1200, capacity: 1, category: 'Beauty' },
  { name: 'Nutritionist Consultation', type: 'hourly', price: 1100, capacity: 1, category: 'Health' },
  { name: 'Physiotherapy Session', type: 'hourly', price: 1000, capacity: 1, category: 'Health' },
  { name: 'Pet Grooming Service', type: 'hourly', price: 800, capacity: 2, category: 'Pet Care' }
];

function generateAvailability(serviceType, capacity) {
  // Build availableDays array
  const availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // Build timeSlots array - this is what the backend expects
  const timeSlots = [];
  if (serviceType === 'hourly') {
    // Hourly slots from 9 AM to 6 PM
    for (let hour = 9; hour < 18; hour++) {
      timeSlots.push({
        start: `${hour.toString().padStart(2, '0')}:00`,
        end: `${(hour + 1).toString().padStart(2, '0')}:00`
      });
    }
  } else {
    // Daily booking - single full-day slot
    timeSlots.push({
      start: '09:00',
      end: '18:00'
    });
  }

  return { availableDays, timeSlots };
}

function generateUnavailableDates() {
  const dates = [];
  const today = new Date();
  
  // Add 3-5 random unavailable dates in the next 2 months
  const count = Math.floor(Math.random() * 3) + 3;
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + Math.floor(Math.random() * 60) + 1);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  return dates;
}

function generateImages(count) {
  const images = [];
  for (let i = 1; i <= count; i++) {
    images.push(`https://picsum.photos/seed/service${Math.random().toString(36).substring(7)}/800/600`);
  }
  return images;
}

async function seedServiceProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Delete only existing service/booking products
    console.log('\n🗑️  Deleting existing service/booking products...');
    const deleteResult = await client.query("DELETE FROM products WHERE product_type = 'booking' AND attributes->>'booking' IS NOT NULL AND attributes->'tour' IS NULL");
    console.log(`   Deleted ${deleteResult.rowCount} service products`);
    
    // Delete all existing bookings
    console.log('🗑️  Deleting all existing bookings...');
    const deleteBookings = await client.query('DELETE FROM bookings');
    console.log(`   Deleted ${deleteBookings.rowCount} bookings\n`);

    // Get vendor
    const vendorResult = await client.query(
      "SELECT id FROM vendors WHERE store_name = 'Service Hub' LIMIT 1"
    );
    
    let vendorId;
    if (vendorResult.rows.length === 0) {
      console.log('Creating service vendor...');
      
      // First, get or create a user for the vendor
      let userId;
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = 'service@hub.com' LIMIT 1"
      );
      
      if (userResult.rows.length === 0) {
        const newUser = await client.query(
          `INSERT INTO users (email, password, first_name, last_name, role)
           VALUES ('service@hub.com', '$2a$10$dummyhashedpassword123456789012345678901234567890', 'Service', 'Hub', 'vendor')
           RETURNING id`
        );
        userId = newUser.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
      }
      
      const newVendor = await client.query(
        `INSERT INTO vendors (user_id, store_name, slug, description, contact_email, contact_phone, status, kyc_status)
         VALUES ($1, 'Service Hub', 'service-hub', 'Premium service bookings and classes', 'service@hub.com', '9123456780', 'active', 'approved')
         RETURNING id`,
        [userId]
      );
      vendorId = newVendor.rows[0].id;
    } else {
      vendorId = vendorResult.rows[0].id;
    }

    console.log(`Using vendor ID: ${vendorId}`);
    console.log('\n📅 Creating 30 service booking products...\n');

    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      const { availableDays, timeSlots } = generateAvailability(service.type, service.capacity);
      const unavailableDates = generateUnavailableDates();
      const images = generateImages(4);
      
      const slug = service.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const description = service.type === 'daily'
        ? `Book your ${service.name} session for a full day of enjoyment. Perfect for ${service.category.toLowerCase()} enthusiasts. Our facilities offer world-class amenities and professional staff to ensure the best experience. Capacity: ${service.capacity} persons per day.`
        : `Professional ${service.name} service available by the hour. Book your preferred time slot with our experienced professionals. Each session is personalized to meet your specific needs. Duration: 1 hour per session.`;
      
      const shortDescription = service.type === 'daily'
        ? `Full day ${service.category} access - ${service.capacity} capacity`
        : `Hourly ${service.category} service - Professional quality`;

      const bookingAttributes = {
        booking: {
          duration: service.type === 'hourly' ? 1 : 1,
          durationUnit: service.type === 'hourly' ? 'hours' : 'days',
          bufferTime: service.type === 'hourly' ? 15 : 0,
          availableDays: availableDays,
          timeSlots: timeSlots,
          maxCapacity: service.capacity,
          unavailableDates: unavailableDates
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
          service.name,
          slug,
          description,
          shortDescription,
          service.price,
          Math.floor(service.price * 1.25), // Compare at price
          'booking',
          `SRV-${slug.toUpperCase().substring(0, 10)}-${Math.floor(Math.random() * 999) + 1}`,
          images, // Pass array directly, not JSON.stringify
          'active',
          (Math.random() * 1 + 4).toFixed(1), // Rating between 4.0 and 5.0
          Math.floor(Math.random() * 80) + 20, // Review count
          JSON.stringify(bookingAttributes)
        ]
      );

      const emoji = service.type === 'daily' ? '📅' : '⏰';
      console.log(`✅ ${i + 1}. ${emoji} ${service.name} (${service.type}, capacity: ${service.capacity})`);
    }

    console.log('\n🎉 Successfully created 30 service booking products!\n');
    console.log('📅 15 Daily booking services (full-day access)');
    console.log('⏰ 15 Hourly booking services (time-slot based)');
    console.log('\nYou can now test service bookings with availability calendar and time slot management.');

  } catch (error) {
    console.error('Error seeding service products:', error);
  } finally {
    await client.end();
  }
}

seedServiceProducts();
