const pool = require('../config/db');

async function getBestSellingProducts(limit = 10, days = 30, userId) {
  const [rows] = await pool.query(
    `SELECT p.product_id, p.name, SUM(bi.quantity) as total_sold, SUM(bi.quantity * bi.price) as revenue
     FROM bill_items bi
     JOIN products p ON p.product_id = bi.product_id
     JOIN bills b ON b.bill_id = bi.bill_id
     WHERE b.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND b.user_id = ?
     GROUP BY p.product_id, p.name
     ORDER BY total_sold DESC
     LIMIT ?`,
    [days, userId, limit]
  );
  return rows.map(r => ({
    product_id: r.product_id,
    name: r.name,
    total_sold: parseInt(r.total_sold, 10),
    revenue: parseFloat(r.revenue)
  }));
}

async function getSalesByPeriod(period = 'daily', userId) {
  let groupBy, dateFormat;
  if (period === 'monthly') {
    groupBy = "DATE_FORMAT(b.date, '%Y-%m')";
    dateFormat = "DATE_FORMAT(b.date, '%Y-%m') as period";
  } else {
    groupBy = 'b.date';
    dateFormat = 'b.date as period';
  }

  const [rows] = await pool.query(
    `SELECT ${dateFormat}, SUM(b.total_amount) as total
     FROM bills b
     WHERE b.user_id = ?
     GROUP BY ${groupBy}
     ORDER BY period DESC
     LIMIT 30`,
    [userId]
  );
  return rows.map(r => ({
    period: r.period,
    total: parseFloat(r.total)
  }));
}

async function getInventoryValue(userId) {
  const [rows] = await pool.query(
    'SELECT SUM(price * quantity) as value, COUNT(*) as product_count FROM products WHERE user_id = ?',
    [userId]
  );
  return {
    totalValue: parseFloat(rows[0]?.value || 0),
    productCount: parseInt(rows[0]?.product_count || 0, 10)
  };
}

async function getProfitLoss(days = 30, userId) {
  const [income] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cashflow
     WHERE type = 'income' AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND user_id = ?`,
    [days, userId]
  );
  const [expense] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM cashflow
     WHERE type = 'expense' AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND user_id = ?`,
    [days, userId]
  );
  const totalIncome = parseFloat(income[0]?.total || 0);
  const totalExpense = parseFloat(expense[0]?.total || 0);
  return {
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    period: `${days} days`
  };
}

async function getAnalytics(userId) {
  const [bestSelling, dailySales, inventoryValue, profitLoss] = await Promise.all([
    getBestSellingProducts(10, 30, userId),
    getSalesByPeriod('daily', userId),
    getInventoryValue(userId),
    getProfitLoss(30, userId)
  ]);

  return {
    bestSellingProducts: bestSelling,
    dailySales: dailySales.slice(0, 14),
    monthlySales: (await getSalesByPeriod('monthly', userId)).slice(0, 6),
    inventoryValue,
    profitLoss
  };
}

module.exports = { getAnalytics, getBestSellingProducts, getSalesByPeriod, getInventoryValue, getProfitLoss };
