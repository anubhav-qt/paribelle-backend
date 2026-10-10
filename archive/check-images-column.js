const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkImagesColumn() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check column type
    const columnInfo = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('images', 'featuredImage')
    `);

    console.log('\n=== Column Information ===');
    columnInfo.rows.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (${col.udt_name}), nullable: ${col.is_nullable}`);
    });

    // Check a sample of products with their images
    const sampleResult = await client.query(`
      SELECT 
        id, 
        name, 
        images,
        "featuredImage",
        "vendorId"
      FROM products 
      WHERE "featuredImage" IS NOT NULL
      LIMIT 10
    `);

    console.log('\n=== Sample Products with Featured Images ===');
    sampleResult.rows.forEach((product, index) => {
      console.log(`\nProduct ${index + 1}: ${product.name}`);
      console.log(`  Featured Image: ${product.featuredImage}`);
      console.log(`  Images Array: ${JSON.stringify(product.images)}`);
      console.log(`  Images is Array: ${Array.isArray(product.images)}`);
      console.log(`  Images length: ${product.images ? product.images.length : 'N/A'}`);
    });

    // Count products by image configuration
    const countResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT("featuredImage") as has_featured_image,
        COUNT(CASE WHEN array_length(images, 1) > 0 THEN 1 END) as has_images_array,
        COUNT(CASE WHEN "featuredImage" IS NOT NULL AND (images IS NULL OR array_length(images, 1) IS NULL OR array_length(images, 1) = 0) THEN 1 END) as featured_only
      FROM products
    `);

    console.log('\n=== Product Image Statistics ===');
    const stats = countResult.rows[0];
    console.log(`Total products: ${stats.total}`);
    console.log(`Products with featuredImage: ${stats.has_featured_image}`);
    console.log(`Products with images array: ${stats.has_images_array}`);
    console.log(`Products with ONLY featuredImage (empty images array): ${stats.featured_only}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkImagesColumn();
