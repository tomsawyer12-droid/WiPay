const db = require('../src/config/db');
require('dotenv').config();

async function run() {
    console.log('--- Debugging Packages ---');
    try {
        // 1. Raw Package List
        const [packages] = await db.query('SELECT * FROM packages');
        console.log('Total Packages:', packages.length);

        for (const p of packages) {
            console.log(`\nPackage: ${p.id} - ${p.name} (Admin: ${p.admin_id})`);

            // 2. Count Vouchers
            const [total] = await db.query('SELECT count(*) as c FROM vouchers WHERE package_id = ?', [p.id]);
            const [unused] = await db.query('SELECT count(*) as c FROM vouchers WHERE package_id = ? AND is_used = 0', [p.id]);
            const [used] = await db.query('SELECT count(*) as c FROM vouchers WHERE package_id = ? AND is_used = 1', [p.id]);

            console.log(`   Total Vouchers: ${total[0].c}`);
            console.log(`   Unused: ${unused[0].c}`);
            console.log(`   Used: ${used[0].c}`);
        }

        // 3. Test Actual Query
        console.log('\n--- Testing Public Query (Admin 1) ---');
        let query = `
            SELECT p.id, p.name, p.price, COUNT(v.id) as unused_count
            FROM packages p
            JOIN vouchers v ON p.id = v.package_id AND v.is_used = 0
            JOIN admins a ON p.admin_id = a.id
            WHERE p.admin_id = ?
            GROUP BY p.id, p.name, p.price
            HAVING COUNT(v.id) > 0
        `;
        const [rows] = await db.query(query, [1]);
        console.log('Query Result for Admin 1:');
        console.log(JSON.stringify(rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

run();
