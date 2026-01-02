# Revert camelCase back to snake_case in init-database.sql
$sqlFile = Join-Path $PSScriptRoot "init-database.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Error "SQL file not found: $sqlFile"
    exit 1
}

Write-Host "Reading SQL file..." -ForegroundColor Cyan
$content = Get-Content $sqlFile -Raw

Write-Host "Converting camelCase to snake_case..." -ForegroundColor Cyan

# Common columns that appear in multiple tables
$content = $content -replace '\bcreatedAt\b', 'created_at'
$content = $content -replace '\bupdatedAt\b', 'updated_at'
$content = $content -replace '\bdeletedAt\b', 'deleted_at'
$content = $content -replace '\bfirstName\b', 'first_name'
$content = $content -replace '\blastName\b', 'last_name'
$content = $content -replace '\bemailVerified\b', 'email_verified'
$content = $content -replace '\bphoneVerified\b', 'phone_verified'
$content = $content -replace '\bverificationToken\b', 'verification_token'
$content = $content -replace '\bverificationTokenExpires\b', 'verification_token_expires'
$content = $content -replace '\bresetPasswordToken\b', 'reset_password_token'
$content = $content -replace '\bresetPasswordExpires\b', 'reset_password_expires'
$content = $content -replace '\bgoogleId\b', 'google_id'
$content = $content -replace '\bprofilePicture\b', 'profile_picture'

# Users table specific
$content = $content -replace '\bfullName\b', 'full_name'

# Vendors table specific
$content = $content -replace '\bvendorId\b', 'vendor_id'
$content = $content -replace '\buserId\b', 'user_id'
$content = $content -replace '\bstoreName\b', 'store_name'
$content = $content -replace '\bstoreDescription\b', 'store_description'
$content = $content -replace '\bstoreLogo\b', 'store_logo'
$content = $content -replace '\bstoreBanner\b', 'store_banner'
$content = $content -replace '\bisVerified\b', 'is_verified'
$content = $content -replace '\bisActive\b', 'is_active'
$content = $content -replace '\bthemeColor\b', 'theme_color'
$content = $content -replace '\bsupportEmail\b', 'support_email'
$content = $content -replace '\bsupportPhone\b', 'support_phone'
$content = $content -replace '\bgstNumber\b', 'gst_number'
$content = $content -replace '\bpanNumber\b', 'pan_number'
$content = $content -replace '\bbankAccount\b', 'bank_account'
$content = $content -replace '\bifscCode\b', 'ifsc_code'

# Categories table
$content = $content -replace '\bparentId\b', 'parent_id'
$content = $content -replace '\bimagePath\b', 'image_path'
$content = $content -replace '\bisActive\b', 'is_active'
$content = $content -replace '\bdisplayMode\b', 'display_mode'

# Products table
$content = $content -replace '\bproductId\b', 'product_id'
$content = $content -replace '\bcategoryId\b', 'category_id'
$content = $content -replace '\blongDescription\b', 'long_description'
$content = $content -replace '\bregularPrice\b', 'regular_price'
$content = $content -replace '\bsalePrice\b', 'sale_price'
$content = $content -replace '\bisFeatured\b', 'is_featured'
$content = $content -replace '\binStock\b', 'in_stock'
$content = $content -replace '\bstockQuantity\b', 'stock_quantity'
$content = $content -replace '\blowStockThreshold\b', 'low_stock_threshold'
$content = $content -replace '\bimageUrls\b', 'image_urls'
$content = $content -replace '\bproductType\b', 'product_type'
$content = $content -replace '\bdurationMinutes\b', 'duration_minutes'
$content = $content -replace '\bavailableSlots\b', 'available_slots'
$content = $content -replace '\bmaxBookingsPerSlot\b', 'max_bookings_per_slot'
$content = $content -replace '\bserviceLocation\b', 'service_location'
$content = $content -replace '\bhsnCode\b', 'hsn_code'

# Product Variants
$content = $content -replace '\bvariantId\b', 'variant_id'
$content = $content -replace '\bskuId\b', 'sku_id'
$content = $content -replace '\bcompareAtPrice\b', 'compare_at_price'
$content = $content -replace '\bpreviousPrices\b', 'previous_prices'

# Orders table
$content = $content -replace '\borderId\b', 'order_id'
$content = $content -replace '\borderNumber\b', 'order_number'
$content = $content -replace '\borderDate\b', 'order_date'
$content = $content -replace '\bshippingAddress\b', 'shipping_address'
$content = $content -replace '\bbillingAddress\b', 'billing_address'
$content = $content -replace '\btotalAmount\b', 'total_amount'
$content = $content -replace '\bdiscountAmount\b', 'discount_amount'
$content = $content -replace '\bshippingCost\b', 'shipping_cost'
$content = $content -replace '\btaxAmount\b', 'tax_amount'
$content = $content -replace '\bpaymentMethod\b', 'payment_method'
$content = $content -replace '\bpaymentStatus\b', 'payment_status'
$content = $content -replace '\borderStatus\b', 'order_status'
$content = $content -replace '\btrackingNumber\b', 'tracking_number'
$content = $content -replace '\bestimatedDelivery\b', 'estimated_delivery'

# Order Items
$content = $content -replace '\borderItemId\b', 'order_item_id'
$content = $content -replace '\bunitPrice\b', 'unit_price'
$content = $content -replace '\bvariantInfo\b', 'variant_info'

# Payments table
$content = $content -replace '\bpaymentId\b', 'payment_id'
$content = $content -replace '\btransactionId\b', 'transaction_id'
$content = $content -replace '\bpaymentGateway\b', 'payment_gateway'

