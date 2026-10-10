const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'marketplace',
  user: process.env.DB_USERNAME || 'admin',
  password: process.env.DB_PASSWORD || 'admin',
});

async function checkReviews() {
  try {
    // Check Laptop Stand specifically
    const laptopStand = await pool.query(`
      SELECT name, review_count, average_rating 
      FROM products 
      WHERE name LIKE '%Laptop Stand%'
    `);
    
    console.log('\n📊 Laptop Stand Reviews:');
    if (laptopStand.rows.length > 0) {
      laptopStand.rows.forEach(p => {
        console.log(`  ${p.name}: ${p.review_count} reviews, ${p.average_rating} avg rating`);
      });
    } else {
      console.log('  No Laptop Stand product found');
    }
    
    // Get actual reviews for Laptop Stand
    if (laptopStand.rows.length > 0 && laptopStand.rows[0].review_count > 0) {
      const productId = await pool.query(`
        SELECT id FROM products WHERE name LIKE '%Laptop Stand%' LIMIT 1
      `);
      
      if (productId.rows.length > 0) {
        const reviews = await pool.query(`
          SELECT r.rating, r.comment, r.is_verified_purchase, u.first_name, u.last_name
          FROM reviews r
          JOIN users u ON r.user_id = u.id
          WHERE r.product_id = $1
          ORDER BY r.created_at DESC
        `, [productId.rows[0].id]);
        
        console.log('\n💬 Reviews:');
        reviews.rows.forEach((r, i) => {
          console.log(`  ${i + 1}. ⭐${r.rating} by ${r.first_name} ${r.last_name} ${r.is_verified_purchase ? '✓' : ''}`);
          console.log(`     "${r.comment}"`);
        });
      }
    }
    
    // Summary of all products
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE review_count > 0) as products_with_reviews,
        SUM(review_count) as total_reviews
      FROM products
    `);
    
    console.log('\n📈 Overall Summary:');
    console.log(`  Total Products: ${summary.rows[0].total_products}`);
    console.log(`  Products with Reviews: ${summary.rows[0].products_with_reviews}`);
    console.log(`  Total Reviews: ${summary.rows[0].total_reviews}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkReviews();
