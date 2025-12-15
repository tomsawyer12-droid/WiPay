const http = require('http');

const makeRequest = (path, i) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5002,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            console.log(`Request ${i}: Status Code: ${res.statusCode}`);
            resolve(res.statusCode);
        });

        req.on('error', (e) => {
            console.error(`Request ${i}: Error: ${e.message}`);
            resolve(null);
        });

        // Send dummy data for login
        if (path === '/api/login') {
            req.write(JSON.stringify({ username: 'test', password: 'test' }));
        }

        req.end();
    });
};

const runTest = async () => {
    console.log('Testing General Limiter on /api/packages (expecting 100 limit)...');
    // We won't hit 100 in this quick test, but we can verify it returns 200/404 not 429 initially
    await makeRequest('/api/packages', 1);

    console.log('\nTesting Strict Limiter on /api/login (expecting 10 limit)...');
    let limitHit = false;
    for (let i = 1; i <= 15; i++) {
        const status = await makeRequest('/api/login', i);
        if (status === 429) {
            console.log('Strict Rate Limit Hit! Success.');
            limitHit = true;
            break;
        }
    }

    if (!limitHit) {
        console.log('Strict Rate Limit NOT Hit (Check if server is running or limit is too high for test).');
    }
};

runTest();
