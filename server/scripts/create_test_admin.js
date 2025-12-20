const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config(); // Loads .env from current directory (server/)

async function createTestAdmin() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'wipay'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const username = 'testadmin';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if exists
        const [rows] = await connection.execute('SELECT * FROM admins WHERE username = ?', [username]);
        if (rows.length > 0) {
            console.log('Test admin already exists. Updating password...');
            await connection.execute('UPDATE admins SET password_hash = ? WHERE username = ?', [hashedPassword, username]);
        } else {
            console.log('Creating new test admin...');
            await connection.execute(
                'INSERT INTO admins (username, password_hash, role, billing_type) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, 'admin', 'commission']
            );
        }

        console.log('Success! Login with:');
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);

        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

createTestAdmin();
