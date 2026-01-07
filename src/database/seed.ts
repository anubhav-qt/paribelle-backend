import { DataSource } from 'typeorm';
import { Category } from '../modules/categories/category.entity';
import { Product, ProductStatus } from '../modules/products/product.entity';
import { Vendor, VendorStatus, KYCStatus } from '../modules/vendors/vendor.entity';
import { User, UserRole, UserStatus } from '../modules/users/user.entity';
import * as bcrypt from 'bcrypt';

// Use unbuffered output for cloud environments
function log(message: string) {
  process.stdout.write(message + '\n');
}

export async function seedData(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const vendorRepository = dataSource.getRepository(Vendor);
  const categoryRepository = dataSource.getRepository(Category);
  const productRepository = dataSource.getRepository(Product);

  // Check if data already exists
  const existingProducts = await productRepository.count();
  if (existingProducts > 0) {
    log('✅ Seed data already exists, skipping...');
    return;
  }

  log('🌱 Seeding database...');

  // Create superadmin user
  let superAdminUser = await userRepository.findOne({ where: { email: 'admin@marketplace.com' } });
  if (!superAdminUser) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    superAdminUser = await userRepository.save({
      email: 'admin@marketplace.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      emailVerifiedAt: new Date(), // Pre-verified for testing
      status: UserStatus.ACTIVE,
    } as User) as User;
    log('✅ Created superadmin user: admin@marketplace.com');
  }

  // Create a vendor user
  let vendorUser = await userRepository.findOne({ where: { email: 'vendor@marketplace.com' } });
  if (!vendorUser) {
    const hashedPassword = await bcrypt.hash('vendor123', 10);
    vendorUser = await userRepository.save({
      email: 'vendor@marketplace.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Vendor',
      role: UserRole.VENDOR_ADMIN,
      emailVerifiedAt: new Date(), // Pre-verified for testing
      status: UserStatus.ACTIVE,
    } as User) as User;
    log('✅ Created vendor user: vendor@marketplace.com');
  }

  // Create a normal customer user
  let customerUser = await userRepository.findOne({ where: { email: 'test@marketplace.com' } });
  if (!customerUser) {
    const hashedPassword = await bcrypt.hash('test', 10);
    customerUser = await userRepository.save({
      email: 'test@marketplace.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Customer',
      role: UserRole.CUSTOMER,
      emailVerifiedAt: new Date(), // Pre-verified for testing
      status: UserStatus.ACTIVE,
    } as User) as User;
    log('✅ Created customer user: test@marketplace.com');
  }

  // Create vendor (check if exists first)
  let vendor = await vendorRepository.findOne({ where: { slug: 'demo-store' } });
  if (!vendor) {
    vendor = await vendorRepository.save({
      userId: vendorUser.id,
      user: vendorUser,
      storeName: 'Demo Store',
      slug: 'demo-store',
      contactEmail: 'vendor@marketplace.com',
      contactPhone: '+1234567890',
      description: 'Your trusted marketplace vendor',
      status: VendorStatus.ACTIVE,
      kycStatus: KYCStatus.APPROVED, // Set KYC status to approved for seed data
    }) as Vendor;
  }

  // Create categories
  const electronics = await categoryRepository.save({
    name: 'Electronics',
    slug: 'electronics',
    description: 'Latest gadgets and electronic devices',
    sortOrder: 1,
  });

  const fashion = await categoryRepository.save({
    name: 'Fashion',
    slug: 'fashion',
    description: 'Trendy clothing and accessories',
    sortOrder: 2,
  });

  const home = await categoryRepository.save({
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Everything for your home',
    sortOrder: 3,
  });

  const books = await categoryRepository.save({
    name: 'Books',
    slug: 'books',
    description: 'Books for every reader',
    sortOrder: 4,
  });

  const sports = await categoryRepository.save({
    name: 'Sports & Outdoors',
    slug: 'sports-outdoors',
    description: 'Gear up for your adventures',
    sortOrder: 5,
  });

  // Create products
  const products = [
    // Electronics (15 products)
    {
      name: 'Wireless Bluetooth Headphones',
      slug: 'wireless-bluetooth-headphones',
      description: 'Premium noise-cancelling wireless headphones with 30-hour battery life. Crystal clear sound quality and comfortable design for all-day wear.',
      shortDescription: 'Premium noise-cancelling wireless headphones',
      price: 79.99,
      compareAtPrice: 129.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-001',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.5,
      reviewCount: 128,
    },
    {
      name: 'Smart Watch Pro',
      slug: 'smart-watch-pro',
      description: 'Advanced fitness tracking, heart rate monitoring, and smartphone notifications. Water-resistant and 7-day battery life.',
      shortDescription: 'Advanced fitness tracking smartwatch',
      price: 199.99,
      compareAtPrice: 299.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-002',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.7,
      reviewCount: 89,
    },
    {
      name: 'Portable Bluetooth Speaker',
      slug: 'portable-bluetooth-speaker',
      description: 'Compact and powerful wireless speaker with 360-degree sound. Waterproof design perfect for outdoor use.',
      shortDescription: 'Waterproof portable speaker',
      price: 49.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-003',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500',
      images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.3,
      reviewCount: 56,
    },
    {
      name: '4K Webcam',
      slug: '4k-webcam',
      description: 'Professional 4K webcam with autofocus and built-in microphone. Perfect for streaming and video calls.',
      shortDescription: '4K autofocus webcam with mic',
      price: 89.99,
      compareAtPrice: 149.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-004',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=500',
      images: ['https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.6,
      reviewCount: 73,
    },
    {
      name: 'Wireless Gaming Mouse',
      slug: 'wireless-gaming-mouse',
      description: 'High-precision wireless gaming mouse with RGB lighting and programmable buttons. 50-hour battery life.',
      shortDescription: 'RGB wireless gaming mouse',
      price: 59.99,
      compareAtPrice: 89.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-005',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=500',
      images: ['https://images.unsplash.com/photo-1527814050087-3793815479db?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.4,
      reviewCount: 91,
    },
    {
      name: 'USB-C Hub 7-in-1',
      slug: 'usb-c-hub-7in1',
      description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and power delivery. Aluminum design.',
      shortDescription: '7-port USB-C multiport adapter',
      price: 39.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-006',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1625948515291-69613efd103f?w=500',
      images: ['https://images.unsplash.com/photo-1625948515291-69613efd103f?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.5,
      reviewCount: 156,
    },
    {
      name: 'Mechanical Keyboard RGB',
      slug: 'mechanical-keyboard-rgb',
      description: 'Premium mechanical keyboard with blue switches and customizable RGB lighting. Durable construction.',
      shortDescription: 'RGB mechanical keyboard',
      price: 119.99,
      compareAtPrice: 179.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-007',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500',
      images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.8,
      reviewCount: 203,
    },
    {
      name: 'Wireless Charging Pad',
      slug: 'wireless-charging-pad',
      description: 'Fast wireless charging pad compatible with all Qi-enabled devices. Sleek design with LED indicator.',
      shortDescription: 'Fast Qi wireless charger',
      price: 24.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-008',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1591290619762-d0e5d477c4f8?w=500',
      images: ['https://images.unsplash.com/photo-1591290619762-d0e5d477c4f8?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.3,
      reviewCount: 84,
    },
    {
      name: 'Action Camera 4K',
      slug: 'action-camera-4k',
      description: 'Waterproof 4K action camera with image stabilization. Includes mounting accessories and remote control.',
      shortDescription: 'Waterproof 4K action cam',
      price: 149.99,
      compareAtPrice: 249.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-009',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500',
      images: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500'],
      vendorId: vendor.id,
      categories: [electronics, sports],
      averageRating: 4.6,
      reviewCount: 127,
    },
    {
      name: 'Portable Power Bank 20000mAh',
      slug: 'power-bank-20000',
      description: 'High-capacity portable charger with fast charging. Can charge smartphone up to 5 times.',
      shortDescription: '20000mAh fast charging power bank',
      price: 34.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-010',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500',
      images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.4,
      reviewCount: 198,
    },
    {
      name: 'Smart LED Light Bulbs 4-Pack',
      slug: 'smart-led-bulbs-4pack',
      description: 'WiFi-enabled color-changing LED bulbs. Control with app or voice assistant. Energy efficient.',
      shortDescription: 'WiFi smart LED bulbs set',
      price: 44.99,
      compareAtPrice: 69.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-011',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=500',
      images: ['https://images.unsplash.com/photo-1563089145-599997674d42?w=500'],
      vendorId: vendor.id,
      categories: [electronics, home],
      averageRating: 4.5,
      reviewCount: 142,
    },
    {
      name: 'Laptop Stand Aluminum',
      slug: 'laptop-stand-aluminum',
      description: 'Ergonomic aluminum laptop stand with adjustable height. Improves posture and cooling.',
      shortDescription: 'Adjustable aluminum laptop stand',
      price: 29.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-012',
      stockQuantity: 10,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500',
      images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.7,
      reviewCount: 165,
    },
    {
      name: 'Noise Cancelling Earbuds',
      slug: 'noise-cancelling-earbuds',
      description: 'True wireless earbuds with active noise cancellation. 24-hour battery with charging case.',
      shortDescription: 'ANC true wireless earbuds',
      price: 99.99,
      compareAtPrice: 149.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-013',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1590658165737-15a047b7a0b8?w=500',
      images: ['https://images.unsplash.com/photo-1590658165737-15a047b7a0b8?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.6,
      reviewCount: 187,
    },
    {
      name: 'HD Monitor 27-inch',
      slug: 'hd-monitor-27inch',
      description: '27-inch Full HD monitor with IPS panel. Slim bezel design, perfect for multitasking.',
      shortDescription: '27" Full HD IPS monitor',
      price: 179.99,
      compareAtPrice: 249.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-014',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500',
      images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.7,
      reviewCount: 94,
    },
    {
      name: 'Ring Light with Tripod',
      slug: 'ring-light-tripod',
      description: '10-inch LED ring light with adjustable tripod. Perfect for selfies, makeup, and video recording.',
      shortDescription: '10" LED ring light with stand',
      price: 39.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'ELEC-015',
      stockQuantity: 2,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500',
      images: ['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=500'],
      vendorId: vendor.id,
      categories: [electronics],
      averageRating: 4.4,
      reviewCount: 112,
    },

    // Fashion (18 products)
    {
      name: 'Classic Denim Jacket',
      slug: 'classic-denim-jacket',
      description: 'Timeless denim jacket with a modern fit. Made from premium cotton denim, perfect for any casual occasion.',
      shortDescription: 'Premium cotton denim jacket',
      price: 69.99,
      compareAtPrice: 99.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'FASH-001',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500',
      images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500'],
      vendorId: vendor.id,
      categories: [fashion],
      averageRating: 4.6,
      reviewCount: 34,
    },
    {
      name: 'Leather Crossbody Bag',
      slug: 'leather-crossbody-bag',
      description: 'Elegant genuine leather crossbody bag with adjustable strap. Multiple compartments for organization.',
      shortDescription: 'Genuine leather crossbody bag',
      price: 89.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'FASH-002',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500',
      images: ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500'],
      vendorId: vendor.id,
      categories: [fashion],
      averageRating: 4.8,
      reviewCount: 67,
    },
    {
      name: 'Running Sneakers',
      slug: 'running-sneakers',
      description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper. Perfect for daily training.',
      shortDescription: 'Lightweight cushioned running shoes',
      price: 79.99,
      compareAtPrice: 119.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'FASH-003',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
      vendorId: vendor.id,
      categories: [fashion, sports],
      averageRating: 4.4,
      reviewCount: 92,
    },
    // Home & Living
    {
      name: 'Aromatherapy Diffuser',
      slug: 'aromatherapy-diffuser',
      description: 'Ultrasonic essential oil diffuser with LED lights. Creates a calming atmosphere while moisturizing the air.',
      shortDescription: 'LED essential oil diffuser',
      price: 34.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'HOME-001',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500',
      images: ['https://images.unsplash.com/photo-1603006905003-be475563bc59?w=500'],
      vendorId: vendor.id,
      categories: [home],
      averageRating: 4.5,
      reviewCount: 145,
    },
    {
      name: 'Modern Table Lamp',
      slug: 'modern-table-lamp',
      description: 'Minimalist LED table lamp with touch control and adjustable brightness. Energy-efficient and stylish design.',
      shortDescription: 'Touch control LED table lamp',
      price: 44.99,
      compareAtPrice: 64.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'HOME-002',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500',
      images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500'],
      vendorId: vendor.id,
      categories: [home],
      averageRating: 4.2,
      reviewCount: 38,
    },
    // Books
    {
      name: 'The Art of Programming',
      slug: 'art-of-programming',
      description: 'Comprehensive guide to modern programming practices. Perfect for beginners and experienced developers alike.',
      shortDescription: 'Modern programming guide',
      price: 29.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'BOOK-001',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500',
      images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500'],
      vendorId: vendor.id,
      categories: [books],
      averageRating: 4.9,
      reviewCount: 234,
    },
    {
      name: 'Mindfulness Journal',
      slug: 'mindfulness-journal',
      description: 'Daily journal for mindfulness practice and personal growth. Includes prompts and guided exercises.',
      shortDescription: 'Daily mindfulness journal',
      price: 19.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'BOOK-002',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500',
      images: ['https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=500'],
      vendorId: vendor.id,
      categories: [books],
      averageRating: 4.6,
      reviewCount: 78,
    },
    // Sports
    {
      name: 'Yoga Mat Pro',
      slug: 'yoga-mat-pro',
      description: 'Extra thick non-slip yoga mat with carrying strap. Eco-friendly material, perfect for all types of yoga.',
      shortDescription: 'Non-slip eco-friendly yoga mat',
      price: 39.99,
      compareAtPrice: 59.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'SPORT-001',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
      images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'],
      vendorId: vendor.id,
      categories: [sports],
      averageRating: 4.7,
      reviewCount: 112,
    },
    {
      name: 'Resistance Bands Set',
      slug: 'resistance-bands-set',
      description: 'Set of 5 resistance bands with different tension levels. Includes door anchor and carrying bag.',
      shortDescription: '5-piece resistance band set',
      price: 24.99,
      priceType: 'mrp_with_gst',
      gstRate: 18,
      sku: 'SPORT-002',
      stockQuantity: 0,
      status: ProductStatus.ACTIVE,
      featuredImage: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500',
      images: ['https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500'],
      vendorId: vendor.id,
      categories: [sports],
      averageRating: 4.5,
      reviewCount: 67,
    },
  ];

  log(`📦 Inserting ${products.length} products...`);
  let count = 0;
  for (const productData of products) {
    await productRepository.save(productData);
    count++;
    if (count % 5 === 0) {
      log(`   - ${count}/${products.length} products inserted...`);
    }
  }
  log(`   - ${count}/${products.length} products inserted`);

  log('✅ Seed data created successfully!');
  log(`   - ${products.length} products created`);
  log(`   - 5 categories created`);
  log(`   - 1 vendor created`);
}
