const pool = require('../config/db');

async function getAllProducts(userId) {
  const [rows] = await pool.query(
    'SELECT product_id, name, price, quantity FROM products WHERE user_id = ? ORDER BY name',
    [userId]
  );
  return rows.map(r => ({
    product_id: r.product_id,
    name: r.name,
    price: parseFloat(r.price),
    quantity: r.quantity
  }));
}

async function getProductById(id, userId) {
  const [rows] = await pool.query(
    'SELECT product_id, name, price, quantity FROM products WHERE product_id = ? AND user_id = ?',
    [id, userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { product_id: r.product_id, name: r.name, price: parseFloat(r.price), quantity: r.quantity };
}

async function createProduct({ name, price, quantity, userId }) {
  const [result] = await pool.query(
    'INSERT INTO products (name, price, quantity, user_id) VALUES (?, ?, ?, ?)',
    [name, parseFloat(price), parseInt(quantity, 10) || 0, userId]
  );
  return { product_id: result.insertId, name, price: parseFloat(price), quantity: parseInt(quantity, 10) || 0 };
}

async function updateProduct(id, { name, price, quantity }, userId) {
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (price !== undefined) { updates.push('price = ?'); values.push(parseFloat(price)); }
  if (quantity !== undefined) { updates.push('quantity = ?'); values.push(parseInt(quantity, 10)); }
  if (updates.length === 0) return getProductById(id, userId);

  values.push(id);
  values.push(userId);
  await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE product_id = ? AND user_id = ?`, values);
  return getProductById(id, userId);
}

async function deleteProduct(id, userId) {
  const [result] = await pool.query('DELETE FROM products WHERE product_id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
