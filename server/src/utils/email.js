const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendPaymentNotification(toEmail, amount, phone, ref, voucherCode, balance, username) {
    if (!toEmail) {
        console.warn('[EMAIL] No admin email provided. Skipping notification.');
        return;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `Payment Received: ${amount} UGX`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #4caf50;">Payment Successful</h2>
                <p>Hello ${username || 'Admin'},</p>
                <p>A new payment has been confirmed.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${Number(amount).toLocaleString()} UGX</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Payer:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${phone}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Reference:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${ref}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Voucher:</strong></td>
                        <td style="padding: 8px; border-bottom: 1px solid #eee;">${voucherCode || 'N/A'}</td>
                    </tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #4caf50;">
                    <strong>Current Balance:</strong> ${balance ? Number(balance).toLocaleString() : '0'} UGX
                </div>
                <p style="margin-top: 20px; color: #777; font-size: 12px;">WiPay Notification System</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Sent to ${toEmail} for Ref: ${ref}`);
    } catch (err) {
        console.error('[EMAIL] Failed to send:', err.message);
    }
}

async function sendSMSPurchaseNotification(toEmail, amount, credits, ref, balance, username) {
    if (!toEmail) return;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `SMS Credits Purchased: ${credits} Credits`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #2196f3;">SMS Credits Added</h2>
                <p>Hello ${username || 'Admin'},</p>
                <p>You have successfully purchased SMS credits.</p>
                <p><strong>Amount:</strong> ${Number(amount).toLocaleString()} UGX</p>
                <p><strong>Credits Added:</strong> ${credits}</p>
                <p><strong>Reference:</strong> ${ref}</p>
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #2196f3;">
                    <strong>Current Balance:</strong> ${balance ? Number(balance).toLocaleString() : '0'} UGX
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error('[EMAIL] Failed to send SMS Notification:', err.message);
    }
}

async function sendWithdrawalNotification(toEmail, amount, phone, ref, description, balance, username) {
    if (!toEmail) return;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: `Withdrawal Initiated: ${Number(amount).toLocaleString()} UGX`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #ff9800;">Withdrawal Initiated</h2>
                <p>Hello ${username || 'Admin'},</p>
                <p>A withdrawal request has been processed.</p>
                <p><strong>Amount:</strong> ${Number(amount).toLocaleString()} UGX</p>
                <p><strong>Recipient:</strong> ${phone}</p>
                <p><strong>Reason:</strong> ${description}</p>
                <p><strong>Reference:</strong> ${ref}</p>
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #ff9800;">
                    <strong>Current Balance:</strong> ${balance ? Number(balance).toLocaleString() : '0'} UGX
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (err) {
        console.error('[EMAIL] Failed to send Withdrawal Notification:', err.message);
    }
}

module.exports = { sendPaymentNotification, sendSMSPurchaseNotification, sendWithdrawalNotification };
