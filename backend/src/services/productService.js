const pool = require('../config/db');

async function getAllProducts(userId) {
  const [rows] = await pool.query(
    'SELECT product_id, name, price, buying_price, quantity, low_stock_threshold FROM products WHERE user_id = ? ORDER BY name',
    [userId]
  );
  return rows.map(r => ({
    product_id: r.product_id,
    name: r.name,
    price: parseFloat(r.price),
    buying_price: r.buying_price != null ? parseFloat(r.buying_price) : null,
    quantity: r.quantity,
    low_stock_threshold: r.low_stock_threshold ?? 5,
  }));
}

async function getProductById(id, userId) {
  const [rows] = await pool.query(
    'SELECT product_id, name, price, buying_price, quantity, low_stock_threshold FROM products WHERE product_id = ? AND user_id = ?',
    [id, userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    product_id: r.product_id,
    name: r.name,
    price: parseFloat(r.price),
    buying_price: r.buying_price != null ? parseFloat(r.buying_price) : null,
    quantity: r.quantity,
    low_stock_threshold: r.low_stock_threshold ?? 5,
  };
}

/**
 * Create a product and automatically record an expense for the total buying cost.
 * Expense = buyingPrice × quantity  (falls back to selling price if no buying price)
 */
async function createProduct({ name, price, buying_price, quantity, low_stock_threshold, userId }) {
  const sellingPrice = parseFloat(price);
  const buyingPrice = buying_price != null ? parseFloat(buying_price) : sellingPrice;
  const qty = parseInt(quantity, 10) || 0;
  const threshold = parseInt(low_stock_threshold, 10) || 5;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO products (name, price, buying_price, quantity, low_stock_threshold, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, sellingPrice, buyingPrice, qty, threshold, userId]
    );
    const productId = result.insertId;

    // Auto-record expense: total buying cost
    if (qty > 0) {
      const totalBuyingCost = buyingPrice * qty;
      const today = new Date().toISOString().split('T')[0];
      await connection.query(
        'INSERT INTO cashflow (type, amount, date, description, user_id) VALUES (?, ?, ?, ?, ?)',
        ['expense', totalBuyingCost, today, `Stock purchase: ${name} (${qty} units @ ₹${buyingPrice.toFixed(2)})`, userId]
      );
    }

    await connection.commit();
    return {
      product_id: productId,
      name,
      price: sellingPrice,
      buying_price: buyingPrice,
      quantity: qty,
      low_stock_threshold: threshold,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Update product fields. When quantity changes:
 *   - qty increased → record expense for newly added units (buyingPrice × diff)
 *   - qty decreased → record income for removed units (buyingPrice × diff)
 */
async function updateProduct(id, { name, price, buying_price, quantity, low_stock_threshold }, userId) {
  const current = await getProductById(id, userId);
  if (!current) return null;

  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (price !== undefined) { updates.push('price = ?'); values.push(parseFloat(price)); }
  if (buying_price !== undefined) { updates.push('buying_price = ?'); values.push(parseFloat(buying_price)); }
  if (quantity !== undefined) { updates.push('quantity = ?'); values.push(parseInt(quantity, 10)); }
  if (low_stock_threshold !== undefined) { updates.push('low_stock_threshold = ?'); values.push(parseInt(low_stock_threshold, 10)); }

  if (updates.length === 0) return current;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    values.push(id);
    values.push(userId);
    await connection.query(
      `UPDATE products SET ${updates.join(', ')} WHERE product_id = ? AND user_id = ?`,
      values
    );

    // If quantity changed, record cashflow adjustment
    if (quantity !== undefined) {
      const newQty = parseInt(quantity, 10);
      const oldQty = current.quantity;
      const diff = newQty - oldQty;
      const effectiveBuyingPrice = buying_price != null
        ? parseFloat(buying_price)
        : (current.buying_price ?? (price != null ? parseFloat(price) : current.price));

      if (diff !== 0) {
        const today = new Date().toISOString().split('T')[0];
        const productName = name ?? current.name;
        if (diff > 0) {
          // Quantity increased → expense for newly added stock
          const expenseAmount = effectiveBuyingPrice * diff;
          await connection.query(
            'INSERT INTO cashflow (type, amount, date, description, user_id) VALUES (?, ?, ?, ?, ?)',
            ['expense', expenseAmount, today,
              `Stock added: ${productName} (+${diff} units @ ₹${effectiveBuyingPrice.toFixed(2)})`, userId]
          );
        } else {
          // Quantity decreased → income for removed stock
          const incomeAmount = effectiveBuyingPrice * Math.abs(diff);
          await connection.query(
            'INSERT INTO cashflow (type, amount, date, description, user_id) VALUES (?, ?, ?, ?, ?)',
            ['income', incomeAmount, today,
              `Stock removed: ${productName} (${diff} units @ ₹${effectiveBuyingPrice.toFixed(2)})`, userId]
          );
        }
      }
    }

    await connection.commit();
    return getProductById(id, userId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
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
