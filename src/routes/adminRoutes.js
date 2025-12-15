const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms'); // Not used here directly but good to have if we expand

// Middleware applied to all routes in this file
router.use('/admin', authenticateToken);

// --- Categories ---
router.post('/admin/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const [result] = await db.query('INSERT INTO categories (name, admin_id) VALUES (?, ?)', [name, req.user.id]);
        res.json({ id: result.insertId, name, message: 'Category created' });
    } catch (err) {
        console.error('Create Category Error:', err);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

router.get('/admin/categories', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories WHERE admin_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// --- Packages ---
router.post('/admin/packages', async (req, res) => {
    const { name, price, validity_hours, category_id, data_limit_mb } = req.body;

    if (!name || !price || !validity_hours || !category_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await db.query(`
            INSERT INTO packages (category_id, name, price, validity_hours, data_limit_mb, created_at, admin_id)
            VALUES (?, ?, ?, ?, ?, NOW(), ?)
        `, [category_id, name, price, validity_hours, data_limit_mb || 0, req.user.id]);
        res.json({ message: 'Package created successfully' });
    } catch (err) {
        console.error('Create Package Error:', err);
        res.status(500).json({ error: 'Failed to create package' });
    }
});

router.get('/admin/packages', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM packages p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.admin_id = ?
            ORDER BY p.created_at DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Packages Error:', err);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// --- Vouchers ---
router.post('/admin/vouchers/import', async (req, res) => {
    const { package_id, vouchers } = req.body;
    const inputList = req.body.vouchers || req.body.codes;

    if (!package_id || !inputList || !Array.isArray(inputList) || inputList.length === 0) {
        return res.status(400).json({ error: 'Invalid input. Access package_id and array of vouchers.' });
    }

    try {
        const placeholder = inputList.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const values = [];

        inputList.forEach(item => {
            let code, comment, package_ref;
            if (typeof item === 'string') {
                code = item;
                comment = null;
                package_ref = null;
            } else {
                code = item.code;
                comment = item.comment || null;
                package_ref = item.package_ref || null;
            }
            values.push(package_id, code, comment, package_ref, req.user.id);
        });

        const query = `INSERT IGNORE INTO vouchers (package_id, code, comment, package_ref, admin_id) VALUES ${placeholder}`;
        const [result] = await db.query(query, values);

        res.json({ message: `Import complete. Added ${result.affectedRows} new vouchers.` });
    } catch (err) {
        console.error('Import Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to import vouchers: ' + err.message });
    }
});

router.get('/admin/vouchers', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT v.id, v.code, v.comment, v.package_ref, v.is_used, p.name as package_name, v.created_at
            FROM vouchers v
            JOIN packages p ON v.package_id = p.id
            WHERE v.is_used = FALSE AND v.admin_id = ?
            ORDER BY v.created_at DESC
            LIMIT 100
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to fetch vouchers.' });
    }
});


