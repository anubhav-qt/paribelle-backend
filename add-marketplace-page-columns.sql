-- The MarketplacePage entity declares tags/view_count/author_name and a wider
-- page_type enum than the table was created with, so every read of the table
-- failed with "column MarketplacePage.tags does not exist". This realigns the
-- table with the entity.

ALTER TABLE marketplace_pages ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE marketplace_pages ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
ALTER TABLE marketplace_pages ADD COLUMN IF NOT EXISTS author_name character varying(255);

-- PageType gained 'cookie' and 'blog' after the table was created.
ALTER TABLE marketplace_pages DROP CONSTRAINT IF EXISTS marketplace_pages_page_type_check;
ALTER TABLE marketplace_pages ADD CONSTRAINT marketplace_pages_page_type_check
  CHECK (page_type::text = ANY (ARRAY[
    'custom', 'about', 'contact', 'faq', 'terms', 'privacy', 'cookie', 'blog'
  ]::text[]));
