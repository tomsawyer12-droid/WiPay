// const fetch = require('node-fetch'); // Use global fetch
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE_URL = 'http://localhost:5002';
let TOKEN = '';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

async function login() {
    console.log('Logging in...');
    const res = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'pike', password: 'password123' }) // Assuming default/known creds
    });
    const data = await res.json();
    if (res.ok) {
        TOKEN = data.token;
        console.log('Login Successful');
    } else {
        throw new Error('Login Failed: ' + JSON.stringify(data));
    }
}

async function getOTPFromDB() {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query('SELECT withdrawal_otp, id FROM admins WHERE username = ?', ['pike']);
    await conn.end();
    return rows.length > 0 ? rows[0].withdrawal_otp : null;
}

async function testFlow() {
    try {
        await login();

        console.log('Initiating Withdrawal...');
        const initRes = await fetch(`${BASE_URL}/api/admin/withdraw/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({ amount: 500, phone_number: '0770000000' })
        });

        const initData = await initRes.json();
        console.log('Init Response:', initData);

        if (!initRes.ok) throw new Error('Initiate Failed');

        console.log('Fetching OTP from DB...');
        const otp = await getOTPFromDB();
        console.log('OTP Found:', otp);

        if (!otp) throw new Error('OTP not found in DB');

        console.log('Confirming Withdrawal...');
        const confirmRes = await fetch(`${BASE_URL}/api/admin/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                amount: 500,
                phone_number: '0770000000',
                description: 'Test API Flow',
                otp: otp
            })
        });

        const confirmData = await confirmRes.json();
        console.log('Confirm Response:', confirmData);

        if (confirmRes.ok) {
            console.log('TEST PASSED: Withdrawal Successful');
        } else {
            console.log('TEST FAILED: ' + JSON.stringify(confirmData));
        }

    } catch (e) {
        console.error('TEST ERROR:', e);
    }
}

testFlow();
