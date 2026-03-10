const express = require('express');
const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validationMiddleware');
const authService = require('../services/authService');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('businessName').optional().trim(),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, businessName, email, password } = req.body;
      const result = await authService.register(name, email, password, businessName);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.status(201).json({ token: result.token, user: result.user });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      if (!result.success) {
        return res.status(401).json({ message: result.message });
      }

      res.json({
        token: result.token,
        user: result.user
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

module.exports = router;
