require('dotenv').config();
const db = require('./src/config/db');

async function checkAtaho() {
    try {
        console.log('Searching for "ATAHO" in admins...');
        const [admins] = await db.query('SELECT * FROM admins WHERE username LIKE "%ATAHO%" OR business_name LIKE "%ATAHO%"');

        if (admins.length === 0) {
            console.log('❌ No admin found matching "ATAHO".');
            return;
        }

        const admin = admins[0];
        console.log(`\n✅ Found Admin: ${admin.username} (ID: ${admin.id})`);
        console.log(`   Business: ${admin.business_name}`);
        console.log(`   Email: ${admin.email}`);

        // 1. Total (All)
        const [totalRows] = await db.query(
            "SELECT COUNT(*) as count, COALESCE(SUM(amount - COALESCE(fee, 0)), 0) as val FROM transactions WHERE admin_id = ? AND status = 'success'", 
            [admin.id]
        );
        const totalRev = Number(totalRows[0].val);

        // 2. MoMo Only (Non-Manual)
        const [momoRows] = await db.query(
            "SELECT COUNT(*) as count, COALESCE(SUM(amount - COALESCE(fee, 0)), 0) as val FROM transactions WHERE admin_id = ? AND status = 'success' AND payment_method != 'manual'", 
            [admin.id]
        );
        const momoRev = Number(momoRows[0].val);

        // 3. Manual Only
        const manualRev = totalRev - momoRev;

        // 4. Withdrawals
        const [wRows] = await db.query(
            'SELECT COUNT(*) as count, COALESCE(SUM(amount + COALESCE(fee, 0)), 0) as val FROM withdrawals WHERE admin_id = ? AND (status="success" OR status="pending")', 
            [admin.id]
        );
        const withdrawn = Number(wRows[0].val);

        // 5. Calculations
        const FEE = 2000;
        
        // Scenario A: Logic includes Manual
        const balA = totalRev - withdrawn;
        const withA = Math.max(0, balA - FEE);

        // Scenario B: Logic Excludes Manual (Strict MoMo)
        const balB = momoRev - withdrawn;
        const withB = Math.max(0, balB - FEE);

        console.log('\n--- BALANCE BREAKDOWN ---');
        console.log(`💰 Total Revenue (All):      ${totalRev.toLocaleString()} UGX (Txns: ${totalRows[0].count})`);
        console.log(`📱 MoMo Revenue:             ${momoRev.toLocaleString()} UGX (Txns: ${momoRows[0].count})`);
        console.log(`📝 Manual Revenue:           ${manualRev.toLocaleString()} UGX`);
        console.log(`💸 Total Withdrawals:       -${withdrawn.toLocaleString()} UGX (Count: ${wRows[0].count})`);
        console.log(`-----------------------------------`);
        console.log(`CURRENT WALLET CALCULATION (Includes Manual):`);
        console.log(`   Total Wallet:             ${balA.toLocaleString()} UGX`);
        console.log(`   Reserve Fee:             -${FEE.toLocaleString()} UGX`);
        console.log(`   👉 Withdrawable:          ${withA.toLocaleString()} UGX`);
        console.log(`-----------------------------------`);
        console.log(`IF WE EXCLUDE MANUAL TRANSACTIONS:`);
        console.log(`   MoMo Balance:             ${balB.toLocaleString()} UGX`);
        console.log(`   👉 Withdrawable:          ${withB.toLocaleString()} UGX`);
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkAtaho();
