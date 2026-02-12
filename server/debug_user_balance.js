require('dotenv').config();
const db = require('./src/config/db');

async function checkUserBalance() {
    try {
        const searchTerm = 'ATAHO'; // Searching for partial match
        console.log(`Searching for admin matching: "${searchTerm}"...`);

        const [admins] = await db.query(
            'SELECT * FROM admins WHERE username LIKE ? OR business_name LIKE ? OR email LIKE ?', 
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );

        if (admins.length === 0) {
            console.log('No admin found with that name locally.');
            const [allAdmins] = await db.query('SELECT id, username, business_name FROM admins LIMIT 5');
            console.log('Available admins:', allAdmins);
            return;
        }

        const admin = admins[0];
        console.log(`Found Admin: ${admin.username} (ID: ${admin.id}) Business: ${admin.business_name}`);

        // 1. Finance Stats
        const [transRows] = await db.query(
             "SELECT COALESCE(SUM(amount - COALESCE(fee, 0)), 0) as rev FROM transactions WHERE admin_id = ? AND status = 'success'", 
             [admin.id]
        );
        const globalRevenue = Number(transRows[0].rev);

        const [withdrawRows] = await db.query(
            'SELECT COALESCE(SUM(amount + COALESCE(fee, 0)), 0) as total_withdrawn FROM withdrawals WHERE admin_id = ? AND (status="success" OR status="pending")', 
            [admin.id]
        );
        const totalWithdrawn = Number(withdrawRows[0].total_withdrawn);

        // 2. Logic Check
        const totalBalance = globalRevenue - totalWithdrawn;
        const WITHDRAW_FEE = Number(process.env.WITHDRAW_FEE) || 0;
        
        let netBalance = totalBalance - WITHDRAWAL_FEE;
        
        console.log('--- Calculation Breakdown ---');
        console.log(`Global Revenue:     ${globalRevenue.toLocaleString()} UGX`);
        console.log(`Total Withdrawals: -${totalWithdrawn.toLocaleString()} UGX`);
        console.log(`--------------------------------`);
        console.log(`Total Wallet Bal:   ${totalBalance.toLocaleString()} UGX`);
        console.log(`Minus Reserve Fee: -${WITHDRAW_FEE.toLocaleString()} UGX`);
        console.log(`--------------------------------`);
        console.log(`Withdrawable Bal:   ${Math.max(0, netBalance).toLocaleString()} UGX`);
        
        if (netBalance <= 0 && totalBalance > 0) {
            console.log('\n[CONCLUSION]: Your Total Balance is positive, but it is less than or equal to the Withdrawal Reserve Fee (2000). Hence, Withdrawable is 0.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkUserBalance();
