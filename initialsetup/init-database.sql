-- ============================================================
-- Marketplace Backend Database Initialization Script
-- ============================================================
-- This script creates a fresh database with all required tables
-- for first-time backend deployment
-- 
-- Run this script in PostgreSQL as a superuser
-- ============================================================

-- Create database (connect to postgres database first)
-- Note: Uncomment the following lines if you want to create database
-- CREATE DATABASE marketplace OWNER admin;
-- \c marketplace;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables (if any) in correct order to respect foreign keys
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS vendor_reviews CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS vendor_blog_posts CASCADE;
DROP TABLE IF EXISTS vendor_pages CASCADE;
DROP TABLE IF EXISTS vendor_navigation CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS hsnCodes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS homepage_settings CASCADE;
DROP TABLE IF EXISTS footer_settings CASCADE;
DROP TABLE IF EXISTS marketplace_pages CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS cities CASCADE;
DROP TABLE IF EXISTS sub_locations CASCADE;

-- ============================================================
-- Core Tables
-- ============================================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    reset_password_token VARCHAR(255),
    reset_password_expires TIMESTAMP,
    google_id VARCHAR(255),
    profile_picture TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    sortOrder INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HSN Codes Table
CREATE TABLE hsnCodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    gstRate DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    is_default BOOLEAN DEFAULT FALSE,
    type VARCHAR(50) DEFAULT 'shipping',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Vendor Tables
-- ============================================================

-- Vendors Table
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    description TEXT,
    logo TEXT,
    banner TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    commissionRate DECIMAL(5, 2) DEFAULT 10.00,
    
    -- Business Information
    businessName VARCHAR(255),
    businessRegistrationNumber VARCHAR(100),
    gst_number VARCHAR(50),
    pan_number VARCHAR(50),
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    
    -- Settings
    primary_color VARCHAR(20) DEFAULT '#3B82F6',
    secondary_color VARCHAR(20) DEFAULT '#10B981',
    fontFamily VARCHAR(100) DEFAULT 'Inter',
    
    -- Social Media
    facebookUrl TEXT,
    instagramUrl TEXT,
    twitterUrl TEXT,
    linkedinUrl TEXT,
    
    -- Additional Settings
    minOrderAmount DECIMAL(10, 2) DEFAULT 0,
    freeShippingThreshold DECIMAL(10, 2),
    categoryDisplayMode VARCHAR(50) DEFAULT 'grid',
    
    -- Policies
    shippingPolicy TEXT,
    returnPolicy TEXT,
    privacyPolicy TEXT,
    termsOfService TEXT,
    
    -- KYC
    kycStatus VARCHAR(50) DEFAULT 'pending',
    kycDocuments JSONB,
    kycVerifiedAt TIMESTAMP,
    
    -- Hero Banners
    heroBanners JSONB,
    
    -- Location
    locationCityId UUID,
    locationSubLocationId UUID,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Pages Table
CREATE TABLE vendor_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, slug)
);

-- Vendor Blog Posts Table
CREATE TABLE vendor_blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    tags TEXT[],
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, slug)
);

-- Vendor Navigation Table
CREATE TABLE vendor_navigation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES vendor_navigation(id) ON DELETE CASCADE,
    sortOrder INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Product Tables
-- ============================================================

-- Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    shortDescription TEXT,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    costPrice DECIMAL(10, 2),
    sku VARCHAR(100),
    barcode VARCHAR(100),
    stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    weight DECIMAL(10, 2),
    weightUnit VARCHAR(20) DEFAULT 'kg',
    dimensions JSONB,
    images TEXT[],
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,
    isTaxable BOOLEAN DEFAULT TRUE,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    hsn_code VARCHAR(20),
    hsnCodeId UUID REFERENCES hsnCodes(id) ON DELETE SET NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    tags TEXT[],
    
    -- Product Variations
    hasVariations BOOLEAN DEFAULT FALSE,
    variationOptions JSONB,
    
    -- Product Attributes
    attributes JSONB,
    
    -- SEO & Tracking
    viewsCount INTEGER DEFAULT 0,
    salesCount INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, slug)
);

