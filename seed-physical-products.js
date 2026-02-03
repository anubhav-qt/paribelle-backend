const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

const physicalProducts = [
  { name: 'Wireless Bluetooth Headphones', category: 'Electronics', price: 2999, images: 3, variants: true },
  { name: 'Smart Watch Series 5', category: 'Electronics', price: 8999, images: 4, variants: true },
  { name: 'Leather Wallet - Premium', category: 'Fashion', price: 1499, images: 3, variants: true },
  { name: 'Running Shoes - Professional', category: 'Sports', price: 4999, images: 5, variants: true },
  { name: 'Stainless Steel Water Bottle', category: 'Sports', price: 899, images: 2, variants: true },
  { name: 'Cotton T-Shirt Pack of 3', category: 'Fashion', price: 1299, images: 4, variants: true },
  { name: 'Yoga Mat with Carry Bag', category: 'Sports', price: 1599, images: 3, variants: false },
  { name: 'Laptop Backpack - Waterproof', category: 'Accessories', price: 2499, images: 4, variants: true },
  { name: 'Coffee Maker - Automatic', category: 'Home Appliances', price: 6999, images: 3, variants: false },
  { name: 'Air Purifier - HEPA Filter', category: 'Home Appliances', price: 12999, images: 4, variants: false },
  { name: 'Gaming Mouse - RGB', category: 'Electronics', price: 1999, images: 5, variants: true },
  { name: 'Mechanical Keyboard', category: 'Electronics', price: 4999, images: 4, variants: true },
  { name: 'Sunglasses - Polarized', category: 'Fashion', price: 2999, images: 3, variants: true },
  { name: 'Fitness Tracker Band', category: 'Electronics', price: 3499, images: 3, variants: true },
  { name: 'Denim Jeans - Slim Fit', category: 'Fashion', price: 2499, images: 4, variants: true },
  { name: 'Formal Shirt - Cotton', category: 'Fashion', price: 1799, images: 3, variants: true },
  { name: 'Sneakers - Casual Wear', category: 'Fashion', price: 3999, images: 5, variants: true },
  { name: 'Bed Sheet Set - King Size', category: 'Home', price: 2999, images: 3, variants: true },
  { name: 'Bath Towel Set - 6 Pieces', category: 'Home', price: 1999, images: 2, variants: true },
  { name: 'Kitchen Knife Set - 8 Pieces', category: 'Home Appliances', price: 3499, images: 3, variants: false },
  { name: 'Non-Stick Cookware Set', category: 'Home Appliances', price: 5999, images: 4, variants: false },
  { name: 'Electric Kettle - 1.8L', category: 'Home Appliances', price: 1499, images: 2, variants: false },
  { name: 'Desk Lamp - LED', category: 'Home', price: 1299, images: 3, variants: true },
  { name: 'Wall Clock - Modern Design', category: 'Home', price: 899, images: 2, variants: false },
  { name: 'Photo Frame Set - 5 Pieces', category: 'Home', price: 1199, images: 3, variants: false },
  { name: 'Portable Speaker - Bluetooth', category: 'Electronics', price: 2499, images: 4, variants: true },
  { name: 'Power Bank - 20000mAh', category: 'Electronics', price: 1999, images: 3, variants: false },
  { name: 'Phone Case - Shockproof', category: 'Accessories', price: 499, images: 5, variants: true },
  { name: 'Screen Protector - Tempered Glass', category: 'Accessories', price: 299, images: 2, variants: true },
  { name: 'USB Cable Set - 3 Pack', category: 'Electronics', price: 599, images: 2, variants: true }
];

const colors = ['Black', 'White', 'Blue', 'Red', 'Gray', 'Green', 'Navy', 'Brown'];
const sizes = ['S', 'M', 'L', 'XL', 'XXL'];

