const db = require('./src/config/db');

async function verify() {
    try {
        const [rows] = await db.query('SELECT transaction_ref, status, voucher_code, fee FROM transactions WHERE transaction_ref LIKE "SIM-%" ORDER BY id DESC LIMIT 1');
        console.log('--- VERIFICATION RESULT ---');
        console.log(JSON.stringify(rows[0], null, 2));
    } catch (e) {
        console.error('VERIFY ERROR:', e);
    } finally {
        process.exit(0);
    }
}

verify();
