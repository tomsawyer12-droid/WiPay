const mysql = require('mysql2/promise');
require('dotenv').config();

async function simulateSMS() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'wipay'
    });

    try {
        // 1. Find Pending SMS Deposit
        const [rows] = await conn.query("SELECT * FROM sms_fees WHERE type = 'deposit' AND status = 'pending' ORDER BY id DESC LIMIT 1");

        if (rows.length === 0) {
            console.log("No pending SMS deposits found.");
            process.exit(0);
        }

        const tx = rows[0];
        console.log(`Found Pending Transaction: ${tx.reference} (${tx.amount} UGX)`);

        // 2. Trigger Webhook
        console.log('[SIM] Sending Webhook success...');
        const response = await fetch('http://localhost:5002/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'success',
                reference: tx.reference,
                amount: tx.amount
            })
        });

        console.log(`[SIM] Response: ${response.status} ${await response.text()}`);

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

simulateSMS();
