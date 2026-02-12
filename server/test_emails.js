require('dotenv').config();
const { 
    sendOTP, 
    sendApprovalEmail, 
    sendPaymentNotification, 
    sendSMSPurchaseNotification, 
    sendWithdrawalOTP, 
    sendWithdrawalNotification, 
    sendLowSMSBalanceWarning 
} = require('./src/utils/email');

const testEmail = process.env.EMAIL_USER; // Send to self for testing
const username = "Test Admin";

async function runTests() {
    console.log("Starting Email Tests...");

    // Test Payment Notification
    console.log("Testing sendPaymentNotification...");
    await sendPaymentNotification(testEmail, 5000, "+256700000000", "REF-TEST-123", "XY-99-ZZ", 25000, username);

    // Test SMS Purchase Notification
    console.log("Testing sendSMSPurchaseNotification...");
    await sendSMSPurchaseNotification(testEmail, 10000, 200, "SMS-TEST-456", 15000, username);

    // Test Withdrawal OTP
    console.log("Testing sendWithdrawalOTP...");
    await sendWithdrawalOTP(testEmail, "654321", username);

    // Test Withdrawal Notification
    console.log("Testing sendWithdrawalNotification...");
    await sendWithdrawalNotification(testEmail, 20000, "+256711111111", "W-TEST-789", "Office Rent", 5000, username);

    // Test Low Balance Warning
    console.log("Testing sendLowSMSBalanceWarning...");
    await sendLowSMSBalanceWarning(testEmail, 850, username);

    console.log("Tests Complete. Check your inbox at:", testEmail);
}

runTests().catch(err => {
    console.error("Test Suite Failed:", err);
});
