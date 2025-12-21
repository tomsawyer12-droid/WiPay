const { sendPaymentNotification } = require('../src/utils/email');
require('dotenv').config();

console.log('Testing email...');
console.log('User:', process.env.EMAIL_USER);
const pass = process.env.EMAIL_PASS;
console.log('Pass Status:', pass ? `Loaded (Length: ${pass.length})` : 'UNDEFINED or EMPTY');

async function run() {
    try {
        await sendPaymentNotification('ataho955@gmail.com', 500, '+256700000000', 'TEST-REF', 'TEST-VOUCHER');
        console.log('Test function called.');
    } catch (e) {
        console.error('Test script error:', e);
    }
}

run();
