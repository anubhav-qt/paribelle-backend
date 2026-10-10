#!/usr/bin/env node

/**
 * Migration Script: Add billing contact fields to orders table
 * 
 * This migration adds billing_name, billing_email, and billing_phone fields
 * to support separate billing addresses for orders.
 */

const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'marketplace',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('billing_name', 'billing_email', 'billing_phone');
    `;
    
    const checkResult = await client.query(checkQuery);
    const existingColumns = checkResult.rows.map(row => row.column_name);
    
    console.log('Existing billing contact columns:', existingColumns);

    // Add missing columns
    const columnsToAdd = [
      { name: 'billing_name', type: 'VARCHAR(255)', description: 'Full name for billing address' },
      { name: 'billing_email', type: 'VARCHAR(255)', description: 'Email for billing address' },
      { name: 'billing_phone', type: 'VARCHAR(20)', description: 'Phone for billing address' },
    ];

    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding column ${column.name}...`);
        await client.query(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.type};`);
        await client.query(`COMMENT ON COLUMN orders.${column.name} IS '${column.description}';`);
        console.log(`✓ Added ${column.name}`);
      } else {
        console.log(`- Column ${column.name} already exists, skipping`);
      }
    }

    // Update existing orders to copy shipping contact to billing contact if billing is null
    console.log('Updating existing orders with billing contact info...');
    const updateQuery = `
      UPDATE orders 
      SET 
        billing_name = COALESCE(billing_name, shipping_name),
        billing_email = COALESCE(billing_email, shipping_email),
        billing_phone = COALESCE(billing_phone, shipping_phone)
      WHERE 
        billing_name IS NULL 
        OR billing_email IS NULL 
        OR billing_phone IS NULL;
    `;
    
    const updateResult = await client.query(updateQuery);
    console.log(`✓ Updated ${updateResult.rowCount} order(s)`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
