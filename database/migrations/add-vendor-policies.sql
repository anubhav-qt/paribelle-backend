-- Add return and cancellation policy columns to vendors table
-- These allow vendors to configure their own policies, overriding marketplace defaults

ALTER TABLE vendors 
ADD COLUMN "returnPolicy" jsonb,
ADD COLUMN "cancellationPolicy" jsonb;

-- Example structure:
-- returnPolicy: { "enabled": true, "days": 7, "text": "Returns accepted within 7 days..." }
-- cancellationPolicy: { "enabled": true, "text": "Orders can be cancelled before shipping..." }
