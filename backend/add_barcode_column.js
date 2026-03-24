const mysql = require('mysql2/promise');
require('dotenv').config();

async function addBarcodeColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'photo_billing',
  });

  try {
    console.log('Adding barcode column to products table...');
    await connection.query('ALTER TABLE products ADD COLUMN barcode VARCHAR(255) DEFAULT NULL;');
    console.log('Successfully added barcode column.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Barcode column already exists.');
    } else {
      console.error('Error adding column:', err);
    }
  } finally {
    await connection.end();
  }
}

addBarcodeColumn();
