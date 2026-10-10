-- Add transaction_id column to payments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'transaction_id'
    ) THEN
        ALTER TABLE payments 
        ADD COLUMN transaction_id VARCHAR UNIQUE;
        
        -- Generate transaction IDs for existing payments
        UPDATE payments 
        SET transaction_id = 'TXN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 12))
        WHERE transaction_id IS NULL;
        
        -- Make it NOT NULL after populating existing rows
        ALTER TABLE payments 
        ALTER COLUMN transaction_id SET NOT NULL;
        
        RAISE NOTICE 'Added transaction_id column to payments table';
    ELSE
        RAISE NOTICE 'Column transaction_id already exists in payments table';
    END IF;
END $$;
