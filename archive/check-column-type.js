const { DataSource } = require('typeorm');
require('dotenv').config();

async function checkColumnType() {
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
    
    // Check column type
    const columnInfo = await ds.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'variationThemes'
    `);
    
    console.log('📊 Column Info:');
    console.log(columnInfo[0]);
    
    // Get raw data
    const raw = await ds.query(`
      SELECT id, name, "variationThemes"
      FROM products
      WHERE slug = 'customshirt'
    `);
    
    console.log('\n📦 Raw Data from Database:');
    console.log('Type:', typeof raw[0].variationThemes);
    console.log('Value:', raw[0].variationThemes);
    console.log('Is Array:', Array.isArray(raw[0].variationThemes));
    
    if (Array.isArray(raw[0].variationThemes)) {
      console.log('\n✅ It IS an array with values:', raw[0].variationThemes);
    } else {
      console.log('\n❌ Not an array, converting...');
      
      // Fix the data by parsing if it's a string
      const parsed = JSON.parse(raw[0].variationThemes);
      console.log('Parsed:', parsed);
    }
    
    await ds.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkColumnType();
