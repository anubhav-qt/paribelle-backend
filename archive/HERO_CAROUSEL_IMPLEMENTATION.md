# Hero Carousel Implementation

## Overview
Implemented a dynamic, admin-configurable hero carousel for the homepage with auto-rotation, manual navigation, and support for multiple banner images.

## Features Implemented

### 1. Hero Carousel Component (`HeroCarousel.tsx`)

**Features:**
- ✅ Auto-rotating carousel (5-second intervals)
- ✅ Manual navigation with arrow buttons
- ✅ Dot indicators for slide navigation
- ✅ Smooth fade transitions between slides
- ✅ Pause on hover
- ✅ Responsive design (mobile to desktop)
- ✅ Animated text with fade-in effects
- ✅ Optional CTA button support
- ✅ Image overlay for better text readability
- ✅ Fallback gradient when no image provided

**Specifications:**
- Default Auto-play: 5 seconds per slide
- Transition: Fade (700ms)
- Height: 
  - Mobile: 400px
  - Tablet: 500px
  - Desktop: 600px
- Recommended Image Size: 1920x600px (16:9 aspect ratio)

### 2. Admin Settings Integration

**Location:** Admin → Settings → Hero Carousel Banners

**Features:**
- ✅ Add/Remove banner slides
- ✅ Configure multiple banners
- ✅ Set display order
- ✅ Upload/set image URLs
- ✅ Customize title and subtitle
- ✅ Optional CTA button with link
- ✅ Live preview ready

**Banner Configuration Fields:**
- **Image URL**: Direct link to banner image (optional)
- **Title**: Main heading text
- **Subtitle**: Supporting text
- **CTA Text**: Call-to-action button label (optional)
- **CTA Link**: Button destination URL (optional)
- **Display Order**: Numeric sort order (0-based)

### 3. Animation Enhancements

Added CSS animations in `globals.css`:
- `fadeIn` animation for text elements
- Staggered animation delays for smooth reveals
- Animation classes: `animate-fadeIn`, `animation-delay-200`, `animation-delay-400`

## Usage

### For Administrators

1. **Access Settings:**
   - Navigate to Admin Dashboard
   - Go to Settings
   - Scroll to "Hero Carousel Banners" section

2. **Add New Banner:**
   - Click "+ Add Banner" button
   - Fill in banner details:
     - Image URL (or leave empty for gradient)
     - Title and subtitle
     - Optional CTA button text and link
     - Set display order

3. **Configure Multiple Banners:**
   - Add as many banners as needed
   - Set unique order numbers for each
   - Lower order numbers appear first

4. **Save Changes:**
   - Click "Save Settings" at bottom of page
   - Changes take effect immediately on homepage

### For Frontend Users

**Experience:**
- Homepage displays rotating hero banners
- Auto-advances every 5 seconds
- Hover to pause auto-rotation
- Click arrows to manually navigate
- Click dots to jump to specific slide
- Mobile-friendly with touch support

## Technical Implementation

### Component Structure

```typescript
interface HeroBanner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  order: number;
}
```

### Data Flow

1. **Fetch** → Component fetches banners from `/api/v1/settings/hero_banners`
2. **Sort** → Banners sorted by `order` field
3. **Display** → Carousel renders sorted banners
4. **Auto-rotate** → useEffect triggers slide changes every 5 seconds
5. **User Control** → Buttons/dots override auto-rotation

### Responsive Behavior

**Mobile (< 768px):**
- Height: 400px
- Single column text
- Smaller font sizes
- Touch-friendly navigation

**Tablet (768px - 1024px):**
- Height: 500px
- Optimized spacing
- Medium font sizes

**Desktop (> 1024px):**
- Height: 600px
- Full-width text container
- Large, prominent headings

## Default Fallback

When no banners configured:
```jsx
{
  id: 'default',
  imageUrl: '',
  title: 'Discover Amazing Products',
  subtitle: 'Shop from thousands of products across multiple categories...',
  order: 0
}
```

