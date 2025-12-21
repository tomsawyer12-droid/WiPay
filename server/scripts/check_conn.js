const https = require('https');

const url = 'https://payments.relworx.com/api/mobile-money/check-request-status?test=1';

console.log(`Checking connectivity to: ${url}`);

const req = https.get(url, (res) => {
    console.log(`Response Status: ${res.statusCode}`);
    res.on('data', (d) => {
        console.log('Data received (first 100 chars):', d.toString().substring(0, 100));
    });
});

req.on('error', (e) => {
    console.error('Connection Error:', e);
});

req.end();
