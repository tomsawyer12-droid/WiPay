const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms'); // Not used here directly but good to have if we expand

// Middleware applied to all routes in this file
router.use(authenticateToken);

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

// --- Stats & Logs ---
router.get('/admin/stats', async (req, res) => {
    try {
        const [transStats] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'success' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as daily_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END), 0) as weekly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as monthly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as yearly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_revenue
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
            WHERE status = 'success' AND created_at >= DATE(NOW()) - INTERVAL 7 DAY AND admin_id = ?
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

router.get('/admin/sms-logs', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sms_logs WHERE admin_id = ? ORDER BY created_at DESC LIMIT 100', [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;
