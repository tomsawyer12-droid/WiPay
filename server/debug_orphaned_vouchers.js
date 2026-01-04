require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkOrphans() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        console.log('--- CHECKING ORPHANED VOUCHERS ---');
        // Vouchers with package_id that does NOT exist in packages table
        const [orphans] = await connection.query(`
            SELECT v.id, v.code, v.package_id, v.admin_id 
            FROM vouchers v
            LEFT JOIN packages p ON v.package_id = p.id
            WHERE p.id IS NULL
        `);

        if (orphans.length > 0) {
            console.log(`FOUND ${orphans.length} ORPHANED VOUCHERS!`);
            console.table(orphans);
        } else {
            console.log('No orphaned vouchers found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await connection.end();
    }
}

checkOrphans();
