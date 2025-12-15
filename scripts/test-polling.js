// Native fetch (Node 18+)
const http = require('http');

async function testPolling() {
    const baseUrl = 'http://127.0.0.1:5002/api';
    console.log(`Targeting: ${baseUrl}`);

    try {
        // 1. Get package
        const pkgRes = await fetch(`${baseUrl}/packages?admin_id=1`);
        const packages = await pkgRes.json();
        if (packages.length === 0) return console.log('No packages');
        const pkg = packages[0];
        console.log(`Using Package: ${pkg.name}`);

        // 2. Buy
        console.log('Initiating purchase...');
        const buyRes = await fetch(`${baseUrl}/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: '256777000111', package_id: pkg.id })
        });
        const buyData = await buyRes.json();
        console.log('Purchase Response:', buyData);

        if (!buyData.transaction_id) return console.error('Purchase failed');

        // 3. Poll
        console.log(`Polling status for ${buyData.transaction_id}...`);
        const pollRes = await fetch(`${baseUrl}/check-payment-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_ref: buyData.transaction_id })
        });
        const pollData = await pollRes.json();
        console.log('Poll Response:', pollData);

        if (pollData.status === 'SUCCESS') {
            console.error('FAIL: Status returned SUCCESS prematurely! Should be PENDING.');
        } else {
            console.log('PASS: Status is PENDING (as expected for unpaid test).');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    }
}

testPolling();
