const db = require('../src/config/db');

async function dumpLogs() {
    try {
        const [rows] = await db.query('SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 5');
        console.log('Total Logs:', rows.length);
        rows.forEach(r => {
            console.log('--- Log ---');
            console.log('ID:', r.id);
            console.log('Status:', r.status);
            console.log('Response:', r.response);
        });
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
dumpLogs();
