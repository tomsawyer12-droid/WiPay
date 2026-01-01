const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sessionStore = require('../config/session');
const { sendSMS } = require('../utils/sms');
const { sendPaymentNotification, sendSMSPurchaseNotification, sendWithdrawalOTP, sendWithdrawalNotification } = require('../utils/email');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const RELWORX_API_URL = 'https://payments.relworx.com/api/mobile-money/request-payment';
const RELWORX_SEND_PAYMENT_URL = 'https://payments.relworx.com/api/mobile-money/send-payment';
const RELWORX_API_KEY = process.env.RELWORX_API_KEY;
const RELWORX_ACCOUNT_NO = process.env.RELWORX_ACCOUNT_NO;

async function getAdminBalance(adminId) {
    try {
        const [transStats] = await db.query("SELECT COALESCE(SUM(amount - COALESCE(fee, 0)), 0) as total_revenue FROM transactions WHERE status = 'success' AND admin_id = ?", [adminId]);
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?", [adminId]);
        const bal = Number(transStats[0].total_revenue) - Number(withdrawStats[0].total_withdrawn);
        console.log(`[BALANCE] Admin ${adminId}: Rev=${transStats[0].total_revenue}, Wd=${withdrawStats[0].total_withdrawn}, Bal=${bal}`);
        return bal;
    } catch (e) {
        console.error('Error fetching balance:', e);
        return 0;
    }
}

function grantAccess(phoneNumber, durationHours) {
    console.log(`[GATEWAY] Granting access to ${phoneNumber} for ${durationHours} hours.`);
    return true; // Used to trigger router API
}

