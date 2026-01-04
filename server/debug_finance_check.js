const db = require('./src/config/db');

async function checkFinance() {
    try {
        const adminId = 31; // Based on logs
        console.log(`Checking finance for Admin ID: ${adminId}`);

        // 1. Raw Revenue
        const [rows] = await db.query(`
            SELECT id, amount, fee, status, payment_method, transaction_ref, created_at 
            FROM transactions 
            WHERE admin_id = ? 
            ORDER BY id DESC
        `, [adminId]);

        console.log('--- ALL TRANSACTIONS ---');
        let calculatedRevenue = 0;
        rows.forEach(r => {
            const isSuccess = r.status === 'success';
            const isNotManual = r.payment_method !== 'manual';
            const isNotSMS = !r.transaction_ref.startsWith('SMS-');

            let amount = parseFloat(r.amount) || 0;
            let fee = parseFloat(r.fee) || 0;
            let net = amount - fee;

            if (isSuccess && isNotManual && isNotSMS) {
                calculatedRevenue += net;
                console.log(`[INCLUDE] ID:${r.id} Amount:${amount} Fee:${fee} Net:${net} Ref:${r.transaction_ref}`);
            } else {
                console.log(`[SKIP]    ID:${r.id} Status:${r.status} Method:${r.payment_method} Ref:${r.transaction_ref}`);
            }
        });

        console.log('------------------------');
        console.log('Calculated Total Revenue:', calculatedRevenue);

        // 2. Withdrawals
        const [withdrawals] = await db.query(`SELECT * FROM withdrawals WHERE admin_id = ?`, [adminId]);
        let totalWithdrawn = 0;
        console.log('--- WITHDRAWALS ---');
        withdrawals.forEach(w => {
            let amt = parseFloat(w.amount) || 0;
            totalWithdrawn += amt;
            console.log(`ID:${w.id} Amount:${amt}`);
        });
        console.log('------------------------');
        console.log('Calculated Total Withdrawn:', totalWithdrawn);
        console.log('NET BALANCE (Rev - Withdrawn):', calculatedRevenue - totalWithdrawn);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkFinance();
