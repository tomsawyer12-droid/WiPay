const db = require('../src/config/db');

async function checkSchema() {
    try {
        const [tCols] = await db.query('SHOW COLUMNS FROM transactions');
        console.log('--- Transactions Table ---');
        tCols.forEach(c => console.log(c.Field, c.Type));

        const [vCols] = await db.query('SHOW COLUMNS FROM vouchers');
        console.log('\n--- Vouchers Table ---');
        vCols.forEach(c => console.log(c.Field, c.Type));

        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkSchema();
