// Run migration 005 - Add source column to bills table
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'photo_billing',
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '005_add_bill_source.sql'),
      'utf8'
    );

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        console.log('Running:', stmt.substring(0, 60) + '...');
        await connection.execute(stmt);
        console.log('✅ Success');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('⚠️  Column already exists, skipping.');
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migration 005 complete: source column added to bills table.');
  } finally {
    await connection.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
