# Review System Implementation

This document describes the comprehensive review system for products and vendors in the marketplace.

## Overview

The review system allows customers to:
- Review products they have purchased
- Review vendors/sellers after receiving orders
- View product and vendor reviews
- Vendors can respond to reviews

## Features

### Product Reviews
- ⭐ 1-5 star rating
- 📝 Written review/comment
- ✅ Verified purchase badge
- 🖼️ Image uploads (future enhancement)
- 💬 Vendor response capability
- 🔒 Only customers who purchased can review

### Vendor Reviews
- ⭐ Overall rating (1-5 stars)
- 📦 Product quality rating
- 🚚 Shipping speed rating
- 💬 Customer service rating
- ✅ Verified purchase from order
- 🔒 One review per order

## Database Schema

### Product Reviews Table (`reviews`)
```sql
- id: UUID (primary key)
- rating: INT (1-5)
- comment: TEXT
- isVerifiedPurchase: BOOLEAN
- isApproved: BOOLEAN
- images: TEXT[] (array)
- vendorResponse: TEXT (nullable)
- vendorResponseDate: TIMESTAMP (nullable)
- userId: UUID (foreign key)
- productId: UUID (foreign key)
- orderItemId: UUID (foreign key, nullable)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Vendor Reviews Table (`vendor_reviews`)
```sql
- id: UUID (primary key)
- rating: INT (1-5)
- comment: TEXT
- isVerifiedPurchase: BOOLEAN
- isApproved: BOOLEAN
- productQualityRating: INT (nullable)
- shippingSpeedRating: INT (nullable)
- customerServiceRating: INT (nullable)
- vendorResponse: TEXT (nullable)
- vendorResponseDate: TIMESTAMP (nullable)
- userId: UUID (foreign key)
- vendorId: UUID (foreign key)
- orderId: UUID (foreign key, nullable)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Product Entity Update
Added field:
- `averageRating: DECIMAL(3,2)` - Automatically calculated from reviews

## API Endpoints

### Product Reviews

#### Create Product Review
```
POST /api/v1/reviews/products
Authorization: Bearer <token>

Body:
{
  "productId": "uuid",
  "rating": 5,
  "comment": "Great product!",
  "orderItemId": "uuid" (optional - for verified purchase)
}
```

#### Get Product Reviews
```
GET /api/v1/reviews/products/:productId?page=1&limit=10

Response:
{
  "reviews": [...],
  "total": 100,
  "averageRating": 4.5
}
```

#### Update Product Review
```
PUT /api/v1/reviews/products/:reviewId
Authorization: Bearer <token>

Body:
{
  "rating": 4,
  "comment": "Updated review"
}
```

#### Delete Product Review
```
DELETE /api/v1/reviews/products/:reviewId
Authorization: Bearer <token>
```

### Vendor Reviews

#### Create Vendor Review
```
POST /api/v1/reviews/vendors
Authorization: Bearer <token>

Body:
{
  "vendorId": "uuid",
  "rating": 5,
  "comment": "Excellent seller!",
  "orderId": "uuid" (optional),
  "productQualityRating": 5,
  "shippingSpeedRating": 4,
  "customerServiceRating": 5
}
```

#### Get Vendor Reviews
```
GET /api/v1/reviews/vendors/:vendorId?page=1&limit=10

Response:
{
  "reviews": [...],
  "total": 50,
  "averageRating": 4.7,
  "stats": {
    "averageRating": 4.7,
    "productQuality": 4.8,
    "shippingSpeed": 4.5,
    "customerService": 4.9,
    "totalReviews": 50
  }
}
```

#### Update Vendor Review
```
PUT /api/v1/reviews/vendors/:reviewId
Authorization: Bearer <token>

Body:
{
  "rating": 4,
  "comment": "Updated review",
  "productQualityRating": 4,
  "shippingSpeedRating": 4,
  "customerServiceRating": 5
}
```

### Vendor Responses

#### Add Response to Product Review
```
POST /api/v1/reviews/products/:reviewId/response
Authorization: Bearer <token> (must be vendor)

Body:
{
  "response": "Thank you for your feedback!"
}
```

#### Add Response to Vendor Review
```
POST /api/v1/reviews/vendors/:reviewId/response
Authorization: Bearer <token> (must be vendor)

Body:
{
  "response": "We appreciate your business!"
}
```

