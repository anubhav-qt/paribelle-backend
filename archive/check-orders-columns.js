const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'marketplace' });
c.connect()
  .then(() => c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'"))
  .then(r => { console.log('orders columns:', r.rows.map(x => x.column_name).join(', ')); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
