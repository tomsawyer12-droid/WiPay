const http = require('http');
const PORT = 5002;

function checkServer() {
    console.log(`[HEALTH-CHECK] Pinging http://localhost:${PORT}...`);

    const req = http.get(`http://localhost:${PORT}`, (res) => {
        console.log(`[HEALTH-CHECK] Server Responded: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 500) {
            console.log('✅ Server is UP and Running!');
            process.exit(0);
        } else {
            console.log('⚠️ Server responded with error status.');
            process.exit(1);
        }
    });

    req.on('error', (err) => {
        console.error(`❌ Connection Failed: ${err.message}`);
        console.error('   -> Check if "node server.js" is running.');
        process.exit(1);
    });

    req.end();
}

checkServer();
