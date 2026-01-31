const db = require('./src/config/db');
require('dotenv').config();

async function check() {
    try {
        console.log('--- Checking Packages & Vouchers ---');

        const admins = [31, 33];

        for (const id of admins) {
            console.log(`\nChecking Admin ID: ${id}`);
            const [pkgs] = await db.query('SELECT * FROM packages WHERE admin_id = ?', [id]);
            console.log(`Packages found: ${pkgs.length}`);

            if (pkgs.length > 0) {
                for (const p of pkgs) {
                    const [vouchers] = await db.query('SELECT count(*) as count FROM vouchers WHERE package_id = ? AND is_used = 0', [p.id]);
                    console.log(`  - Package "${p.name}" (ID ${p.id}): ${vouchers[0].count} unused vouchers`);
                }
            } else {
                console.log('  No packages.');
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
