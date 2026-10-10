const { DataSource } = require('typeorm');
require('dotenv').config();

async function checkCustomShirt() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await ds.initialize();
    console.log('✓ Database connected\n');
    
    // Get parent product
    const parent = await ds.query(`
      SELECT id, name, slug, "isParent", "variationThemes"
      FROM products
      WHERE slug = 'customshirt'
    `);
    
    if (parent.length === 0) {
      console.log('❌ CustomShirt product not found!');
      await ds.destroy();
      return;
    }
    
    console.log('📦 Parent Product:');
    console.log(`   Name: ${parent[0].name}`);
    console.log(`   Slug: ${parent[0].slug}`);
    console.log(`   ID: ${parent[0].id}`);
    console.log(`   Is Parent: ${parent[0].isParent}`);
    console.log(`   Variation Themes: ${JSON.stringify(parent[0].variationThemes)}`);
    
    // Get variations
    const variations = await ds.query(`
      SELECT id, name, sku, "stockQuantity", price, "variationAttributes"
      FROM products
      WHERE "parentProductId" = $1
      ORDER BY name
    `, [parent[0].id]);
    
    console.log(`\n🎨 Found ${variations.length} variations:\n`);
    variations.forEach((v, i) => {
      console.log(`${i+1}. ${v.name}`);
      console.log(`   SKU: ${v.sku} | Stock: ${v.stockQuantity} | Price: $${v.price}`);
      console.log(`   Attributes: ${JSON.stringify(v.variationAttributes)}\n`);
    });
    
    console.log(`✅ CustomShirt product has ${variations.length} variations (should be 16)`);
    console.log(`\n🌐 View at: http://localhost:3000/products/customshirt`);
    
    await ds.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCustomShirt();
