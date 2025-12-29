const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'marketplace',
  password: 'Donotchange@123',
  port: 5432,
});

async function testAPI() {
  try {
    await client.connect();
    
    // Get product ID
    const productResult = await client.query(
      `SELECT id FROM products WHERE slug LIKE $1 ORDER BY "createdAt" DESC LIMIT 1`,
      ['aniljoshi2-test003%']
    );
    
    if (productResult.rows.length === 0) {
      console.log('Product not found');
      return;
    }
    
    const productId = productResult.rows[0].id;
    console.log('Product ID:', productId);
    console.log('\nTesting API endpoint: GET /api/v1/products/' + productId);
    console.log('Testing API endpoint: GET /api/v1/products/' + productId + '/variants');
    console.log('\nYou can test these in your browser or Postman');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testAPI();
