require('dotenv').config();
const db = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function listTables() {
    try {
        console.log('DB Config:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });

        const [rows] = await db.query('SHOW TABLES');
        const output = JSON.stringify(rows, null, 2);
        console.log('Tables fetched. Writing to file...');
        fs.writeFileSync(path.join(__dirname, 'tables_dump.json'), output);
        console.log('Done.');
    } catch (e) {
        console.error(e);
        fs.writeFileSync(path.join(__dirname, 'tables_error.txt'), e.toString());
    } finally {
        process.exit();
    }
}

listTables();
