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

// Recover Voucher (Public)
router.post('/recover-voucher', async (req, res) => {
    const { phone_number, admin_id } = req.body;

    if (!phone_number) return res.status(400).json({ error: 'Phone number required' });

    try {
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.slice(1);
        else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

        const query = `
            SELECT t.voucher_code, t.created_at, t.amount, p.name as package_name 
            FROM transactions t
            LEFT JOIN packages p ON t.package_id = p.id
            WHERE t.phone_number = ? 
            AND t.status = 'success' 
            AND t.voucher_code IS NOT NULL
            ${admin_id ? 'AND t.admin_id = ?' : ''}
            ORDER BY t.created_at DESC 
            LIMIT 1
        `;

        const params = admin_id ? [formattedPhone, admin_id] : [formattedPhone];
        const [rows] = await db.query(query, params);

        res.json(rows);
    } catch (err) {
        console.error('Recover Voucher Error:', err);
        res.status(500).json({ error: 'Failed to search for vouchers' });
    }
});

module.exports = router;

