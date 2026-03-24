const pool = require('./backend/src/config/db');
async function check() {
  const [rows] = await pool.query('DESCRIBE users');
  console.log(rows);
  process.exit(0);
}
check();
