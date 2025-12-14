const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wipay'
};

async function createAdmin(username, password) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        // Check if exists
        const [rows] = await conn.query('SELECT * FROM admins WHERE username = ?', [username]);
        if (rows.length > 0) {
            console.log(`Error: Admin "${username}" already exists.`);
            return;
        }

        const hash = await bcrypt.hash(password, 10);
        await conn.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
        console.log(`Success: Admin "${username}" created.`);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await conn.end();
    }
}

// Usage: node create_admin.js <username> <password>
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node create_admin.js <username> <password>');
} else {
    createAdmin(args[0], args[1]);
}
