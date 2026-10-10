const { Client } = require('pg');
require('dotenv').config();

async function addItemReturnsSupport() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('📦 Adding support for individual item returns...\n');

    // Create returns table
    console.log('1️⃣  Creating returns table...');
    await client.query(`
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
    `);
    console.log('   ✅ Returns table created');

    // Create return_refunds table
    console.log('2️⃣  Creating return_refunds table...');
    await client.query(`
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
    `);
    console.log('   ✅ Return refunds table created');

    // Create indexes
    console.log('3️⃣  Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
      CREATE INDEX IF NOT EXISTS idx_returns_order_item_id ON returns(order_item_id);
      CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
      CREATE INDEX IF NOT EXISTS idx_returns_vendor_id ON returns(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
      CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);
      CREATE INDEX IF NOT EXISTS idx_returns_requested_at ON returns(requested_at);
      
      CREATE INDEX IF NOT EXISTS idx_return_refunds_return_id ON return_refunds(return_id);
      CREATE INDEX IF NOT EXISTS idx_return_refunds_status ON return_refunds(status);
    `);
    console.log('   ✅ Indexes created');

    // Create triggers
    console.log('4️⃣  Creating update triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_returns_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trigger_update_returns_updated_at ON returns;
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

      DROP TRIGGER IF EXISTS trigger_update_return_refunds_updated_at ON return_refunds;
      CREATE TRIGGER trigger_update_return_refunds_updated_at
          BEFORE UPDATE ON return_refunds
          FOR EACH ROW
          EXECUTE FUNCTION update_return_refunds_updated_at();
    `);
    console.log('   ✅ Triggers created');

    // Create return number generator function
    console.log('5️⃣  Creating return number generator...');
    await client.query(`
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
    `);
    console.log('   ✅ Return number generator created');

    // Add comments
    console.log('6️⃣  Adding table documentation...');
    await client.query(`
      COMMENT ON TABLE returns IS 'Tracks return requests for individual order items';
      COMMENT ON TABLE return_refunds IS 'Tracks refund transactions for approved returns';
      COMMENT ON COLUMN returns.quantity IS 'Number of items being returned (can be partial quantity)';
      COMMENT ON COLUMN returns.original_quantity IS 'Original quantity purchased in the order item';
    `);
    console.log('   ✅ Documentation added');

    // Add return status column to order_items if not exists
    console.log('7️⃣  Adding return tracking to order_items...');
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS return_status VARCHAR(50) 
          CHECK (return_status IS NULL OR return_status IN ('none', 'partial', 'full'));
      
      UPDATE order_items 
      SET returned_quantity = 0, return_status = 'none'
      WHERE returned_quantity IS NULL;
    `);
    console.log('   ✅ Order items updated for return tracking');

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📋 Next steps:');
    console.log('   1. Implement API endpoints for creating return requests');
    console.log('   2. Add vendor/admin dashboard for approving/rejecting returns');
    console.log('   3. Integrate refund processing with payment gateway');
    console.log('   4. Update invoice generation to handle partial returns');
    console.log('   5. Add email notifications for return status changes');
    console.log('   6. Implement return eligibility checks (time limits, return policy)');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

addItemReturnsSupport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
