const https = require('https');
require('dotenv').config();

const username = process.env.UGSMS_USERNAME;
const password = process.env.UGSMS_PASSWORD;

if (!username) {
    console.error('No credentials in .env');
    process.exit(1);
}

const endpoints = [
    '/v1/sms/balance',
    '/v1/balance',
    '/api/v1/sms/balance',
    '/sms/balance'
];

async function probe() {
    console.log('Probing UGSMS balance endpoints...');

    for (const ep of endpoints) {
        const url = `https://ugsms.com${ep}`;
        console.log(`Trying: ${url}`);
        try {
            const res = await fetch(url, {
                method: 'POST', // Try POST first as their send is POST
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            console.log(`[POST] ${ep} Status:`, res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('SUCCESS DATA:', data);
                return;
            }

            // Try GET
            const resGet = await fetch(`${url}?username=${username}&password=${password}`, {
                method: 'GET'
            });
            console.log(`[GET] ${ep} Status:`, resGet.status);
            if (resGet.ok) {
                const data = await resGet.json();
                console.log('SUCCESS DATA:', data);
                return;
            }

        } catch (e) {
            console.error(`Error probing ${ep}:`, e.message);
        }
    }
    console.log('Probe finished. No obvious endpoint found.');
}

probe();