router.post('/admin/sell-voucher', async (req, res) => {
    const { package_id, phone_number } = req.body;

    if (!package_id || !phone_number) {
        return res.status(400).json({ error: 'Package and Phone number required' });
    }

    try {
        // 1. Get Package details
        const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [package_id]);
        if (packages.length === 0) return res.status(404).json({ error: 'Package not found' });
        const pkg = packages[0];

        // 2. Get Available Voucher
        const [vouchers] = await db.query('SELECT * FROM vouchers WHERE package_id = ? AND is_used = FALSE AND admin_id = ? LIMIT 1', [package_id, req.user.id]);
        if (vouchers.length === 0) return res.status(400).json({ error: 'No vouchers available for this package' });
        const voucher = vouchers[0];

        // 3. Mark Voucher Used (Updates counts)
        // Update voucher status (mark as used)
        await db.query('UPDATE vouchers SET is_used = 1, used_by = ?, used_at = NOW() WHERE id = ?', [phone_number, voucher.id]);

        // Create Transaction Record (Method: MANUAL)
        // This ensures the sale is logged for history, but marked differently for stats.
        const txRef = 'MAN-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        await db.query(`
            INSERT INTO transactions 
            (transaction_ref, phone_number, amount, package_id, status, admin_id, payment_method) 
            VALUES (?, ?, ?, ?, 'success', ?, 'manual')
        `, [txRef, phone_number, pkg.price, package_id, req.user.id]);

        // Send SMS
        const message = `Voucher Purchase Successful. Code: ${voucher.code}. Package: ${pkg.name}. Valid for ${pkg.validity_hours} hours.`;
        await sendSMS(phone_number, message, req.user.id);

        res.json({ message: 'Voucher sent successfully', code: voucher.code });

    } catch (err) {
        console.error('Sell Voucher Error:', err);
        res.status(500).json({ error: 'Failed to sell voucher' });
    }
});

router.delete('/admin/vouchers', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.query(`DELETE FROM vouchers WHERE id IN (${placeholders}) AND admin_id = ?`, [...ids, req.user.id]);
        res.json({ message: `Deleted ${ids.length} vouchers` });
    } catch (err) {
        console.error('Delete Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to delete vouchers' });
    }
});

// --- Transactions / Payments History ---
router.get('/admin/transactions', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT t.id, t.transaction_ref, t.phone_number, t.amount, t.status, t.payment_method, t.created_at, p.name as package_name
            FROM transactions t
            LEFT JOIN packages p ON t.package_id = p.id
            WHERE t.admin_id = ?
            ORDER BY t.created_at DESC
            LIMIT 500
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Transactions Error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// --- Stats & Logs ---
router.get('/admin/stats', async (req, res) => {
    try {
        // Exclude 'manual' payments from revenue stats
        const [transStats] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as daily_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END), 0) as weekly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as monthly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as yearly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' THEN amount ELSE 0 END), 0) as total_revenue
            FROM transactions
            WHERE admin_id = ?
        `, [req.user.id]);

        const [withdrawStats] = await db.query('SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?', [req.user.id]);

        const totalRevenue = Number(transStats[0].total_revenue);
        const totalWithdrawn = Number(withdrawStats[0].total_withdrawn);
        const netBalance = totalRevenue - totalWithdrawn;

        const [counts] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM packages WHERE admin_id = ?) as packages_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 0 AND admin_id = ?) as vouchers_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 1 AND admin_id = ?) as bought_vouchers_count
        `, [req.user.id, req.user.id, req.user.id]);

        const [graphData] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%a') as day_name, SUM(amount) as total
            FROM transactions 
            WHERE status = 'success' AND payment_method != 'manual' AND created_at >= DATE(NOW()) - INTERVAL 7 DAY AND admin_id = ?
            GROUP BY day_name
            ORDER BY created_at
        `, [req.user.id]);

        res.json({
            finance: { ...transStats[0], total_revenue: netBalance },
            counts: counts[0],
            graph: graphData
        });
    } catch (err) {
        console.error('Stats Error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// SMS Logs
router.get('/admin/sms-logs', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sms_logs WHERE admin_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Admin SMS Balance (Inferred from logs)
router.get('/admin/sms-balance', async (req, res) => {
    try {
        // Fetch the latest successful SMS log to find the remaining balance
        const [logs] = await db.query('SELECT response FROM sms_logs WHERE status = "success" AND admin_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id]);

        if (logs.length > 0) {
            try {
                const data = JSON.parse(logs[0].response);
                // Relworx response structure: { success: true, data: { remaining_balance: 405, ... } }
                // or { remaining_balance: ... } depending on version. 
                // Based on logs seen: data.data.remaining_balance
                const balance = data.data?.remaining_balance ?? 0;
                return res.json({ balance });
            } catch (parseErr) {
                console.warn('Failed to parse SMS log response:', parseErr);
            }
        }

        res.json({ balance: 0 });
    } catch (err) {
        console.error('SMS Balance Error:', err);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

module.exports = router;
