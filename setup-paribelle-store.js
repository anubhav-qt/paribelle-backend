/**
 * Sets up the root PariBelle store.
 *
 * The platform is a store-builder: every shop lives on its own subdomain, and the
 * root domain is PariBelle's own shop. This script makes the data match that model:
 *
 *  1. Creates the `paribelle` vendor that owns the root store.
 *  2. Demotes the generic demo categories (Electronics, Books, Home & Living,
 *     Sports) to the `demo-store` vendor so they only show on demo-store.<host>.
 *  3. Leaves a single global category tree for the root site:
 *     Fashion > Kurtis, Jewellery.
 *  4. Seeds PariBelle's own kurti and jewellery catalogue.
 *  5. Points `root_vendor_slug` at `paribelle` so the homepage scopes to it.
 *  6. Replaces the placeholder footer/hero content with real PariBelle copy.
 *
 * Safe to re-run: every step is idempotent.
 *
 *   node setup-paribelle-store.js
 */
const { Client } = require('pg');

require('dotenv').config({ path: '.env.local' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'marketplace',
});

const DEMO_ONLY_CATEGORY_SLUGS = ['electronics', 'books', 'home-living', 'sports-outdoors'];

const KURTIS = [
  {
    slug: 'anarkali-kurti-rose-gota',
    name: 'Rosewood Anarkali Kurti',
    shortDescription: 'Floor-sweeping anarkali in rose georgette with hand-worked gota patti.',
    description:
      'A floor-sweeping anarkali cut from soft rose georgette, finished with hand-worked gota patti along the yoke and hem. Fully lined, with a concealed side zip and three-quarter sleeves. Pairs beautifully with our Kundan drop earrings.',
    price: 3499,
    compareAtPrice: 4999,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&q=80',
    stock: 18,
  },
  {
    slug: 'chikankari-straight-kurti-ivory',
    name: 'Ivory Chikankari Straight Kurti',
    shortDescription: 'Lucknowi chikankari on breathable cotton mul — an everyday heirloom.',
    description:
      'Hand-embroidered in Lucknow using traditional chikankari stitches, this straight-cut kurti is made from breathable cotton mul that only softens with every wash. Side slits, a mandarin collar and a relaxed fit make it as easy on a workday as it is at a summer lunch.',
    price: 1899,
    compareAtPrice: 2499,
    image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=1200&q=80',
    stock: 26,
  },
  {
    slug: 'bandhani-a-line-kurti-indigo',
    name: 'Indigo Bandhani A-Line Kurti',
    shortDescription: 'Kutch bandhani tie-dye on handloom cotton, cut in a flowing A-line.',
    description:
      'Tied and dyed by artisan families in Kutch, each bandhani dot is knotted by hand before dyeing — which is why no two pieces are ever identical. Cut in a flowing A-line on handloom cotton, with a V-neck and quarter sleeves.',
    price: 2299,
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200&q=80',
    stock: 14,
  },
  {
    slug: 'silk-blend-festive-kurti-emerald',
    name: 'Emerald Silk-Blend Festive Kurti',
    shortDescription: 'Deep emerald silk blend with zari borders, made for celebration.',
    description:
      'A deep emerald silk blend with woven zari borders at the cuffs and hem. Structured enough to hold its drape through a long evening, lightweight enough to dance in. Comes with a matching dupatta.',
    price: 4299,
    compareAtPrice: 5499,
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80',
    stock: 9,
  },
  {
    slug: 'block-print-cotton-kurti-mustard',
    name: 'Mustard Block-Print Cotton Kurti',
    shortDescription: 'Hand block-printed in Bagru with natural dyes on soft cotton.',
    description:
      'Hand block-printed in Bagru using natural dyes and hand-carved teak blocks. The mustard ground and rust motifs mellow gently with age. Straight cut, full sleeves, with pockets — because kurtis should have pockets.',
    price: 1599,
    compareAtPrice: 1999,
    image: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=1200&q=80',
    stock: 31,
  },
  {
    slug: 'mirror-work-kurti-black',
    name: 'Midnight Mirror-Work Kurti',
    shortDescription: 'Hand-set shisha mirror work on a midnight rayon base.',
    description:
      'Shisha mirrors set by hand across the yoke, catching light with every movement, on a fluid midnight rayon base. A relaxed silhouette with a keyhole back and tasselled tie.',
    price: 2799,
    image: 'https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=1200&q=80',
    stock: 12,
  },
];

