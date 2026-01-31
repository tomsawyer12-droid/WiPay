require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugBought() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        console.log('--- ADMINS ---');
        const [admins] = await connection.query('SELECT id, username FROM admins');

        for (const admin of admins) {
            console.log(`\nChecking Admin: ${admin.username} (ID: ${admin.id})`);

            // The exact query from adminRoutes.js
            const [rows] = await connection.query(`
                SELECT count(*) as count 
                FROM transactions 
                WHERE admin_id = ? 
                AND status = "success" 
                AND payment_method != "manual" 
                AND transaction_ref NOT LIKE "SMS-%"
            `, [admin.id]);

            const count = rows[0].count;
            console.log(`DASHBOARD COUNT: ${count}`);

            if (count > 0 && count < 20) {
                console.log('--- DETAILS ---');
                const [details] = await connection.query(`
                    SELECT id, transaction_ref, amount, payment_method, created_at, voucher_code 
                    FROM transactions 
                    WHERE admin_id = ? 
                    AND status = "success" 
                    AND payment_method != "manual" 
                    AND transaction_ref NOT LIKE "SMS-%"
                `, [admin.id]);
                console.table(details);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

debugBought();
