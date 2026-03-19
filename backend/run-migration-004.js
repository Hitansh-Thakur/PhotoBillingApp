/**
 * Migration 004: Add opening_balance column to users table.
 * Run with: node run-migration-004.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    console.log('Running migration 004: Add opening_balance to users...');
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00
        AFTER business_name
    `);
    console.log('✅ Migration 004 complete: opening_balance column added (or already existed).');
  } catch (err) {
    console.error('❌ Migration 004 failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
