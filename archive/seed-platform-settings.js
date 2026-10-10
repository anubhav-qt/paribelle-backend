const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'marketplace',
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seedPlatformSettings() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if platform_settings has any rows
    const check = await client.query('SELECT COUNT(*) FROM platform_settings');
    const count = parseInt(check.rows[0].count);

    if (count > 0) {
      console.log('Platform settings already exist. Skipping seed.');
      return;
    }

    // Insert default platform settings
    await client.query(`
      INSERT INTO platform_settings (
        site_name,
        business_name,
        business_phone,
        business_email,
        registered_address_line1,
        registered_city,
        registered_state,
        registered_pincode,
        registered_country,
        currency,
        currency_symbol,
        timezone,
        language,
        commission_rate,
        tax_rate
      ) VALUES (
        'GaliCart Marketplace',
        'GaliCart',
        '+91 1234567890',
        'support@galicart.com',
        'Business Address Line 1',
        'Mumbai',
        'Maharashtra',
        '400001',
        'India',
        'INR',
        '₹',
        'Asia/Kolkata',
        'en',
        0.00,
        18.00
      )
    `);

    console.log('✓ Platform settings seeded successfully!');
  } catch (error) {
    console.error('Error seeding platform settings:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedPlatformSettings();
