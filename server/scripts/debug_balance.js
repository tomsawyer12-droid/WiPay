const db = require('../src/config/db');
require('dotenv').config();

async function run() {
    console.log('--- Debugging Balance for Admin 1 ---');
    try {
        const adminId = 1;

        // 1. Check Transactions
        const [txs] = await db.query("SELECT id, amount, fee, status, admin_id FROM transactions WHERE admin_id = ? AND status = 'success'", [adminId]);
        console.log(`Found ${txs.length} successful transactions for Admin ${adminId}:`);
        txs.forEach(t => console.log(` - ID: ${t.id}, Amt: ${t.amount}, Fee: ${t.fee} (${typeof t.fee})`));

        // 2. Check Withdrawals
        const [wds] = await db.query("SELECT id, amount FROM withdrawals WHERE admin_id = ?", [adminId]);
        console.log(`Found ${wds.length} withdrawals.`);

        // 3. Run Balance Query
        const [transStats] = await db.query("SELECT COALESCE(SUM(amount - IFNULL(fee, 0)), 0) as total_revenue FROM transactions WHERE status = 'success' AND admin_id = ?", [adminId]);
        const [withdrawStats] = await db.query("SELECT COALESCE(SUM(amount), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ?", [adminId]);

        console.log('Raw Revenue Query Result:', transStats[0]);
        console.log('Raw Withdraw Query Result:', withdrawStats[0]);

        const totalRev = Number(transStats[0].total_revenue);
        const totalWd = Number(withdrawStats[0].total_withdrawn);
        console.log(`Calculated Balance: ${totalRev} - ${totalWd} = ${totalRev - totalWd}`);

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

run();
