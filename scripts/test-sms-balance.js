const fs = require('fs');

async function testBalance() {
    const baseUrl = 'http://127.0.0.1:5002/api';

    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'testpass' })
    });

    if (!loginRes.ok) return console.error('Login failed', await loginRes.text());
    const { token } = await loginRes.json();
    console.log('Got token.');

    // 2. Check Balance
    console.log('Checking SMS balance...');
    const res = await fetch(`${baseUrl}/admin/sms-balance`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    console.log('Balance Response:', data);
}

testBalance();