### Order Reviews

#### Get Order Items with Reviews
```
GET /api/v1/reviews/orders/:orderId/items
Authorization: Bearer <token>

Response: Array of order items with their reviews
```

#### Get Order Vendor Review
```
GET /api/v1/reviews/orders/:orderId/vendor-review
Authorization: Bearer <token>

Response: Vendor review for the order or null
```

## Frontend Components

### 1. RatingDisplay.tsx
Display star ratings with optional number and count.

**Usage:**
```tsx
<RatingDisplay 
  rating={4.5} 
  showNumber={true}
  count={25}
  size="md"
/>
```

**Props:**
- `rating`: number (0-5)
- `maxRating`: number (default: 5)
- `size`: 'sm' | 'md' | 'lg'
- `showNumber`: boolean
- `count`: number (optional review count)

### 2. RatingInput.tsx
Interactive star rating input for forms.

**Usage:**
```tsx
<RatingInput
  value={rating}
  onChange={setRating}
  label="Overall Rating"
  required
/>
```

**Props:**
- `value`: number (current rating)
- `onChange`: (rating: number) => void
- `maxRating`: number (default: 5)
- `size`: 'sm' | 'md' | 'lg'
- `label`: string (optional)
- `required`: boolean (optional)

### 3. ReviewForm.tsx
Form for submitting product or vendor reviews.

**Usage:**
```tsx
<ReviewForm
  type="product"
  itemId={productId}
  itemName="Product Name"
  orderItemId={orderItemId}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

**Props:**
- `type`: 'product' | 'vendor'
- `itemId`: string (product or vendor ID)
- `itemName`: string
- `orderItemId`: string (optional for product)
- `orderId`: string (optional for vendor)
- `existingReview`: object (optional for editing)
- `onSubmit`: (data: any) => Promise<void>
- `onCancel`: () => void

### 4. ReviewCard.tsx
Display a single review with user info and ratings.

**Usage:**
```tsx
<ReviewCard
  review={review}
  type="product"
/>
```

**Props:**
- `review`: Review object
- `type`: 'product' | 'vendor'
- `productQualityRating`: number (vendor only)
- `shippingSpeedRating`: number (vendor only)
- `customerServiceRating`: number (vendor only)

## Pages

### Order Review Page
**Route:** `/orders/[id]/review`

Features:
- Review all products in an order
- Review the vendor/seller
- Edit existing reviews
- Only available for delivered orders
- Shows verified purchase badges
- Real-time updates

## Business Rules

### Product Reviews
1. ✅ Customers can review products they purchased
2. ✅ Only delivered orders can be reviewed
3. ✅ One review per order item
4. ✅ Reviews marked as "Verified Purchase" when linked to order
5. ✅ Customers can edit their own reviews
6. ✅ Customers can delete their own reviews
7. ✅ Vendors can respond to reviews on their products
8. ✅ Product average rating automatically updated

### Vendor Reviews
1. ✅ Customers can review vendors after order delivery
2. ✅ One review per order
3. ✅ Includes overall rating + 3 specific ratings
4. ✅ Reviews marked as "Verified Purchase" when linked to order
5. ✅ Vendors can respond to reviews
6. ✅ Statistics calculated: avg rating, quality, shipping, service

### Validation
- Rating must be 1-5 stars
- Comment minimum length: 10 characters
- Only order owner can review
- Order must be in "delivered" status
- Cannot review same product/vendor twice from same order

## Usage Flow

### Customer Reviews a Product

1. Customer receives delivered order
2. Navigate to "My Orders" page
3. Click "Review Order" on delivered order
4. Fill out review for each product:
   - Select star rating (1-5)
   - Write review comment
   - Submit
5. Review appears with "Verified Purchase" badge
6. Product average rating updates automatically

### Customer Reviews a Vendor

1. On the order review page
2. See vendor section at top
3. Click "Write Review"
4. Fill out:
   - Overall rating
   - Product quality rating (optional)
   - Shipping speed rating (optional)
   - Customer service rating (optional)
   - Written comment
5. Submit vendor review

### Vendor Responds to Review

1. Vendor views review on their product/store page
2. Click "Respond" button
3. Write response message
4. Submit
5. Response appears below customer review

## Future Enhancements

### Phase 2
- [ ] Image uploads with reviews
- [ ] Review helpfulness voting (thumbs up/down)
- [ ] Report inappropriate reviews
- [ ] Filter reviews by rating
- [ ] Sort reviews (most recent, highest rated, etc.)
- [ ] Review moderation dashboard for admin

### Phase 3
- [ ] Review incentives (reward points)
- [ ] Review reminders via email
- [ ] Review statistics on product pages
- [ ] Vendor review response notifications
- [ ] Review verification badges for multiple purchases

### Phase 4
- [ ] Video reviews
- [ ] Question & Answer section
- [ ] Review highlights/summary
- [ ] AI-powered review sentiment analysis
- [ ] Automated fake review detection

## Installation

### 1. Run Database Migration

The review system requires new database tables. Run synchronization:

```bash
cd marketplace-backend
npm run start:dev
# TypeORM will auto-create tables in development
```

For production, create a migration:

```bash
npm run migration:generate -- -n AddReviewTables
npm run migration:run
```

### 2. Verify API Endpoints

Test the review endpoints:

```bash
# Create product review
curl -X POST http://localhost:3001/api/v1/reviews/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "uuid",
    "rating": 5,
    "comment": "Great product!",
    "orderItemId": "uuid"
  }'

