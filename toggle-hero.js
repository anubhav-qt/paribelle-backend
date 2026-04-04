/**
 * Usage:
 *   node toggle-hero.js hide   -- clears all banners (hides hero section)
 *   node toggle-hero.js show   -- restores the 3 default banners
 */
const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'marketplace' });

const action = process.argv[2];

const defaultBanners = [
  {
    id: 'banner-1', order: 0,
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80',
    title: 'Redefine Your Style',
    subtitle: 'Explore our curated collection of premium fashion — where elegance meets modern design.',
    ctaText: 'Shop Collection', ctaLink: '/products',
  },
  {
    id: 'banner-2', order: 1,
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=80',
    title: 'Fine Jewellery for Every Occasion',
    subtitle: 'Timeless pieces crafted with precision. From everyday elegance to statement jewellery.',
    ctaText: 'Discover Jewellery', ctaLink: '/products',
  },
  {
    id: 'banner-3', order: 2,
    imageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&q=80',
    title: 'New Season, New You',
    subtitle: 'Fresh arrivals every week. Stay ahead of trends with our exclusive boutique selections.',
    ctaText: 'View New Arrivals', ctaLink: '/products',
  },
];

const value = action === 'hide' ? [] : defaultBanners;

c.connect()
  .then(() => c.query("UPDATE settings SET value = $1 WHERE key = 'hero_banners'", [JSON.stringify(value)]))
  .then(r => { console.log(`Hero section ${action === 'hide' ? 'hidden' : 'shown'}. Rows affected: ${r.rowCount}`); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
