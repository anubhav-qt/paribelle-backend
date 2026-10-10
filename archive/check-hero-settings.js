const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'marketplace' });

c.connect()
  .then(() => c.query("SELECT key, value FROM settings WHERE key LIKE '%hero%'"))
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
