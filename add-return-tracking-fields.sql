-- Add return tracking fields to orders table

-- Add return approval timestamp
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_approved_at TIMESTAMP NULL;

-- Add return rejection timestamp  
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_rejected_at TIMESTAMP NULL;

-- Add return rejection reason
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_rejection_reason TEXT NULL;

-- Add comments
COMMENT ON COLUMN orders.return_approved_at IS 'Timestamp when return request was approved by admin';
COMMENT ON COLUMN orders.return_rejected_at IS 'Timestamp when return request was rejected by admin';
COMMENT ON COLUMN orders.return_rejection_reason IS 'Admin reason for rejecting the return request';
