import { DataSource } from 'typeorm';
import { Category } from '../modules/categories/category.entity';
import { Product, ProductStatus, ProductType } from '../modules/products/product.entity';
import { ProductVariant } from '../modules/products/product-variant.entity';
import { Vendor, VendorStatus, KYCStatus } from '../modules/vendors/vendor.entity';
import { User, UserRole, UserStatus } from '../modules/users/user.entity';
import { Setting } from '../modules/homepage/settings.entity';
import * as bcrypt from 'bcrypt';

// Use unbuffered output for cloud environments
function log(message: string) {
  process.stdout.write(message + '\n');
}

/**
 * The one store this installation serves. The id is fixed so the admin panel
 * can stamp it on writes without a lookup — it must match the frontend's
 * NEXT_PUBLIC_STORE_VENDOR_ID.
 */
export const PARIBELLE_VENDOR_ID = '00000000-0000-0000-0000-000000000001';
export const PARIBELLE_VENDOR_SLUG = 'paribelle';

export async function seedData(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const vendorRepository = dataSource.getRepository(Vendor);
  const categoryRepository = dataSource.getRepository(Category);
  const productRepository = dataSource.getRepository(Product);
  const variantRepository = dataSource.getRepository(ProductVariant);

  log('🌱 Seeding PariBelle...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@paribelle.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  let adminUser = await userRepository.findOne({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = (await userRepository.save({
      email: adminEmail,
      password: await bcrypt.hash(adminPassword, 10),
      firstName: 'PariBelle',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
    } as User)) as User;
    log(`✅ Admin user: ${adminEmail}`);
  }

  let vendor = await vendorRepository.findOne({ where: { id: PARIBELLE_VENDOR_ID } });
  if (!vendor) {
    vendor = (await vendorRepository.save({
      id: PARIBELLE_VENDOR_ID,
      userId: adminUser.id,
      user: adminUser,
      storeName: 'PariBelle',
      slug: PARIBELLE_VENDOR_SLUG,
      businessName: 'PariBelle',
      contactEmail: adminEmail,
      contactPhone: '0000000000',
      description:
        'Designer kurtis and artificial jewellery, designed in Jaipur with new pieces every season.',
      status: VendorStatus.ACTIVE,
      kycStatus: KYCStatus.APPROVED,
      commissionRate: 0,
      shippingCost: 0,
    })) as Vendor;
    log('✅ Store: PariBelle');
  }

  // Point the storefront at this store.
  const settingRepository = dataSource.getRepository(Setting);
  for (const [key, value] of [
    ['root_vendor_slug', PARIBELLE_VENDOR_SLUG],
    ['marketplace_name', 'PariBelle'],
    ['currency', 'INR'],
  ]) {
    const existing = await settingRepository.findOne({ where: { key } });
    if (!existing) {
      await settingRepository.save({ key, value });
    }
  }

  // PariBelle sells two things. That is the whole category tree.
  const categorySeeds = [
    {
      name: 'Kurtis',
      slug: 'kurtis',
      description: 'Designer kurtis in cotton, silk and chanderi.',
      sortOrder: 1,
    },
    {
      name: 'Jewellery',
      slug: 'jewellery',
      description: 'Artificial jewellery — jhumkas, necklaces, bangles and more.',
      sortOrder: 2,
    },
  ];

  const categories: Record<string, Category> = {};
  for (const seed of categorySeeds) {
    let category = await categoryRepository.findOne({ where: { slug: seed.slug } });
    if (!category) {
      category = await categoryRepository.save(seed as Partial<Category>);
      log(`✅ Category: ${seed.name}`);
    }
    categories[seed.slug] = category;
  }

  // `attributes` here is not a product column — it is what the product's
  // variant carries. Filterable properties live on `ProductVariant` and
  // nowhere else, so each seeded product gets one variant holding them.
  const productSeeds: Array<
    Partial<Product> & { categorySlug: string; attributes: Record<string, string> }
  > = [
    {
      categorySlug: 'kurtis',
      name: 'Chanderi Silk Anarkali Kurti',
      slug: 'chanderi-silk-anarkali-kurti',
      description:
        'A floor-length anarkali in handwoven chanderi silk, with fine gota detailing at the neckline and a flared silhouette that moves beautifully.',
      shortDescription: 'Handwoven chanderi silk anarkali with gota detailing.',
      price: 3499,
      compareAtPrice: 4299,
      sku: 'PB-KUR-0001',
      stockQuantity: 18,
      hsnCode: '6211',
      gstRate: 5,
      attributes: { Fabric: 'Chanderi', Colour: 'Rose', Size: 'M', Sleeve: 'Three-Quarter', Occasion: 'Festive' },
    },
    {
      categorySlug: 'kurtis',
      name: 'Block Print Cotton Straight Kurti',
      slug: 'block-print-cotton-straight-kurti',
      description:
        'Hand block printed on breathable cotton in a straight cut that works as easily for the office as for a weekend afternoon.',
      shortDescription: 'Hand block printed cotton, straight cut.',
      price: 1299,
      compareAtPrice: 1699,
      sku: 'PB-KUR-0002',
      stockQuantity: 42,
      hsnCode: '6211',
      gstRate: 5,
      attributes: { Fabric: 'Cotton', Colour: 'Indigo', Size: 'L', Sleeve: 'Short', Occasion: 'Work' },
    },
    {
      categorySlug: 'kurtis',
      name: 'Embroidered A-Line Festive Kurti',
      slug: 'embroidered-a-line-festive-kurti',
      description:
        'Thread and sequin embroidery across the yoke, finished on a soft rayon blend. Cut A-line so it drapes without clinging.',
      shortDescription: 'Sequin and thread embroidery on a soft rayon blend.',
      price: 2199,
      sku: 'PB-KUR-0003',
      stockQuantity: 25,
      hsnCode: '6211',
      gstRate: 5,
      attributes: { Fabric: 'Rayon', Colour: 'Maroon', Size: 'S', Sleeve: 'Full', Occasion: 'Wedding' },
    },
    {
      categorySlug: 'jewellery',
      name: 'Kundan Jhumka Earrings',
      slug: 'kundan-jhumka-earrings',
      description:
        'Classic dome jhumkas set with kundan stones and finished with pearl drops. Gold-tone plating over a light alloy base.',
      shortDescription: 'Kundan-set jhumkas with pearl drops.',
      price: 899,
      compareAtPrice: 1199,
      sku: 'PB-JWL-0001',
      stockQuantity: 60,
      hsnCode: '7117',
      gstRate: 3,
      attributes: { Type: 'Earrings', Finish: 'Gold-tone', Stone: 'Kundan', Occasion: 'Wedding' },
    },
    {
      categorySlug: 'jewellery',
      name: 'Oxidised Silver Choker Set',
      slug: 'oxidised-silver-choker-set',
      description:
        'An oxidised choker with matching earrings, worked in a tribal motif that sits well against both cotton and silk.',
      shortDescription: 'Oxidised choker with matching earrings.',
      price: 1499,
      sku: 'PB-JWL-0002',
      stockQuantity: 34,
      hsnCode: '7117',
      gstRate: 3,
      attributes: { Type: 'Necklace', Finish: 'Oxidised', Stone: 'Beads', Occasion: 'Festive' },
    },
    {
      categorySlug: 'jewellery',
      name: 'Meenakari Bangle Stack',
      slug: 'meenakari-bangle-stack',
      description:
        'A set of six enamelled meenakari bangles in graduated colours, meant to be worn together or split across both wrists.',
      shortDescription: 'Set of six enamelled meenakari bangles.',
      price: 749,
      compareAtPrice: 999,
      sku: 'PB-JWL-0003',
      stockQuantity: 48,
      hsnCode: '7117',
      gstRate: 3,
      attributes: { Type: 'Bangles', Finish: 'Rose Gold', Stone: 'Meenakari', Occasion: 'Everyday' },
    },
  ];

  for (const { categorySlug, attributes, ...seed } of productSeeds) {
    const existing = await productRepository.findOne({ where: { slug: seed.slug } });
    if (existing) continue;

    const product = (await productRepository.save({
      ...seed,
      vendorId: vendor.id,
      vendor,
      categories: [categories[categorySlug]],
      status: ProductStatus.ACTIVE,
      productType: ProductType.PHYSICAL,
      priceType: 'mrp_with_gst',
      trackInventory: true,
      images: [],
    } as Partial<Product>)) as Product;

    await variantRepository.save({
      productId: product.id,
      sku: product.sku,
      variantAttributes: attributes,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      stockQuantity: product.stockQuantity,
      isActive: true,
    } as Partial<ProductVariant>);
  }
  log(`✅ Products: ${productSeeds.length} seeded`);

  log('🎉 Seed complete.');
}