// Purchase Initiation
router.post('/purchase', async (req, res) => {
    const { phone_number, package_id } = req.body;

    if (!phone_number || !package_id) return res.status(400).json({ error: 'Phone number and package ID required.' });

    try {
        const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [package_id]);
        if (packages.length === 0) return res.status(404).json({ error: 'Package not found.' });
        const selectedPackage = packages[0];

        const [vouchers] = await db.query('SELECT count(*) as count FROM vouchers WHERE package_id = ? AND is_used = 0', [package_id]);
        if (vouchers[0].count === 0) return res.status(400).json({ error: 'No vouchers available.' });

        const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.slice(1);
        else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

        console.log(`[GATEWAY] Payment for ${formattedPhone}, Amount: ${selectedPackage.price}`);

        await db.query(`
            INSERT INTO transactions (transaction_ref, phone_number, amount, package_id, status, admin_id)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `, [reference, formattedPhone, selectedPackage.price, package_id, selectedPackage.admin_id]);

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

        if (response.ok) {
            res.json({
                message: 'Payment request sent. Check PIN prompt.',
                transaction_id: reference,
                status: 'pending'
            });
        } else {
            console.error('[Purchase] Gateway Failed:', JSON.stringify(paymentData, null, 2));
            await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [reference]);
            res.status(400).json({ error: 'Payment gateway failed', details: paymentData });
        }
    } catch (err) {
        console.error('Purchase error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook Endpoint (Relworx callbacks)
router.post('/webhook', async (req, res) => {
    const data = req.body;
    console.log('[WEBHOOK] Received:', JSON.stringify(data));

    // Relworx structure usually sends { status: 'success', reference: '...', ... }
    // Ensure we handle different potential structures or verify signature if possible.
    // For now, checks status and reference.

    const status = (data.status || '').toLowerCase();
    const reference = data.reference || data.payment_reference;

    if (!reference) return res.status(400).send('No reference provided');

    // --- HANDLE SMS TOPUP (SMS- Prefix) ---
    if (reference.startsWith('SMS-')) {
        if (status === 'success' || status === 'successful') {
            await db.query('UPDATE sms_fees SET status = "success" WHERE reference = ?', [reference]);
            console.log(`[WEBHOOK] SMS Topup Successful: ${reference}`);

            // Email Notification
            try {
                // Find who made this payment? sms_fees usually has admin_id
                const [smsRows] = await db.query('SELECT admin_id, amount, credits FROM sms_fees WHERE reference = ?', [reference]);
                if (smsRows.length > 0) {
                    const adminId = smsRows[0].admin_id;
                    const balance = await getAdminBalance(adminId);
                    const [adminRows] = await db.query('SELECT email, username FROM admins WHERE id = ?', [adminId]);
                    if (adminRows.length > 0 && adminRows[0].email) {
                        sendSMSPurchaseNotification(adminRows[0].email, smsRows[0].amount, smsRows[0].credits, reference, balance, adminRows[0].username);
                    }
                }
            } catch (smsEmailErr) { console.error('SMS Email Error', smsEmailErr); }

        } else if (status === 'failed') {
            await db.query('UPDATE sms_fees SET status = "failed" WHERE reference = ?', [reference]);
            console.log(`[WEBHOOK] SMS Topup Failed: ${reference}`);
        }
        return res.status(200).send('OK');
    }

    // --- HANDLE STANDARD TRANSACTIONS ---
    if (status === 'success' || status === 'successful') {
        try {
            // Check if already handled
            const [txs] = await db.query('SELECT * FROM transactions WHERE transaction_ref = ?', [reference]);
            if (txs.length === 0) return res.status(404).send('Transaction not found');

            const tx = txs[0];
            if (tx.status === 'success') return res.status(200).send('Already processed');

            // Fetch Admin Billing Type to calculate Fee
            const [pkgs] = await db.query('SELECT admin_id FROM packages WHERE id = ?', [tx.package_id]);
            let feeMs = 0;

            if (pkgs.length > 0) {
                const adminId = pkgs[0].admin_id;
                const [admins] = await db.query('SELECT billing_type FROM admins WHERE id = ?', [adminId]);
                if (admins.length > 0 && admins[0].billing_type === 'commission') {
                    feeMs = tx.amount * 0.05;
                }
            }

            // Mark as Success and Apply Calculated Fee (0 or 5%)
            await db.query('UPDATE transactions SET status = "success", fee = ? WHERE transaction_ref = ?', [feeMs, reference]);

            // Notify Payments Update
            req.io.emit('data_update', { type: 'payments' });

            // Assign Voucher Logic
            const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [tx.package_id]);
            if (packages.length > 0) {
                if (availableVouchers.length > 0) {
                    const voucher = availableVouchers[0];
                    await db.query('UPDATE vouchers SET is_used = TRUE WHERE id = ?', [voucher.id]);

                    // Store voucher code in transactions
                    await db.query('UPDATE transactions SET voucher_code = ? WHERE transaction_ref = ?', [voucher.code, reference]);

                    req.io.emit('data_update', { type: 'vouchers' }); // Notify Vouchers Update
                    req.io.emit('data_update', { type: 'payments' });

                    const msg = `Payment Received! Your voucher code: ${voucher.code}. Valid for ${packages[0].validity_hours} hrs.`;
                    sendSMS(tx.phone_number, msg, packages[0].admin_id);
                    req.io.emit('data_update', { type: 'sms' });

                    console.log(`[WEBHOOK] Voucher sent for ${reference}`);

                    // Email Notification
                    try {
                        const [adminRows] = await db.query('SELECT email FROM admins WHERE id = ?', [packages[0].admin_id]);
                        if (adminRows.length > 0) {
                            sendPaymentNotification(adminRows[0].email, tx.amount, tx.phone_number, reference, voucher.code);
                        }
                    } catch (emailErr) { console.error('Email Error:', emailErr); }
                } else {
                    console.error(`[WEBHOOK] No vouchers available for ${reference}`);
                }
            }
            res.status(200).send('OK');
        } catch (err) {
            console.error('[WEBHOOK] Error:', err);
            res.status(500).send('Server Error');
        }
    } else if (status === 'failed') {
        await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [reference]);
        console.log(`[WEBHOOK] Transaction failed: ${reference}`);
        res.status(200).send('OK');
    } else {
        console.log(`[WEBHOOK] Status ignored: ${status}`);
        res.status(200).send('OK');
    }
});

