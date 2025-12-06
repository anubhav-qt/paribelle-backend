# Multi-Image Support Implementation

## Overview
Added support for multiple images and videos per product across the marketplace application, with an Amazon-style image gallery interface.

## Backend Changes

### 1. Database Entity (Already Existed)
**File:** `apps/backend/src/modules/products/product.entity.ts`
- Product entity already had `images` field: `@Column('simple-array', { nullable: true }) images: string[]`
- Supports comma-separated array of image/video URLs

### 2. Seed Data Updates
**File:** `apps/backend/src/database/seed.ts`

Updated all products to include multiple images (3-5 per product). Examples:

```typescript
// Wireless Headphones - 4 images
images: [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
  'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500',
  'https://images.unsplash.com/photo-1545127398-14699f92334b?w=500',
  'https://images.unsplash.com/photo-1577174881658-0f30157f72c4?w=500'
]

// Smart Watch - 5 images
images: [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
  'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500',
  'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500',
  'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500'
]

// Yoga Mat - 3 images + 1 YouTube video
images: [
  'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
  'https://images.unsplash.com/photo-1592432678016-e910b452ce45?w=500',
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
  'https://www.youtube.com/embed/v7AYKMP6rOE'
]
```

**Products updated with multi-images:**
- Electronics (13 products): Headphones, Smart Watch, Bluetooth Speaker, Webcam, Gaming Mouse, USB-C Hub, Mechanical Keyboard, Wireless Charger, Action Camera, Power Bank, Smart LED Bulbs, Laptop Stand, Noise Cancelling Earbuds, Ring Light
- Fashion (12 products): Men's shorts, shirts, Women's skirts, jeans, tops, blouses, Running shoes
- Home & Sports (6 products): Aromatherapy Diffuser, Table Lamp, Books, Yoga Mat, Resistance Bands

## Frontend Changes

### 1. Product Image Gallery Component
**File:** `apps/web/src/components/ProductImageGallery.tsx` (NEW)

Amazon-style gallery with:
- **Main display**: Large image/video with zoom capability
- **Navigation**: Previous/Next arrows on hover
- **Thumbnail strip**: Scrollable thumbnails with active indicator
- **Image counter**: "3 / 5" style counter
- **Video support**: MP4, WebM, YouTube embeds, Vimeo embeds
- **Responsive**: Works on mobile and desktop

```tsx
<ProductImageGallery images={product.images || [featuredImage]} />
```

### 2. Homepage Product Cards
**File:** `apps/web/src/app/page.tsx`

Updated Product interface:
```typescript
interface Product {
  // ...existing fields
  images?: string[];
  featuredImage: string;
  vendor?: {
    subdomain?: string;
    businessName?: string;
  };
}
```

All product card sections updated to use:
```tsx
<img 
  src={product.images?.[0] || product.featuredImage || fallback}
  alt={product.name}
/>
```

Vendor links added:
```tsx
{vendor?.subdomain && (
  <a 
    href={`http://${vendor.subdomain}.localhost:3000`}
    target="_blank"
    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
  >
    <ExternalLink className="w-3 h-3" />
    Visit {vendor.businessName}
  </a>
)}
```

### 3. Category Page
**File:** `apps/web/src/app/category/[slug]/page.tsx`

Updated Product interface and both product card sections (with/without location):
- Added `images?: string[]` to interface
- Updated all product images to use `product.images?.[0] || product.featuredImage`

### 4. Product Detail Page
**File:** `apps/web/src/app/products/[slug]/page.tsx`

Replaced single image with ProductImageGallery:
```tsx
<ProductImageGallery 
  images={product.images || [product.featuredImage]} 
/>
```

Added vendor website link section after categories.

## Video Support

Supported video formats:
- **Direct files**: `.mp4`, `.webm` (rendered in `<video>` tag)
- **YouTube**: `youtube.com/embed/VIDEO_ID` or `youtu.be/VIDEO_ID`
- **Vimeo**: `vimeo.com/VIDEO_ID` or `player.vimeo.com/video/VIDEO_ID`

Detection logic:
```typescript
const isVideo = (url: string) => {
  const videoExtensions = ['.mp4', '.webm'];
  const videoHosts = ['youtube.com', 'youtu.be', 'vimeo.com'];
  return videoExtensions.some(ext => url.toLowerCase().endsWith(ext)) ||
         videoHosts.some(host => url.includes(host));
};
```

## Database Migration

No migration needed - the `images` column already exists as `simple-array` type.

To populate with new seed data:
```bash
cd apps/backend
npm run seed
```

Note: The seed script has been updated to handle foreign key constraints in the correct order.

## Usage Examples

### Adding Products with Multiple Images

```typescript
const product = {
  name: 'Example Product',
  featuredImage: 'https://example.com/main.jpg',
  images: [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
    'https://example.com/image3.jpg',
    'https://www.youtube.com/embed/DEMO_VIDEO',
    'https://example.com/video.mp4'
  ]
};
```

### Displaying Product Gallery

```tsx
import ProductImageGallery from '@/components/ProductImageGallery';

<ProductImageGallery 
  images={product.images || [product.featuredImage]} 
/>
```

## Features

✅ Multiple images per product (3-5 images each)  
✅ Video support (YouTube, Vimeo, MP4, WebM)  
✅ Amazon-style gallery with thumbnails  
✅ Image zoom functionality  
✅ Navigation arrows  
✅ Responsive design  
✅ Fallback to featuredImage  
✅ Vendor website links  
✅ Updated across all product displays:
  - Homepage (3 sections)
  - Category pages
  - Product detail pages

## Files Modified

### Backend
- `apps/backend/src/database/seed.ts` - Added multi-images to all products
- `apps/backend/src/modules/products/product.entity.ts` - Already had images field

### Frontend
- `apps/web/src/components/ProductImageGallery.tsx` - NEW component
- `apps/web/src/app/page.tsx` - Updated interface and 3 product card sections
- `apps/web/src/app/category/[slug]/page.tsx` - Updated interface and product cards
- `apps/web/src/app/products/[slug]/page.tsx` - Using ProductImageGallery

## Next Steps

To see the multi-image functionality in action:

1. **Reset and seed database** (when ready to clear existing data):
   ```bash
   cd apps/backend
   npm run seed
   ```

2. **Restart services**:
   ```bash
   .\restart-services.ps1
   ```

3. **View products** with multiple images and videos in:
   - Homepage product listings
   - Category pages
   - Individual product detail pages

The image gallery will show navigation arrows, thumbnail strip, and support both images and embedded videos.