const JEWELLERY = [
  {
    slug: 'kundan-drop-earrings-gold',
    name: 'Kundan Drop Earrings',
    shortDescription: 'Uncut-stone kundan drops set in gold-finish brass.',
    description:
      'Classic kundan drops with uncut stones set in gold-finish brass, finished with a fringe of pearl beads. Light enough for all-day wear, with a secure screw back.',
    price: 1249,
    compareAtPrice: 1799,
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&q=80',
    stock: 40,
  },
  {
    slug: 'oxidised-silver-jhumka',
    name: 'Oxidised Silver Jhumkas',
    shortDescription: 'Temple-motif jhumkas in oxidised silver finish.',
    description:
      'Dome-shaped jhumkas with temple motifs in an oxidised silver finish, edged with tiny ghungroo bells. The everyday earring that quietly finishes any kurti.',
    price: 799,
    image: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=1200&q=80',
    stock: 55,
  },
  {
    slug: 'polki-choker-necklace-set',
    name: 'Polki Choker Necklace Set',
    shortDescription: 'Statement polki choker with matching earrings.',
    description:
      'A statement polki choker with matching earrings, set in gold-finish brass with emerald-green accents and a pearl drop row. Adjustable dori tie at the back.',
    price: 3299,
    compareAtPrice: 4499,
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80',
    stock: 11,
  },
  {
    slug: 'meenakari-bangle-set-six',
    name: 'Meenakari Bangle Set of Six',
    shortDescription: 'Hand-painted meenakari enamel bangles, set of six.',
    description:
      'Six slim bangles finished in hand-painted meenakari enamel — rose, ivory and deep teal against gold. Stack them together or spread them across both wrists.',
    price: 949,
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80',
    stock: 33,
  },
  {
    slug: 'pearl-maang-tikka',
    name: 'Pearl Maang Tikka',
    shortDescription: 'Delicate freshwater-pearl maang tikka on a fine gold chain.',
    description:
      'A delicate maang tikka strung with freshwater pearls on a fine gold-finish chain, ending in a single kundan centrepiece. Understated enough for a mehendi, precise enough for a wedding.',
    price: 699,
    compareAtPrice: 999,
    image: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&q=80',
    stock: 28,
  },
  {
    slug: 'antique-gold-anklet-pair',
    name: 'Antique Gold Payal Pair',
    shortDescription: 'Antique-finish payals with a soft ghungroo chime.',
    description:
      'A pair of antique-finish payals lined with tiny ghungroo bells for a soft chime as you walk. Adjustable hook clasp fits most ankle sizes.',
    price: 599,
    image: 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1200&q=80',
    stock: 47,
  },
];

const FOOTER_SECTIONS = [
  {
    title: 'Customer Care',
    enabled: true,
    links: [
      { label: 'Contact Us', url: '/contact' },
      { label: 'Shipping & Delivery', url: '/shipping' },
      { label: 'Returns & Exchanges', url: '/returns' },
      { label: 'FAQ', url: '/faq' },
      { label: 'Size Guide', url: '/size-guide' },
    ],
  },
  {
    title: 'My Account',
    enabled: true,
    links: [
      { label: 'Login / Register', url: '/login' },
      { label: 'My Orders', url: '/orders' },
      { label: 'My Wishlist', url: '/wishlist' },
      { label: 'My Dashboard', url: '/dashboard' },
    ],
  },
  {
    title: 'PariBelle',
    enabled: true,
    links: [
      { label: 'Our Story', url: '/about' },
      { label: 'The Lookbook', url: '/lookbook' },
      { label: 'Open Your Own Store', url: '/vendor-registration' },
      { label: 'Privacy Policy', url: '/privacy-policy' },
      { label: 'Terms of Service', url: '/terms-of-service' },
    ],
  },
];

