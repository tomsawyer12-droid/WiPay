const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wipay'
};

async function checkSchema() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        console.log('Checking withdrawals table...');
        const [columns] = await conn.query('SHOW COLUMNS FROM withdrawals');
        console.log(columns);

        console.log('Checking recent withdrawals...');
        const [rows] = await conn.query('SELECT * FROM withdrawals ORDER BY id DESC LIMIT 5');
        console.log(rows);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await conn.end();
    }
}

checkSchema();
