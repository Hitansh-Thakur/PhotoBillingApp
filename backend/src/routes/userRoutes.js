const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');

const router = express.Router();
router.use(authMiddleware);

// GET /api/users/me - Get current user profile (including opening_balance)
router.get('/me', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT user_id, name, business_name, email, opening_balance, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];
        res.json({
            user_id: user.user_id,
            name: user.name,
            business_name: user.business_name,
            email: user.email,
            opening_balance: user.opening_balance != null ? parseFloat(user.opening_balance) : 0,
            created_at: user.created_at
        });
    } catch (err) {
        console.error('Get user profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT /api/users/me - Update current user profile (name, business_name, opening_balance)
router.put('/me', async (req, res) => {
    try {
        const { name, business_name, opening_balance } = req.body;
        const updates = [];
        const values = [];

        if (name !== undefined && name.trim()) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (business_name !== undefined) {
            updates.push('business_name = ?');
            values.push(business_name?.trim() || null);
        }
        if (opening_balance !== undefined && opening_balance !== null) {
            const balance = parseFloat(opening_balance);
            if (!isNaN(balance) && balance >= 0) {
                updates.push('opening_balance = ?');
                values.push(balance);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        values.push(req.user.userId);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );

        const [rows] = await pool.query(
            'SELECT user_id, name, business_name, email, opening_balance, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );
        const user = rows[0];
        res.json({
            user_id: user.user_id,
            name: user.name,
            business_name: user.business_name,
            email: user.email,
            opening_balance: user.opening_balance != null ? parseFloat(user.opening_balance) : 0,
            created_at: user.created_at
        });
    } catch (err) {
        console.error('Update user profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Alias: PUT /api/users/me/profile → same as PUT /api/users/me
router.put('/me/profile', async (req, res) => {
    try {
        const { name, business_name, opening_balance } = req.body;
        const updates = [];
        const values = [];

        if (name !== undefined && name.trim()) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        if (business_name !== undefined) {
            updates.push('business_name = ?');
            values.push(business_name?.trim() || null);
        }
        if (opening_balance !== undefined && opening_balance !== null) {
            const balance = parseFloat(opening_balance);
            if (!isNaN(balance) && balance >= 0) {
                updates.push('opening_balance = ?');
                values.push(balance);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        values.push(req.user.userId);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
            values
        );

        const [rows] = await pool.query(
            'SELECT user_id, name, business_name, email, opening_balance, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );
        const user = rows[0];
        res.json({
            user_id: user.user_id,
            name: user.name,
            business_name: user.business_name,
            email: user.email,
            opening_balance: user.opening_balance != null ? parseFloat(user.opening_balance) : 0,
            created_at: user.created_at
        });
    } catch (err) {
        console.error('Update user profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
