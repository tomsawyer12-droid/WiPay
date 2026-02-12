const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function test() {
    console.log('Testing connection to:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            ssl: {
                rejectUnauthorized: false
            }
        });
        console.log('✅ Success! Connected to database.');
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('Query result:', rows[0].result);
        await connection.end();
    } catch (err) {
        console.error('❌ Connection Failed:');
        console.error('Error Code:', err.code);
        console.error('Error Name:', err.name);
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
}

test();