# Bookings table
$content = $content -replace '\bbookingId\b', 'booking_id'
$content = $content -replace '\bbookingDate\b', 'booking_date'
$content = $content -replace '\bstartTime\b', 'start_time'
$content = $content -replace '\bendTime\b', 'end_time'
$content = $content -replace '\bcustomerName\b', 'customer_name'
$content = $content -replace '\bcustomerEmail\b', 'customer_email'
$content = $content -replace '\bcustomerPhone\b', 'customer_phone'
$content = $content -replace '\bspecialRequests\b', 'special_requests'

# Reviews table
$content = $content -replace '\breviewId\b', 'review_id'
$content = $content -replace '\bisVerified\b', 'is_verified'

# Vendor Reviews
$content = $content -replace '\bvendorReviewId\b', 'vendor_review_id'

# Vendor Pages
$content = $content -replace '\bpageId\b', 'page_id'
$content = $content -replace '\bpageSlug\b', 'page_slug'
$content = $content -replace '\bmetaTitle\b', 'meta_title'
$content = $content -replace '\bmetaDescription\b', 'meta_description'
$content = $content -replace '\bmetaKeywords\b', 'meta_keywords'
$content = $content -replace '\bisPublished\b', 'is_published'
$content = $content -replace '\bpublishedAt\b', 'published_at'

# Vendor Blog Posts
$content = $content -replace '\bpostId\b', 'post_id'
$content = $content -replace '\bfeaturedImage\b', 'featured_image'

# Vendor Navigation
$content = $content -replace '\bnavItemId\b', 'nav_item_id'
$content = $content -replace '\bparentNavItemId\b', 'parent_nav_item_id'
$content = $content -replace '\bnavType\b', 'nav_type'
$content = $content -replace '\bnavOrder\b', 'nav_order'
$content = $content -replace '\bexternalUrl\b', 'external_url'

# Addresses table
$content = $content -replace '\baddressId\b', 'address_id'
$content = $content -replace '\baddressLine1\b', 'address_line1'
$content = $content -replace '\baddressLine2\b', 'address_line2'
$content = $content -replace '\bpostalCode\b', 'postal_code'
$content = $content -replace '\bisDefault\b', 'is_default'
$content = $content -replace '\baddressType\b', 'address_type'

# Settings table
$content = $content -replace '\bsettingId\b', 'setting_id'
$content = $content -replace '\bsettingValue\b', 'setting_value'
$content = $content -replace '\bsiteTitle\b', 'site_title'
$content = $content -replace '\bsiteDescription\b', 'site_description'
$content = $content -replace '\bsiteLogo\b', 'site_logo'
$content = $content -replace '\bsiteFavicon\b', 'site_favicon'
$content = $content -replace '\bcontactEmail\b', 'contact_email'
$content = $content -replace '\bcontactPhone\b', 'contact_phone'
$content = $content -replace '\bsocialLinks\b', 'social_links'

# Homepage settings
$content = $content -replace '\bfeaturedVendors\b', 'featured_vendors'
$content = $content -replace '\bfeaturedProducts\b', 'featured_products'
$content = $content -replace '\bfeaturedCategories\b', 'featured_categories'
$content = $content -replace '\bheroSection\b', 'hero_section'
$content = $content -replace '\baboutSection\b', 'about_section'

# Footer settings
$content = $content -replace '\bfooterTemplate\b', 'footer_template'
$content = $content -replace '\bfooterContent\b', 'footer_content'
$content = $content -replace '\bcopyrightText\b', 'copyright_text'

# Marketplace pages
$content = $content -replace '\bpageSlug\b', 'page_slug'
$content = $content -replace '\bpageTitle\b', 'page_title'
$content = $content -replace '\bpageContent\b', 'page_content'

# Platform settings
$content = $content -replace '\bprimaryColor\b', 'primary_color'
$content = $content -replace '\bsecondaryColor\b', 'secondary_color'
$content = $content -replace '\baccentColor\b', 'accent_color'

# Cities and Sub-locations
$content = $content -replace '\bcityId\b', 'city_id'
$content = $content -replace '\bcityName\b', 'city_name'
$content = $content -replace '\bsubLocationId\b', 'sub_location_id'
$content = $content -replace '\bsubLocationName\b', 'sub_location_name'

# HSN Codes
$content = $content -replace '\bhsnId\b', 'hsn_id'
$content = $content -replace '\btaxRate\b', 'tax_rate'

# Invoices
$content = $content -replace '\binvoiceId\b', 'invoice_id'
$content = $content -replace '\binvoiceNumber\b', 'invoice_number'
$content = $content -replace '\binvoiceDate\b', 'invoice_date'
$content = $content -replace '\bsubtotal\b', 'subtotal'
$content = $content -replace '\bcgst\b', 'cgst'
$content = $content -replace '\bsgst\b', 'sgst'
$content = $content -replace '\bigst\b', 'igst'
$content = $content -replace '\bgrandTotal\b', 'grand_total'

# Invoice Items
$content = $content -replace '\binvoiceItemId\b', 'invoice_item_id'
$content = $content -replace '\bitemName\b', 'item_name'
$content = $content -replace '\btaxableAmount\b', 'taxable_amount'

Write-Host "Writing updated SQL file..." -ForegroundColor Cyan
$content | Set-Content $sqlFile -NoNewline

Write-Host "✓ Successfully converted camelCase to snake_case!" -ForegroundColor Green
Write-Host "File: $sqlFile" -ForegroundColor Gray
