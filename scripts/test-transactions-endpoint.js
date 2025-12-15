

async function testTransactions() {
    const baseUrl = 'http://127.0.0.1:5002/api';

    // 1. Login
    console.log('Logging in...');
    const loginRes = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testadmin', password: 'testpass' })
    });

    if (!loginRes.ok) return console.error('Login failed', await loginRes.text());
    const { token } = await loginRes.json();
    console.log('Got token.');

    // 2. Fetch Transactions
    console.log('Fetching transactions...');
    const res = await fetch(`${baseUrl}/admin/transactions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error('Failed:', res.status, await res.text());
    } else {
        const data = await res.json();
        console.log('Transactions found:', data.length);
        if (data.length > 0) console.log('Sample:', data[0]);
    }
}

testTransactions();
