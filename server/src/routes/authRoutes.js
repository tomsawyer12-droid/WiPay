const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Login API (Admin)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
        if (users.length === 0) return res.status(400).json({ error: 'User not found' });

        const user = users[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ error: 'Invalid password' });

        // Create Token
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // Set HttpOnly Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // process.env.NODE_ENV === 'production', // Disabled for HTTP IP access
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({ token, username: user.username, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout API
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Change Password API
router.post('/admin/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and New passwords are required' });
    }

    try {
        const [admins] = await db.query('SELECT * FROM admins WHERE id = ?', [req.user.id]);
        if (admins.length === 0) return res.status(404).json({ error: 'User not found' });

        const admin = admins[0];
        const validPass = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!validPass) return res.status(400).json({ error: 'Incorrect current password' });

        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change Pass Error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
