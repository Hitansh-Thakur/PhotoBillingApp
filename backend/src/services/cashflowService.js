const pool = require('../config/db');

async function getCashflowSummary(userId, startDate = null, endDate = null) {
  const dateFilter = startDate && endDate ? ' AND date BETWEEN ? AND ?' : '';
  const params = [userId];
  if (startDate && endDate) {
    params.push(startDate, endDate);
  }

  const [incomeRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cashflow WHERE user_id = ? AND type = 'income'${dateFilter}`,
    params
  );
  const [expenseRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cashflow WHERE user_id = ? AND type = 'expense'${dateFilter}`,
    params
  );

  const totalIncome = parseFloat(incomeRows[0]?.total || 0);
  const totalExpenses = parseFloat(expenseRows[0]?.total || 0);
  const balance = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    balance,
    period: startDate && endDate ? { startDate, endDate } : null
  };
}

async function getCashflowEntries(userId, limit = 100, type = null) {
  let sql = 'SELECT entry_id, type, amount, date, description, bill_id, created_at FROM cashflow WHERE user_id = ?';
  const params = [userId];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY date DESC, created_at DESC LIMIT ?';
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows.map(r => ({
    entry_id: r.entry_id,
    type: r.type,
    amount: parseFloat(r.amount),
    date: r.date,
    description: r.description,
    bill_id: r.bill_id
  }));
}


async function addExpense({ amount, description = null, date = null, userId }) {
  const d = date || new Date().toISOString().split('T')[0];
  const [result] = await pool.query(
    'INSERT INTO cashflow (type, amount, date, description, user_id) VALUES (?, ?, ?, ?, ?)',
    ['expense', parseFloat(amount), d, description, userId]
  );
  return { entry_id: result.insertId, type: 'expense', amount: parseFloat(amount), date: d, description };
}

async function addCashflowEntry({ type, amount, description = null, date = null, userId }) {
  const d = date || new Date().toISOString().split('T')[0];
  const [result] = await pool.query(
    'INSERT INTO cashflow (type, amount, date, description, user_id) VALUES (?, ?, ?, ?, ?)',
    [type, parseFloat(amount), d, description, userId]
  );
  return { entry_id: result.insertId, type, amount: parseFloat(amount), date: d, description };
}

async function getCashflowEntryById(entryId, userId) {
  const [rows] = await pool.query(
    'SELECT entry_id, type, amount, date, description, bill_id, created_at FROM cashflow WHERE entry_id = ? AND user_id = ?',
    [entryId, userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    entry_id: r.entry_id,
    type: r.type,
    amount: parseFloat(r.amount),
    date: r.date,
    description: r.description,
    bill_id: r.bill_id
  };
}

async function updateCashflowEntry(entryId, { type, amount, description = null, date = null }, userId) {
  const d = date || new Date().toISOString().split('T')[0];
  const [result] = await pool.query(
    'UPDATE cashflow SET type = ?, amount = ?, date = ?, description = ? WHERE entry_id = ? AND user_id = ?',
    [type, parseFloat(amount), d, description, entryId, userId]
  );
  if (result.affectedRows === 0) return null;
  return { entry_id: entryId, type, amount: parseFloat(amount), date: d, description };
}

async function deleteCashflowEntry(entryId, userId) {
  // First check if entry exists and is not linked to a bill
  const entry = await getCashflowEntryById(entryId, userId);
  if (!entry) return null;
  if (entry.bill_id !== null) {
    throw new Error('Cannot delete cashflow entry linked to a bill');
  }

  const [result] = await pool.query('DELETE FROM cashflow WHERE entry_id = ? AND user_id = ?', [entryId, userId]);
  return result.affectedRows > 0;
}

module.exports = {
  getCashflowSummary,
  getCashflowEntries,
  addExpense,
  addCashflowEntry,
  getCashflowEntryById,
  updateCashflowEntry,
  deleteCashflowEntry
};

