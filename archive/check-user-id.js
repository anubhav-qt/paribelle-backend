const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'marketplace',
});

async function checkUserId() {
  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check if the problematic user ID exists
    const userId = '51b4a747-7a66-4d0c-9a9a-6ec93a212654';
    const result = await client.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      console.log('✅ User found:');
      console.log(result.rows[0]);
    } else {
      console.log('❌ User ID NOT FOUND:', userId);
      console.log('\nThis user ID is stored in localStorage but does not exist in the database.');
      console.log('The user needs to clear localStorage and login again.\n');
    }

    // Show all valid users
    console.log('\n📋 Valid users in database:');
    const users = await client.query('SELECT id, email FROM users ORDER BY created_at DESC LIMIT 10');
    users.rows.forEach(u => console.log(`${u.email}: ${u.id}`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkUserId();
