-- Add checkout address fields for bookings so service/tour bookings can persist addresses
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS shipping_address_details JSONB,
ADD COLUMN IF NOT EXISTS billing_address_same_as_shipping BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS billing_address_details JSONB;