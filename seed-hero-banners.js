const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'marketplace' });

const heroBanners = [
  {
    id: 'banner-1',
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80',
    title: 'Redefine Your Style',
    subtitle: 'Explore our curated collection of premium fashion — where elegance meets modern design.',
    ctaText: 'Shop Collection',
    ctaLink: '/products',
    order: 0,
  },
  {
    id: 'banner-2',
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=80',
    title: 'Fine Jewellery for Every Occasion',
    subtitle: 'Timeless pieces crafted with precision. From everyday elegance to statement jewellery.',
    ctaText: 'Discover Jewellery',
    ctaLink: '/products',
    order: 1,
  },
  {
    id: 'banner-3',
    imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&q=80',
    title: 'New Season, New You',
    subtitle: 'Fresh arrivals every week. Stay ahead of trends with our exclusive boutique selections.',
    ctaText: 'View New Arrivals',
    ctaLink: '/products',
    order: 2,
  },
];

c.connect()
  .then(() => {
    return c.query(
      "UPDATE settings SET value = $1 WHERE key = 'hero_banners'",
      [JSON.stringify(heroBanners)]
    );
  })
  .then(r => {
    console.log('Hero banners updated. Rows affected:', r.rowCount);
    // Verify
    return c.query("SELECT key, value FROM settings WHERE key = 'hero_banners'");
  })
  .then(r => {
    const banners = r.rows[0].value;
    console.log('Stored banners:', JSON.stringify(banners, null, 2));
    c.end();
  })
  .catch(e => { console.error(e.message); c.end(); });