Shows blue-to-purple gradient background with default marketing text.

## Best Practices

### Image Guidelines

1. **Dimensions:**
   - Recommended: 1920x600px
   - Aspect Ratio: 16:9 or 3:1
   - Format: JPG or PNG
   - Max Size: < 500KB (optimize for web)

2. **Content Placement:**
   - Place text-safe areas on left side
   - Avoid important content near edges
   - Test on mobile devices
   - Consider overlay darkness

3. **Text Contrast:**
   - Use high-contrast colors
   - Dark overlay automatically added (40% opacity)
   - Light text works best on most images

### Performance Tips

1. **Optimize Images:**
   - Use CDN for hosting
   - Compress images (WebP format ideal)
   - Lazy load when possible

2. **Limit Banners:**
   - Recommended: 3-5 banners
   - Too many = slower load times
   - Quality over quantity

3. **CTA Strategy:**
   - Use sparingly (not every banner needs one)
   - Clear, action-oriented text
   - Link to relevant landing pages

## Example Configuration

### Banner 1: Featured Products
```json
{
  "imageUrl": "https://cdn.example.com/summer-sale.jpg",
  "title": "Summer Sale - Up to 70% Off",
  "subtitle": "Amazing deals on electronics, fashion, and home decor",
  "ctaText": "Shop Now",
  "ctaLink": "/category/electronics",
  "order": 0
}
```

### Banner 2: Brand Story
```json
{
  "imageUrl": "",
  "title": "Your Trusted Marketplace",
  "subtitle": "Connecting you with quality vendors across the country",
  "ctaText": "",
  "ctaLink": "",
  "order": 1
}
```

### Banner 3: New Arrivals
```json
{
  "imageUrl": "https://cdn.example.com/new-arrivals.jpg",
  "title": "Just Arrived",
  "subtitle": "Check out our latest products from top brands",
  "ctaText": "Explore",
  "ctaLink": "/products",
  "order": 2
}
```

## Troubleshooting

### Banner Not Showing
- Check if hero_banners setting exists in database
- Verify imageUrl is accessible (no CORS issues)
- Check browser console for errors

### Images Not Loading
- Verify URL is publicly accessible
- Check image format (JPG, PNG, WebP supported)
- Ensure HTTPS if site uses HTTPS

### Carousel Not Auto-Rotating
- Check if only 1 banner configured (needs 2+ for rotation)
- Verify JavaScript not disabled
- Check browser console for errors

### Poor Mobile Display
- Use responsive images
- Test on actual devices
- Adjust text length for mobile

## Future Enhancements

Potential improvements:
- [ ] Image upload directly in admin (vs URL)
- [ ] Preview mode in admin settings
- [ ] Transition effects selector (fade, slide, zoom)
- [ ] Slide-specific timing controls
- [ ] A/B testing capabilities
- [ ] Click tracking/analytics
- [ ] Video background support
- [ ] Parallax scrolling effects
- [ ] Mobile-specific images
- [ ] Scheduled banner rotation (time-based)

## Database Schema

The hero_banners setting is stored as JSON array:

```sql
INSERT INTO site_settings (key, value, description)
VALUES (
  'hero_banners',
  '[
    {
      "id": "banner-1",
      "imageUrl": "https://example.com/banner1.jpg",
      "title": "Welcome",
      "subtitle": "Great products await",
      "ctaText": "Shop Now",
      "ctaLink": "/products",
      "order": 0
    }
  ]',
  'Hero carousel banners for homepage'
);
```

## Dependencies

- React hooks: `useState`, `useEffect`, `useCallback`
- Lucide icons: `ChevronLeft`, `ChevronRight`
- Tailwind CSS for styling
- Native fetch API for data loading

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- Arrow buttons have `aria-label` attributes
- Dots have descriptive labels
- Keyboard navigation support
- Pause on hover for better readability
- High contrast text with overlay

---

**Version:** 1.0  
**Last Updated:** November 25, 2025  
**Author:** Marketplace Development Team