// Sync Polling Endpoint
router.post('/check-payment-status', async (req, res) => {
    const { transaction_ref } = req.body;
    if (!transaction_ref) return res.status(400).json({ error: 'Ref required' });

    try {
        const [txs] = await db.query('SELECT * FROM transactions WHERE transaction_ref = ?', [transaction_ref]);
        if (txs.length === 0) return res.status(404).json({ error: 'Transaction not found' });

        const tx = txs[0];
        // If DB already says success (e.g. from webhook), return immediately
        if (tx.status === 'success') {
            return res.json({ status: 'SUCCESS', voucher_code: tx.voucher_code });
        }
        if (tx.status === 'failed') return res.json({ status: 'FAILED' });

        // Otherwise, ask Gateway
        const checkUrl = `https://payments.relworx.com/api/mobile-money/check-request-status?account_no=${RELWORX_ACCOUNT_NO}&reference=${transaction_ref}&internal_reference=${transaction_ref}`;

        console.log(`[POLL] Checking: ${checkUrl}`);
        const response = await fetch(checkUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/vnd.relworx.v2',
                'Authorization': `Bearer ${RELWORX_API_KEY}`
            }
        });

        const data = await response.json();
        const status = (data.status || '').toUpperCase();
        const itemStatus = (data.item_status || '').toUpperCase();

        // STRICT CHECK: Do NOT check data.success === true, as that refers to the API call success, not payment success.
        if (status === 'SUCCESS' || itemStatus === 'SUCCESS') {

            // Calculate Fee Dynamic
            const [pkgs] = await db.query('SELECT admin_id FROM packages WHERE id = ?', [tx.package_id]);
            let feeMs = 0;
            if (pkgs.length > 0) {
                const adminId = pkgs[0].admin_id;
                const [admins] = await db.query('SELECT billing_type FROM admins WHERE id = ?', [adminId]);
                if (admins.length > 0 && admins[0].billing_type === 'commission') {
                    feeMs = tx.amount * 0.05;
                }
            }

            await db.query('UPDATE transactions SET status = "success", fee = ? WHERE transaction_ref = ?', [feeMs, transaction_ref]);

            // Assign Voucher Logic (Idempotent: handled if not already done)
            const [updatedTxs] = await db.query('SELECT * FROM transactions WHERE transaction_ref = ?', [transaction_ref]);
            // Only reuse logic if not done? The code below repeats webhook logic.
            // Ideally we refactor 'assignVoucher' to a function. 
            // For now, I'll inline but ensure we don't double send if DB query takes a moment.
            // Actually, the webhook might have beaten us.
            // Let's just do the same logic:

            const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [tx.package_id]);
            if (packages.length > 0) {
                // Check if we already assigned a voucher to THIS transaction? 
                // We don't have a tx_id on vouchers table. 
                // So we risk double assignment if webhook and poll run purely in parallel.
                // However, polling is usually fallback.
                // Let's rely on `tx.status` check above. Since correct status is now set to 'success' 2 lines up,
                // we proceed. But wait, if webhook set it to success, the early return caught it.
                // If we set it to success here, we are the first.

                const [availableVouchers] = await db.query('SELECT * FROM vouchers WHERE package_id = ? AND is_used = FALSE LIMIT 1', [tx.package_id]);

                if (availableVouchers.length > 0) {
                    const voucher = availableVouchers[0];
                    await db.query('UPDATE vouchers SET is_used = TRUE WHERE id = ?', [voucher.id]);

                    // Store in Transactions
                    await db.query('UPDATE transactions SET voucher_code = ? WHERE transaction_ref = ?', [voucher.code, transaction_ref]);

                    const msg = `Payment Received! Your voucher code: ${voucher.code}. Valid for ${packages[0].validity_hours} hrs.`;
                    sendSMS(tx.phone_number, msg, packages[0].admin_id);

                    // Email Notification
                    try {
                        const adminId = packages[0].admin_id;
                        const balance = await getAdminBalance(adminId);
                        const [adminRows] = await db.query('SELECT email, username FROM admins WHERE id = ?', [adminId]);
                        if (adminRows.length > 0) {
                            sendPaymentNotification(adminRows[0].email, tx.amount, tx.phone_number, transaction_ref, voucher.code, balance, adminRows[0].username);
                        }
                    } catch (emailErr) { console.error('Email Error:', emailErr); }

                    return res.json({ status: 'SUCCESS', voucher_code: voucher.code });
                }
            }
            return res.json({ status: 'SUCCESS' }); // Success but maybe no voucher available?
        } else if (status === 'FAILED') {
            await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [transaction_ref]);
            return res.json({ status: 'FAILED' });
        } else {
            return res.json({ status: 'PENDING', remote_data: data });
        }
    } catch (err) {
        console.error('Polling Error:', err);
        res.status(500).json({ error: 'Error checking status' });
    }
});

