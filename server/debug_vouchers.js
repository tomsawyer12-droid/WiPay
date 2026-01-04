require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugVouchers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        console.log('--- ADMINS ---');
        const [admins] = await connection.query('SELECT id, username, email FROM admins');
        console.table(admins);

        console.log('\n--- VOUCHER COUNTS PER ADMIN (Unused) ---');
        const [counts] = await connection.query(`
            SELECT admin_id, COUNT(*) as unused_count 
            FROM vouchers 
            WHERE is_used = 0 
            GROUP BY admin_id
        `);
        console.table(counts);

        console.log('\n--- LIST IF COUNT IS SMALL (< 20) ---');
        for (const row of counts) {
            if (row.unused_count < 20) {
                console.log(`\nAdmin ${row.admin_id} has ${row.unused_count} vouchers:`);
                const [vouchers] = await connection.query(`
                    SELECT id, code, package_id, created_at 
                    FROM vouchers 
                    WHERE admin_id = ? AND is_used = 0
                `, [row.admin_id]);
                console.table(vouchers);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

debugVouchers();
