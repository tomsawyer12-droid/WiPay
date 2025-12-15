// Native fetch is available in Node > 18
// const fetch = require('node-fetch'); 
const http = require('http');

async function testPurchase() {
    const baseUrl = 'http://127.0.0.1:5002/api';
    console.log(`Targeting: ${baseUrl}`);

    try {
        // 1. Get Packages
        console.log('Fetching packages...');
        const pkgRes = await fetch(`${baseUrl}/packages?admin_id=1`);
        if (!pkgRes.ok) {
            console.error(`Failed to fetch packages: ${pkgRes.status} ${pkgRes.statusText}`);
            const text = await pkgRes.text();
            console.error('Response:', text);
            return;
        }
        const packages = await pkgRes.json();
        console.log(`Found ${packages.length} packages.`);

        if (packages.length === 0) {
            console.log('No packages found to test purchase.');
            return;
        }

        const pkg = packages[0];
        console.log(`Testing purchase for package: ${pkg.name} (ID: ${pkg.id})`);

        // 2. Initiate Purchase
        const payload = {
            phone_number: '256777123456',
            package_id: pkg.id
        };

        console.log('Sending purchase request...');
        const buyRes = await fetch(`${baseUrl}/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Purchase Status: ${buyRes.status}`);
        const contentType = buyRes.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);

        const text = await buyRes.text();
        console.log('Raw Response Body:', text);

        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.error('FAILED TO PARSE JSON. This would cause "Network Error" on frontend.');
        }

    } catch (err) {
        console.error('Network/Fetch Request Failed:', err);
    }
}

testPurchase();