const HERO_SLIDES = [
  {
    id: 'hero-1',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1920&q=80',
    title: 'Discover the Elegance',
    subtitle: 'Handcrafted designer kurtis, made to be treasured.',
    ctaText: 'Shop Kurtis',
    ctaLink: '/category/kurtis',
    order: 0,
  },
  {
    id: 'hero-2',
    imageUrl: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1920&q=80',
    title: 'Jewellery, Reimagined',
    subtitle: 'Kundan, polki and oxidised silver — crafted by hand, priced for every day.',
    ctaText: 'Shop Jewellery',
    ctaLink: '/category/jewellery',
    order: 1,
  },
  {
    id: 'hero-3',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=1920&q=80',
    title: 'The Festive Edit',
    subtitle: 'Pieces worth keeping, for the season of celebration.',
    ctaText: 'Explore New In',
    ctaLink: '/category/new-in',
    order: 2,
  },
];

const PAGES = [
  {
    slug: 'contact',
    title: 'Contact Us',
    pageType: 'contact',
    content: `We would love to hear from you — whether it is a question about a piece, an order, or a custom request.

## Reach us

**Email** — care@paribelle.com
We reply to every email within one working day.

**Phone / WhatsApp** — +91 98765 43210
Monday to Saturday, 10:00 AM to 7:00 PM IST.

**Studio address**
PariBelle Studio
14 Chandpole Bazaar
Jaipur, Rajasthan 302001

## Order enquiries

Have your order number handy (it looks like PB-XXXXXX) and we will be able to help you far faster. You can find it in your [order history](/orders) or in your order confirmation email.

## Wholesale and collaborations

For bulk orders, styling collaborations or press enquiries, write to hello@paribelle.com.`,
  },
  {
    slug: 'shipping',
    title: 'Shipping & Delivery',
    pageType: 'custom',
    content: `## Delivery timelines

| Destination | Estimated delivery |
| --- | --- |
| Metro cities | 2–4 working days |
| Rest of India | 4–7 working days |
| International | 10–15 working days |

Orders are dispatched from our Jaipur studio within 24–48 hours of being placed. Made-to-order and custom-sized pieces take 7–10 days to craft before dispatch — this is mentioned on the product page wherever it applies.

## Shipping charges

- **Free shipping** on all prepaid orders over ₹1,999.
- A flat ₹99 applies to orders below ₹1,999.
- Cash on delivery carries an additional ₹49 handling fee.

## Tracking your order

You will receive a tracking link by email and SMS as soon as your parcel is handed to our courier partner. You can also follow it from your [order history](/orders) at any time.

## A note on handcrafted pieces

Every kurti and every piece of jewellery we send out is made by hand. Slight variations in colour, print placement and embroidery are the signature of handwork, not a defect.`,
  },
  {
    slug: 'returns',
    title: 'Returns & Exchanges',
    pageType: 'custom',
    content: `## Our promise

If a piece is not right, you have **7 days from delivery** to return or exchange it. No lengthy forms, no questions we do not need to ask.

## What we can accept

- Unworn and unwashed pieces, with all original tags attached.
- Items in their original packaging.
- Jewellery in its original box, with no signs of wear.

## What we cannot accept

- Pieces that have been worn, washed, altered or custom-sized to your measurements.
- Items marked *Final Sale* on the product page.
- Returns raised more than 7 days after delivery.

## How to start a return

1. Open your [order history](/orders) and find the order.
2. Select **Request Return** on the item you would like to send back.
3. Choose a reason and whether you would like a refund or an exchange.
4. Our courier partner will collect the parcel from your address within 2–3 working days.

## Refunds

Once your return reaches our studio and passes a quick quality check, refunds are issued to the original payment method within 5–7 working days. Cash-on-delivery orders are refunded by bank transfer — we will ask for your account details when the return is approved.

Exchanges for a different size are shipped free of charge.`,
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    pageType: 'faq',
    content: `## Ordering

**Do I need an account to place an order?**
No — you can check out as a guest. Creating an account simply makes it easier to track orders, save addresses and keep a wishlist.

**Can I change or cancel my order?**
Yes, as long as it has not been dispatched. Write to care@paribelle.com with your order number and we will sort it out.

## Sizing

**How do I find my size?**
Every product page carries a size chart with exact garment measurements. If you are between sizes on a kurti, we usually suggest sizing up for a more comfortable drape.

**Do you offer custom sizing?**
We do, on most kurtis. Choose *Custom* in the size selector and enter your measurements at checkout. Custom pieces take 7–10 days to craft and are not eligible for return.

## Products

**Is the jewellery real gold or silver?**
Our jewellery is artificial — brass and alloy bases with gold, silver or oxidised finishes, set with kundan, polki, pearls and enamel. It is crafted by hand, designed to last, and priced so you can own more than one.

**How should I care for my pieces?**
Hand-wash kurtis cold and dry in shade. Keep jewellery away from perfume and moisture, and store it in the pouch it arrived in.

## Payments

**What payment methods do you accept?**
UPI, all major credit and debit cards, net banking, and cash on delivery across most Indian pin codes.

**Is my payment secure?**
Yes. Payments are processed by Razorpay, and we never see or store your card details.

## Still stuck?

Write to us at care@paribelle.com or visit our [contact page](/contact).`,
  },
  {
    slug: 'size-guide',
    title: 'Size Guide',
    pageType: 'custom',
    content: `All measurements are of the garment itself, in inches. Measure a kurti you already love and compare — it is the most reliable way to find your fit.

## Kurtis

| Size | Bust | Waist | Hip | Length |
| --- | --- | --- | --- | --- |
| XS | 34 | 30 | 36 | 44 |
| S | 36 | 32 | 38 | 44 |
| M | 38 | 34 | 40 | 45 |
| L | 40 | 36 | 42 | 45 |
| XL | 42 | 38 | 44 | 46 |
| XXL | 44 | 40 | 46 | 46 |

## How to measure

**Bust** — around the fullest part, keeping the tape level and relaxed.
**Waist** — around the narrowest part of your torso, usually just above the navel.
**Hip** — around the fullest part, roughly 8 inches below the waist.

## Fit notes

- Anarkali and A-line silhouettes are forgiving through the waist and hip; go by your bust measurement.
- Straight-cut kurtis sit closer to the body — if you are between sizes, size up.
- Custom sizing is available on most kurtis at no extra cost. Choose *Custom* in the size selector.

Still unsure? Send us your measurements at care@paribelle.com and we will recommend a size.`,
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertSetting(key, value, type = 'string', isPublic = true) {
  await client.query(
    `INSERT INTO settings (key, value, type, is_public, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type, updated_at = NOW()`,
    [key, value, type, isPublic],
  );
}

async function ensureVendor() {
  const existing = await client.query(`SELECT id FROM vendors WHERE slug = 'paribelle'`);
  if (existing.rows.length > 0) return existing.rows[0].id;

  // The root store belongs to the platform itself, so it is owned by the
  // platform admin rather than a separate vendor login.
  const owner = await client.query(
    `SELECT id FROM users
     WHERE role IN ('super_admin', 'admin', 'vendor_admin')
     ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
     LIMIT 1`,
  );
  if (owner.rows.length === 0) {
    throw new Error('No admin user found to own the PariBelle store — run the admin seed first.');
  }

  const { rows } = await client.query(
    `INSERT INTO vendors (user_id, store_name, slug, description, status, vendor_type, business_name,
                          contact_email, contact_phone, city, state, country, postal_code,
                          is_kyc_verified, kyc_status, commission_rate, free_shipping_threshold,
                          shipping_cost, return_policy_days, allow_returns)
     VALUES ($1, 'PariBelle', 'paribelle',
             'Handcrafted designer kurtis and artificial jewellery, made in Jaipur.',
             'active', 'business', 'PariBelle Studio',
             'care@paribelle.com', '+91 98765 43210', 'Jaipur', 'Rajasthan', 'India', '302001',
             true, 'approved', 0, 1999, 99, 7, true)
     RETURNING id`,
    [owner.rows[0].id],
  );
  return rows[0].id;
}

/**
 * Category is a TypeORM closure-table tree, so parent_id alone is not enough —
 * categories_closure has to carry a row for the node itself plus one for every
 * ancestor above it, or the tree endpoints return an empty children list.
 */
async function syncClosure(categoryId, parentId) {
  await client.query(`DELETE FROM categories_closure WHERE id_descendant = $1`, [categoryId]);
  await client.query(
    `INSERT INTO categories_closure (id_ancestor, id_descendant)
     VALUES ($1, $1) ON CONFLICT DO NOTHING`,
    [categoryId],
  );
  if (!parentId) return;

  await client.query(
    `INSERT INTO categories_closure (id_ancestor, id_descendant)
     SELECT id_ancestor, $2 FROM categories_closure WHERE id_descendant = $1
     ON CONFLICT DO NOTHING`,
    [parentId, categoryId],
  );
}

async function ensureCategory({ slug, name, description, image, sortOrder, parentId, vendorId }) {
  const existing = await client.query(`SELECT id FROM categories WHERE slug = $1`, [slug]);
  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE categories
       SET name = $2, description = $3, image = $4, sort_order = $5,
           parent_id = $6, vendor_id = $7, is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, name, description, image, sortOrder, parentId || null, vendorId || null],
    );
    await syncClosure(existing.rows[0].id, parentId);
    return existing.rows[0].id;
  }

  const { rows } = await client.query(
    `INSERT INTO categories (name, slug, description, image, is_active, sort_order, parent_id, vendor_id)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7)
     RETURNING id`,
    [name, slug, description, image, sortOrder, parentId || null, vendorId || null],
  );
  await syncClosure(rows[0].id, parentId);
  return rows[0].id;
}

