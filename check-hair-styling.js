const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

async function checkHairStyling() {
  try {
    await client.connect();

    const result = await client.query(`
      SELECT id, name, price, product_type, attributes
      FROM products 
      WHERE name LIKE '%Hair Styling%'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const product = result.rows[0];
      console.log('\n=== Hair Styling Service ===\n');
      console.log(`ID: ${product.id}`);
      console.log(`Name: ${product.name}`);
      console.log(`Price: ₹${product.price}`);
      console.log(`Type: ${product.product_type}`);
      console.log('\nBooking Attributes:');
      console.log(JSON.stringify(product.attributes.booking, null, 2));
    } else {
      console.log('Hair Styling Service not found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkHairStyling();
