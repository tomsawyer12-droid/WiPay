const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5001


    ;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Redirect root to dashboard
app.get('/', (req, res, next) => {
    // If it's a browser request (accepts html), redirect. 
    // Otherwise let express.static handle it (though usually root IS browser)
    res.redirect('/dashboard.html');
});

app.use(express.static('.')); // Serve static files (index.html, style.css)

// --- Database Connection ---
const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root', // Adjust if you have a different user
    password: '', // Adjust if you have a password
    database: 'wipay',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- Payment Config ---
// --- Payment Config ---
const RELWORX_API_URL = 'https://payments.relworx.com/api/mobile-money/request-payment';
const RELWORX_SEND_PAYMENT_URL = 'https://payments.relworx.com/api/mobile-money/send-payment';
const RELWORX_API_KEY = process.env.RELWORX_API_KEY;
const RELWORX_ACCOUNT_NO = process.env.RELWORX_ACCOUNT_NO;

// --- In-Memory Store ---
// format: { phoneNumber: { expiry: timestamp, token: string } }
const sessionStore = new Map();

// --- Mock Data Removed (Using DB) ---

// --- SMS Config ---
const UGSMS_API_URL = 'https://ugsms.com/v1/sms/send';
const UGSMS_USERNAME = process.env.UGSMS_USERNAME;
const UGSMS_PASSWORD = process.env.UGSMS_PASSWORD;

// --- Helper Functions (Simulations & Utils) ---

