const pool = require('../config/db');

/**
 * Creates a bill from items, reduces product quantities, and records cashflow income.
 * @param {Object} params
 * @param {number} params.userId - User ID
 * @param {Array<{product_id: number, quantity: number, price?: number}>} params.items - Bill items
 * @param {string} [params.imagePath] - Optional image path from upload
 */
async function createBill({ userId, items, imagePath = null }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let subtotal = 0;
    const billItems = [];

    for (const item of items) {
      const [prod] = await connection.query(
        'SELECT product_id, name, price, quantity FROM products WHERE product_id = ? AND user_id = ?',
        [item.product_id, userId]
      );
      if (prod.length === 0) {
        throw new Error(`Product ${item.product_id} not found or does not belong to your store`);
      }
      const p = prod[0];
      const qty = parseInt(item.quantity, 10) || 1;
      const price = item.price != null ? parseFloat(item.price) : parseFloat(p.price);

      if (p.quantity < qty) {
        throw new Error(`Insufficient quantity for ${p.name}`);
      }

      const lineTotal = price * qty;
      subtotal += lineTotal;
      billItems.push({ product_id: p.product_id, name: p.name, quantity: qty, price });
    }

    const total = subtotal;

    const [billResult] = await connection.query(
      'INSERT INTO bills (user_id, total_amount, image_path) VALUES (?, ?, ?)',
      [userId || null, total, imagePath]
    );
    const billId = billResult.insertId;

    for (const bi of billItems) {
      await connection.query(
        'INSERT INTO bill_items (bill_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [billId, bi.product_id, bi.quantity, bi.price]
      );
      await connection.query(
        'UPDATE products SET quantity = quantity - ? WHERE product_id = ?',
        [bi.quantity, bi.product_id]
      );
    }

    await connection.query(
      'INSERT INTO cashflow (type, amount, bill_id, user_id) VALUES (?, ?, ?, ?)',
      ['income', total, billId, userId]
    );

    await connection.commit();

    return {
      bill_id: billId,
      total_amount: total,
      items: billItems,
      date: new Date().toISOString().split('T')[0]
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getBills(userId = null, limit = 50) {
  let sql = `
    SELECT b.bill_id, b.date, b.total_amount, b.image_path, b.created_at
    FROM bills b
    WHERE 1=1
  `;
  const params = [];
  if (userId) {
    sql += ' AND b.user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY b.created_at DESC LIMIT ?';
  params.push(limit);

  const [bills] = await pool.query(sql, params);

  const result = [];
  for (const b of bills) {
    const [items] = await pool.query(
      `SELECT bi.product_id, bi.quantity, bi.price, p.name
       FROM bill_items bi
       JOIN products p ON p.product_id = bi.product_id
       WHERE bi.bill_id = ?`,
      [b.bill_id]
    );
    result.push({
      bill_id: b.bill_id,
      date: b.date,
      total_amount: parseFloat(b.total_amount),
      image_path: b.image_path,
      items: items.map(i => ({
        product_id: i.product_id,
        name: i.name,
        quantity: i.quantity,
        price: parseFloat(i.price)
      }))
    });
  }
  return result;
}

module.exports = { createBill, getBills };
