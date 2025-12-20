const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' }); // Adjust path if running from scripts/ dir

async function resetPassword() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node reset_password.js <username> <new_password>');
        process.exit(1);
    }

    const [username, newPassword] = args;

    try {
        // Create Connection
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        console.log(`🔒 Hashing password for user: ${username}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update DB
        const [result] = await connection.execute(
            'UPDATE admins SET password_hash = ? WHERE username = ?',
            [hashedPassword, username]
        );

        if (result.affectedRows > 0) {
            console.log('✅ Password successfully updated!');
        } else {
            console.error('❌ User not found.');
        }

        await connection.end();

    } catch (err) {
        console.error('Error:', err);
    }
}

resetPassword();
