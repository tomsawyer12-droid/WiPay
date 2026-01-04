const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sessionStore = require('../config/session');


// Get Branding Info (Public)
router.get('/branding', async (req, res) => {
    const { admin_id } = req.query;

    if (!admin_id) return res.json({ name: 'UGPAY', phone: '' });

    try {
        const [rows] = await db.query('SELECT business_name, business_phone FROM admins WHERE id = ?', [admin_id]);

        if (rows.length === 0) {
            return res.json({ name: 'UGPAY', phone: '' });
        }

        res.json({
            name: rows[0].business_name || 'UGPAY',
            phone: rows[0].business_phone || ''
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to fetch branding' });
    }
});

// Get Packages (Public/Captive Portal)
router.get('/packages', async (req, res) => {
    const { admin_id } = req.query;

    if (!admin_id) return res.json([]);

    try {
        let query = `
            SELECT p.id, p.name, p.price, p.validity_hours AS duration_hours
            FROM packages p
            JOIN vouchers v ON p.id = v.package_id AND v.is_used = 0
            JOIN admins a ON p.admin_id = a.id
            WHERE p.admin_id = ?
            AND p.is_active = 1
            AND (a.billing_type != 'subscription' OR a.subscription_expiry > NOW() OR a.subscription_expiry IS NULL)
            GROUP BY p.id, p.name, p.price, p.validity_hours
            HAVING COUNT(v.id) > 0
        `;

        const [rows] = await db.query(query, [admin_id]);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// Connect / Check Status
router.post('/connect', (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number) return res.status(400).json({ error: 'Phone number required' });

    const session = sessionStore.get(phone_number);

    if (session && session.expiry > Date.now()) {
        return res.json({
            status: 'connected',
            redirect_url: 'https://www.google.com'
        });
    } else {
        return res.json({
            status: 'pending_payment',
            message: 'Your session has expired or payment is still processing.'
        });
    }
});

module.exports = router;
