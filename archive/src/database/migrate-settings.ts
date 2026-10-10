import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'marketplace_user',
  password: process.env.DB_PASSWORD || 'marketplace123',
  database: process.env.DB_NAME || 'marketplace',
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Create site_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key VARCHAR(255) UNIQUE NOT NULL,
        value JSONB,
        description TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Created site_settings table');

    // Insert default location filter setting
    await client.query(`
      INSERT INTO site_settings (key, value, description) 
      VALUES (
        'location_filter_enabled', 
        'true', 
        'Enable/disable location-based product filtering across the marketplace'
      ) ON CONFLICT (key) DO NOTHING;
    `);
    
    // Insert default currency setting
    await client.query(`
      INSERT INTO site_settings (key, value, description) 
      VALUES (
        'currency', 
        '"INR"', 
        'Default currency for the marketplace'
      ) ON CONFLICT (key) DO NOTHING;
    `);
    console.log('✓ Inserted default settings');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);
    `);
    console.log('✓ Created index');

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
