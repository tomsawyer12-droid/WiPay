const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wipay'
};

async function fixVoucherIndex() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        console.log('Connected to database.');

        // 1. Check existing indices
        const [indices] = await conn.query('SHOW INDEX FROM vouchers');
        // console.log('Indices:', indices);

        // Filter for unique index on 'code'
        const codeIndex = indices.find(row => row.Column_name === 'code' && row.Non_unique === 0 && row.Key_name !== 'PRIMARY');

        if (codeIndex) {
            console.log(`Found existing unique index on 'code': ${codeIndex.Key_name}`);
            await conn.query(`DROP INDEX ${codeIndex.Key_name} ON vouchers`);
            console.log('Dropped global unique index.');
        } else {
            console.log('No global unique index on code found (or already removed).');
        }

        // 2. Add Composite Index (admin_id, code)
        // Check if it already exists to avoid error
        const compositeIndex = indices.find(row => row.Key_name === 'idx_voucher_admin_code');
        if (!compositeIndex) {
            await conn.query('ALTER TABLE vouchers ADD UNIQUE INDEX idx_voucher_admin_code (admin_id, code)');
            console.log('Added composite unique index (admin_id, code).');
        } else {
            console.log('Composite index already exists.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await conn.end();
    }
}

fixVoucherIndex();