function generateVariants(productName, hasVariants) {
  if (!hasVariants) return null;
  
  const variants = [];
  const isClothing = productName.includes('Shirt') || productName.includes('Jeans') || productName.includes('T-Shirt');
  
  if (isClothing) {
    // Clothing: colors and sizes
    const selectedColors = colors.slice(0, 3);
    selectedColors.forEach(color => {
      sizes.forEach(size => {
        variants.push({
          name: `${color} - ${size}`,
          price: null,
          stock: Math.floor(Math.random() * 50) + 10,
          sku: `${productName.substring(0, 3).toUpperCase()}-${color.substring(0, 2)}-${size}`,
          attributes: { color, size }
        });
      });
    });
  } else {
    // Other products: just colors
    const selectedColors = colors.slice(0, 4);
    selectedColors.forEach(color => {
      variants.push({
        name: color,
        price: null,
        stock: Math.floor(Math.random() * 30) + 15,
        sku: `${productName.substring(0, 3).toUpperCase()}-${color.substring(0, 3)}`,
        attributes: { color }
      });
    });
  }
  
  return variants;
}

function generateImages(count) {
  const images = [];
  for (let i = 1; i <= count; i++) {
    images.push(`https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/800`);
  }
  return images;
}

async function seedPhysicalProducts() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Don't delete existing products - just add more
    console.log('\n📦 Adding 30 additional physical products...\n');

    // Get vendor
    const vendorResult = await client.query(
      "SELECT id FROM vendors WHERE store_name = 'Test Store' LIMIT 1"
    );
    
    let vendorId;
    if (vendorResult.rows.length === 0) {
      console.log('Creating test vendor...');
      
      // First, get or create a user for the vendor
      let userId;
      const userResult = await client.query(
        "SELECT id FROM users WHERE email = 'test@store.com' LIMIT 1"
      );
      
      if (userResult.rows.length === 0) {
        const newUser = await client.query(
          `INSERT INTO users (email, password, first_name, last_name, role)
           VALUES ('test@store.com', '$2a$10$dummyhashedpassword123456789012345678901234567890', 'Test', 'Store', 'vendor')
           RETURNING id`
        );
        userId = newUser.rows[0].id;
      } else {
        userId = userResult.rows[0].id;
      }
      
      const newVendor = await client.query(
        `INSERT INTO vendors (user_id, store_name, slug, description, contact_email, contact_phone, status, kyc_status)
         VALUES ($1, 'Test Store', 'test-store', 'Test vendor for physical products', 'test@store.com', '1234567890', 'active', 'approved')
         RETURNING id`,
        [userId]
      );
      vendorId = newVendor.rows[0].id;
    } else {
      vendorId = vendorResult.rows[0].id;
    }

    console.log(`Using vendor ID: ${vendorId}`);
    console.log('\n🛍️  Creating 30 physical products...\n');

    for (let i = 0; i < physicalProducts.length; i++) {
      const product = physicalProducts[i];
      const variants = generateVariants(product.name, product.variants);
      const images = generateImages(product.images);
      
      const slug = product.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const description = `High-quality ${product.name} from ${product.category} category. Perfect for everyday use with excellent durability and performance. Features premium materials and modern design.`;
      
      const shortDescription = `Premium ${product.name} - Best quality guaranteed`;

      await client.query(
        `INSERT INTO products (
          vendor_id, name, slug, description, short_description, price, compare_at_price,
          stock_quantity, product_type, sku, images, status, average_rating, review_count,
          variants, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())`,
        [
          vendorId,
          product.name,
          slug,
          description,
          shortDescription,
          product.price,
          Math.floor(product.price * 1.2), // Compare at price (20% higher)
          variants ? null : Math.floor(Math.random() * 100) + 20, // Stock for non-variant products
          'physical',
          `PROD-${slug.toUpperCase().substring(0, 10)}-${Math.floor(Math.random() * 999) + 1}`,
          images,
          'active',
          (Math.random() * 2 + 3).toFixed(1), // Rating between 3.0 and 5.0
          Math.floor(Math.random() * 100) + 10, // Review count
          variants ? JSON.stringify(variants) : null
        ]
      );

      console.log(`✅ ${i + 1}. ${product.name} (${variants ? variants.length + ' variants' : 'no variants'})`);
    }

    console.log('\n🎉 Successfully created 30 physical products!\n');
    console.log('You can now test physical product purchases with variants and stock management.');

  } catch (error) {
    console.error('Error seeding physical products:', error);
  } finally {
    await client.end();
  }
}

seedPhysicalProducts();
