/**
 * Migration: Add Razorpay payment support
 * 
 * 1. Adds payment_status column to bills table (pending/paid)
 * 2. Creates payments table to record Razorpay transactions
 */
const pool = require('./src/config/db');

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log('🔄 Running Razorpay payment migration...');

    // Step 1: Add payment_status to bills table if not exists
    await conn.query(`
      ALTER TABLE bills
      ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending'
    `);
    console.log('✅ Added payment_status column to bills table');

    // Step 2: Create payments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        bill_id       INT NOT NULL,
        order_id      VARCHAR(100) NOT NULL,
        payment_id    VARCHAR(100),
        amount        DECIMAL(10, 2) NOT NULL,
        currency      VARCHAR(10) NOT NULL DEFAULT 'INR',
        status        ENUM('created', 'paid', 'failed') NOT NULL DEFAULT 'created',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created payments table');

    console.log('\n✅ Razorpay migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runMigration();
