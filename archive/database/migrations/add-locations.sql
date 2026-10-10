-- Create cities table
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(255),
    country VARCHAR(255) DEFAULT 'India',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sub_locations table
CREATE TABLE IF NOT EXISTS sub_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    "cityId" UUID REFERENCES cities(id) ON DELETE CASCADE,
    "zipCode" VARCHAR(20),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add location columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS "cityId" UUID REFERENCES cities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "subLocationId" UUID REFERENCES sub_locations(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_cityId ON vendors("cityId");
CREATE INDEX IF NOT EXISTS idx_vendors_subLocationId ON vendors("subLocationId");
CREATE INDEX IF NOT EXISTS idx_sub_locations_cityId ON sub_locations("cityId");
