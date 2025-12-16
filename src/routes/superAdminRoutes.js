const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, verifySuperAdmin } = require('../middleware/auth');

// Middleware for all super admin routes
router.use(authenticateToken);
router.use(verifySuperAdmin);

// Get All Tenants (Admins)
router.get('/tenants', async (req, res) => {
    try {
        const [admins] = await db.query('SELECT id, username, role, billing_type, subscription_expiry, created_at FROM admins ORDER BY created_at DESC');
        res.json(admins);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching tenants' });
    }
});

// Create New Tenant
router.post('/tenants', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Check if username exists
        const [existing] = await db.query('SELECT id FROM admins WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const billingType = req.body.billing_type || 'commission';

        await db.query('INSERT INTO admins (username, password_hash, role, billing_type) VALUES (?, ?, ?, ?)', [username, hash, 'admin', billingType]);

        res.status(201).json({ message: 'Tenant created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create tenant' });
    }
});

// Delete Tenant
router.delete('/tenants/:id', async (req, res) => {
    const tenantId = req.params.id;

    // Prevent deleting self
    if (parseInt(tenantId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    try {
        await db.query('DELETE FROM admins WHERE id = ?', [tenantId]);
        res.json({ message: 'Tenant deleted successfully' });
        // Note: In a real production app, we should probably soft-delete or handle their associated data.
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete tenant' });
    }
});

// Renew Subscription
router.patch('/tenants/:id/subscription', async (req, res) => {
    const tenantId = req.params.id;
    const { expiry_date } = req.body; // YYYY-MM-DD or Valid Date String

    if (!expiry_date) return res.status(400).json({ error: 'Date required' });

    try {
        await db.query('UPDATE admins SET subscription_expiry = ? WHERE id = ?', [expiry_date, tenantId]);
        res.json({ message: 'Subscription updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// System Stats
router.get('/stats', async (req, res) => {
    try {
        const [admins] = await db.query('SELECT COUNT(*) as count FROM admins WHERE role = "admin"');
        const [vouchers] = await db.query('SELECT COUNT(*) as count FROM vouchers');
        const [totalRevenue] = await db.query('SELECT SUM(amount) as total FROM transactions WHERE status = "SUCCESS"');
        const [totalFees] = await db.query('SELECT SUM(fee) as total FROM transactions WHERE status = "SUCCESS"');

        res.json({
            tenantCount: admins[0].count,
            totalVouchers: vouchers[0].count,
            totalRevenue: totalRevenue[0].total || 0,
            totalCommission: totalFees[0].total || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
