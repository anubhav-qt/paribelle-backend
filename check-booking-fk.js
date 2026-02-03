const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace'
});

async function checkIds() {
  try {
    await client.connect();

    const productId = 'eec1923e-030d-45ba-853f-02477b460009';
    const userId = '51b4a747-7a66-4d0c-9a9a-6ec93a212654';
    const vendorId = '30b364eb-8ca2-4b50-ac53-54bc0244492c';

    console.log('Checking IDs from booking error...\n');

    // Check product
    const product = await client.query('SELECT id, name FROM products WHERE id = $1', [productId]);
    console.log(`Product (${productId}):`, product.rows.length > 0 ? product.rows[0].name : '❌ NOT FOUND');

    // Check user
    const user = await client.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    console.log(`User (${userId}):`, user.rows.length > 0 ? user.rows[0].email : '❌ NOT FOUND');

    // Check vendor
    const vendor = await client.query('SELECT id, store_name FROM vendors WHERE id = $1', [vendorId]);
    console.log(`Vendor (${vendorId}):`, vendor.rows.length > 0 ? vendor.rows[0].store_name : '❌ NOT FOUND');

    // Check the constraint name
    console.log('\nFinding constraint FK_64cd97487c5c42806458ab5520c...');
    const constraint = await client.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'FK_64cd97487c5c42806458ab5520c'
    `);
    
    if (constraint.rows.length > 0) {
      const c = constraint.rows[0];
      console.log(`Constraint: ${c.table_name}.${c.column_name} -> ${c.foreign_table_name}.${c.foreign_column_name}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkIds();
