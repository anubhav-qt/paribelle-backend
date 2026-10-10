const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace',
});

async function checkBookingPrices() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check bookings and their prices
    const result = await client.query(`
      SELECT 
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.total_price,
        b.customer_name,
        p.name as product_name,
        p.price as product_price
      FROM bookings b
      LEFT JOIN products p ON b.product_id = p.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    console.log('Recent bookings:');
    console.log('═'.repeat(120));
    
    if (result.rows.length === 0) {
      console.log('No bookings found in database');
    } else {
      result.rows.forEach((booking, index) => {
        console.log(`\n${index + 1}. Booking ID: ${booking.id}`);
        console.log(`   Product: ${booking.product_name}`);
        console.log(`   Date: ${booking.booking_date}`);
        console.log(`   Time: ${booking.start_time || 'N/A'} - ${booking.end_time || 'N/A'}`);
        console.log(`   Customer: ${booking.customer_name}`);
        console.log(`   Product Price: ₹${booking.product_price}`);
        console.log(`   Booking Total Price: ₹${booking.total_price}`);
        
        if (parseFloat(booking.total_price) === 0) {
          console.log(`   ⚠️  WARNING: Total price is 0!`);
        }
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkBookingPrices();
