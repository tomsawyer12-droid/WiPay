const db = require('../src/config/db');

async function seedLog() {
    try {
        // Get testadmin ID
        const [users] = await db.query('SELECT id FROM admins WHERE username = "testadmin"');
        if (users.length === 0) {
            console.error('testadmin not found');
            process.exit(1);
        }
        const adminId = users[0].id;

        // Insert fake log
        const fakeResponse = JSON.stringify({
            success: true,
            data: {
                remaining_balance: 999,
                status: 'pending'
            }
        });

        await db.query(
            'INSERT INTO sms_logs (phone_number, message, status, response, admin_id) VALUES (?, ?, ?, ?, ?)',
            ['1234567890', 'Test Balance', 'success', fakeResponse, adminId]
        );

        console.log('Seeded fake SMS log for admin:', adminId);
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seedLog();
