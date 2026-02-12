require('dotenv').config();
const db = require('./src/config/db');

async function simulate() {
    try {
        // 1. Get or Create Admin
        const [admins] = await db.query('SELECT id FROM admins LIMIT 1');
        if (admins.length === 0) { console.log('No admins'); return; }
        const adminId = admins[0].id;

        // 2. Insert Transaction (Amount = 1500)
        // Withdrawable = 1500 - 2000 = -500 -> 0.
        await db.query(`
            INSERT INTO transactions (transaction_ref, phone_number, amount, status, admin_id, created_at)
            VALUES (?, ?, ?, 'success', ?, NOW())
        `, [`TEST-${Date.now()}`, '256700000000', 1500, adminId]);

        console.log(`Inserted transaction of 1500 UGX for Admin ID ${adminId}.`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

simulate();
