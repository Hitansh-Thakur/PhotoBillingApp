const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const analyticsService = require('../services/analyticsService');

const router = express.Router();
router.use(authMiddleware);

// GET /api/analytics/revenue - Total revenue
router.get('/revenue', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const profitLoss = await analyticsService.getProfitLoss(days, req.user.userId);
    res.json({
      totalRevenue: profitLoss.totalIncome,
      period: profitLoss.period
    });
  } catch (err) {
    console.error('Get revenue error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/top-products - Best selling products
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const days = parseInt(req.query.days, 10) || 30;
    const topProducts = await analyticsService.getBestSellingProducts(limit, days, req.user.userId);
    res.json(topProducts);
  } catch (err) {
    console.error('Get top products error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics/daily - Daily sales data
router.get('/daily', async (req, res) => {
  try {
    const dailySales = await analyticsService.getSalesByPeriod('daily', req.user.userId);
    res.json(dailySales);
  } catch (err) {
    console.error('Get daily sales error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/analytics - Complete analytics dashboard
router.get('/', async (req, res) => {
  try {
    const analytics = await analyticsService.getAnalytics(req.user.userId);
    res.json(analytics);
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
