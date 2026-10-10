-- Search Optimization Indexes
-- Run this migration to add indexes for search suggestions performance

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_status_name ON products (status, name);

-- Categories table indexes  
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
CREATE INDEX IF NOT EXISTS idx_categories_name_lower ON categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (is_active);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_store_name ON vendors (store_name);
CREATE INDEX IF NOT EXISTS idx_vendors_store_name_lower ON vendors (LOWER(store_name));
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors (status);

-- Composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS idx_products_active_name ON products (status, name) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_categories_active_name ON categories (is_active, name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendors_approved_name ON vendors (status, store_name) WHERE status = 'approved';

-- Full text search indexes (for future advanced search)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendors_store_name_trgm ON vendors USING gin (store_name gin_trgm_ops);

-- Note: gin_trgm_ops requires pg_trgm extension
-- Run this first if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
