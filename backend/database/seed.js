/**
 * Seed script - creates demo user and sample products
 * Run: node database/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function seed() {
  try {
    const hashedPassword = await bcrypt.hash('demo123', 10);

    await pool.query(
      `INSERT INTO users (name, email, password) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      ['Demo User', 'demo@example.com', hashedPassword]
    );

    const [products] = await pool.query('SELECT COUNT(*) as count FROM products');
    if (products[0].count === 0) {
      await pool.query(
        `INSERT INTO products (name, price, quantity) VALUES
         ('Milk', 45, 20), ('Bread', 30, 15), ('Eggs', 120, 10),
         ('Rice (1kg)', 85, 25), ('Cooking Oil', 180, 12),
         ('Sugar (500g)', 55, 18), ('Tea', 200, 8), ('Soap', 40, 30)`
      );
      console.log('Seeded sample products.');
    }

    console.log('Seed completed. Demo user: demo@example.com / demo123');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
