const db = require('./src/config/db');

async function checkResources() {
    try {
        console.log('--- Checking Resources Table ---');
        const [rows] = await db.query('SELECT * FROM resources');
        console.log(`Found ${rows.length} resources:`);
        rows.forEach(r => console.log(`- [${r.id}] ${r.title} (${r.file_path})`));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkResources();