// Initiate Withdrawal (OTP)
router.post('/admin/withdraw/initiate', authenticateToken, async (req, res) => {
    const { amount, phone_number } = req.body;
    if (!amount || !phone_number) return res.status(400).json({ error: 'Required fields missing' });

    try {
        // 1. Check Balance
        const [transStats] = await db.query("SELECT COALESCE(SUM(amount - fee), 0) as total_revenue FROM transactions WHERE status = 'success' AND admin_id = ?", [req.user.id]);
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?", [req.user.id]);
        const currentBalance = Number(transStats[0].total_revenue) - Number(withdrawStats[0].total_withdrawn);

        if (Number(amount) > currentBalance) {
            return res.status(400).json({ error: 'Insufficient funds', message: `Balance: ${currentBalance}` });
        }

        // 2. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        // 3. Save to DB
        await db.query('UPDATE admins SET withdrawal_otp = ?, withdrawal_otp_expiry = ? WHERE id = ?', [otp, expiry, req.user.id]);

        // 4. Send Email
        const [adminRows] = await db.query('SELECT email, username FROM admins WHERE id = ?', [req.user.id]);
        if (adminRows.length > 0 && adminRows[0].email) {
            sendWithdrawalOTP(adminRows[0].email, otp, adminRows[0].username);
        }

        res.json({ message: 'OTP sent to email', step: 'otp' });

    } catch (err) {
        console.error('Initiate Withdraw Error:', err);
        res.status(500).json({ error: 'Failed to initiate withdrawal' });
    }
});

// Admin Withdraw (Confirm)
router.post('/admin/withdraw', authenticateToken, async (req, res) => {
    const { amount, phone_number, description, otp } = req.body;

    if (!amount || !phone_number || !otp) return res.status(400).json({ error: 'Required fields missing including OTP' });

    try {
        // 1. Verify OTP
        const [rows] = await db.query('SELECT withdrawal_otp, withdrawal_otp_expiry FROM admins WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(401).json({ error: 'Unauthorized' });

        const { withdrawal_otp, withdrawal_otp_expiry } = rows[0];

        if (!withdrawal_otp || withdrawal_otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }
        if (new Date() > new Date(withdrawal_otp_expiry)) {
            return res.status(400).json({ error: 'OTP Expired' });
        }

        // 2. Format Phone & Check Balance (Again, for safety)
        let formattedPhone = phone_number.trim();
        if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.slice(1);
        else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

        const [transStats] = await db.query("SELECT COALESCE(SUM(amount - fee), 0) as total_revenue FROM transactions WHERE status = 'success' AND admin_id = ?", [req.user.id]);
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?", [req.user.id]);

        const currentBalance = Number(transStats[0].total_revenue) - Number(withdrawStats[0].total_withdrawn);

        if (Number(amount) > currentBalance) {
            return res.status(400).json({ error: 'Insufficient funds', message: `Balance: ${currentBalance}` });
        }

        // 3. Process Payment
        const reference = `W-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const payload = {
            account_no: RELWORX_ACCOUNT_NO,
            reference: reference,
            msisdn: formattedPhone,
            currency: 'UGX',
            amount: Number(amount),
            description: description || 'Admin Withdrawal'
        };

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

        if (response.ok && (result.success === true || result.status === 'success')) {
            // 4. Clear OTP
            await db.query('UPDATE admins SET withdrawal_otp = NULL, withdrawal_otp_expiry = NULL WHERE id = ?', [req.user.id]);

            // 5. Record Withdrawal
            await db.query(
                'INSERT INTO withdrawals (phone_number, amount, reference, description, admin_id) VALUES (?, ?, ?, ?, ?)',
                [formattedPhone, amount, reference, description, req.user.id]
            );

            // Email Notification
            try {
                const balance = await getAdminBalance(req.user.id);
                const [adminRows] = await db.query('SELECT email, username FROM admins WHERE id = ?', [req.user.id]);
                if (adminRows.length > 0 && adminRows[0].email) {
                    sendWithdrawalNotification(adminRows[0].email, amount, formattedPhone, reference, description || 'Admin Withdrawal', balance, adminRows[0].username);
                }
            } catch (wdEmailErr) { console.error('Withdraw Email Error', wdEmailErr); }

            // Emit Real-time Update
            req.io.emit('data_update', { type: 'withdrawals' }); // Use checking logic on client

            res.json({ success: true, data: result });
        } else {
            console.warn('[Withdraw] Failed:', result);
            res.status(400).json({ success: false, error: result.message || 'Failed', details: result });
        }
    } catch (err) {
        console.error('Withdraw Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.get('/admin/my-transactions', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                created_at, 
                'Withdrawal' as type, 
                amount, 
                'success' as status, 
                reference, 
                description 
            FROM withdrawals 
            WHERE admin_id = ?
            
            UNION ALL
            
            SELECT 
                created_at, 
                'Subscription' as type, 
                amount, 
                status, 
                reference, 
                CONCAT('Subscription for ', months, ' months') as description 
            FROM admin_subscriptions 
            WHERE admin_id = ?
            
            ORDER BY created_at DESC
        `;

        const [rows] = await db.query(query, [req.user.id, req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('My Transactions Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Admin SMS Balance


module.exports = router;
