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

-- Drop schema and recreate (cleanest way to start fresh)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- ============================================================
-- Core Tables
-- ============================================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
    vendor_id UUID,
    status VARCHAR(50) DEFAULT 'active',
    avatar TEXT,
    email_verified_at TIMESTAMP,
    email_verification_token VARCHAR(255),
    email_verification_token_expiry TIMESTAMP,
    phone_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
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
    vendor_id UUID,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    meta_title VARCHAR(255),
    meta_description TEXT,
    filter_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories closure table for tree structure (required by TypeORM @Tree)
CREATE TABLE categories_closure (
    id_ancestor UUID NOT NULL,
    id_descendant UUID NOT NULL,
    PRIMARY KEY (id_ancestor, id_descendant),
    FOREIGN KEY (id_ancestor) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (id_descendant) REFERENCES categories(id) ON DELETE CASCADE
);

-- HSN Codes Table
CREATE TABLE hsn_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    recommended_gst_rate DECIMAL(5, 2) DEFAULT 0,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Addresses Table
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
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
-- Schema synchronized with src/modules/vendors/vendor.entity.ts
CREATE TABLE vendors (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    store_name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    logo VARCHAR(255),
    banner VARCHAR(255),
    
    -- Vendor Type & Status (enums)
    vendor_type VARCHAR(50) DEFAULT 'individual' CHECK (vendor_type IN ('individual', 'business')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
    
    -- Commission & Shipping Settings
    commission_rate DECIMAL(5, 2) DEFAULT 10.00,
    free_shipping_threshold DECIMAL(10, 2),
    shipping_cost DECIMAL(10, 2) DEFAULT 50.00,
    
    -- Return Policy Settings
    return_policy_days INTEGER DEFAULT 7 CHECK (return_policy_days >= 0),
    allow_returns BOOLEAN DEFAULT TRUE,
    
    -- Business Details
    business_name VARCHAR(255),
    tax_id VARCHAR(255),
    gst_number VARCHAR(255),
    
    -- Bank Details for Payouts
    bank_account_number VARCHAR(255),
    bank_ifsc_code VARCHAR(255),
    bank_account_name VARCHAR(255),
    
    -- Contact Details
    contact_email VARCHAR(255),
    contact_phone VARCHAR(255),
    
    -- Address
    address TEXT,
    city_id UUID,
    sub_location_id UUID,
    pincode VARCHAR(255),
    
    -- Google Location Data
    google_place_id VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    postal_code VARCHAR(255),
    
    -- KYC Verification (Legacy Fields)
    is_kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_document_type VARCHAR(255),
    kyc_document_url VARCHAR(255),
    kyc_verified_at TIMESTAMP,
    
    -- Comprehensive KYC Fields
    kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
    kyc_documents JSONB,
    kyc_submitted_at TIMESTAMP,
    kyc_approved_at TIMESTAMP,
    kyc_approved_by UUID,
    kyc_rejected_reason TEXT,
    pan_number VARCHAR(255),
    
    -- GST Registration
    gst_registration_type VARCHAR(50) DEFAULT 'unregistered' CHECK (gst_registration_type IN ('unregistered', 'regular', 'composition')),
    gst_state VARCHAR(255),
    
    -- Invoice Frequency
    invoice_frequency VARCHAR(50) DEFAULT 'per_order',
    
    -- Subdomain/Custom Domain Support
    subdomain VARCHAR(255) UNIQUE,
    custom_domain VARCHAR(255) UNIQUE,
    
    -- Hero Banners Configuration (JSONB)
    hero_banners JSONB,
    
    -- Theme & Branding Configuration (JSONB)
    theme_config JSONB,
    
    -- Category Display Mode
    category_display_mode VARCHAR(10) DEFAULT 'sidebar',
    
    -- About & Content
    about_content TEXT,
    about_images JSONB,
    
    -- SEO Configuration
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Store Features
    show_reviews BOOLEAN DEFAULT TRUE,
    show_related_products BOOLEAN DEFAULT TRUE,
    enable_blog BOOLEAN DEFAULT FALSE,
    enable_custom_pages BOOLEAN DEFAULT FALSE,
    
    -- Metrics
    total_sales DECIMAL(10, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    
    -- Return & Cancellation Policies (JSONB)
    return_policy JSONB,
    cancellation_policy JSONB,
    
    -- Relations
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Pages Table
CREATE TABLE vendor_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    page_type VARCHAR(50) DEFAULT 'custom' CHECK (page_type IN ('custom', 'about', 'contact', 'faq', 'terms', 'privacy')),
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    images TEXT[],
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    show_in_navigation BOOLEAN DEFAULT TRUE,
    is_home_page BOOLEAN DEFAULT FALSE,
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
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    author_name VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    meta_title VARCHAR(255),
    meta_description TEXT,
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
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Product Tables
-- ============================================================

-- Products Table
CREATE TABLE products (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    cost_per_item DECIMAL(10, 2),
    
    -- GST and Tax Fields
    hsn_code VARCHAR(255),
    sac_code VARCHAR(255),
    gst_rate DECIMAL(5, 2) DEFAULT 18.00,
    price_type VARCHAR(50) DEFAULT 'selling_price_without_gst',
    mrp DECIMAL(10, 2),
    base_price DECIMAL(10, 2),
    gst_amount DECIMAL(10, 2),
    
    -- Inventory
    sku VARCHAR(255) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER,
    track_inventory BOOLEAN DEFAULT TRUE,
    
    -- Status & Type
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock')),
    product_type VARCHAR(50) DEFAULT 'physical' CHECK (product_type IN ('physical', 'booking')),
    
    -- Images
    images TEXT[],
    featured_image VARCHAR(255),
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Product Variants Support (JSON)
    variants JSONB,
    
    -- Product Attributes/Metadata for Filtering
    attributes JSONB,
    
    -- Enhanced Variants Support
    has_variants BOOLEAN DEFAULT FALSE,
    variant_options JSONB,
    
    -- Product Variations Support (Legacy)
    is_parent BOOLEAN DEFAULT FALSE,
    parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variation_themes TEXT[],
    variation_attributes JSONB,
    
    -- Shipping Dimensions
    weight DECIMAL(10, 2),
    weight_unit VARCHAR(255),
    length DECIMAL(10, 2),
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    dimension_unit VARCHAR(255),
    
    -- Statistics
    view_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    
    -- Relations
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Categories Junction Table (many-to-many)
CREATE TABLE product_categories (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- Product Variants Table
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    variant_attributes JSONB,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    images TEXT[],
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
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'returned', 'refunded')),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
    
    -- Vendor snapshot at time of order (for invoices and historical accuracy)
    vendor_business_name VARCHAR(255),
    vendor_store_name VARCHAR(255),
    vendor_gst_number VARCHAR(50),
    vendor_address TEXT,
    vendor_city VARCHAR(100),
    vendor_state VARCHAR(100),
    vendor_postal_code VARCHAR(20),
    vendor_country VARCHAR(100),
    vendor_contact_email VARCHAR(255),
    vendor_contact_phone VARCHAR(20),
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Commission & Payout
    commission_amount DECIMAL(10, 2) DEFAULT 0,
    commission_rate DECIMAL(5, 2) DEFAULT 0,
    vendor_payout DECIMAL(10, 2) DEFAULT 0,
    
    -- Shipping Information
    shipping_name VARCHAR(255),
    shipping_email VARCHAR(255),
    shipping_phone VARCHAR(20),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_country VARCHAR(100),
    
    -- Billing Information
    billing_address_same_as_shipping BOOLEAN DEFAULT TRUE,
    billing_address TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),
    
    -- Additional Info
    customer_notes TEXT,
    admin_notes TEXT,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    
    -- Payment
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    
    -- Dates
    confirmed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    returned_at TIMESTAMP,
    
    -- Return information
    return_reason TEXT,
    
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
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    product_image TEXT,
    variant_options JSONB,
    variant_details JSONB,
    booking_details JSONB,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Tax details
    hsn_code VARCHAR(20),
    gst_rate DECIMAL(5, 2),
    cgst_amount DECIMAL(10, 2),
    sgst_amount DECIMAL(10, 2),
    igst_amount DECIMAL(10, 2),
    
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
    gateway_payment_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    gateway_signature VARCHAR(255),
    gateway_response JSONB,
    
    -- Additional Info
    failure_reason TEXT,
    notes TEXT,
    
    -- Dates
    paid_at TIMESTAMP,
    refunded_at TIMESTAMP,
    
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
    booking_time TIME,
    duration_minutes INTEGER,
    
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Customer Details
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- Pricing
    price DECIMAL(10, 2) NOT NULL,
    deposit_amount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Additional Info
    notes TEXT,
    admin_notes TEXT,
    cancellation_reason TEXT,
    
    -- Dates
    confirmed_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
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
    due_date DATE NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Commission details (for vendor invoices)
    commission_amount DECIMAL(10, 2),
    commission_rate DECIMAL(5, 2),
    payout_amount DECIMAL(10, 2),
    
    -- Billing information
    billing_name TEXT,
    billing_email TEXT,
    billing_phone TEXT,
    billing_address TEXT,
    billing_city VARCHAR(255),
    billing_state VARCHAR(255),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),
    
    -- Tax details
    gst_number VARCHAR(50),
    pan_number VARCHAR(50),
    
    -- PDF file
    pdf_url TEXT,
    
    -- Notes
    notes TEXT,
    terms TEXT,
    
    -- Email tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    
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
    name VARCHAR(255), -- Product/item name
    description TEXT,
    hsn_code VARCHAR(20),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    
    -- Amounts
    subtotal DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    taxable_amount DECIMAL(10, 2) NOT NULL,
    
    -- GST breakdown
    gst_rate DECIMAL(5, 2) DEFAULT 0,
    cgst_rate DECIMAL(5, 2) DEFAULT 0,
    sgst_rate DECIMAL(5, 2) DEFAULT 0,
    igst_rate DECIMAL(5, 2) DEFAULT 0,
    cgst_amount DECIMAL(10, 2) DEFAULT 0,
    sgst_amount DECIMAL(10, 2) DEFAULT 0,
    igst_amount DECIMAL(10, 2) DEFAULT 0,
    total_gst DECIMAL(10, 2) DEFAULT 0,
    
    -- Simple tax fields (for compatibility with TypeORM entity)
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    
    -- Total
    total DECIMAL(10, 2) NOT NULL,
    
    -- References
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster product lookups
CREATE INDEX idx_invoice_items_product_id ON invoice_items(product_id);

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
    is_approved BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
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
    is_approved BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
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
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Homepage Settings Table
CREATE TABLE homepage_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hero_title VARCHAR(255),
    hero_subtitle TEXT,
    hero_image TEXT,
    hero_cta_text VARCHAR(100),
    hero_cta_link TEXT,
    featured_categories UUID[],
    featured_products UUID[],
    featured_vendors UUID[],
    banners JSONB,
    sections JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Footer Settings Table
-- Schema synchronized with src/modules/footer-settings/entities/footer-settings.entity.ts
CREATE TABLE footer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    about_text VARCHAR(255) DEFAULT 'Your marketplace description goes here. We connect buyers and sellers in a trusted, secure platform.',
    social_links JSONB DEFAULT '[]'::jsonb,
    custom_sections JSONB DEFAULT '[]'::jsonb,
    contact_info JSONB DEFAULT '{"phone":"","email":"","address":""}'::jsonb,
    copyright_text TEXT,
    show_categories BOOLEAN DEFAULT TRUE,
    max_categories_display INTEGER DEFAULT 6,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Settings Table
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name VARCHAR(255),
    site_description TEXT,
    site_logo TEXT,
    site_favicon TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_address TEXT,
    currency VARCHAR(10) DEFAULT 'INR',
    currency_symbol VARCHAR(10) DEFAULT '₹',
    timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Business Settings
    commission_rate DECIMAL(5, 2) DEFAULT 10.00,
    tax_rate DECIMAL(5, 2) DEFAULT 18.00,
    
    -- Email Settings
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    
    -- Payment Gateway Settings
    razorpay_key_id VARCHAR(255),
    razorpay_key_secret VARCHAR(255),
    razorpay_enabled BOOLEAN DEFAULT FALSE,
    
    -- Storage Settings
    storage_provider VARCHAR(50) DEFAULT 'local',
    aws_access_key VARCHAR(255),
    aws_secret_key VARCHAR(255),
    aws_region VARCHAR(50),
    aws_bucket VARCHAR(255),
    
    -- Policies
    terms_of_service TEXT,
    privacy_policy TEXT,
    cookie_policy TEXT,
    return_policy TEXT,
    shipping_policy TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Marketplace Pages Table
CREATE TABLE marketplace_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    page_type VARCHAR(50) DEFAULT 'custom' CHECK (page_type IN ('custom', 'about', 'contact', 'faq', 'terms', 'privacy')),
    content TEXT NOT NULL,
    excerpt TEXT,
    featured_image TEXT,
    images TEXT[],
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    show_in_navigation BOOLEAN DEFAULT TRUE,
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
    is_user_created BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sub Locations Table (Areas within cities)
CREATE TABLE sub_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    zip_code VARCHAR(10),
    is_user_created BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Foreign Key Constraints (added after all tables are created)
-- ============================================================

-- Add vendor_id foreign key to categories
ALTER TABLE categories 
ADD CONSTRAINT fk_categories_vendor 
FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;

-- ============================================================
-- Initial Settings Data
-- ============================================================

-- Insert default marketplace settings
INSERT INTO settings (key, value, description, is_public, created_at, updated_at)
VALUES
    ('category_display_mode', 'top', 'Display categories at the top toolbar or in the left sidebar tree. Values: "top" or "sidebar"', true, NOW(), NOW()),
    ('location_filter_enabled', 'false', 'Enable/disable location-based product filtering across the marketplace', true, NOW(), NOW()),
    ('currency', 'INR', 'Default currency for the marketplace', true, NOW(), NOW()),
    ('platform_commission_rate', '10', 'Default marketplace commission rate percentage for all vendors', true, NOW(), NOW()),
    ('thumbnailLayout', 'vertical', 'Product image thumbnail layout orientation. Values: "vertical" (Amazon-style left sidebar) or "horizontal" (bottom strip)', true, NOW(), NOW()),
    ('marketplace_name', 'GaliCart', 'Marketplace name displayed in header', true, NOW(), NOW()),
    ('marketplace_logo', '', 'Marketplace logo URL', true, NOW(), NOW()),
    ('default-theme', '{
        "primaryColor": "#FF9900",
        "secondaryColor": "#232F3E",
        "accentColor": "#FF9900",
        "backgroundColor": "#FFFFFF",
        "textColor": "#0F1111",
        "fontFamily": "Amazon Ember, Arial, sans-serif",
        "headingFont": "Amazon Ember, Arial, sans-serif",
        "layout": "modern",
        "customCss": "",
        "showLogo": true,
        "showSearchBar": true,
        "footerText": "",
        "socialLinks": {
            "facebook": "",
            "instagram": "",
            "twitter": "",
            "youtube": "",
            "linkedin": ""
        }
    }', 'Default marketplace theme configuration (Amazon-style)', true, NOW(), NOW()),
    ('hero_banners', '[
        {
            "id": "banner-1",
            "imageUrl": "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1920&h=600&fit=crop",
            "title": "Discover Traditional Rajasthani Fashion",
            "subtitle": "Explore our curated collection of authentic ethnic wear and handicrafts",
            "ctaText": "Shop Now",
            "ctaLink": "/products",
            "order": 0
        },
        {
            "id": "banner-2",
            "imageUrl": "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=1920&h=600&fit=crop",
            "title": "Exclusive Handcrafted Jewelry",
            "subtitle": "Unique pieces that celebrate Indian artistry and craftsmanship",
            "ctaText": "Explore Collection",
            "ctaLink": "/category/jewelry",
            "order": 1
        },
        {
            "id": "banner-3",
            "imageUrl": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1920&h=600&fit=crop",
            "title": "Premium Kurtis & Ethnic Wear",
            "subtitle": "From everyday elegance to festive glamour - find your perfect style",
            "ctaText": "Browse Collection",
            "ctaLink": "/category/fashion",
            "order": 2
        }
    ]', 'Hero carousel banners for homepage', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Categories
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parentId ON categories(parent_id);
CREATE INDEX idx_categories_isActive ON categories(is_active);
CREATE INDEX idx_categories_vendorId_isActive ON categories(vendor_id, is_active);
CREATE INDEX idx_categories_isActive_sortOrder ON categories(is_active, sort_order);

-- Vendors
CREATE INDEX idx_vendors_userId ON vendors(user_id);
CREATE INDEX idx_vendors_slug ON vendors(slug);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_cityId ON vendors(city_id);
CREATE INDEX idx_vendors_subLocationId ON vendors(sub_location_id);

-- Products
CREATE INDEX idx_products_vendorId ON products(vendor_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_createdAt ON products(created_at DESC);
CREATE INDEX idx_products_vendorId_status ON products(vendor_id, status);
CREATE INDEX idx_products_status_createdAt ON products(status, created_at DESC);
CREATE INDEX idx_products_vendorId_createdAt ON products(vendor_id, created_at DESC);

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
CREATE INDEX idx_payments_gatewayPaymentId ON payments(gateway_payment_id);

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
CREATE INDEX idx_reviews_isApproved ON reviews(is_approved);

-- Vendor Reviews
CREATE INDEX idx_vendor_reviews_vendorId ON vendor_reviews(vendor_id);
CREATE INDEX idx_vendor_reviews_userId ON vendor_reviews(user_id);
CREATE INDEX idx_vendor_reviews_isApproved ON vendor_reviews(is_approved);

-- Addresses
CREATE INDEX idx_addresses_userId ON addresses(user_id);
CREATE INDEX idx_addresses_isDefault ON addresses(is_default);

-- HSN Codes
CREATE INDEX idx_hsn_codes_code ON hsn_codes(code);

-- Settings
CREATE INDEX idx_settings_key ON settings(key);

-- Cities
CREATE INDEX idx_cities_slug ON cities(slug);
CREATE INDEX idx_cities_isActive ON cities(is_active);

-- Sub Locations
CREATE INDEX idx_sub_locations_cityId ON sub_locations(city_id);

-- Vendor Pages
CREATE UNIQUE INDEX idx_vendor_pages_vendorId_slug ON vendor_pages(vendor_id, slug);
CREATE INDEX idx_vendor_pages_vendorId ON vendor_pages(vendor_id);
CREATE INDEX idx_vendor_pages_status ON vendor_pages(status);

-- Vendor Blog Posts
CREATE UNIQUE INDEX idx_vendor_blog_posts_vendorId_slug ON vendor_blog_posts(vendor_id, slug);
CREATE INDEX idx_vendor_blog_posts_vendorId ON vendor_blog_posts(vendor_id);
CREATE INDEX idx_vendor_blog_posts_status ON vendor_blog_posts(status);

-- HSN Codes Category Index
CREATE INDEX idx_hsn_codes_category ON hsn_codes(category);

-- ============================================================
-- Foreign Key Constraints (Added After Table Creation)
-- ============================================================

-- Add foreign keys for vendors table location references
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_sub_location FOREIGN KEY (sub_location_id) REFERENCES sub_locations(id) ON DELETE SET NULL;

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




