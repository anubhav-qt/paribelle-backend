-- Create invoice_items table for credit note line items
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    
    -- Tax details
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    hsn_code VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Display confirmation
SELECT 'invoice_items table created successfully' AS status;
