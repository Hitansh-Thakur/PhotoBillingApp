const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');

const router = express.Router();
router.use(authMiddleware);

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT user_id, name, email, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        res.json({
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            created_at: user.created_at
        });
    } catch (err) {
        console.error('Get user profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
