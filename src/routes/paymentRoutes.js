const express = require('express');
const router = express.Router();
const db = require('../config/db');
const sessionStore = require('../config/session');
const { sendSMS } = require('../utils/sms');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config();

const RELWORX_API_URL = 'https://payments.relworx.com/api/mobile-money/request-payment';
const RELWORX_SEND_PAYMENT_URL = 'https://payments.relworx.com/api/mobile-money/send-payment';
const RELWORX_API_KEY = process.env.RELWORX_API_KEY;
const RELWORX_ACCOUNT_NO = process.env.RELWORX_ACCOUNT_NO;

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
            await db.query('UPDATE transactions SET status = "failed" WHERE transaction_ref = ?', [reference]);
            res.status(400).json({ error: 'Payment gateway failed', details: paymentData });
        }
    } catch (err) {
        console.error('Purchase error:', err);
        res.status(500).json({ error: 'Internal server error' });
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
        if (tx.status === 'success') return res.json({ status: 'SUCCESS' });

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

        if (status === 'SUCCESS' || itemStatus === 'SUCCESS' || data.success === true) {
            await db.query('UPDATE transactions SET status = "success" WHERE transaction_ref = ?', [transaction_ref]);

            // Assign Voucher Logic
            const [packages] = await db.query('SELECT * FROM packages WHERE id = ?', [tx.package_id]);
            if (packages.length > 0) {
                const [availableVouchers] = await db.query('SELECT * FROM vouchers WHERE package_id = ? AND is_used = FALSE LIMIT 1', [tx.package_id]);

                if (availableVouchers.length > 0) {
                    const voucher = availableVouchers[0];
                    await db.query('UPDATE vouchers SET is_used = TRUE WHERE id = ?', [voucher.id]);
                    const msg = `Payment Received! Your voucher code: ${voucher.code}. Valid for ${packages[0].validity_hours} hrs.`;
                    sendSMS(tx.phone_number, msg, packages[0].admin_id);
                }
            }
            return res.json({ status: 'SUCCESS' });
        } else {
            return res.json({ status: 'PENDING', remote_data: data });
        }
    } catch (err) {
        console.error('Polling Error:', err);
        res.status(500).json({ error: 'Error checking status' });
    }
});

// Admin Withdraw
router.post('/admin/withdraw', authenticateToken, async (req, res) => {
    const { amount, phone_number, description } = req.body;

    if (!amount || !phone_number) return res.status(400).json({ error: 'Required fields missing' });

    try {
        const [transStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_revenue FROM transactions WHERE status = 'success' AND admin_id = ?", [req.user.id]);
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?", [req.user.id]);

        const currentBalance = Number(transStats[0].total_revenue) - Number(withdrawStats[0].total_withdrawn);

        if (Number(amount) > currentBalance) {
            return res.status(400).json({ error: 'Insufficient funds', message: `Balance: ${currentBalance}` });
        }

        const reference = `W-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const payload = {
            account_no: RELWORX_ACCOUNT_NO,
            reference: reference,
            msisdn: phone_number,
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
            await db.query(
                'INSERT INTO withdrawals (phone_number, amount, reference, description, admin_id) VALUES (?, ?, ?, ?, ?)',
                [phone_number, amount, reference, description, req.user.id]
            );
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

// Admin SMS Balance
router.get('/admin/sms-balance', authenticateToken, async (req, res) => {
    // Basic impl for now, normally calls smsService
    res.json({ balance: 0 }); // Placeholder or move full logic here
});

module.exports = router;
