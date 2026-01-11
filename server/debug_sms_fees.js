const db = require('./src/config/db');
require('dotenv').config();

async function checkSMSFees() {
    try {
        console.log('--- Checking sms_fees Table Schema ---');
        const [columns] = await db.query('SHOW COLUMNS FROM sms_fees');
        columns.forEach(c => {
            if (c.Field === 'reference') {
                console.log(`COLUMN: ${c.Field}, TYPE: ${c.Type}, NULL: ${c.Null}`);
            }
        });

        console.log('\n--- Last 5 Entries in sms_fees ---');
        const [rows] = await db.query('SELECT id, reference, amount, status, created_at FROM sms_fees ORDER BY id DESC LIMIT 5');
        console.table(rows);

        console.log('\n--- Searching for specific reference ---');
        // The one from the logs
        const ref = 'SMS-1767702097614-615';
        const [search] = await db.query('SELECT * FROM sms_fees WHERE reference = ?', [ref]);
        console.log(`Searching for ${ref}:`, search.length > 0 ? 'FOUND' : 'NOT FOUND');
        if (search.length > 0) console.log(search[0]);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkSMSFees();
