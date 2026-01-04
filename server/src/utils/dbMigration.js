const db = require('../config/db');

async function runPendingMigrations() {
    console.log('Checking for pending database migrations...');
    try {
        // Migration 1: Add is_active to packages
        const addColumnQuery = `
            ALTER TABLE packages
            ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
        `;

        await db.query(addColumnQuery);
        console.log('Migration Success: Added is_active column to packages table.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            // This is fine, column exists
            console.log('Migration Info: is_active column already exists.');
        } else {
            console.error('Migration Error:', err);
            // Don't crash the server, just log
        }
    }

    try {
        // Migration 2: Create routers table
        const createRoutersTableQuery = `
            CREATE TABLE IF NOT EXISTS routers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                mikhmon_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
            );
        `;
        await db.query(createRoutersTableQuery);
        console.log('Migration Success: Routers table checked/created.');
    } catch (err) {
        console.error('Migration Error (Routers Table):', err);
    }

    try {
        // Migration 3: Add router_id to transactions
        const addRouterColumnQuery = `
            ALTER TABLE transactions
            ADD COLUMN router_id INT DEFAULT NULL;
        `;
        await db.query(addRouterColumnQuery);
        console.log('Migration Success: Added router_id to transactions table.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Migration Info: router_id column already exists in transactions.');
        } else {
            console.error('Migration Error (Transactions router_id):', err);
        }
    }
}

module.exports = { runPendingMigrations };
