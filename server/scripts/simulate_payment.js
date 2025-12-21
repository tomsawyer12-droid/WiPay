const mysql = require('mysql2/promise');
const db = require('../src/config/db');
require('dotenv').config();

async function simulate() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    const ref = `SIM-${Date.now()}`;
    const amount = 500;
    const phone = '+256700000000';
    const packageId = 1; // Assuming ID 1 exists
    const adminId = 1; // Assuming Admin 1 exists

    try {
        // 1. Create Pending Transaction
        console.log(`[SIM] Creating pending transaction: ${ref}`);
        await conn.query(
            'INSERT INTO transactions (transaction_ref, phone_number, amount, package_id, status, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
            [ref, phone, amount, packageId, 'pending', adminId]
        );

        // 2. Trigger Webhook
        console.log('[SIM] Sending Webhook POST...');
        const response = await fetch('http://localhost:5002/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'success',
                reference: ref,
                internal_reference: ref, // Some gateways send this
                amount: amount
            })
        });

        console.log(`[SIM] Response Status: ${response.status}`);
        const text = await response.text();
        console.log(`[SIM] Response Body: ${text}`);

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

simulate();
