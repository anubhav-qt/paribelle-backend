// Script to fix all product review counts
// Run with: node fix-review-counts.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function fixReviewCounts() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing product review counts...\n');
    
    // Update all products with correct review counts and ratings
    const result = await client.query(`
      UPDATE products p
      SET 
        review_count = COALESCE(review_stats.count, 0),
        average_rating = COALESCE(review_stats.avg_rating, 0)
      FROM (
        SELECT 
          r.product_id,
          COUNT(r.id)::integer as count,
          ROUND(AVG(r.rating)::numeric, 1) as avg_rating
        FROM reviews r
        WHERE (r.is_approved = true OR r.is_approved IS NULL)
        GROUP BY r.product_id
      ) as review_stats
      WHERE p.id = review_stats.product_id
      AND (
        p.review_count != review_stats.count 
        OR p.average_rating != review_stats.avg_rating
        OR p.review_count IS NULL
      )
      RETURNING p.id, p.name, p.review_count, p.average_rating
    `);
    
    console.log(`✅ Updated ${result.rowCount} products with correct review counts\n`);
    
    if (result.rowCount > 0) {
      console.log('Updated products:');
      result.rows.forEach(row => {
        console.log(`  - ${row.name}: ${row.review_count} reviews, ${row.average_rating} avg rating`);
      });
    }
    
    // Also reset products with 0 reviews to ensure they show 0
    const zeroResult = await client.query(`
      UPDATE products p
      SET 
        review_count = 0,
        average_rating = 0
      WHERE p.id NOT IN (
        SELECT DISTINCT product_id FROM reviews 
        WHERE (is_approved = true OR is_approved IS NULL)
      )
      AND (p.review_count != 0 OR p.review_count IS NULL OR p.average_rating != 0)
      RETURNING p.id, p.name
    `);
    
    if (zeroResult.rowCount > 0) {
      console.log(`\n✅ Reset ${zeroResult.rowCount} products with no reviews to 0`);
    }
    
    console.log('\n✨ All product review counts are now accurate!');
    
  } catch (error) {
    console.error('❌ Error fixing review counts:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixReviewCounts();
