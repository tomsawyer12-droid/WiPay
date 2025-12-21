const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wipay_db'
};

async function expireUser() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Expiring testadmin...');
        await connection.query('UPDATE admins SET subscription_expiry = ? WHERE username = ?', ['2023-01-01 00:00:00', 'testadmin']);
        console.log('✅ testadmin is now EXPIRED.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

expireUser();
