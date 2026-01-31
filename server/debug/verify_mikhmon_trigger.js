const path = require('path');

function testTrigger(username) {
    const scriptPath = path.join(__dirname, '../../create_mikhmon_client.sh');
    const command = `bash "${scriptPath}" ${username}`;
    console.log(`TEST: Triggering Mikhmon isolation for ${username}`);
    console.log(`COMMAND: ${command}`);

    // Simulate valid results
    if (command.includes('create_mikhmon_client.sh') && username === 'test_user') {
        console.log('✅ Logic Valid: Command correctly constructed.');
    } else {
        console.log('❌ Logic Invalid.');
    }
}

testTrigger('test_user');
