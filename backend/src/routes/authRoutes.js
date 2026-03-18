const express = require('express');
const { body } = require('express-validator');
const handleValidationErrors = require('../middleware/validationMiddleware');
const authService = require('../services/authService');

const router = express.Router();

// In-memory session store for tracking login times
// Key: userId, Value: { loginTime: Date }
const activeSessions = new Map();

/**
 * Format a timestamp to a readable locale string
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Log user activity to the backend console
 */
function logUserActivity(userId, status, extra = {}) {
  const now = new Date();
  const time = formatTime(now);
  const date = now.toLocaleDateString('en-IN');

  let logParts = [
    `\x1b[36m[USER ACTIVITY]\x1b[0m`,
    `User ID: \x1b[33m${userId}\x1b[0m`,
    `Status: \x1b[${status === 'Active' ? '32' : '31'}m${status}\x1b[0m`,
    `Time: \x1b[35m${time}\x1b[0m`,
    `Date: ${date}`,
  ];

  if (extra.loginTime) {
    logParts.push(`Login: \x1b[35m${formatTime(extra.loginTime)}\x1b[0m`);
  }
  if (extra.logoutTime) {
    logParts.push(`Logout: \x1b[35m${formatTime(extra.logoutTime)}\x1b[0m`);
  }
  if (extra.sessionDuration !== undefined) {
    const mins = Math.floor(extra.sessionDuration / 60000);
    const secs = Math.floor((extra.sessionDuration % 60000) / 1000);
    logParts.push(`Session Duration: \x1b[36m${mins}m ${secs}s\x1b[0m`);
  }

  console.log(logParts.join(' | '));
}

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
      // Log new registration activity
      // authService returns { userId, name, email } — use userId directly
      logUserActivity(result.user.userId || email, 'Active');
      activeSessions.set(result.user.userId, { loginTime: new Date() });
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

      // authService returns { userId, name, email } — use userId directly
      const userId = result.user.userId;
      const loginTime = new Date();

      // Track session start
      activeSessions.set(userId, { loginTime });

      // Log user activity to console
      logUserActivity(userId, 'Active');

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

router.post('/logout', async (req, res) => {
  try {
    // Try to extract userId from Authorization header token (basic approach)
    const authHeader = req.headers.authorization;
    let userId = 'unknown';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
        }
      } catch {
        // ignore decode errors
      }
    }

    const logoutTime = new Date();
    const session = activeSessions.get(userId);

    if (session) {
      const sessionDuration = logoutTime - session.loginTime;
      logUserActivity(userId, 'Inactive', {
        loginTime: session.loginTime,
        logoutTime,
        sessionDuration,
      });
      activeSessions.delete(userId);
    } else {
      logUserActivity(userId, 'Inactive', { logoutTime });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