# Get product reviews
curl http://localhost:3001/api/v1/reviews/products/PRODUCT_ID
```

### 3. Test Frontend

1. Place an order and mark it as delivered (admin)
2. Navigate to "My Orders"
3. Click "Review Order" on delivered order
4. Submit reviews for products and vendor
5. Verify reviews appear correctly

## Troubleshooting

### Reviews not showing
- Check if order status is "delivered"
- Verify user is authenticated
- Check browser console for errors
- Verify API endpoints are accessible

### Cannot submit review
- Ensure order is delivered
- Check if review already exists
- Verify rating is 1-5
- Ensure comment is at least 10 characters

### Average rating not updating
- Service automatically updates on create/update/delete
- Check database product table for `averageRating` column
- Verify reviews are approved (`isApproved = true`)

## Database Indexes

For optimal performance, add these indexes:

```sql
-- Product reviews
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_order_item_id ON reviews(order_item_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_product_approved ON reviews(product_id, is_approved);

-- Vendor reviews
CREATE INDEX idx_vendor_reviews_vendor_id ON vendor_reviews(vendor_id);
CREATE INDEX idx_vendor_reviews_user_id ON vendor_reviews(user_id);
CREATE INDEX idx_vendor_reviews_order_id ON vendor_reviews(order_id);
CREATE INDEX idx_vendor_reviews_created_at ON vendor_reviews(created_at DESC);
CREATE INDEX idx_vendor_reviews_vendor_approved ON vendor_reviews(vendor_id, is_approved);
```

## Security Considerations

1. ✅ **Authentication Required**: All write operations require valid JWT token
2. ✅ **Authorization**: Users can only review their own orders
3. ✅ **Ownership Validation**: Can only edit/delete own reviews
4. ✅ **Vendor Validation**: Vendors can only respond to reviews on their products
5. ✅ **Order Validation**: Reviews only allowed for delivered orders
6. ✅ **Duplicate Prevention**: One review per order item/order
7. ⚠️ **Rate Limiting**: Consider adding rate limits to prevent spam (future)
8. ⚠️ **Content Moderation**: Consider profanity filter (future)

## Testing Checklist

- [ ] Create product review as customer
- [ ] Create vendor review as customer
- [ ] Update existing review
- [ ] Delete review
- [ ] Vendor responds to product review
- [ ] Vendor responds to vendor review
- [ ] View reviews on product page
- [ ] View reviews on vendor page
- [ ] Verify verified purchase badge
- [ ] Check average rating calculation
- [ ] Test review form validation
- [ ] Test access control (cannot review others' orders)
- [ ] Test status validation (only delivered orders)
- [ ] Test duplicate prevention

## Summary

The review system is fully implemented with:
- ✅ Product reviews with verified purchases
- ✅ Vendor reviews with detailed ratings
- ✅ Vendor response capability
- ✅ Automatic average rating calculation
- ✅ Complete frontend UI components
- ✅ Order review page integration
- ✅ Full API with validation and security
- ✅ Proper entity relations and database schema

Customers can now leave detailed feedback on products and vendors, helping other buyers make informed decisions while giving vendors valuable insights to improve their service.
