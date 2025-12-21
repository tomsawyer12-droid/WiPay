const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

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

router.delete('/admin/categories/:id', async (req, res) => {
    const categoryId = req.params.id;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Verify Category Ownership
        const [cat] = await connection.query('SELECT id FROM categories WHERE id = ? AND admin_id = ?', [categoryId, req.user.id]);
        if (cat.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Category not found' });
        }

        // 2. Get Package IDs linked to this category
        const [packages] = await connection.query('SELECT id FROM packages WHERE category_id = ?', [categoryId]);
        const packageIds = packages.map(p => p.id);

        if (packageIds.length > 0) {
            // 3. Delete Vouchers linked to these packages
            const placeholders = packageIds.map(() => '?').join(',');
            await connection.query(`DELETE FROM vouchers WHERE package_id IN (${placeholders})`, packageIds);

            // 4. Delete Packages
            await connection.query('DELETE FROM packages WHERE category_id = ?', [categoryId]);
        }

        // 5. Delete Category
        await connection.query('DELETE FROM categories WHERE id = ?', [categoryId]);

        await connection.commit();
        res.json({ message: 'Category and all related data deleted successfully' });

    } catch (err) {
        await connection.rollback();
        console.error('Delete Category Error:', err);
        res.status(500).json({ error: 'Failed to delete category' });
    } finally {
        connection.release();
    }
});

// --- Packages ---
router.post('/admin/packages', async (req, res) => {
    const { name, price, validity_hours, category_id, data_limit_mb } = req.body;

    if (!name || !price || !category_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await db.query(`
            INSERT INTO packages (category_id, name, price, validity_hours, data_limit_mb, created_at, admin_id)
            VALUES (?, ?, ?, ?, ?, NOW(), ?)
        `, [category_id, name, price, validity_hours || 0, data_limit_mb || 0, req.user.id]);
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
            WHERE admin_id = ? 
            AND (status = 'success' OR status IS NULL)
            AND type != 'subscription'
        `, [req.user.id]);

        const balance = rows[0].balance || 0;
        res.json({ balance: Math.max(0, Number(balance)) });
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
        console.log(`[SMS-TOPUP] Init Response (${response.status}):`, JSON.stringify(paymentData));

        if (response.ok) {
            res.json({
                message: 'Payment request initiated. Please check your phone.',
                status: 'pending',
                reference: reference
            });
        } else {
            console.error(`[SMS-TOPUP] Gateway Failed:`, paymentData);
            await db.query('UPDATE sms_fees SET status = "failed" WHERE reference = ?', [reference]);
            const errorMsg = paymentData.message || 'Unknown error';
            res.status(400).json({ error: `Payment gateway failed: ${errorMsg}`, details: paymentData });
        }
    } catch (err) {
        console.error('Buy SMS Error:', err);
        res.status(500).json({ error: 'Failed to process purchase' });
    }
});

router.get('/admin/sms-status/:reference', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT status, amount FROM sms_fees WHERE reference = ? AND admin_id = ?', [req.params.reference, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        const localStatus = rows[0].status;

        // If success or failed, return immediately
        if (localStatus === 'success' || localStatus === 'failed') {
            return res.json({ status: localStatus });
        }

        // --- Active Backup Poll (For Localhost/Backup) ---
        const checkUrl = `https://payments.relworx.com/api/mobile-money/check-request-status?account_no=${RELWORX_ACCOUNT_NO}&reference=${req.params.reference}&internal_reference=${req.params.reference}`;

        try {
            const gwRes = await fetch(checkUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.relworx.v2',
                    'Authorization': `Bearer ${RELWORX_API_KEY}`
                }
            });

            if (!gwRes.ok) return res.json({ status: 'pending' }); // Keep waiting

            const gwData = await gwRes.json();
            const gwStatus = (gwData.status || '').toUpperCase();
            const itemStatus = (gwData.item_status || '').toUpperCase();

            // Check Success
            if (gwStatus === 'SUCCESS' || itemStatus === 'SUCCESS') {
                await db.query('UPDATE sms_fees SET status = "success" WHERE reference = ?', [req.params.reference]);
                return res.json({ status: 'success' });
            }
            // Check Failure
            else if (gwStatus === 'FAILED' || itemStatus === 'FAILED') {
                await db.query('UPDATE sms_fees SET status = "failed" WHERE reference = ?', [req.params.reference]);
                return res.json({ status: 'failed' });
            }

            return res.json({ status: 'pending' });

        } catch (fetchErr) {
            console.error('[SMS-POLL] Fetch Error:', fetchErr);
            return res.json({ status: 'pending' });
        }

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

        const adminId = req.user.id;
        const totalRevenue = Number(transStats[0].total_revenue);
        const totalWithdrawn = Number(withdrawStats[0].total_withdrawn);
        const netBalance = totalRevenue - totalWithdrawn;

        // 2. Counts
        const [catCount] = await db.query('SELECT count(*) as count FROM categories WHERE admin_id = ?', [adminId]);
        const [pkgCount] = await db.query('SELECT count(*) as count FROM packages WHERE admin_id = ?', [adminId]);
        const [voucherCount] = await db.query('SELECT count(*) as count FROM vouchers WHERE admin_id = ? AND is_used = 0', [adminId]);
        const [boughtCount] = await db.query('SELECT count(*) as count FROM vouchers WHERE admin_id = ? AND is_used = 1', [adminId]);
        const [paymentCount] = await db.query('SELECT count(*) as count FROM transactions WHERE admin_id = ? AND status = "success"', [adminId]);

        // 3. Subscription Status
        const [adminInfo] = await db.query('SELECT subscription_expiry FROM admins WHERE id = ?', [adminId]);

        res.json({
            finance: {
                ...transStats[0],
                total_revenue: netBalance
            },
            counts: {
                categories_count: catCount[0].count,
                packages_count: pkgCount[0].count,
                vouchers_count: voucherCount[0].count,
                bought_vouchers_count: boughtCount[0].count,
                payments_count: paymentCount[0].count
            },
            subscription: {
                expiry: adminInfo[0].subscription_expiry
            }
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


// --- Subscription Renewal ---
router.post('/admin/renew-subscription', async (req, res) => {
    const { phone_number, months } = req.body;

    if (!phone_number) return res.status(400).json({ error: 'Phone number is required' });
    if (!months || months < 1) return res.status(400).json({ error: 'Invalid duration' });

    // Enforce Pricing Server-Side
    const MONTHLY_FEE = 20000;
    const amount = months * MONTHLY_FEE;

    try {
        // Format Phone
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.slice(1);
        else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

        const reference = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        console.log(`[SUBSCRIPTION] Initiating for ${formattedPhone}, Months: ${months}, Amount: ${amount}, Ref: ${reference}`);

        // 1. Insert Pending Record in NEW table
        await db.query(`
            INSERT INTO admin_subscriptions 
            (admin_id, amount, months, phone_number, status, reference) 
            VALUES (?, ?, ?, ?, 'pending', ?)
        `, [req.user.id, amount, months, formattedPhone, reference]);

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
                description: `Subscription Renewal (${months} months)`
            })
        });

        const paymentData = await response.json();
        console.log(`[SUBSCRIPTION] Gateway Response:`, JSON.stringify(paymentData));

        if (response.ok) {
            res.json({
                message: 'Payment request initiated.',
                status: 'pending',
                reference: reference
            });
        } else {
            console.error(`[SUBSCRIPTION] Gateway Failed:`, paymentData);
            await db.query('UPDATE admin_subscriptions SET status = "failed" WHERE reference = ?', [reference]);
            res.status(400).json({ error: 'Payment gateway failed', details: paymentData });
        }
    } catch (err) {
        console.error('Subscription Error:', err);
        res.status(500).json({ error: 'Failed to process subscription' });
    }
});

