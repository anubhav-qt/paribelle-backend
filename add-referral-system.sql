-- ============================================================
-- Referral System Migration
-- ============================================================
-- Adds referral functionality for vendors and customers
-- Run Date: 2026-01-07
-- ============================================================

-- Add referral fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_credits_earned DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_referral_date TIMESTAMP;

COMMENT ON COLUMN users.referral_code IS 'Unique referral code for this user';
COMMENT ON COLUMN users.referred_by IS 'User who referred this user';
COMMENT ON COLUMN users.wallet_balance IS 'Available wallet balance for customers';
COMMENT ON COLUMN users.referral_credits_earned IS 'Total referral credits earned';
COMMENT ON COLUMN users.last_referral_date IS 'Last successful referral date for rate limiting';

-- Add referral fields to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS registration_fee_paid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS registration_paid_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS referral_discount DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN vendors.referred_by IS 'User who referred this vendor';
COMMENT ON COLUMN vendors.registration_fee_paid IS 'Amount paid for vendor registration';
COMMENT ON COLUMN vendors.registration_paid_at IS 'When registration fee was paid';
COMMENT ON COLUMN vendors.referral_discount IS 'Discount amount received via referral';

-- Create referral_transactions table
CREATE TABLE IF NOT EXISTS referral_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  credit_amount DECIMAL(10, 2) NOT NULL,
  registration_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'failed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  credited_at TIMESTAMP
);

COMMENT ON TABLE referral_transactions IS 'Tracks all referral credits earned by users';
COMMENT ON COLUMN referral_transactions.referrer_id IS 'User who earned the referral credit';
COMMENT ON COLUMN referral_transactions.referred_vendor_id IS 'Vendor who was referred';
COMMENT ON COLUMN referral_transactions.credit_amount IS 'Amount credited to referrer';
COMMENT ON COLUMN referral_transactions.registration_invoice_id IS 'Registration invoice that triggered this credit';
COMMENT ON COLUMN referral_transactions.status IS 'Status: pending, credited, failed, cancelled';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_last_referral_date ON users(last_referral_date);
CREATE INDEX IF NOT EXISTS idx_vendors_referred_by ON vendors(referred_by);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_referrer ON referral_transactions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_vendor ON referral_transactions(referred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_referral_transactions_status ON referral_transactions(status);

-- Add referral system settings
INSERT INTO site_settings (key, value, description, created_at, updated_at)
VALUES 
  ('VENDOR_REGISTRATION_COST', '5000', 'Vendor registration fee in INR', NOW(), NOW()),
  ('REFERRAL_PERCENTAGE', '20', 'Percentage discount for referred vendors', NOW(), NOW()),
  ('REFERRAL_CREDIT_PERCENTAGE', '20', 'Percentage of registration fee credited to referrer', NOW(), NOW()),
  ('REFERRAL_DAILY_LIMIT', '1', 'Maximum number of successful referrals per day per user', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
