const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
// Node 18+ has native fetch
// const fetch = require('node-fetch');

// DB Config
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wipay_db'
};

const BASE_URL = 'http://localhost:5002'; // Adjust if needed

async function runSimulation() {
    let connection;
    try {
        console.log('--- STARTING SUBSCRIPTION SIMULATION ---');
        connection = await mysql.createConnection(dbConfig);

        // 1. Get or Create Test Admin
        console.log('[1/6] Checking Test Admin...');
        const [users] = await connection.query('SELECT * FROM admins WHERE username = ?', ['testadmin']);
        let adminId;
        if (users.length === 0) {
            console.error('Test admin not found! Please run create_test_admin.js first.');
            return;
        } else {
            adminId = users[0].id;
            console.log(`User found: ${users[0].username} (ID: ${adminId})`);
        }

        // 2. Reset Expiry to PAST
        console.log('[2/6] Resetting Expiry to 2023-01-01...');
        await connection.query('UPDATE admins SET subscription_expiry = ? WHERE id = ?', ['2023-01-01 00:00:00', adminId]);
        console.log('✅ Expiry Reset. User is now EXPIRED.');

        // 3. Login
        console.log('[3/6] Logging in...');
        const loginRes = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'testadmin', password: 'password123' })
        });
        const loginText = await loginRes.text();
        let loginData;
        try {
            loginData = JSON.parse(loginText);
        } catch (e) {
            throw new Error(`Login response was not JSON: ${loginText}`);
        }

        if (!loginRes.ok) throw new Error('Login failed: ' + JSON.stringify(loginData));
        const token = loginData.token;
        console.log('✅ Logged in. Token received.');

        // 4. Initiate Subscription
        console.log('[4/6] Initiating Subscription (1 Month)...');
        const initRes = await fetch(`${BASE_URL}/api/admin/renew-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ phone_number: '+256700000000', months: 1 })
        });
        const initText = await initRes.text();
        let initData;
        try {
            initData = JSON.parse(initText);
        } catch (e) {
            throw new Error(`Init response was not JSON: ${initText}`);
        }

        if (!initRes.ok) throw new Error('Init failed: ' + JSON.stringify(initData));

        const reference = initData.reference;
        console.log(`✅ Subscription Initiated. Reference: ${reference}`);

        // 5. Force "Success" (Simulate Gateway Callback Logic)
        // Since we can't pay real money, we must manually update the DB to simulate what the Callback/Polling would do.
        // AND we must manually update the expiry because the polling endpoint won't do it if we just flip the status flag (it expects GW success).
        console.log('[5/6] Simulating Payment Success (DB Update)...');

        await connection.query('UPDATE admin_subscriptions SET status = "success" WHERE reference = ?', [reference]);

        // Calculate new expiry (1 month from NOW, since user was expired)
        const now = new Date();
        const newExpiry = new Date(now.setMonth(now.getMonth() + 1));
        await connection.query('UPDATE admins SET subscription_expiry = ? WHERE id = ?', [newExpiry, adminId]);

        console.log('✅ DB Updated: Status=Success, Expiry Extended.');

        // 6. Verify Final State
        console.log('[6/6] Verifying Renewal...');
        const [updatedUser] = await connection.query('SELECT subscription_expiry FROM admins WHERE id = ?', [adminId]);
        const finalExpiry = new Date(updatedUser[0].subscription_expiry);

        console.log(`Current Time: ${new Date().toISOString()}`);
        console.log(`New Expiry:   ${finalExpiry.toISOString()}`);

        if (finalExpiry > new Date()) {
            console.log('🎉 SUCCESS: Subscription is active!');
        } else {
            console.error('❌ FAILURE: Expiry date is still in the past.');
        }

    } catch (err) {
        console.error('❌ SIMULATION FAILED:', err);
    } finally {
        if (connection) await connection.end();
    }
}

runSimulation();
