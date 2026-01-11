const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');

async function debug() {
    const env = dotenv.parse(fs.readFileSync('/var/www/wipay-server/.env'));
    const db = await mysql.createConnection({
        host: env.DB_HOST,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        port: env.DB_PORT || 3306
    });

    const results = { admins: [] };

    try {
        const [admins] = await db.query('SELECT id, username FROM admins');

        for (const admin of admins) {
            const adminStats = {
                username: admin.username,
                id: admin.id,
                routers: []
            };

            // Global Stats
            const [globalRev] = await db.query("SELECT SUM(amount - COALESCE(fee, 0)) as rev FROM transactions WHERE admin_id = ? AND status = 'success'", [admin.id]);
            const [globalWithdraw] = await db.query("SELECT SUM(amount) as withdrawn FROM withdrawals WHERE admin_id = ? AND (status = 'success' OR status = 'pending')", [admin.id]);

            adminStats.globalRevenue = globalRev[0].rev || 0;
            adminStats.globalWithdrawn = globalWithdraw[0].withdrawn || 0;
            adminStats.globalBalance = adminStats.globalRevenue - adminStats.globalWithdrawn;

            // Router Statistics
            const [routers] = await db.query('SELECT id, name FROM routers WHERE admin_id = ?', [admin.id]);
            for (const r of routers) {
                const [routerRev] = await db.query("SELECT SUM(amount - COALESCE(fee, 0)) as rev FROM transactions WHERE admin_id = ? AND router_id = ? AND status = 'success'", [admin.id, r.id]);
                adminStats.routers.push({
                    name: r.name,
                    id: r.id,
                    revenue: routerRev[0].rev || 0
                });
            }

            // Legacy
            const [nullRev] = await db.query("SELECT SUM(amount - COALESCE(fee, 0)) as rev FROM transactions WHERE admin_id = ? AND router_id IS NULL AND status = 'success'", [admin.id]);
            adminStats.legacyRevenue = nullRev[0].rev || 0;

            // Samples
            const [samples] = await db.query('SELECT id, amount, router_id, status FROM transactions WHERE admin_id = ? ORDER BY created_at DESC LIMIT 10', [admin.id]);
            adminStats.recentSamples = samples;

            results.admins.push(adminStats);
        }

        fs.writeFileSync('/tmp/inspect_results.json', JSON.stringify(results, null, 2));
        console.log('Results written to /tmp/inspect_results.json');

    } catch (e) {
        console.error(e);
    } finally {
        await db.end();
    }
}

debug();
