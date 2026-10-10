-- Add password reset token fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_token_expiry TIMESTAMP;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
