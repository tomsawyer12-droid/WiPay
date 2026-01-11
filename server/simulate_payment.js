const db = require('./src/config/db');

async function runCallback() {
    console.log('--- STARTING SIMULATION ---');
    try {
        // 1. Get a Package
        const [pkgs] = await db.query('SELECT * FROM packages LIMIT 1');
        if (pkgs.length === 0) { console.error('No packages found'); process.exit(1); }
        const pkg = pkgs[0];
        console.log(`Using Package: ${pkg.name} (ID: ${pkg.id})`);

        // 2. Create Pending Transaction
        const ref = `SIM-${Date.now()}`;
        const phone = '+256700000000';
        console.log(`Creating Transaction: ${ref} for ${phone}`);

        await db.query(`
            INSERT INTO transactions (transaction_ref, phone_number, amount, package_id, status, admin_id)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `, [ref, phone, pkg.price, pkg.id, pkg.admin_id]);

        console.log('Transaction Created. Triggering Webhook...');

        // 3. Trigger Webhook
        const webhookUrl = 'http://127.0.0.1:5002/api/webhook';
        const payload = JSON.stringify({
            status: 'success',
            reference: ref,
            amount: pkg.price,
            msisdn: phone
        });

        // Use native fetch (Node 18+)
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            body: payload
        });

        console.log(`Webhook Response: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log('Body:', text);

        // 4. Verify DB Status
        const [rows] = await db.query('SELECT status, voucher_code, fee FROM transactions WHERE transaction_ref = ?', [ref]);
        console.log('Final DB State:', rows[0]);

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        process.exit(0);
    }
}

runCallback();
