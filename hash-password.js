const bcrypt = require('bcrypt');

async function hashPassword() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Bcrypt Hash:', hash);
  console.log('\nCopy this hash into the SQL INSERT query above');
}

hashPassword();