async function ensureProduct(product, categoryId, vendorId, skuPrefix) {
  const existing = await client.query(`SELECT id FROM products WHERE slug = $1`, [product.slug]);

  let productId;
  if (existing.rows.length > 0) {
    productId = existing.rows[0].id;
    await client.query(
      `UPDATE products
       SET name = $2, description = $3, short_description = $4, price = $5, compare_at_price = $6,
           stock_quantity = $7, images = $8, featured_image = $9, status = 'active',
           product_type = 'physical', vendor_id = $10, updated_at = NOW()
       WHERE id = $1`,
      [
        productId,
        product.name,
        product.description,
        product.shortDescription,
        product.price,
        product.compareAtPrice || null,
        product.stock,
        [product.image],
        product.image,
        vendorId,
      ],
    );
  } else {
    const { rows } = await client.query(
      `INSERT INTO products (name, slug, description, short_description, price, compare_at_price,
                             sku, stock_quantity, low_stock_threshold, track_inventory, status,
                             product_type, images, featured_image, gst_rate, price_type,
                             vendor_id, average_rating, review_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 3, true, 'active', 'physical', $9, $10,
               5, 'mrp_with_gst', $11, 0, 0)
       RETURNING id`,
      [
        product.name,
        product.slug,
        product.description,
        product.shortDescription,
        product.price,
        product.compareAtPrice || null,
        `${skuPrefix}-${slugify(product.slug).slice(0, 20).toUpperCase()}`,
        product.stock,
        [product.image],
        product.image,
        vendorId,
      ],
    );
    productId = rows[0].id;
  }

  await client.query(
    `INSERT INTO product_categories (product_id, category_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [productId, categoryId],
  );

  return productId;
}

async function main() {
  await client.connect();
  console.log('Connected to database.\n');

  await client.query('BEGIN');
  try {
    // ---------------------------------------------------------------- vendors
    const paribelleId = await ensureVendor();
    console.log(`PariBelle vendor: ${paribelleId}`);

    const demoVendor = await client.query(`SELECT id FROM vendors WHERE slug = 'demo-store'`);
    const demoVendorId = demoVendor.rows[0]?.id || null;

    // ------------------------------------------------------------- categories
    // Demo categories become the demo store's own, so they disappear from the
    // root site but keep working on demo-store.<host>.
    if (demoVendorId) {
      const demoted = await client.query(
        `UPDATE categories SET vendor_id = $1, updated_at = NOW()
         WHERE slug = ANY($2::text[]) AND vendor_id IS DISTINCT FROM $1`,
        [demoVendorId, DEMO_ONLY_CATEGORY_SLUGS],
      );
      console.log(`Moved ${demoted.rowCount} demo categories to demo-store.`);

      // The old global "Fashion" held three demo apparel items. Give the demo
      // store its own apparel category and move them across, so PariBelle's
      // Fashion tree starts clean.
      const demoApparelId = await ensureCategory({
        slug: 'demo-apparel',
        name: 'Apparel',
        description: 'Demo store apparel.',
        image: null,
        sortOrder: 2,
        vendorId: demoVendorId,
      });

      const fashion = await client.query(`SELECT id FROM categories WHERE slug = 'fashion'`);
      if (fashion.rows.length > 0) {
        const fashionId = fashion.rows[0].id;
        const moved = await client.query(
          `UPDATE product_categories SET category_id = $1
           WHERE category_id = $2 AND product_id IN (SELECT id FROM products WHERE vendor_id = $3)`,
          [demoApparelId, fashionId, demoVendorId],
        );
        console.log(`Moved ${moved.rowCount} demo products out of Fashion.`);
      }
    }

    const fashionId = await ensureCategory({
      slug: 'fashion',
      name: 'Fashion',
      description:
        'Handcrafted kurtis and artificial jewellery, made by artisans across Rajasthan and Uttar Pradesh.',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80',
      sortOrder: 0,
      vendorId: null,
    });

    const kurtisId = await ensureCategory({
      slug: 'kurtis',
      name: 'Kurtis',
      description:
        'Anarkali, straight-cut and A-line kurtis in chikankari, bandhani, block print and silk.',
      image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=900&q=80',
      sortOrder: 0,
      parentId: fashionId,
      vendorId: null,
    });

    const jewelleryId = await ensureCategory({
      slug: 'jewellery',
      name: 'Jewellery',
      description: 'Kundan, polki, meenakari and oxidised silver — handcrafted artificial jewellery.',
      image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80',
      sortOrder: 1,
      parentId: fashionId,
      vendorId: null,
    });
    console.log('Category tree: Fashion > Kurtis, Jewellery');

    // --------------------------------------------------------------- products
    for (const kurti of KURTIS) {
      await ensureProduct(kurti, kurtisId, paribelleId, 'PB-K');
    }
    for (const piece of JEWELLERY) {
      await ensureProduct(piece, jewelleryId, paribelleId, 'PB-J');
    }
    console.log(`Seeded ${KURTIS.length} kurtis and ${JEWELLERY.length} jewellery pieces.`);

    // --------------------------------------------------------------- settings
    await upsertSetting('root_vendor_slug', 'paribelle');
    await upsertSetting('marketplace_name', 'PariBelle');
    await upsertSetting('currency', 'INR');
    await upsertSetting('hero_banners', JSON.stringify(HERO_SLIDES, null, 2), 'json');
    console.log('Settings updated (root_vendor_slug = paribelle).');

    // --------------------------------------------------------- footer content
    await client.query(
      `UPDATE footer_settings
       SET about_text = $1, social_links = $2, custom_sections = $3, contact_info = $4,
           copyright_text = $5, show_categories = true, max_categories_display = 6, updated_at = NOW()`,
      [
        'Designer kurtis and artificial jewellery, handcrafted in Jaipur to celebrate Indian artistry.',
        JSON.stringify([
          { platform: 'instagram', url: 'https://instagram.com/paribelle', enabled: true },
          { platform: 'facebook', url: 'https://facebook.com/paribelle', enabled: true },
        ]),
        JSON.stringify(FOOTER_SECTIONS),
        JSON.stringify({
          email: 'care@paribelle.com',
          phone: '+91 98765 43210',
          address: 'PariBelle Studio\n14 Chandpole Bazaar\nJaipur, Rajasthan 302001',
        }),
        'All rights reserved.',
      ],
    );
    console.log('Footer settings updated.');

    // ------------------------------------------------------------ static pages
    for (const page of PAGES) {
      await client.query(
        `INSERT INTO marketplace_pages (title, slug, page_type, content, status, show_in_navigation, published_at)
         VALUES ($1, $2, $3, $4, 'published', false, NOW())
         ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title, content = EXCLUDED.content, page_type = EXCLUDED.page_type,
             status = 'published', updated_at = NOW()`,
        [page.title, page.slug, page.pageType, page.content],
      );
    }
    console.log(`Published ${PAGES.length} customer-care pages.`);

    await client.query('COMMIT');
    console.log('\nDone. Root store is PariBelle (Fashion > Kurtis, Jewellery).');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('\nSetup failed:', error.message);
  process.exit(1);
});
