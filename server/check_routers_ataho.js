require('dotenv').config();
const db = require('./src/config/db');

async function checkRouters() {
    try {
        console.log('Searching for "ATAHO" in admins...');
        const [admins] = await db.query('SELECT * FROM admins WHERE username LIKE "%ATAHO%" OR business_name LIKE "%ATAHO%"');

        if (admins.length === 0) {
            console.log('❌ No admin found matching "ATAHO".');
            return;
        }

        const admin = admins[0];
        console.log(`✅ Found Admin: ${admin.username} (ID: ${admin.id})`);

        // The exact query from adminRoutes.js
        const query = `
            SELECT 
                r.id, 
                r.name,
                r.mikhmon_url,
                (SELECT COUNT(*) FROM vouchers v 
                 JOIN packages p ON v.package_id = p.id 
                 WHERE p.router_id = r.id AND v.is_used = FALSE AND v.admin_id = ?) as voucher_stock,
                (SELECT COALESCE(SUM(t.amount - COALESCE(t.fee, 0)), 0) FROM transactions t 
                 WHERE t.router_id = r.id AND t.status = 'SUCCESS' AND t.admin_id = ?) as total_revenue,
                (SELECT COALESCE(SUM(t.amount - COALESCE(t.fee, 0)), 0) FROM transactions t 
                 WHERE t.router_id = r.id AND t.status = 'SUCCESS' AND t.admin_id = ? 
                 AND t.created_at >= NOW() - INTERVAL 1 DAY) as daily_revenue
            FROM routers r
            WHERE r.admin_id = ?
            ORDER BY r.created_at DESC
        `;

        console.log('\nRunning Router Stats Query...');
        const [rows] = await db.query(query, [admin.id, admin.id, admin.id, admin.id]); // Note: 4 params

        console.log(`Found ${rows.length} routers.`);
        if (rows.length > 0) {
            console.table(rows);
        } else {
            console.log('No routers found for this admin.');
            // Check if routers table has any data at all?
            const [allRouters] = await db.query('SELECT COUNT(*) as c FROM routers');
            console.log(`Total routers in DB (for anyone): ${allRouters[0].c}`);
        }

    } catch (e) {
        console.error('Query Failed:', e);
    } finally {
        process.exit();
    }
}

checkRouters();
