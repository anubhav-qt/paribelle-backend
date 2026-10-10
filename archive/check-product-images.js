const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkProductImages() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check the product with name containing 'Wireless Bluetooth Headphones'
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        images,
        "featuredImage",
        "vendorId",
        status
      FROM products 
      WHERE name ILIKE '%Wireless Bluetooth Headphones%'
      LIMIT 5
    `);

    console.log('\n=== Products matching "Wireless Bluetooth Headphones" ===\n');
    
    if (result.rows.length === 0) {
      console.log('No products found');
    } else {
      result.rows.forEach((product, index) => {
        console.log(`Product ${index + 1}:`);
        console.log(`  ID: ${product.id}`);
        console.log(`  Name: ${product.name}`);
        console.log(`  Vendor ID: ${product.vendorId}`);
        console.log(`  Status: ${product.status}`);
        console.log(`  Featured Image: ${product.featuredImage}`);
        console.log(`  Images type: ${typeof product.images}`);
        console.log(`  Images value: ${JSON.stringify(product.images, null, 2)}`);
        console.log(`  Images is Array: ${Array.isArray(product.images)}`);
        if (Array.isArray(product.images)) {
          console.log(`  Images length: ${product.images.length}`);
          product.images.forEach((img, i) => {
            console.log(`    Image ${i + 1}: "${img}" (type: ${typeof img})`);
          });
        }
        console.log('---');
      });
    }

    // Also check total product count and how many have images
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN images IS NOT NULL AND jsonb_array_length(images::jsonb) > 0 THEN 1 END) as products_with_images,
        COUNT(CASE WHEN images IS NULL OR jsonb_array_length(images::jsonb) = 0 THEN 1 END) as products_without_images
      FROM products
    `);

    console.log('\n=== Overall Statistics ===');
    console.log(`Total products: ${statsResult.rows[0].total_products}`);
    console.log(`Products with images: ${statsResult.rows[0].products_with_images}`);
    console.log(`Products without images: ${statsResult.rows[0].products_without_images}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkProductImages();
