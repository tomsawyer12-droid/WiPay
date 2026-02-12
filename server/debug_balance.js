require('dotenv').config();
const db = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function run() {
    let output = '';
    const log = (msg) => { console.log(msg); output += msg + '\n'; };

    try {
        log('Starting Balance Check...');
        log('WITHDRAW_FEE: ' + process.env.WITHDRAW_FEE);
        const FEE = Number(process.env.WITHDRAW_FEE) || 0;

        const [admins] = await db.query('SELECT id, username, email FROM admins');
        
        log(`Found ${admins.length} admins.`);

        for (const admin of admins) {
            log(`\n--- Admin: ${admin.username} (ID: ${admin.id}) ---`);

            const [allTrans] = await db.query(
                "SELECT COUNT(*) as count, COALESCE(SUM(amount - COALESCE(fee,0)), 0) as total FROM transactions WHERE admin_id = ? AND status = 'success'", 
                [admin.id]
            );

            const [momoTrans] = await db.query(
                "SELECT COUNT(*) as count, COALESCE(SUM(amount - COALESCE(fee,0)), 0) as total FROM transactions WHERE admin_id = ? AND status = 'success' AND payment_method != 'manual'", 
                [admin.id]
            );

            const [withdrawals] = await db.query(
                'SELECT COUNT(*) as count, COALESCE(SUM(amount + COALESCE(fee, 0)), 0) as total FROM withdrawals WHERE admin_id = ? AND (status="success" OR status="pending")', 
                [admin.id]
            );

            const totalRev = Number(allTrans[0].total);
            const momoRev = Number(momoTrans[0].total);
            const totalWithdrawn = Number(withdrawals[0].total);

            const balanceRaw = totalRev - totalWithdrawn;
            let withdrawable = balanceRaw - FEE;
            if (withdrawable < 0) withdrawable = 0;

            log(`Global Revenue (All): ${totalRev} (Count: ${allTrans[0].count})`);
            log(`Global Revenue (MoMo Only): ${momoRev} (Count: ${momoTrans[0].count})`);
            log(`Total Withdrawals: ${totalWithdrawn} (Count: ${withdrawals[0].count})`);
            log(`Raw Balance: ${balanceRaw}`);
            log(`Withdrawable (Raw - ${FEE}): ${withdrawable}`);
        }

    } catch (e) {
        log('Error: ' + e.message);
        console.error(e);
    } finally {
        fs.writeFileSync(path.join(__dirname, 'balance_log.txt'), output);
        process.exit();
    }
}

run();
