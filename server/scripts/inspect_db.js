
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wipay_db'
};

async function inspect() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('Connected to DB.');

        // 1. Admins
        const [admins] = await conn.query('SELECT id, username, email FROM admins');
        console.table(admins);

        // 2. Categories per Admin
        const [cats] = await conn.query('SELECT admin_id, COUNT(*) as count FROM categories GROUP BY admin_id');
        console.log('Categories per Admin:');
        console.table(cats);

        // 3. Vouchers per Admin
        const [vouchers] = await conn.query('SELECT admin_id, COUNT(*) as count FROM vouchers GROUP BY admin_id');
        console.log('Vouchers per Admin:');
        console.table(vouchers);

        await conn.end();
    } catch (e) {
        console.error('Error:', e);
    }
}

inspect();
