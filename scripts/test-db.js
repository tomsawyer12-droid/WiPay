const db = require('../src/config/db');

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        const connection = await db.getConnection();
        console.log('Successfully connected to the database!');
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
}

testConnection();
