const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

// Configure Multer for temp uploads
const upload = multer({ dest: 'uploads/' });

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
router.post('/admin/vouchers/import', upload.single('file'), async (req, res) => {
    const { package_id } = req.body;

    console.log('DEBUG IMPORT RE-TRY:', {
        body: req.body,
        file: req.file ? req.file.path : 'MISSING',
        content_type: req.headers['content-type'],
        all_headers: req.headers
    });

    if (!req.file || !package_id) {
        return res.status(400).json({ error: 'File and package_id are required' });
    }

    const results = [];
    const BATCH_SIZE = 500;
    let totalInserted = 0;

    const processBatch = async (batch) => {
        if (batch.length === 0) return;
        const placeholder = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const values = [];
        batch.forEach(row => {
            // CSV columns: code, comment (optional), package_ref (optional)
            // Or just single column 'code'
            const code = row.code || row[0]; // adaptive for header/no-header
            const comment = row.comment || null;
            const pkgRef = row.package_ref || null;
            values.push(package_id, code, comment, pkgRef);
        });

        // Insert ignoring duplicates
        const query = `INSERT IGNORE INTO vouchers (package_id, code, comment, package_ref, admin_id) VALUES ${placeholder.replace(/\(.*\)/g, `(?, ?, ?, ?, ${req.user.id})`)}`;

        // Fix: The placeholder replacement above is tricky with adaptive values. 
        // Let's use strict mapping to ensure admin_id is correct.
        const strictValues = [];
        batch.forEach(row => {
            const code = row.code || (Object.values(row)[0]); // First column as code
            const comment = row.comment || null;
            const pkgRef = row.package_ref || null;
            strictValues.push(package_id, code, comment, pkgRef, req.user.id);
        });
        const strictPlaceholder = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');

        const [result] = await db.query(`INSERT IGNORE INTO vouchers (package_id, code, comment, package_ref, admin_id) VALUES ${strictPlaceholder}`, strictValues);
        totalInserted += result.affectedRows;
    };

    try {
        const stream = fs.createReadStream(req.file.path)
            .pipe(csv())
            .on('data', (data) => {
                results.push(data);
                if (results.length >= BATCH_SIZE) {
                    stream.pause(); // Pause reading while writing to DB
                    const batch = results.splice(0, BATCH_SIZE);
                    processBatch(batch)
                        .then(() => stream.resume())
                        .catch(err => {
                            console.error('Batch Insert Error:', err);
                            stream.destroy(err);
                        });
                }
            })
            .on('end', async () => {
                // Process remaining
                if (results.length > 0) {
                    await processBatch(results);
                }
                // Cleanup file
                fs.unlink(req.file.path, (err) => { if (err) console.error('Cleanup Error:', err); });
                res.json({ message: `Import complete. Processed ${totalInserted} vouchers.` });
            })
            .on('error', (err) => {
                console.error('CSV Stream Error:', err);
                res.status(500).json({ error: 'Failed to process CSV file' });
            });

    } catch (err) {
        console.error('Import Setup Error:', err);
        res.status(500).json({ error: 'Server error during import setup' });
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


// --- SMS & Finance ---
const RELWORX_API_URL = 'https://payments.relworx.com/api/mobile-money/request-payment';
const RELWORX_API_KEY = process.env.RELWORX_API_KEY;
const RELWORX_ACCOUNT_NO = process.env.RELWORX_ACCOUNT_NO;

router.get('/admin/sms-balance', async (req, res) => {
    try {
        // Calculate balance: Sum of SUCCESS deposits - Sum of usage
        // Note: Usage rows (type='usage') are naturally negative in amount, so straight SUM works 
        // IF we filter properly. Usage doesn't have a status usually, or defaults to success.
        // Let's assume usage is always valid. Deposits must be 'success'.
        const [rows] = await db.query(`
            SELECT SUM(amount) as balance 
            FROM sms_fees 
            WHERE admin_id = ? AND (status = 'success' OR status IS NULL)
        `, [req.user.id]);

        const balance = rows[0].balance || 0;
        res.json({ balance: Number(balance) });
    } catch (err) {
        console.error('Fetch SMS Balance Error:', err);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

router.post('/admin/buy-sms', async (req, res) => {
    const { amount, phone_number } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    if (!phone_number) return res.status(400).json({ error: 'Phone number is required' });

    try {
        // Format Phone
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.slice(1);
        else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

        const reference = `SMS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Helper log
        console.log(`[SMS-TOPUP] Initiating for ${formattedPhone}, Amount: ${amount}, Ref: ${reference}`);

        // 1. Insert Pending Record
        await db.query('INSERT INTO sms_fees (admin_id, amount, type, description, status, reference) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, amount, 'deposit', `Pending Top up via ${formattedPhone}`, 'pending', reference]);

        // 2. Call Relworx
        const response = await fetch(RELWORX_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.relworx.v2',
                'Authorization': `Bearer ${RELWORX_API_KEY}`
            },
            body: JSON.stringify({
                account_no: RELWORX_ACCOUNT_NO,
                reference: reference,
                msisdn: formattedPhone,
                currency: 'UGX',
                amount: Number(amount),
                description: `SMS Topup`
            })
        });

        const paymentData = await response.json();

        if (response.ok) {
            res.json({
                message: 'Payment request initiated. Please check your phone.',
                status: 'pending',
                reference: reference
            });
        } else {
            console.error('[SMS-TOPUP] Gateway Failed:', paymentData);
            await db.query('UPDATE sms_fees SET status = "failed" WHERE reference = ?', [reference]);
            res.status(400).json({ error: 'Payment gateway failed', details: paymentData });
        }
    } catch (err) {
        console.error('Buy SMS Error:', err);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
});

router.get('/admin/sms-status/:reference', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT status FROM sms_fees WHERE reference = ? AND admin_id = ?', [req.params.reference, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        res.json({ status: rows[0].status });
    } catch (err) {
        console.error('Check SMS Status Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/admin/sell-voucher', async (req, res) => {
    const { package_id, phone_number } = req.body;
    const SMS_COST = 35;

    if (!package_id || !phone_number) {
        return res.status(400).json({ error: 'Package and Phone number required' });
    }

    const connection = await db.getConnection(); // Use transaction

    try {
        await connection.beginTransaction();

        // 0. Check SMS Balance
        const [balRows] = await connection.query('SELECT SUM(amount) as balance FROM sms_fees WHERE admin_id = ?', [req.user.id]);
        const balance = Number(balRows[0].balance || 0);

        if (balance < SMS_COST) {
            await connection.rollback();
            return res.status(400).json({ error: `Insufficient SMS balance. Cost: ${SMS_COST}, Balance: ${balance}` });
        }

        // 1. Get Package details
        const [packages] = await connection.query('SELECT * FROM packages WHERE id = ?', [package_id]);
        if (packages.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Package not found' });
        }
        const pkg = packages[0];

        // 2. Get Available Voucher
        const [vouchers] = await connection.query('SELECT * FROM vouchers WHERE package_id = ? AND is_used = FALSE AND admin_id = ? LIMIT 1 FOR UPDATE', [package_id, req.user.id]);
        if (vouchers.length === 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'No vouchers available for this package' });
        }
        const voucher = vouchers[0];

        // 3. Mark Voucher Used
        await connection.query('UPDATE vouchers SET is_used = 1, used_by = ?, used_at = NOW() WHERE id = ?', [phone_number, voucher.id]);

        // 4. Deduct SMS Cost
        await connection.query('INSERT INTO sms_fees (admin_id, amount, type, description) VALUES (?, ?, ?, ?)',
            [req.user.id, -SMS_COST, 'usage', `Voucher Sale: ${voucher.code}`]);

        // 5. Send SMS (Mock or Real)
        const message = `Code: ${voucher.code}. Package: ${pkg.name}. Valid: ${pkg.validity_hours}h.`;
        await sendSMS(phone_number, message);

        // 6. Record SMS Log (if table exists, otherwise skip or ensure it does)
        // Assuming sms_logs table exists from previous context or generic logging
        try {
            await connection.query('INSERT INTO sms_logs (recipient, message, status, admin_id) VALUES (?, ?, ?, ?)',
                [phone_number, message, 'sent', req.user.id]);
        } catch (logErr) {
            console.warn('SMS Log skipped:', logErr.message);
        }

        await connection.commit();
        res.json({ message: 'Voucher sold and sent via SMS', voucher: voucher.code });

    } catch (err) {
        await connection.rollback();
        console.error('Sell Voucher Error:', err);
        res.status(500).json({ error: 'Transaction failed' });
    } finally {
        connection.release();
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
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND DATE(created_at) = CURDATE() THEN (amount - fee) ELSE 0 END), 0) as daily_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN (amount - fee) ELSE 0 END), 0) as weekly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN (amount - fee) ELSE 0 END), 0) as monthly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' AND YEAR(created_at) = YEAR(CURDATE()) THEN (amount - fee) ELSE 0 END), 0) as yearly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND payment_method != 'manual' THEN (amount - fee) ELSE 0 END), 0) as total_revenue
            FROM transactions
            WHERE admin_id = ?
        `, [req.user.id]);

        const [withdrawStats] = await db.query('SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?', [req.user.id]);

        const totalRevenue = Number(transStats[0].total_revenue);
        const totalWithdrawn = Number(withdrawStats[0].total_withdrawn);
        const netBalance = totalRevenue - totalWithdrawn;

        const [counts] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM categories WHERE admin_id = ?) as categories_count,
                (SELECT COUNT(*) FROM packages WHERE admin_id = ?) as packages_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 0 AND admin_id = ?) as vouchers_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 1 AND admin_id = ?) as bought_vouchers_count,
                (SELECT COUNT(*) FROM transactions WHERE admin_id = ?) as transactions_count
        `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

        const [graphData] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%a') as day_name, SUM(amount) as total
            FROM transactions 
            WHERE status = 'success' AND payment_method != 'manual' AND created_at >= DATE(NOW()) - INTERVAL 7 DAY AND admin_id = ?
            GROUP BY day_name
            ORDER BY created_at
        `, [req.user.id]);

        const [adminInfo] = await db.query('SELECT billing_type, subscription_expiry FROM admins WHERE id = ?', [req.user.id]);

        res.json({
            finance: { ...transStats[0], total_revenue: netBalance },
            counts: counts[0],
            graph: graphData,
            subscription: adminInfo[0] // Return subscription info
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
