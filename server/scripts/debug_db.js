const db = require('../src/config/db');

async function debugDB() {
    try {
        console.log('--- SMS FEES DUMP (JSON) ---');
        const [rows] = await db.query('SELECT * FROM sms_fees ORDER BY id DESC LIMIT 5');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugDB();
