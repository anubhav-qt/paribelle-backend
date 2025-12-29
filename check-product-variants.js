const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'marketplace',
  password: 'Donotchange@123',
  port: 5432,
});

async function checkProduct() {
  try {
    await client.connect();
    
    const searchSlug = process.argv[2] || 'aniljoshi2-test003%';
    console.log('Searching for product with slug:', searchSlug);
    
    // Get product
    const productResult = await client.query(
      `SELECT id, name, slug, price, "stockQuantity", "hasVariants", "variantOptions" 
       FROM products 
       WHERE slug LIKE $1 
       ORDER BY "createdAt" DESC 
       LIMIT 1`,
      [searchSlug]
    );
    
    if (productResult.rows.length === 0) {
      console.log('Product not found');
      return;
    }
    
    const product = productResult.rows[0];
    console.log('Product:', JSON.stringify(product, null, 2));
    
    // Get variants
    const variantsResult = await client.query(
      `SELECT * FROM product_variants WHERE "productId" = $1`,
      [product.id]
    );
    
    console.log('\nVariants count:', variantsResult.rows.length);
    console.log('Variants:', JSON.stringify(variantsResult.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkProduct();
