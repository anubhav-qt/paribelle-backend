/**
 * Update all products to use tax-inclusive pricing (mrp_with_gst)
 * Run with: node update-product-price-type.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function updateProductPriceType() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'marketplace',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current state
    const checkResult = await client.query(`
      SELECT 
        price_type,
        COUNT(*) as count
      FROM products
      GROUP BY price_type
    `);
    
    console.log('\nCurrent price_type distribution:');
    checkResult.rows.forEach(row => {
      console.log(`  ${row.price_type || 'NULL'}: ${row.count} products`);
    });

    // Update all products to use tax-inclusive pricing
    console.log('\nUpdating all products to mrp_with_gst (tax-inclusive)...');
    
    const updateResult = await client.query(`
      UPDATE products 
      SET price_type = 'mrp_with_gst'
      WHERE price_type IS NULL OR price_type = 'selling_price_without_gst'
    `);
    
    console.log(`Updated ${updateResult.rowCount} products to tax-inclusive pricing`);

    // Set default GST rate for products that don't have one
    const gstUpdateResult = await client.query(`
      UPDATE products 
      SET gst_rate = 18.00
      WHERE gst_rate IS NULL
    `);
    
    console.log(`Updated ${gstUpdateResult.rowCount} products with default GST rate (18%)`);

    // Check final state
    const finalCheck = await client.query(`
      SELECT 
        price_type,
        COUNT(*) as count
      FROM products
      GROUP BY price_type
    `);
    
    console.log('\nFinal price_type distribution:');
    finalCheck.rows.forEach(row => {
      console.log(`  ${row.price_type}: ${row.count} products`);
    });

    console.log('\n✅ All products updated successfully!');
    console.log('All product prices are now tax-inclusive (mrp_with_gst)');

  } catch (error) {
    console.error('Error updating products:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the update
updateProductPriceType()
  .then(() => {
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
