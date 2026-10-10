# Vendor Subdomain Implementation - Testing Guide

## ✅ Implementation Complete!

You now have BOTH:
1. **Main Marketplace** - Shows all vendors and products
2. **Vendor-Specific Sites** - Each vendor has their own branded subdomain

---

## How It Works

### Main Marketplace
- URL: `http://localhost:3000`
- Shows: ALL vendors and ALL products
- Example: Browse all products from all vendors

### Vendor-Specific Sites
- URL: `http://vendorslug.localhost:3000`
- Shows: ONLY that vendor's products
- Looks like: The vendor's own website

---

## Testing Locally

### Step 1: Edit Your Hosts File

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Mac/Linux:** `/etc/hosts`

Add these lines:
```
127.0.0.1   testvendor.localhost
127.0.0.1   acmestore.localhost
127.0.0.1   techshop.localhost
```

### Step 2: Create Test Vendors

You need vendors with `slug` field in your database. Example vendors:
- Slug: `testvendor` → Access at: `http://testvendor.localhost:3000`
- Slug: `acmestore` → Access at: `http://acmestore.localhost:3000`
- Slug: `techshop` → Access at: `http://techshop.localhost:3000`

### Step 3: Test URLs

**Main Marketplace (All Vendors):**
```
http://localhost:3000
```

**Vendor-Specific Sites:**
```
http://testvendor.localhost:3000        # Shows only testvendor's products
http://acmestore.localhost:3000         # Shows only acmestore's products
http://techshop.localhost:3000          # Shows only techshop's products
```

**Vendor Product Details:**
```
http://testvendor.localhost:3000/products/product-slug
```

---

## Production Setup

### DNS Configuration

Add a wildcard DNS record:
```
*.marketplace.com → Your server IP
```

### Example Production URLs

**Main Site:**
```
https://marketplace.com
```

**Vendor Sites:**
```
https://testvendor.marketplace.com
https://acmestore.marketplace.com
https://techshop.marketplace.com
```

---

## How The Middleware Works

The middleware (`apps/web/src/middleware.ts`) automatically:

1. Detects subdomain from hostname
2. Rewrites URLs to vendor-specific routes
3. Main site (`localhost:3000`) → Shows all vendors
4. Vendor site (`vendor.localhost:3000`) → Shows only that vendor

### URL Routing Examples

**Subdomain Homepage:**
```
testvendor.localhost:3000/
→ Rewrites to: /vendor/testvendor
→ Shows: Vendor homepage with their products
```

**Subdomain Product Page:**
```
testvendor.localhost:3000/products/cool-gadget
→ Rewrites to: /vendor/testvendor/products/cool-gadget
→ Shows: Product detail ONLY if it belongs to testvendor
```

**Main Site (No Subdomain):**
```
localhost:3000/
→ No rewrite
→ Shows: Main marketplace with all vendors
```

---

## Files Created/Modified

### Frontend
- ✅ `apps/web/src/middleware.ts` - Subdomain routing
- ✅ `apps/web/src/app/vendor/[vendorSlug]/page.tsx` - Vendor homepage
- ✅ `apps/web/src/app/vendor/[vendorSlug]/products/[slug]/page.tsx` - Vendor product page

### Backend
- ✅ `apps/backend/src/modules/vendors/vendors.controller.ts` - Added `slug` endpoint
- ✅ `apps/backend/src/modules/vendors/vendors.service.ts` - Added `findBySlug` method

---

## Quick Test Script

```powershell
# Make sure vendors have slug field
# Create a vendor with slug 'testvendor'

# Add to hosts file:
# 127.0.0.1   testvendor.localhost

# Then visit:
# http://testvendor.localhost:3000  ← Vendor's own site
# http://localhost:3000              ← Main marketplace
```

---

## Benefits

✅ **Professional branding** - Each vendor gets their own URL
✅ **No separate hosting** - All runs on same Next.js app
✅ **Easy to manage** - One codebase for everything
✅ **SEO friendly** - Each vendor site can be indexed separately
✅ **Scalable** - Add unlimited vendors without code changes

---

## Need Help?

If a vendor site shows "Vendor Not Found":
1. Check the vendor has a `slug` field in database
2. Check hosts file has the entry
3. Check the slug matches exactly (case-sensitive)
4. Restart the web server after hosts file changes
