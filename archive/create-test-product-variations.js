const { DataSource } = require('typeorm');
require('dotenv').config();

async function createTestProductWithVariations() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await dataSource.initialize();
    console.log('✓ Database connected\n');

    // Get a vendor ID (use the first vendor in the database)
    const vendors = await dataSource.query('SELECT id FROM vendors LIMIT 1');
    if (vendors.length === 0) {
      console.error('❌ No vendors found. Please create a vendor first.');
      process.exit(1);
    }
    const vendorId = vendors[0].id;
    console.log(`✓ Using vendor ID: ${vendorId}`);

    // Get a category ID (use the first category)
    const categories = await dataSource.query('SELECT id FROM categories LIMIT 1');
    if (categories.length === 0) {
      console.error('❌ No categories found. Please create a category first.');
      process.exit(1);
    }
    const categoryId = categories[0].id;
    console.log(`✓ Using category ID: ${categoryId}\n`);

    // Create parent product
    console.log('Creating parent product: CustomShirt...');
    const parentProduct = await dataSource.query(`
      INSERT INTO products (
        name, slug, description, "shortDescription", price, "compareAtPrice",
        sku, "stockQuantity", status, "productType", "featuredImage",
        images, "isParent", "variationThemes", "vendorId", "trackInventory"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id, name, slug
    `, [
      'CustomShirt',
      'customshirt',
      'Premium quality custom shirt available in multiple colors and sizes. Made from 100% cotton with comfortable fit.',
      'Premium custom shirt in multiple colors and sizes',
      29.99,
      39.99,
      'SHIRT-BASE',
      0, // Parent product has no stock
      'active',
      'physical',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', // T-shirt image
      ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'],
      true, // isParent
      ['color', 'size'], // variationThemes
      vendorId,
      true
    ]);

    const parentId = parentProduct[0].id;
    console.log(`✓ Parent product created: ${parentProduct[0].name} (ID: ${parentId})\n`);

    // Link parent product to category
    await dataSource.query(`
      INSERT INTO product_categories ("productId", "categoryId")
      VALUES ($1, $2)
    `, [parentId, categoryId]);

    // Define variations
    const colors = [
      { value: 'red', label: 'Red', image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800' },
      { value: 'blue', label: 'Blue', image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800' },
      { value: 'black', label: 'Black', image: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800' },
      { value: 'white', label: 'White', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800' },
    ];

    const sizes = [
      { value: 'S', label: 'Small', priceAdjust: 0 },
      { value: 'M', label: 'Medium', priceAdjust: 0 },
      { value: 'L', label: 'Large', priceAdjust: 2 },
      { value: 'XL', label: 'Extra Large', priceAdjust: 4 },
    ];

    console.log('Creating variations...\n');
    let variationCount = 0;

    // Create all combinations
    for (const color of colors) {
      for (const size of sizes) {
        const variantName = `CustomShirt - ${color.label} - ${size.label}`;
        const variantSlug = `customshirt-${color.value}-${size.value}`.toLowerCase();
        const variantSku = `SHIRT-${color.value.toUpperCase()}-${size.value}`;
        const variantPrice = 29.99 + size.priceAdjust;
        const stock = Math.floor(Math.random() * 50) + 10; // Random stock between 10-60

        const variation = await dataSource.query(`
          INSERT INTO products (
            name, slug, description, "shortDescription", price, "compareAtPrice",
            sku, "stockQuantity", status, "productType", "featuredImage",
            images, "isParent", "parentProductId", "variationAttributes", "vendorId", "trackInventory"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          ) RETURNING id, name, sku, "stockQuantity"
        `, [
          variantName,
          variantSlug,
          `Premium quality custom shirt in ${color.label} color, size ${size.label}. Made from 100% cotton with comfortable fit.`,
          `${color.label} shirt in size ${size.label}`,
          variantPrice,
          39.99,
          variantSku,
          stock,
          'active',
          'physical',
          color.image,
          [color.image],
          false, // Not a parent
          parentId, // Link to parent
          JSON.stringify({ color: color.value, size: size.value }), // Variation attributes
          vendorId,
          true
        ]);

        // Link variation to category
        await dataSource.query(`
          INSERT INTO product_categories ("productId", "categoryId")
          VALUES ($1, $2)
        `, [variation[0].id, categoryId]);

        variationCount++;
        console.log(`  ✓ ${variationCount}. ${variation[0].name}`);
        console.log(`     SKU: ${variation[0].sku} | Stock: ${variation[0].stockQuantity} | Price: $${variantPrice}`);
      }
    }

    console.log(`\n✅ Success! Created parent product with ${variationCount} variations\n`);
    console.log('Parent Product Details:');
    console.log(`  Name: ${parentProduct[0].name}`);
    console.log(`  Slug: ${parentProduct[0].slug}`);
    console.log(`  ID: ${parentId}`);
    console.log(`  Variations: ${variationCount} (${colors.length} colors × ${sizes.length} sizes)`);
    console.log(`\n📱 View in browser: http://localhost:3000/products/${parentProduct[0].slug}`);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error creating test product:', error);
    process.exit(1);
  }
}

createTestProductWithVariations();
