-- Create returns table for individual order item returns
-- This allows tracking return requests for each item in an order independently

CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Relations
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    -- Return details
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'requested' 
        CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled')),
    
    -- Item snapshot (for reference)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    variant_options JSONB,
    original_price DECIMAL(10, 2) NOT NULL,
    original_quantity INTEGER NOT NULL,
    
    -- Refund amounts
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_tax DECIMAL(10, 2) DEFAULT 0,
    refund_total DECIMAL(10, 2) NOT NULL,
    
    -- Return tracking
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    
    -- Media (customer can upload photos of damaged/wrong items)
    images JSONB,
    
    -- Comments and notes
    customer_notes TEXT,
    admin_notes TEXT,
    vendor_notes TEXT,
    rejection_reason TEXT,
    
    -- Dates
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    received_at TIMESTAMP,
    refunded_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    -- Approved/Rejected by
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create return_refunds table to track refund transactions
CREATE TABLE IF NOT EXISTS return_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    
    -- Refund details
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Payment gateway details
    transaction_id VARCHAR(255),
    gateway VARCHAR(50),
    gateway_response JSONB,
    
    -- Notes
    notes TEXT,
    
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_order_item_id ON returns(order_item_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_vendor_id ON returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_requested_at ON returns(requested_at);

CREATE INDEX IF NOT EXISTS idx_return_refunds_return_id ON return_refunds(return_id);
CREATE INDEX IF NOT EXISTS idx_return_refunds_status ON return_refunds(status);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_returns_updated_at
    BEFORE UPDATE ON returns
    FOR EACH ROW
    EXECUTE FUNCTION update_returns_updated_at();

CREATE OR REPLACE FUNCTION update_return_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_return_refunds_updated_at
    BEFORE UPDATE ON return_refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_return_refunds_updated_at();

-- Add function to generate return number
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_number VARCHAR(50);
    sequence_num INTEGER;
BEGIN
    -- Get next sequence number for today
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM returns
    WHERE DATE(created_at) = CURRENT_DATE;
    
    -- Format: RET-YYYYMMDD-XXXX
    new_number := 'RET-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables for documentation
COMMENT ON TABLE returns IS 'Tracks return requests for individual order items';
COMMENT ON TABLE return_refunds IS 'Tracks refund transactions for approved returns';
COMMENT ON COLUMN returns.quantity IS 'Number of items being returned (can be partial quantity)';
COMMENT ON COLUMN returns.original_quantity IS 'Original quantity purchased in the order item';
