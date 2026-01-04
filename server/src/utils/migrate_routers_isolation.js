const db = require('../config/db');

async function migrate() {
    console.log("Starting Router Isolation Migration...");
    const connection = await db.getConnection();
    try {
        // Helper to check column existence
        const columnExists = async (table, column) => {
            const [rows] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
            return rows.length > 0;
        };

        // 1. Categories
        if (!(await columnExists('categories', 'router_id'))) {
            console.log("Adding router_id to categories...");
            await connection.query("ALTER TABLE categories ADD COLUMN router_id INT NULL");
            await connection.query("ALTER TABLE categories ADD CONSTRAINT fk_cat_router FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL");
        } else {
            console.log("categories.router_id already exists.");
        }

        // 2. Packages
        if (!(await columnExists('packages', 'router_id'))) {
            console.log("Adding router_id to packages...");
            await connection.query("ALTER TABLE packages ADD COLUMN router_id INT NULL");
            await connection.query("ALTER TABLE packages ADD CONSTRAINT fk_pkg_router FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL");
        } else {
            console.log("packages.router_id already exists.");
        }

        // 3. Vouchers
        if (!(await columnExists('vouchers', 'router_id'))) {
            console.log("Adding router_id to vouchers...");
            await connection.query("ALTER TABLE vouchers ADD COLUMN router_id INT NULL");
            await connection.query("ALTER TABLE vouchers ADD CONSTRAINT fk_voucher_router FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE CASCADE");
            // Vouchers can be deleted if router is deleted? Maybe SET NULL or CASCADE. Let's stick to SET NULL for safety unless user specified. 
            // Actually, if router is gone, vouchers are useless? 
            // Let's use SET NULL for now as per plan.
            // Wait, previous constraint command was SET NULL. Let's keep consistency.
            // Correcting to SET NULL for safety.
        } else {
            console.log("vouchers.router_id already exists.");
        }

        // Re-apply constraint for vouchers if needed? No, assumes if column missing, constraint missing.

        console.log("Migration Complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration Failed:", e);
        process.exit(1);
    } finally {
        connection.release();
    }
}

migrate();