async function sendSMS(phoneNumber, message) {
    let status = 'pending';
    let apiResponse = null;

    if (!UGSMS_USERNAME || !UGSMS_PASSWORD) {
        console.warn('[SMS] Credentials missing. Skipping SMS:', { phoneNumber, message });
        status = 'skipped_no_creds';
    } else {
        try {
            let cleanPhone = phoneNumber.replace('+', '');
            const payload = {
                username: UGSMS_USERNAME,
                password: UGSMS_PASSWORD,
                numbers: cleanPhone,
                message_body: message
            };

            const response = await fetch(UGSMS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            apiResponse = JSON.stringify(result);
            status = response.ok ? 'success' : 'failed';

            console.log('[SMS] Response:', result);
        } catch (err) {
            console.error('[SMS] Error sending message:', err);
            status = 'error';
            apiResponse = JSON.stringify({ error: err.message });
        }
    }

    // Log to DB
    try {
        await db.query(
            'INSERT INTO sms_logs (phone_number, message, status, response) VALUES (?, ?, ?, ?)',
            [phoneNumber, message, status, apiResponse]
        );
    } catch (dbErr) {
        console.error('[SMS] Failed to log to DB:', dbErr);
    }

    return status === 'success';
}

function initiatePayment(packageId, phoneNumber) {
    // Simulate a successful payment request ID
    return `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function grantAccess(phoneNumber, durationHours) {
    console.log(`[GATEWAY] Granting access to ${phoneNumber} for ${durationHours} hours.`);
    // In a real system, this would make an API call to the router/firewall
    return true;
}

// --- API Endpoints ---

// 1. Get Packages from DB
app.get('/api/packages', async (req, res) => {
    try {
        // Fetch packages that have at least one voucher available
        // Group by all selected columns to ensure compatibility with ONLY_FULL_GROUP_BY
        const [rows] = await db.query(`
            SELECT p.id, p.name, p.price, p.validity_hours AS duration_hours
            FROM packages p
            JOIN vouchers v ON p.id = v.package_id
            GROUP BY p.id, p.name, p.price, p.validity_hours
            HAVING COUNT(v.id) > 0
        `);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// 2. Initiate Purchase
app.post('/api/purchase', async (req, res) => {
    const { phone_number, package_id } = req.body;

    if (!phone_number || !package_id) {
        return res.status(400).json({ error: 'Phone number and package ID are required.' });
    }

    try {
        // Check if package exists in DB
        const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [package_id]);
        if (packages.length === 0) {
            return res.status(404).json({ error: 'Package not found.' });
        }
        const selectedPackage = packages[0];

        // Check for available vouchers
        const [vouchers] = await db.query('SELECT count(*) as count FROM vouchers WHERE package_id = ?', [package_id]);
        if (vouchers[0].count === 0) {
            return res.status(400).json({ error: 'No vouchers available for this package.' });
        }

        // Generate Reference
        const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Helper to format phone number to +256...
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '+256' + formattedPhone.slice(1);
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        console.log(`[GATEWAY] Initiating payment for ${formattedPhone}, Amount: ${selectedPackage.price} UGX`);

        // Insert Pending Transaction
        await db.query(`
            INSERT INTO transactions (transaction_ref, phone_number, amount, package_id, status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [reference, formattedPhone, selectedPackage.price, package_id]);

        // Call Relworx API
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
                amount: Number(selectedPackage.price),
                description: `Payment for ${selectedPackage.name}`
            })
        });

        const paymentData = await response.json();
        console.log('[GATEWAY] Response:', paymentData);

        if (response.ok) {
            res.json({
                message: 'Payment request sent to your phone. Please check for the PIN prompt.',
                transaction_id: reference,
                status: 'pending',
                gateway_response: paymentData
            });
        } else {
            console.error('[GATEWAY] Error:', paymentData);
            // Mark as failed in DB
            await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [reference]);
            res.status(400).json({
                error: 'Payment gateway failed',
                details: paymentData
            });
        }

    } catch (err) {
        console.error('Purchase error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Payment Webhook
app.post('/api/payment-webhook', async (req, res) => {
    const { transaction_id, phone_number, package_id, status } = req.body;

    console.log(`[WEBHOOK] Received update for ${transaction_id}: ${status}`);

    if (status === 'SUCCESS') {
        try {
            // Update Transaction Status
            await db.query('UPDATE transactions SET status = "success" WHERE transaction_ref = ?', [transaction_id]);

            const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [package_id]);
            if (packages.length > 0) {
                const selectedPackage = packages[0];
                const durationMs = selectedPackage.validity_hours * 60 * 60 * 1000;
                const expiry = Date.now() + durationMs;

                // Grant Logic (kept for backward compat or immediate login)
                sessionStore.set(phone_number, {
                    expiry: expiry,
                    // netBalance: netBalance // REMOVED: netBalance is not defined in this scope
                });
                grantAccess(phone_number, selectedPackage.validity_hours);

                // --- VOUCHER ASSIGNMENT LOGIC ---
                // 1. Select one unused voucher
                const [availableVouchers] = await db.query(
                    'SELECT * FROM vouchers WHERE package_id = ? AND is_used = FALSE LIMIT 1',
                    [package_id]
                );

                if (availableVouchers.length > 0) {
                    const voucher = availableVouchers[0];

                    // 2. Mark as used
                    await db.query('UPDATE vouchers SET is_used = TRUE WHERE id = ?', [voucher.id]);

                    // 3. Send SMS
                    const message = `Payment Received! Your voucher code for ${selectedPackage.name} is: ${voucher.code}. Thank you for using Garuga Spot.`;

                    // Don't await this if you want the webhook to respond fast, but usually it's fine
                    sendSMS(phone_number, message).then(success => {
                        console.log(`[VOUCHER] SMS sent to ${phone_number}: ${success ? 'OK' : 'FAIL'}`);
                    });

                    console.log(`[VOUCHER] Assigned ${voucher.code} to ${phone_number}`);
                } else {
                    console.error(`[CRITICAL] No vouchers available for package ${package_id} after successful payment!`);
                    // TO DO: Send admin alert
                }

                return res.status(200).json({ status: 'ok', message: 'Access granted' });
            }
        } catch (err) {
            console.error('Webhook error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    } else {
        await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [transaction_id]);
    }

    res.status(200).json({ status: 'ignored', message: 'Payment failed or invalid' });
});

// --- ADMIN CREATION API ---

// Create Category
app.post('/api/admin/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const [result] = await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
        res.json({ id: result.insertId, name, message: 'Category created' });
    } catch (err) {
        console.error('Create Category Error:', err);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Get Categories
app.get('/api/admin/categories', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM categories ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create Package
app.post('/api/admin/packages', async (req, res) => {
    const { name, price, validity_hours, category_id, data_limit_mb } = req.body;

    // Basic validation
    if (!name || !price || !validity_hours || !category_id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await db.query(`
            INSERT INTO packages (category_id, name, price, validity_hours, data_limit_mb, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [category_id, name, price, validity_hours, data_limit_mb || 0]); // Default 0MB limit

        res.json({ message: 'Package created successfully' });
    } catch (err) {
        console.error('Create Package Error:', err);
        res.status(500).json({ error: 'Failed to create package' });
    }
});

// Get Packages (Admin - All packages with Category Name)
app.get('/api/admin/packages', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM packages p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Packages Error:', err);
        res.status(500).json({ error: 'Failed to fetch packages' });
    }
});

// --- VOUCHER MANAGEMENT ---
// Import Vouchers (CSV/JSON Bulk)
app.post('/api/admin/vouchers/import', async (req, res) => {
    const { package_id, vouchers } = req.body; // Changed from 'codes' to 'vouchers' generic name, but keeping compat if possible

    // Support legacy 'codes' array of strings OR new 'vouchers' array of objects {code, comment}
    const inputList = req.body.vouchers || req.body.codes;

    if (!package_id || !inputList || !Array.isArray(inputList) || inputList.length === 0) {
        return res.status(400).json({ error: 'Invalid input. Access package_id and array of vouchers.' });
    }

    try {
        // Bulk insert
        const placeholder = inputList.map(() => '(?, ?, ?, ?)').join(', ');
        const values = [];

        inputList.forEach(item => {
            // item can be string (old way) or object {code, comment, package_ref}
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
            values.push(package_id, code, comment, package_ref);
        });

        const query = `INSERT IGNORE INTO vouchers (package_id, code, comment, package_ref) VALUES ${placeholder}`;
        const [result] = await db.query(query, values);

        res.json({ message: `Import complete. Added ${result.affectedRows} new vouchers (skipped ${inputList.length - result.affectedRows} duplicates).` });
    } catch (err) {
        console.error('Import Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to import vouchers: ' + err.message });
    }
});

// Get Vouchers (Admin)
app.get('/api/admin/vouchers', async (req, res) => {
    try {
        // Get available vouchers with package name, newest first
        const [rows] = await db.query(`
            SELECT v.id, v.code, v.comment, v.package_ref, v.is_used, p.name as package_name, v.created_at
            FROM vouchers v
            JOIN packages p ON v.package_id = p.id
            WHERE v.is_used = FALSE
            ORDER BY v.created_at DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to fetch vouchers.' });
    }
});

// Bulk Delete Vouchers
app.delete('/api/admin/vouchers', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        await db.query(`DELETE FROM vouchers WHERE id IN (${placeholders})`, ids);
        res.json({ message: `Deleted ${ids.length} vouchers` });
    } catch (err) {
        console.error('Delete Vouchers Error:', err);
        res.status(500).json({ error: 'Failed to delete vouchers' });
    }
});


async function getSMSBalance() {
    if (!UGSMS_USERNAME || !UGSMS_PASSWORD) return null;

    try {
        const params = new URLSearchParams({
            username: UGSMS_USERNAME,
            password: UGSMS_PASSWORD
        });

        const url = `https://ugsms.com/v1/balance?${params.toString()}`;
        // console.log('[SMS Balance] Fetching:', url.replace(UGSMS_PASSWORD, '***'));

        const response = await fetch(url, { method: 'GET' });

        if (response.ok) {
            const data = await response.json();
            return data.balance;
        }
    } catch (e) {
        // console.error('[SMS Balance] Error:', e.message);
    }
    return null; // Fallback to null (N/A)
}

// --- ADMIN STATS ENDPOINT ---
app.get('/api/admin/stats', async (req, res) => {
    try {
        // 0. SMS Balance
        const smsBalance = await getSMSBalance();

        // 1. Transaction Stats (Daily, Weekly, Monthly, Yearly)
        const [transStats] = await db.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'success' AND DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) as daily_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END), 0) as weekly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as monthly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' AND YEAR(created_at) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) as yearly_revenue,
                COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_revenue,
                COUNT(CASE WHEN date(created_at) = CURDATE() THEN 1 END) as daily_trans_count
            FROM transactions
        `);

        // 1.5 Calculate Net Balance (Revenue - Withdrawals)
        const [withdrawStats] = await db.query('SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals');
        const totalRevenue = Number(transStats[0].total_revenue);
        const totalWithdrawn = Number(withdrawStats[0].total_withdrawn);
        const netBalance = totalRevenue - totalWithdrawn;

        // 2. Count Stats
        const [counts] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM categories) as categories_count,
                (SELECT COUNT(*) FROM packages) as packages_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 0) as vouchers_count,
                (SELECT COUNT(*) FROM vouchers WHERE is_used = 1) as bought_vouchers_count,
                (SELECT COUNT(*) FROM transactions WHERE status = 'success') as payments_count
        `);
        // 3. Weekly Transaction Graph Data (Last 7 Days)
        const [graphData] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%a') as day_name, SUM(amount) as total
            FROM transactions 
            WHERE status = 'success' AND created_at >= DATE(NOW()) - INTERVAL 7 DAY
            GROUP BY day_name
            ORDER BY created_at
        `);

        res.json({
            sms_balance: smsBalance,
            finance: {
                ...transStats[0],
                total_revenue: netBalance // Override with Net Balance
            },
            counts: counts[0],
            graph: graphData
        });
    } catch (err) {
        console.error('Stats Error:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// 4. Connect / Check Status
app.post('/api/connect', (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number) {
        return res.status(400).json({ error: 'Phone number required' });
    }

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

// Debug endpoint to list sessions (optional)
// Debug endpoint to list sessions (optional)
app.get('/api/debug/sessions', (req, res) => {
    const sessions = {};
    sessionStore.forEach((value, key) => {
        sessions[key] = value;
    });
    res.json(sessions);
});

// --- SMS LOGS API ---
app.get('/api/admin/sms-logs', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 100');
        res.json(rows);
    } catch (err) {
        console.error('Fetch SMS Logs Error:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});
// --- WITHDRAWAL API ---
app.post('/api/admin/withdraw', async (req, res) => {
    const { amount, phone_number, description } = req.body;

    if (!amount || !phone_number) {
        return res.status(400).json({ error: 'Amount and Phone Number are required' });
    }

    if (!RELWORX_API_KEY || !RELWORX_ACCOUNT_NO) {
        return res.status(500).json({ error: 'Server configuration missing Relworx credentials' });
    }

    try {
        // --- 1. Enforce Balance Check ---
        // Calculate current Net Balance
        const [transStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_revenue FROM transactions WHERE status = 'success'");
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals");

        const currentBalance = Number(transStats[0].total_revenue) - Number(withdrawStats[0].total_withdrawn);

        if (Number(amount) > currentBalance) {
            return res.status(400).json({
                error: 'Insufficient funds',
                message: `You cannot withdraw ${Number(amount).toLocaleString()} UGX. Available balance is ${currentBalance.toLocaleString()} UGX.`
            });
        }

        // --- 2. Proceed with Relworx API ---
        const reference = `W-${Date.now()}-${Math.floor(Math.random() * 10000)}`; // Shorter unique ref

        const payload = {
            account_no: RELWORX_ACCOUNT_NO,
            reference: reference,
            msisdn: phone_number, // User provided, e.g. +256...
            currency: 'UGX',
            amount: Number(amount),
            description: description || 'Admin Withdrawal'
        };

        console.log('[Withdraw] Initiating:', payload);

        const response = await fetch(RELWORX_SEND_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.relworx.v2',
                'Authorization': `Bearer ${RELWORX_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[Withdraw] Response:', response.status, result);

        if (response.ok) {
            // Save withdrawal to DB for balance tracking
            await db.query(
                'INSERT INTO withdrawals (phone_number, amount, reference, description) VALUES (?, ?, ?, ?)',
                [phone_number, amount, reference, description]
            );

            res.json({ success: true, data: result });
        } else {
            res.status(response.status).json({ success: false, error: result.message || 'Withdrawal failed', details: result });
        }
    } catch (err) {
        console.error('[Withdraw] Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- SELL VOUCHER API ---
app.post('/api/admin/sell-voucher', async (req, res) => {
    const { package_id, phone_number } = req.body;

    if (!package_id || !phone_number) {
        return res.status(400).json({ error: 'Package ID and Phone Number are required' });
    }

    try {
        // 1. Find an available voucher for this package
        // Assumption: 'is_used' column exists based on typical schema, if not check schema output.
        // Based on typical schema: status='active' or is_used=0
        // Let's assume is_used = 0 
        const [vouchers] = await db.query(
            'SELECT * FROM vouchers WHERE package_id = ? AND is_used = 0 LIMIT 1',
            [package_id]
        );

        if (vouchers.length === 0) {
            return res.status(404).json({ error: 'No available vouchers for this package.' });
        }

        const voucher = vouchers[0];

        // 2. Mark as used (User requested: "mark it as used" instead of delete)
        // The count will still decrease because we filter by is_used=0 in stats.
        await db.query('UPDATE vouchers SET is_used = 1, used_at = NOW() WHERE id = ?', [voucher.id]);

        // 3. Send SMS
        const message = `Your WiPay Voucher Code is: ${voucher.code}. Enjoy!`;
        const smsSuccess = await sendSMS(phone_number, message);

        if (smsSuccess) {
            res.json({ success: true, message: 'Voucher sent successfully', code: voucher.code });
        } else {
            // Rollback usage if SMS failed? Or just returning warning.
            // For now, keep it marked used to avoid double spend, admin can check logs.
            res.status(200).json({ success: true, message: 'Voucher assigned but SMS failed. Check logs.', code: voucher.code, sms_failed: true });
        }

    } catch (err) {
        console.error('[Sell Voucher] Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});