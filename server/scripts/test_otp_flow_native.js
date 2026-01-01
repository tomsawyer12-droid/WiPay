const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5002,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await request('/login', 'POST', { username: 'pike', password: 'password123' });
        if (loginRes.status !== 200) throw new Error('Login Failed: ' + JSON.stringify(loginRes.body));
        const token = loginRes.body.token;
        console.log('Login Successful');

        // 2. Initiate
        console.log('Initiating Withdrawal...');
        const initRes = await request('/admin/withdraw/initiate', 'POST', { amount: 500, phone_number: '0770000000' }, token);
        console.log('Init Response:', initRes.body);
        if (initRes.status !== 200) throw new Error('Initiate Failed');

        // 3. Get OTP
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.query('SELECT withdrawal_otp FROM admins WHERE username = ?', ['pike']);
        await conn.end();
        const otp = rows[0]?.withdrawal_otp;
        console.log('OTP from DB:', otp);

        if (!otp) throw new Error('OTP not found');

        // 4. Confirm
        console.log('Confirming Withdrawal...');
        const confirmRes = await request('/admin/withdraw', 'POST', {
            amount: 500,
            phone_number: '0770000000',
            description: 'Test API Flow',
            otp: otp
        }, token);

        console.log('Confirm Response:', confirmRes.body);

        if (confirmRes.status === 200) {
            console.log('TEST PASSED: Withdrawal Successful');
        } else {
            console.log('TEST FAILED: ' + JSON.stringify(confirmRes.body));
        }

    } catch (e) {
        console.error('TEST ERROR:', e);
    }
})();
