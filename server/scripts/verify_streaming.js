const fs = require('fs');
const http = require('http');

// Helper to make requests
function makeRequest(opts, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(opts, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    try {
        console.log('Logging in...');
        const loginData = JSON.stringify({ username: 'testadmin', password: 'password123' });
        const loginRes = await makeRequest({
            hostname: 'localhost', port: 5002, path: '/api/login', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
        }, loginData);

        if (loginRes.statusCode !== 200) throw new Error('Login failed: ' + loginRes.body);
        const token = JSON.parse(loginRes.body).token;
        console.log('Token acquired.');

        // Prepare Upload
        fs.writeFileSync('test_upload.csv', 'code,comment\nStreamingTest001,Auto Test\nStreamingTest002,Auto Test 2');
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

        const postDataHead = `--${boundary}\r\nContent-Disposition: form-data; name="package_id"\r\n\r\n1\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_upload.csv"\r\nContent-Type: text/csv\r\n\r\n`;
        const postDataTail = `\r\n--${boundary}--`;
        const fileContent = fs.readFileSync('test_upload.csv');

        const bodyBuffer = Buffer.concat([
            Buffer.from(postDataHead, 'utf8'),
            fileContent,
            Buffer.from(postDataTail, 'utf8')
        ]);

        console.log('Uploading file...');
        const uploadRes = await makeRequest({
            hostname: 'localhost', port: 5002, path: '/api/admin/vouchers/import', method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Content-Length': bodyBuffer.length
            }
        }, bodyBuffer);

        console.log(`Upload Status: ${uploadRes.statusCode}`);
        console.log('Response:', uploadRes.body);

        fs.unlinkSync('test_upload.csv');

    } catch (e) {
        console.error('Verify Error:', e);
    }
})();