router.get('/admin/subscription-status/:reference', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT status, months FROM admin_subscriptions WHERE reference = ? AND admin_id = ?', [req.params.reference, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        const localStatus = rows[0].status;
        const monthsToAdd = rows[0].months;

        if (localStatus === 'success' || localStatus === 'failed') {
            return res.json({ status: localStatus });
        }

        // Poll Gateway
        const checkUrl = `https://payments.relworx.com/api/mobile-money/check-request-status?account_no=${RELWORX_ACCOUNT_NO}&reference=${req.params.reference}&internal_reference=${req.params.reference}`;

        console.log(`[SUBSCRIPTION-POLL] Checking: ${req.params.reference}`);

        const gwRes = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.relworx.v2',
                'Authorization': `Bearer ${RELWORX_API_KEY}`
            }
        });

        if (!gwRes.ok) return res.json({ status: 'pending' });

        const gwData = await gwRes.json();
        const gwStatus = (gwData.status || '').toUpperCase();
        const itemStatus = (gwData.item_status || '').toUpperCase();

        if (gwStatus === 'SUCCESS' || itemStatus === 'SUCCESS') {
            console.log(`[SUBSCRIPTION] Confirmed Success: ${req.params.reference}`);

            // Update Transaction Status
            await db.query('UPDATE admin_subscriptions SET status = "success" WHERE reference = ?', [req.params.reference]);

            // Update Admin Expiry
            // We need to fetch current expiry first to add time correctly
            const [adminRows] = await db.query('SELECT subscription_expiry FROM admins WHERE id = ?', [req.user.id]);
            let currentExpiry = new Date(adminRows[0].subscription_expiry);
            const now = new Date();

            // If expired, start from NOW. If active, add to current expiry.
            if (currentExpiry < now) currentExpiry = now;

            currentExpiry.setMonth(currentExpiry.getMonth() + monthsToAdd);

            await db.query('UPDATE admins SET subscription_expiry = ? WHERE id = ?', [currentExpiry, req.user.id]);

            return res.json({ status: 'success' });
        } else if (gwStatus === 'FAILED') {
            await db.query('UPDATE admin_subscriptions SET status = "failed" WHERE reference = ?', [req.params.reference]);
            return res.json({ status: 'failed' });
        }

        res.json({ status: 'pending' });

    } catch (err) {
        console.error('Check Subscription Status Error:', err);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

module.exports = router;
