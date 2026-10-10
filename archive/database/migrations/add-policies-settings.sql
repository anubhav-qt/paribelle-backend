-- Add return and cancellation policy settings
INSERT INTO site_settings (key, value, description, "createdAt", "updatedAt")
VALUES 
  ('return_policy', '{"enabled": true, "days": 7, "text": "Items can be returned within 7 days of delivery in original condition with tags attached. Refund will be processed within 5-7 business days."}', 'Return policy configuration', NOW(), NOW()),
  ('cancellation_policy', '{"enabled": true, "text": "Orders can be cancelled before shipping. Full refund will be issued for prepaid orders. No cancellation charges apply."}', 'Cancellation policy configuration', NOW(), NOW())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    "updatedAt" = NOW();
