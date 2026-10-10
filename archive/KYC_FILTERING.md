# KYC Verification Filtering for Products

## Overview
This document explains the KYC (Know Your Customer) verification filtering implemented across the marketplace backend to ensure only products from verified vendors are shown in public listings.

## Security Rationale
- **Legal Compliance**: Only verified vendors should be able to sell on the marketplace
- **Customer Protection**: Buyers should only see products from vendors who have completed KYC verification
- **Trust**: KYC verification ensures vendor identity and business legitimacy

## Implementation Details

### Affected Methods

#### 1. **ProductsService.findAll()**
- **Location**: `src/modules/products/products.service.ts` (lines 62-95)
- **KYC Filtering**: Applied unless `includeUnverifiedVendors=true` or `vendorId` is specified
- **Use Cases**:
  - Public product listings → KYC filtering enabled
  - Vendor dashboard (with vendorId) → Shows vendor's own products regardless of KYC
  - Admin panel (with includeUnverifiedVendors=true) → Shows all products
- **Query**: `vendor.kycStatus = 'approved'`

#### 2. **ProductsService.findByCategory()**
- **Location**: `src/modules/products/products.service.ts` (lines 171-210)
- **KYC Filtering**: Applied unless specific `vendorId` filter provided
- **Use Cases**:
  - Public category browsing → KYC filtering enabled
  - Vendor's category filter → Shows specific vendor's products
- **Query**: `vendor.kycStatus = 'approved'`

#### 3. **ProductsService.findBySlug()**
- **Location**: `src/modules/products/products.service.ts` (lines 381-415)
- **KYC Filtering**: Always applied
- **Use Cases**:
  - Product detail pages → Only verified vendors' products accessible
- **Query**: `vendor.kycStatus = 'approved'`

#### 4. **ProductsService.findOne()**
- **Location**: `src/modules/products/products.service.ts` (lines 297-337)
- **KYC Filtering**: Always applied
- **Use Cases**:
  - Direct product access by ID → Only verified vendors' products
- **Query**: `vendor.kycStatus = 'approved'`

#### 5. **ProductsService.findVariations()**
- **Location**: `src/modules/products/products.service.ts` (lines 354-363)
- **KYC Filtering**: Always applied
- **Use Cases**:
  - Product variation listings → Only verified vendors' variations
- **Query**: `vendor.kycStatus = 'approved'`

#### 6. **VendorsService.getVendorProducts()**
- **Location**: `src/modules/vendors/vendors.service.ts` (lines 44-63)
- **KYC Filtering**: Always applied
- **Use Cases**:
  - Vendor storefront pages → Only show storefront if vendor is KYC approved
- **Query**: `vendor.kycStatus = 'approved'`

## Database Schema

### Vendor Entity
```sql
vendors (
  ...
  kyc_status VARCHAR(50) DEFAULT 'pending'
  -- Possible values: 'pending', 'approved', 'rejected', 'under_review'
  ...
)
```

## Bypass Mechanisms

### 1. Vendor Dashboard Access
```typescript
// Vendor viewing their own products
productsService.findAll(page, limit, status, search, vendorId, false, null, null, null, false)
// vendorId present → KYC check skipped for that vendor's products
```

### 2. Admin Panel Access
```typescript
// Admin viewing all products
productsService.findAll(page, limit, status, search, null, false, null, null, null, true)
// includeUnverifiedVendors=true → KYC check skipped entirely
```

## Security Considerations

### Current Implementation
- **Public Endpoints**: KYC filtering is enforced by default
- **Vendor Dashboard**: Vendors can see their own products regardless of KYC status
- **Potential Issue**: Anyone can pass a `vendorId` parameter to bypass KYC filtering

### Recommended Enhancement
To prevent malicious users from bypassing KYC filtering by passing arbitrary vendorIds:

```typescript
// In products.controller.ts - Add authentication
@UseGuards(JwtAuthGuard)
async findAll(
  @Request() req,
  @Query('vendorId') vendorId?: string,
  // ... other params
) {
  // Only allow vendorId filter if:
  // 1. User is authenticated vendor AND vendorId matches their ID
  // 2. User is admin
  const allowVendorFilter = 
    (req.user?.role === 'vendor' && req.user?.vendorId === vendorId) ||
    req.user?.role === 'admin';
    
  const actualVendorId = allowVendorFilter ? vendorId : null;
  
  return this.productsService.findAll(
    // ... params with actualVendorId
  );
}
```

## Testing KYC Filtering

### Test Cases

1. **Public Product Listing**
   ```bash
   GET /api/v1/products
   # Should only return products where vendor.kycStatus = 'approved'
   ```

2. **Product Detail by Slug**
   ```bash
   GET /api/v1/products/slug/test-product
   # Should return 404 if vendor.kycStatus != 'approved'
   ```

3. **Category Products**
   ```bash
   GET /api/v1/products?categoryId=123
   # Should only return products from approved vendors
   ```

4. **Vendor Dashboard** (Requires Authentication)
   ```bash
   GET /api/v1/products?vendorId=vendor-uuid
   # Should show vendor's own products regardless of KYC status
   # TODO: Verify user is authenticated and authorized
   ```

5. **Admin Panel** (Requires Admin Role)
   ```bash
   GET /api/v1/products?includeUnverifiedVendors=true
   # Should show all products from all vendors
   # TODO: Add admin role check
   ```

## Related Security Issues

### KYC Document Storage
- **Current Issue**: KYC documents uploaded to public Cloudinary
- **Risk**: Sensitive PII (Aadhaar, PAN, GST certificates) publicly accessible
- **Recommendation**: Move to AWS S3 private bucket with pre-signed URLs
- **See**: [Separate KYC Storage Documentation](#) (TODO)

## Migration Notes

### Database Migration
No migration needed - `kyc_status` column already exists in vendors table with default 'pending'.

### Existing Data
```sql
-- Set existing vendors to 'approved' if already verified
UPDATE vendors 
SET kyc_status = 'approved' 
WHERE kyc_verified = true;

-- Or manually review and approve vendors
SELECT id, store_name, business_name, kyc_status 
FROM vendors 
WHERE kyc_status = 'pending';
```

## Future Enhancements

1. **Authentication Guards**
   - Add JwtAuthGuard to vendor dashboard endpoints
   - Verify vendorId matches authenticated user

2. **Admin Role Enforcement**
   - Add AdminGuard for includeUnverifiedVendors parameter
   - Prevent non-admin users from seeing unverified products

3. **KYC Status Enum**
   - Define TypeScript enum for KYC statuses
   - Add validation to prevent invalid status values

4. **Audit Logging**
   - Log all KYC status changes
   - Track who approved/rejected KYC applications

5. **Notification System**
   - Email vendors when KYC is approved/rejected
   - Notify admins of pending KYC applications

## References
- Payment Flow: [PAYMENT_FLOW.md](./PAYMENT_FLOW.md)
- Cloudinary Integration: [CLOUDINARY_INTEGRATION.md](./CLOUDINARY_INTEGRATION.md)
- Admin Authentication: [ADMIN_AUTH_GUIDE.md](./ADMIN_AUTH_GUIDE.md)
