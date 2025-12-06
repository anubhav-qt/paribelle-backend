-- Update vendors with locations, leaving the first one without location for testing

-- First, let's see what we have
SELECT id, "storeName", "cityId", "subLocationId" FROM vendors ORDER BY "createdAt";

-- Get available cities and sublocations
SELECT c.id as city_id, c.name as city_name, s.id as sublocation_id, s.name as sublocation_name 
FROM cities c 
LEFT JOIN sub_locations s ON s."cityId" = c.id 
ORDER BY c.name, s.name;

-- Update vendors with locations (skip the first vendor for testing)
-- This assumes you have cities and sublocations already seeded

DO $$
DECLARE
    vendor_rec RECORD;
    city_rec RECORD;
    subloc_rec RECORD;
    vendor_count INT := 0;
    city_index INT := 0;
    subloc_index INT := 0;
    first_vendor_id UUID;
    city_ids UUID[];
    subloc_ids UUID[];
BEGIN
    -- Get the first vendor ID to skip
    SELECT id INTO first_vendor_id FROM vendors ORDER BY "createdAt" LIMIT 1;
    RAISE NOTICE 'Skipping first vendor: %', first_vendor_id;
    
    -- Get all city IDs into an array
    SELECT array_agg(id ORDER BY name) INTO city_ids FROM cities;
    
    -- Update each vendor (except the first one)
    FOR vendor_rec IN 
        SELECT id, "storeName" FROM vendors 
        WHERE id != first_vendor_id 
        ORDER BY "createdAt"
    LOOP
        -- Cycle through cities
        city_index := vendor_count % array_length(city_ids, 1);
        
        -- Get city details
        SELECT id, name, state, country INTO city_rec 
        FROM cities 
        WHERE id = city_ids[city_index + 1];
        
        -- Get sublocations for this city
        SELECT array_agg(id ORDER BY name) INTO subloc_ids 
        FROM sub_locations 
        WHERE "cityId" = city_rec.id;
        
        -- Get a sublocation if available
        subloc_rec := NULL;
        IF subloc_ids IS NOT NULL AND array_length(subloc_ids, 1) > 0 THEN
            subloc_index := vendor_count % array_length(subloc_ids, 1);
            SELECT id, name INTO subloc_rec 
            FROM sub_locations 
            WHERE id = subloc_ids[subloc_index + 1];
        END IF;
        
        -- Update the vendor
        UPDATE vendors 
        SET 
            "cityId" = city_rec.id,
            "subLocationId" = subloc_rec.id,
            city = city_rec.name,
            state = city_rec.state,
            country = COALESCE(city_rec.country, 'India')
        WHERE id = vendor_rec.id;
        
        RAISE NOTICE 'Updated "%" -> % / %', 
            vendor_rec."storeName", 
            city_rec.name, 
            COALESCE(subloc_rec.name, 'No sublocation');
        
        vendor_count := vendor_count + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Successfully updated % vendor(s) with locations', vendor_count;
    RAISE NOTICE '📍 1 vendor left without location for testing';
END $$;

-- Verify the results
SELECT 
    v."storeName",
    v.city,
    c.name as city_from_relation,
    s.name as sublocation
FROM vendors v
LEFT JOIN cities c ON c.id = v."cityId"
LEFT JOIN sub_locations s ON s.id = v."subLocationId"
ORDER BY v."createdAt";
