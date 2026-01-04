// Running Security Audit
// Node 18+ has native fetch.

// Node 18+ has native fetch.

const TARGET_URL = 'https://ugpay.tech';

async function runTests() {
    console.log(`🛡️  Starting Security Audit on ${TARGET_URL}...\n`);

    await testProtectedRoutes();
    await testSQLInjection();
    await testBruteForceProtection();
}

async function testProtectedRoutes() {
    console.log('1️⃣  Testing Unloading Access (Protected Routes)...');
    try {
        const res = await fetch(`${TARGET_URL}/api/admin/stats`);
        if (res.status === 401 || res.status === 403) {
            console.log('✅ PASS: Protected route blocked unauthenticated request (Status: ' + res.status + ')');
        } else {
            console.log('❌ FAIL: Protected route accessible without token! (Status: ' + res.status + ')');
        }
    } catch (e) { console.error('Error:', e.message); }
    console.log('---');
}

async function testSQLInjection() {
    console.log('2️⃣  Testing SQL Injection (Login)...');
    try {
        const payload = { username: "' OR '1'='1", password: "' OR '1'='1" };
        const res = await fetch(`${TARGET_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            console.log('✅ PASS: SQL Injection attempt rejected (Status: 401)');
        } else if (res.status === 200) {
            console.log('❌ FAIL: SQL Injection SUCCEEDED! User logged in.');
        } else {
            console.log('⚠️  INFO: Server responded with ' + res.status + ' (likely safe, check logs)');
        }
    } catch (e) { console.error('Error:', e.message); }
    console.log('---');
}

async function testBruteForceProtection() {
    console.log('3️⃣  Testing Brute-Force Rate Limiting...');
    console.log('   (Sending 12 login attempts rapidly...)');

    let blocked = false;
    for (let i = 1; i <= 15; i++) {
        try {
            const res = await fetch(`${TARGET_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: "imacker", password: "wrongpassword" })
            });

            if (res.status === 429) {
                console.log(`✅ PASS: Request #${i} was BLOCKED on purpose (Rate Limit Active).`);
                blocked = true;
                break;
            }
            // Don't log every success to keep output clean, just the first few
            if (i <= 3) console.log(`   Attempt #${i}: Status ${res.status}`);
        } catch (e) {
            console.error(`   Attempt #${i} Error:`, e.message);
        }
    }

    if (!blocked) {
        console.log('❌ FAIL: Rate Limiting did not trigger after 15 attempts.');
    }
    console.log('---');
}

runTests();
