const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

async function checkTours() {
  try {
    await client.connect();

    // Check tours
    const tours = await client.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE product_type = 'booking' AND attributes->'tour' IS NOT NULL
    `);
    console.log(`\nTour products: ${tours.rows[0].count}`);

    // Check all booking products
    const bookings = await client.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE product_type = 'booking'
    `);
    console.log(`Total booking products: ${bookings.rows[0].count}`);

    // Check physical products
    const physical = await client.query(`
      SELECT COUNT(*) as count 
      FROM products 
      WHERE product_type = 'physical'
    `);
    console.log(`Physical products: ${physical.rows[0].count}`);

    // Total
    const total = await client.query(`SELECT COUNT(*) as count FROM products`);
    console.log(`Total products: ${total.rows[0].count}`);

    // Sample tours
    const sampleTours = await client.query(`
      SELECT id, name, price, product_type, status
      FROM products 
      WHERE product_type = 'booking' AND attributes->'tour' IS NOT NULL
      LIMIT 5
    `);
    
    if (sampleTours.rows.length > 0) {
      console.log('\nSample tours:');
      sampleTours.rows.forEach((tour, i) => {
        console.log(`${i + 1}. ${tour.name} - ₹${tour.price} - Status: ${tour.status}`);
      });
    } else {
      console.log('\n⚠️  No tour products found in database!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTours();
