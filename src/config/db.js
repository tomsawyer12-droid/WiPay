const mysql = require('mysql2/promise');
require('dotenv').config(); // Ensure env vars are loaded

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'wipay',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = db;
