const { Client } = require('pg');

async function checkInvoiceItems() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'marketplace',
    user: 'postgres',
    password: 'marketplace',
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Query invoice_items for credit notes
    const result = await client.query(`
      SELECT 
        ii.id, 
        ii.name,
        ii.description,
        ii.quantity, 
        ii.unit_price, 
        ii.tax_amount, 
        ii.total, 
        i.invoice_number, 
        i.type,
        i.total as invoice_total
      FROM invoice_items ii 
      JOIN invoices i ON ii.invoice_id = i.id 
      WHERE i.invoice_number LIKE 'CN-%' 
      ORDER BY ii.created_at DESC 
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('❌ No invoice items found for credit notes');
    } else {
      console.log(`✅ Found ${result.rows.length} invoice items for credit notes:\n`);
      result.rows.forEach((row, index) => {
        console.log(`Item #${index + 1}:`);
        console.log(`  Invoice: ${row.invoice_number} (${row.type})`);
        console.log(`  Product: ${row.name}`);
        console.log(`  Description: ${row.description}`);
        console.log(`  Quantity: ${row.quantity}`);
        console.log(`  Unit Price: $${parseFloat(row.unit_price).toFixed(2)}`);
        console.log(`  Tax: $${parseFloat(row.tax_amount).toFixed(2)}`);
        console.log(`  Total: $${parseFloat(row.total).toFixed(2)}`);
        console.log(`  Invoice Total: $${parseFloat(row.invoice_total).toFixed(2)}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkInvoiceItems();
