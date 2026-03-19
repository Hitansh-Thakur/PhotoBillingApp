/**
 * Migration 003: Add buying_price and low_stock_threshold to products table.
 * Run once: node backend/run-migration-003.js
 */
require('dotenv').config({ path: __dirname + '/.env' });
const pool = require('./src/config/db');

async function run() {
  try {
    console.log('Migration 003: Adding buying_price and low_stock_threshold to products...');

    // buying_price column
    try {
      await pool.query(
        `ALTER TABLE products ADD COLUMN buying_price DECIMAL(10,2) NULL AFTER price`
      );
      console.log('  ✓ Added buying_price column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  ↩ buying_price already exists, skipping');
      } else throw e;
    }

    // low_stock_threshold column
    try {
      await pool.query(
        `ALTER TABLE products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 5 AFTER quantity`
      );
      console.log('  ✓ Added low_stock_threshold column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  ↩ low_stock_threshold already exists, skipping');
      } else throw e;
    }

    console.log('\n✅ Migration 003 completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration 003 failed:', err.message);
    process.exit(1);
  }
}

run();
