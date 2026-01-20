/**
 * Script to identify and fix products with broken Cloudinary images
 * Run with: node fix-broken-images.js
 */

const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'marketplace_db',
  user: process.env.DB_USER || 'marketplace_user',
  password: process.env.DB_PASSWORD || 'marketplace_password',
});

// Check if a URL returns 404
function checkImageExists(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode !== 404);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function findBrokenImages() {
  console.log('🔍 Scanning for products with broken images...\n');
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, images, featured_image as "featuredImage"
      FROM products
      WHERE images IS NOT NULL AND array_length(images, 1) > 0
    `);
    
    const brokenProducts = [];
    
    for (const product of result.rows) {
      console.log(`Checking product: ${product.name} (${product.id})`);
      
      const brokenImages = [];
      
      // Check all images
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          if (img.startsWith('https://res.cloudinary.com')) {
            const exists = await checkImageExists(img);
            if (!exists) {
              brokenImages.push(img);
              console.log(`  ❌ Broken: ${img}`);
            } else {
              console.log(`  ✅ OK: ${img}`);
            }
          }
        }
      }
      
      // Check featured image
      if (product.featuredImage && product.featuredImage.startsWith('https://res.cloudinary.com')) {
        const exists = await checkImageExists(product.featuredImage);
        if (!exists) {
          brokenImages.push(product.featuredImage);
          console.log(`  ❌ Broken featured: ${product.featuredImage}`);
        } else {
          console.log(`  ✅ OK featured: ${product.featuredImage}`);
        }
      }
      
      if (brokenImages.length > 0) {
        brokenProducts.push({
          id: product.id,
          name: product.name,
          brokenImages,
        });
      }
      
      console.log('');
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total products checked: ${result.rows.length}`);
    console.log(`Products with broken images: ${brokenProducts.length}\n`);
    
    if (brokenProducts.length > 0) {
      console.log('Products with broken images:');
      brokenProducts.forEach(p => {
        console.log(`\n  • ${p.name} (${p.id})`);
        console.log(`    ${p.brokenImages.length} broken image(s)`);
      });
      
      console.log('\n\n💡 SOLUTIONS:');
      console.log('1. Re-upload images for these products through the admin panel');
      console.log('2. Or run: node fix-broken-images.js --clean  (removes broken URLs from database)');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

async function cleanBrokenImages() {
  console.log('🧹 Cleaning broken images from database...\n');
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, name, images, featured_image as "featuredImage"
      FROM products
      WHERE images IS NOT NULL AND array_length(images, 1) > 0
    `);
    
    let cleaned = 0;
    
    for (const product of result.rows) {
      const validImages = [];
      let featuredImageValid = true;
      
      // Check all images
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          if (img.startsWith('https://res.cloudinary.com')) {
            const exists = await checkImageExists(img);
            if (exists) {
              validImages.push(img);
            }
          } else {
            validImages.push(img); // Keep non-Cloudinary URLs
          }
        }
      }
      
      // Check featured image
      if (product.featuredImage && product.featuredImage.startsWith('https://res.cloudinary.com')) {
        featuredImageValid = await checkImageExists(product.featuredImage);
      }
      
      // Update if changes needed
      if (validImages.length !== product.images.length || !featuredImageValid) {
        await client.query(
          `UPDATE products 
           SET images = $1, 
               featured_image = $2
           WHERE id = $3`,
          [
            validImages.length > 0 ? validImages : [],
            featuredImageValid ? product.featuredImage : (validImages[0] || null),
            product.id
          ]
        );
        
        console.log(`✅ Cleaned: ${product.name}`);
        console.log(`   Images: ${product.images.length} → ${validImages.length}`);
        cleaned++;
      }
    }
    
    console.log(`\n✨ Done! Cleaned ${cleaned} products.`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
const action = process.argv[2];
if (action === '--clean') {
  cleanBrokenImages().catch(console.error);
} else {
  findBrokenImages().catch(console.error);
}
