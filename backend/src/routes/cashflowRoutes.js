const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const handleValidationErrors = require('../middleware/validationMiddleware');
const cashflowService = require('../services/cashflowService');

const router = express.Router();
router.use(authMiddleware);

// GET /api/cashflow/summary - Get cashflow summary
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await cashflowService.getCashflowSummary(req.user.userId, startDate || null, endDate || null);
    res.json(summary);
  } catch (err) {
    console.error('Get cashflow summary error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/cashflow - Get all cashflow entries with summary
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await cashflowService.getCashflowSummary(req.user.userId, startDate || null, endDate || null);
    const entries = await cashflowService.getCashflowEntries(req.user.userId, 100);
    res.json({ summary, entries });
  } catch (err) {
    console.error('Get cashflow error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/cashflow - Create cashflow entry (income or expense)
router.post(
  '/',
  [
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
    body('description').optional().trim().isString(),
    body('date').optional().isISO8601().withMessage('Valid date required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { type, amount, description, date } = req.body;
      const entry = await cashflowService.addCashflowEntry({ type, amount, description, date, userId: req.user.userId });
      res.status(201).json(entry);
    } catch (err) {
      console.error('Add cashflow entry error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// POST /api/cashflow/expense - Add expense (legacy endpoint)
router.post(
  '/expense',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
    body('description').optional().trim().isString(),
    body('date').optional().isISO8601().withMessage('Valid date required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const expense = await cashflowService.addExpense({ ...req.body, userId: req.user.userId });
      res.status(201).json(expense);
    } catch (err) {
      console.error('Add expense error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// PUT /api/cashflow/:id - Update cashflow entry
router.put(
  '/:id',
  [
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount required'),
    body('description').optional().trim().isString(),
    body('date').optional().isISO8601().withMessage('Valid date required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      if (isNaN(entryId)) {
        return res.status(400).json({ message: 'Invalid entry ID' });
      }

      const { type, amount, description, date } = req.body;
      const updated = await cashflowService.updateCashflowEntry(entryId, { type, amount, description, date }, req.user.userId);

      if (!updated) {
        return res.status(404).json({ message: 'Cashflow entry not found' });
      }

      res.json(updated);
    } catch (err) {
      console.error('Update cashflow entry error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// DELETE /api/cashflow/:id - Delete cashflow entry
router.delete('/:id', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ message: 'Invalid entry ID' });
    }

    const deleted = await cashflowService.deleteCashflowEntry(entryId, req.user.userId);

    if (deleted === null) {
      return res.status(404).json({ message: 'Cashflow entry not found' });
    }

    res.json({ message: 'Cashflow entry deleted successfully' });
  } catch (err) {
    console.error('Delete cashflow entry error:', err);
    if (err.message === 'Cannot delete cashflow entry linked to a bill') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
