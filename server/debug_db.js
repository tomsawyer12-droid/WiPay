const path = require('path');
const cwd = process.cwd();
console.log('CWD:', cwd);

try {
    require('dotenv').config();
    const db = require('./src/config/db');
    console.log('DB Module Loaded');

    // Print masked config
    console.log('DB Config Check:', {
        HOST: process.env.DB_HOST,
        USER: process.env.DB_USER,
        PORT: process.env.DB_PORT || 3306,
        PASS_LEN: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 'MISSING'
    });

    db.getConnection().then(conn => {
        console.log('Successfully obtained connection!');
        conn.release();
        process.exit(0);
    }).catch(err => {
        console.error('Failed to get connection:', err.message);
        process.exit(1);
    });

} catch (e) {
    console.error('Error in debug script:', e);
}