-- Product Variants Table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    costPrice DECIMAL(10, 2),
    stock INTEGER DEFAULT 0,
    weight DECIMAL(10, 2),
    dimensions JSONB,
    image TEXT,
    option1Name VARCHAR(100),
    option1Value VARCHAR(100),
    option2Name VARCHAR(100),
    option2Value VARCHAR(100),
    option3Name VARCHAR(100),
    option3Value VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Order Tables
-- ============================================================

-- Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vendor_id UUID REFERENCES vendors(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    fulfillmentStatus VARCHAR(50) DEFAULT 'unfulfilled',
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Shipping Information
    shippingName VARCHAR(255),
    shippingEmail VARCHAR(255),
    shippingPhone VARCHAR(20),
    shippingaddressLine1 TEXT,
    shippingaddressLine2 TEXT,
    shippingCity VARCHAR(100),
    shippingState VARCHAR(100),
    shippingPostalCode VARCHAR(20),
    shippingCountry VARCHAR(100),
    
    -- Billing Information
    billingName VARCHAR(255),
    billingEmail VARCHAR(255),
    billingPhone VARCHAR(20),
    billingaddressLine1 TEXT,
    billingaddressLine2 TEXT,
    billingCity VARCHAR(100),
    billingState VARCHAR(100),
    billingPostalCode VARCHAR(20),
    billingCountry VARCHAR(100),
    
    -- Additional Info
    customerNotes TEXT,
    adminNotes TEXT,
    tracking_number VARCHAR(255),
    trackingUrl TEXT,
    
    -- Payment
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    
    -- Dates
    paidAt TIMESTAMP,
    fulfilledAt TIMESTAMP,
    shippedAt TIMESTAMP,
    deliveredAt TIMESTAMP,
    cancelledAt TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    
    -- Product snapshot at time of order
    productName VARCHAR(255) NOT NULL,
    productSku VARCHAR(100),
    productImage TEXT,
    variant_options JSONB,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Tax details
    hsn_code VARCHAR(20),
    gstRate DECIMAL(5, 2),
    cgstAmount DECIMAL(10, 2),
    sgstAmount DECIMAL(10, 2),
    igstAmount DECIMAL(10, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Payment Table
-- ============================================================

-- Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL,
    
    -- Payment Gateway Details
    gateway VARCHAR(50),
    gatewayPaymentId VARCHAR(255),
    gatewayOrderId VARCHAR(255),
    gatewaySignature VARCHAR(255),
    gatewayResponse JSONB,
    
    -- Additional Info
    failureReason TEXT,
    notes TEXT,
    
    -- Dates
    paidAt TIMESTAMP,
    refundedAt TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Booking Table
-- ============================================================

-- Bookings Table
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    booking_date DATE NOT NULL,
    bookingTime TIME,
    duration_minutes INTEGER,
    
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Customer Details
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    depositAmount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Additional Info
    notes TEXT,
    adminNotes TEXT,
    cancellationReason TEXT,
    
    -- Dates
    confirmedAt TIMESTAMP,
    completedAt TIMESTAMP,
    cancelledAt TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Invoice Tables
-- ============================================================

-- Invoices Table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'customer',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    
    -- Dates
    invoice_date DATE NOT NULL,
    dueDate DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Commission details (for vendor invoices)
    commissionAmount DECIMAL(10, 2),
    commissionRate DECIMAL(5, 2),
    payoutAmount DECIMAL(10, 2),
    
    -- Billing information
    billingName TEXT,
    billingEmail TEXT,
    billingPhone TEXT,
    billing_address TEXT,
    billingCity VARCHAR(255),
    billingState VARCHAR(255),
    billingPostalCode VARCHAR(20),
    billingCountry VARCHAR(100),
    
    -- Tax details
    gst_number VARCHAR(50),
    pan_number VARCHAR(50),
    
    -- PDF file
    pdfUrl TEXT,
    
    -- Notes
    notes TEXT,
    terms TEXT,
    
    -- Email tracking
    emailSent BOOLEAN DEFAULT FALSE,
    emailSentAt TIMESTAMP,
    
    -- Relations
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice Items Table
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Item details
    description TEXT NOT NULL,
    hsn_code VARCHAR(20),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    taxable_amount DECIMAL(10, 2) NOT NULL,
    
    -- GST breakdown
    gstRate DECIMAL(5, 2) DEFAULT 0,
    cgstRate DECIMAL(5, 2) DEFAULT 0,
    sgstRate DECIMAL(5, 2) DEFAULT 0,
    igstRate DECIMAL(5, 2) DEFAULT 0,
    cgstAmount DECIMAL(10, 2) DEFAULT 0,
    sgstAmount DECIMAL(10, 2) DEFAULT 0,
    igstAmount DECIMAL(10, 2) DEFAULT 0,
    total_gst DECIMAL(10, 2) DEFAULT 0,
    
    -- Total
    total DECIMAL(10, 2) NOT NULL,
    
    -- Reference
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Review Tables
-- ============================================================

-- Reviews Table (Product Reviews)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    isApproved BOOLEAN DEFAULT FALSE,
    helpfulCount INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Reviews Table
CREATE TABLE vendor_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    isApproved BOOLEAN DEFAULT FALSE,
    helpfulCount INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Settings & Configuration Tables
-- ============================================================

-- Admin Settings Table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    isPublic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Homepage Settings Table
CREATE TABLE homepage_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    heroTitle VARCHAR(255),
    heroSubtitle TEXT,
    heroImage TEXT,
    heroCtaText VARCHAR(100),
    heroCtaLink TEXT,
    featured_categories UUID[],
    featured_products UUID[],
    featured_vendors UUID[],
    banners JSONB,
    sections JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Footer Settings Table
CREATE TABLE footer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    logo TEXT,
    description TEXT,
    copyright_text VARCHAR(255),
    social_links JSONB,
    linkColumns JSONB,
    contactInfo JSONB,
    newsletterEnabled BOOLEAN DEFAULT TRUE,
    newsletterTitle VARCHAR(255),
    newsletterDescription TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Settings Table
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    siteName VARCHAR(255),
    site_description TEXT,
    site_logo TEXT,
    site_favicon TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    contactAddress TEXT,
    currency VARCHAR(10) DEFAULT 'INR',
    currencySymbol VARCHAR(10) DEFAULT '₹',
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Business Settings
    commissionRate DECIMAL(5, 2) DEFAULT 10.00,
    tax_rate DECIMAL(5, 2) DEFAULT 18.00,
    
    -- Email Settings
    smtpHost VARCHAR(255),
    smtpPort INTEGER,
    smtpUser VARCHAR(255),
    smtpPassword VARCHAR(255),
    fromEmail VARCHAR(255),
    fromName VARCHAR(255),
    
    -- Payment Gateway Settings
    razorpayKeyId VARCHAR(255),
    razorpayKeySecret VARCHAR(255),
    razorpayEnabled BOOLEAN DEFAULT FALSE,
    
    -- Storage Settings
    storageProvider VARCHAR(50) DEFAULT 'local',
    awsAccessKey VARCHAR(255),
    awsSecretKey VARCHAR(255),
    awsRegion VARCHAR(50),
    awsBucket VARCHAR(255),
    
    -- Policies
    termsOfService TEXT,
    privacyPolicy TEXT,
    cookiePolicy TEXT,
    returnPolicy TEXT,
    shippingPolicy TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace Pages Table
CREATE TABLE marketplace_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Location Tables
-- ============================================================

-- Cities Table
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub Locations Table (Areas within cities)
CREATE TABLE sub_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    postalCodes TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city_id, slug)
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_emailVerified ON users(email_verified);

-- Categories
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parentId ON categories(parent_id);
CREATE INDEX idx_categories_isActive ON categories(is_active);

-- Vendors
CREATE INDEX idx_vendors_userId ON vendors(user_id);
CREATE INDEX idx_vendors_slug ON vendors(slug);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_locationCityId ON vendors(locationCityId);
CREATE INDEX idx_vendors_locationSubLocationId ON vendors(locationSubLocationId);

-- Products
CREATE INDEX idx_products_vendorId ON products(vendor_id);
CREATE INDEX idx_products_categoryId ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_isFeatured ON products(is_featured);
CREATE INDEX idx_products_hsnCodeId ON products(hsnCodeId);
CREATE INDEX idx_products_createdAt ON products(created_at DESC);

-- Product Variants
CREATE INDEX idx_product_variants_productId ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- Orders
CREATE INDEX idx_orders_userId ON orders(user_id);
CREATE INDEX idx_orders_vendorId ON orders(vendor_id);
CREATE INDEX idx_orders_orderNumber ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_paymentStatus ON orders(payment_status);
CREATE INDEX idx_orders_createdAt ON orders(created_at DESC);

-- Order Items
CREATE INDEX idx_order_items_orderId ON order_items(order_id);
CREATE INDEX idx_order_items_productId ON order_items(product_id);

-- Payments
CREATE INDEX idx_payments_orderId ON payments(order_id);
CREATE INDEX idx_payments_userId ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_gatewayPaymentId ON payments(gatewayPaymentId);

-- Bookings
CREATE INDEX idx_bookings_productId ON bookings(product_id);
CREATE INDEX idx_bookings_userId ON bookings(user_id);
CREATE INDEX idx_bookings_vendorId ON bookings(vendor_id);
CREATE INDEX idx_bookings_bookingDate ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Invoices
CREATE INDEX idx_invoices_invoiceNumber ON invoices(invoice_number);
CREATE INDEX idx_invoices_orderId ON invoices(order_id);
CREATE INDEX idx_invoices_userId ON invoices(user_id);
CREATE INDEX idx_invoices_vendorId ON invoices(vendor_id);
CREATE INDEX idx_invoices_type ON invoices(type);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Invoice Items
CREATE INDEX idx_invoice_items_invoiceId ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_orderItemId ON invoice_items(order_item_id);

-- Reviews
CREATE INDEX idx_reviews_productId ON reviews(product_id);
CREATE INDEX idx_reviews_userId ON reviews(user_id);
CREATE INDEX idx_reviews_isApproved ON reviews(isApproved);

-- Vendor Reviews
CREATE INDEX idx_vendor_reviews_vendorId ON vendor_reviews(vendor_id);
CREATE INDEX idx_vendor_reviews_userId ON vendor_reviews(user_id);
CREATE INDEX idx_vendor_reviews_isApproved ON vendor_reviews(isApproved);

-- Addresses
CREATE INDEX idx_addresses_userId ON addresses(user_id);
CREATE INDEX idx_addresses_isDefault ON addresses(is_default);

-- HSN Codes
CREATE INDEX idx_hsnCodes_code ON hsnCodes(code);

-- Settings
CREATE INDEX idx_settings_key ON settings(key);

-- Cities
CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_cities_isActive ON cities(is_active);

-- Sub Locations
CREATE INDEX idx_sub_locations_cityId ON sub_locations(city_id);
CREATE INDEX idx_sub_locations_slug ON sub_locations(slug);
CREATE INDEX idx_sub_locations_isActive ON sub_locations(is_active);

-- ============================================================
-- Database Initialization Complete
-- ============================================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📊 All tables, indexes, and constraints have been set up.';
    RAISE NOTICE '🚀 Your marketplace backend is ready for first-time deployment!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Update .env file with database credentials';
    RAISE NOTICE '   2. Run seed data (optional): npm run seed';
    RAISE NOTICE '   3. Start the backend: npm run dev';
END $$;




