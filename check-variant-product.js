const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkVariantProduct() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check the specific product
    const productResult = await client.query(`
      SELECT 
        id, 
        name,
        price,
        "stockQuantity",
        "hasVariants",
        "variantOptions",
        images,
        "featuredImage"
      FROM products 
      WHERE name = 'aniljoshi2-test0004'
    `);

    console.log('\n=== Product Details ===');
    if (productResult.rows.length === 0) {
      console.log('Product not found');
    } else {
      const product = productResult.rows[0];
      console.log('Product ID:', product.id);
      console.log('Name:', product.name);
      console.log('Price:', product.price);
      console.log('Stock Quantity:', product.stockQuantity);
      console.log('Has Variants:', product.hasVariants);
      console.log('Variant Options:', JSON.stringify(product.variantOptions, null, 2));
      console.log('Images:', product.images);

      // Check if this product has variants
      if (product.id) {
        const variantsResult = await client.query(`
          SELECT 
            id,
            sku,
            "variantAttributes",
            price,
            "compareAtPrice",
            "stockQuantity",
            "isActive",
            images
          FROM product_variants 
          WHERE "productId" = $1
          ORDER BY "createdAt"
        `, [product.id]);

        console.log('\n=== Product Variants ===');
        if (variantsResult.rows.length === 0) {
          console.log('No variants found for this product');
        } else {
          console.log(`Found ${variantsResult.rows.length} variants:\n`);
          variantsResult.rows.forEach((variant, index) => {
            console.log(`Variant ${index + 1}:`);
            console.log(`  ID: ${variant.id}`);
            console.log(`  SKU: ${variant.sku}`);
            console.log(`  Attributes: ${JSON.stringify(variant.variantAttributes)}`);
            console.log(`  Price: ${variant.price}`);
            console.log(`  Compare At Price: ${variant.compareAtPrice}`);
            console.log(`  Stock: ${variant.stockQuantity}`);
            console.log(`  Active: ${variant.isActive}`);
            console.log(`  Images: ${variant.images}`);
            console.log('---');
          });
        }
      }
    }

    // Check overall variant statistics
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN "hasVariants" = true THEN 1 END) as products_with_variants,
        (SELECT COUNT(*) FROM product_variants) as total_variants
      FROM products
    `);

    console.log('\n=== Overall Statistics ===');
    console.log(`Total products: ${statsResult.rows[0].total_products}`);
    console.log(`Products with hasVariants=true: ${statsResult.rows[0].products_with_variants}`);
    console.log(`Total product variants: ${statsResult.rows[0].total_variants}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkVariantProduct();
