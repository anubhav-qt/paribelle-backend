const { DataSource } = require('typeorm');
require('dotenv').config();

async function fixCustomShirt() {
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
    console.log('✓ Connected\n');
    
    // Update the parent product with correct variationThemes array
    await ds.query(`
      UPDATE products
      SET "variationThemes" = ARRAY['color', 'size']::text[]
      WHERE slug = 'customshirt'
    `);
    
    console.log('✅ Updated CustomShirt variationThemes to ["color", "size"]\n');
    
    // Verify the update
    const result = await ds.query(`
      SELECT id, name, "isParent", "variationThemes"
      FROM products
      WHERE slug = 'customshirt'
    `);
    
    console.log('📦 Verification:');
    console.log('   Name:', result[0].name);
    console.log('   Is Parent:', result[0].isParent);
    console.log('   Variation Themes:', result[0].variationThemes);
    console.log('   Is Array:', Array.isArray(result[0].variationThemes));
    
    await ds.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCustomShirt();
