-- Create HSN Codes table
CREATE TABLE IF NOT EXISTS hsn_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_hsn_codes_code ON hsn_codes(code);

-- Insert some common HSN codes
INSERT INTO hsn_codes (code, description, gst_rate) VALUES
('6109', 'T-shirts, singlets and other vests, knitted or crocheted', 12),
('6203', 'Men or boys suits, ensembles, jackets, blazers, trousers', 12),
('6204', 'Women or girls suits, ensembles, jackets, dresses, skirts', 12),
('6401', 'Waterproof footwear with outer soles and uppers of rubber or plastics', 18),
('6402', 'Other footwear with outer soles and uppers of rubber or plastics', 18),
('6403', 'Footwear with outer soles of rubber, plastics, leather', 18),
('6404', 'Footwear with outer soles of rubber or plastics and uppers of textile', 12),
('6405', 'Other footwear', 18),
('8517', 'Telephone sets, mobile phones and other apparatus for transmission', 18),
('8528', 'Monitors and projectors, television reception apparatus', 28),
('4901', 'Printed books, brochures, leaflets and similar printed matter', 0),
('4820', 'Registers, account books, note books, order books, letter pads', 12),
('6110', 'Jerseys, pullovers, cardigans, waistcoats and similar articles, knitted', 12),
('6211', 'Track suits, ski suits and swimwear and other garments', 12),
('6212', 'Brassieres, girdles, corsets, braces, suspenders, garters', 12),
('6214', 'Shawls, scarves, mufflers, mantillas, veils and the like', 5),
('6215', 'Ties, bow ties and cravats', 12),
('6216', 'Gloves, mittens and mitts', 12),
('6217', 'Other made up clothing accessories', 12),
('6302', 'Bed linen, table linen, toilet linen and kitchen linen', 5),
('6303', 'Curtains including drapes and interior blinds', 12),
('6304', 'Other furnishing articles, excluding those of heading 9404', 12),
('6305', 'Sacks and bags, of a kind used for the packing of goods', 18),
('6306', 'Tarpaulins, awnings and sunblinds and tents', 18),
('6307', 'Other made up articles, including dress patterns', 12)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE hsn_codes IS 'HSN (Harmonized System of Nomenclature) codes for GST classification';
COMMENT ON COLUMN hsn_codes.code IS 'HSN code (4-8 digits)';
COMMENT ON COLUMN hsn_codes.description IS 'Description of goods covered by this HSN code';
COMMENT ON COLUMN hsn_codes.gst_rate IS 'Applicable GST rate percentage';
