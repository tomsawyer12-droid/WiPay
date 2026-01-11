const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkSchema() {
    // Try to load env manually if not loaded
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'wipay_db'
    };

    console.log('Connecting to:', dbConfig.host, dbConfig.database);

    const db = await mysql.createConnection(dbConfig);

    try {
        console.log('\n--- Vouchers Table ---');
        const [vouchersCols] = await db.query('DESCRIBE vouchers');
        console.table(vouchersCols.map(c => ({ Field: c.Field, Type: c.Type })));

        console.log('\n--- Transactions Table ---');
        const [transCols] = await db.query('DESCRIBE transactions');
        console.table(transCols.map(c => ({ Field: c.Field, Type: c.Type })));

    } catch (e) {
        console.error(e);
    } finally {
        await db.end();
    }
}

checkSchema();
