const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send OTP Email
 * @param {string} to - Recipient email
 * @param {string} code - The OTP code
 */
const sendOTP = async (to, code) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Auth" <${process.env.EMAIL_FROM}>`,
            to: to,
            subject: 'Your UGPAY Verification Code',
            text: `Your verification code is: ${code}. It expires in 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">Complete Your Registration</h2>
                    <p>Use the code below to verify your email address:</p>
                    <div style="background: #f4f4f5; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        ${code}
                    </div>
                    <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
                </div>
            `,
        });
        console.log('OTP Email Sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
};

/**
 * Send Approval Email
 * @param {string} to - Recipient email
 */
const sendApprovalEmail = async (to) => {
    try {
        await transporter.sendMail({
            from: `"UGPAY Team" <${process.env.EMAIL_FROM}>`,
            to: to,
            subject: 'Account Approved - Welcome to UGPAY',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">Welcome Aboard!</h2>
                    <p>Your account has been approved by the admin. You can now login to your dashboard.</p>
                    <p><a href="https://ugpay.tech/login_dashboard.html" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login Dashboard</a></p>
                </div>
            `,
        });
        return true;
    } catch (error) {
        console.error('Error sending approval email:', error);
        return false;
    }
};

/**
 * Send Payment Notification (Voucher Sale)
 */
const sendPaymentNotification = async (email, amount, phone, ref, code, balance, username) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Payments" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `Sale Notification: UGX ${amount}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">New Voucher Sale!</h2>
                    <p>Hello <b>${username}</b>, you have a new successful transaction.</p>
                    <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><b>Amount:</b> UGX ${amount}</p>
                        <p><b>Customer:</b> ${phone}</p>
                        <p><b>Voucher Code:</b> ${code}</p>
                        <p><b>Reference:</b> ${ref}</p>
                        <p><b>Wallet Balance:</b> UGX ${balance}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">View details in your <a href="https://ugpay.tech/dashboard.html">Dashboard</a>.</p>
                </div>
            `,
        });
        console.log('Payment notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending payment notification:', error);
        return false;
    }
};

/**
 * Send SMS Purchase Notification
 */
const sendSMSPurchaseNotification = async (email, amount, credits, reference, balance, username) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Billing" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'SMS Top-up Successful',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">SMS Credits Added</h2>
                    <p>Hello <b>${username}</b>, your SMS wallet has been topped up.</p>
                    <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><b>Amount Paid:</b> UGX ${amount}</p>
                        <p><b>Reference:</b> ${reference}</p>
                        <p><b>Current Balance:</b> UGX ${balance}</p>
                    </div>
                </div>
            `,
        });
        console.log('SMS purchase notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending SMS purchase notification:', error);
        return false;
    }
};

/**
 * Send Withdrawal OTP
 */
const sendWithdrawalOTP = async (email, otp, username) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Security" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Withdrawal Authorization Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #ef4444;">Authorize Withdrawal</h2>
                    <p>Hello <b>${username}</b>, use the code below to authorize your withdrawal request:</p>
                    <div style="background: #fee2e2; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; margin: 20px 0; color: #b91c1c;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #666;">If you did not initiate this, please secure your account immediately.</p>
                </div>
            `,
        });
        console.log('Withdrawal OTP sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending withdrawal OTP:', error);
        return false;
    }
};

/**
 * Send Withdrawal Notification
 */
const sendWithdrawalNotification = async (email, amount, phone, reference, description, balance, username) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Finance" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Withdrawal Successful',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #10b981;">Funds Withdrawn</h2>
                    <p>Hello <b>${username}</b>, your withdrawal request has been processed successfully.</p>
                    <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><b>Amount:</b> UGX ${amount}</p>
                        <p><b>To Phone:</b> ${phone}</p>
                        <p><b>Reference:</b> ${reference}</p>
                        <p><b>Description:</b> ${description}</p>
                        <p><b>Remaining Balance:</b> UGX ${balance}</p>
                    </div>
                </div>
            `,
        });
        console.log('Withdrawal notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending withdrawal notification:', error);
        return false;
    }
};

/**
 * Send Low SMS Balance Warning
 */
const sendLowSMSBalanceWarning = async (email, balance, username) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Alerts" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'CRITICAL: Low SMS Balance',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #f59e0b;">Low SMS Balance Alert</h2>
                    <p>Hello <b>${username}</b>, your SMS balance is very low.</p>
                    <div style="background: #fffbeb; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><b>Current Balance:</b> UGX ${balance}</p>
                        <p>Your customers may not receive their voucher codes via SMS if the balance runs out.</p>
                    </div>
                    <p><a href="https://ugpay.tech/dashboard.html" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Top up Now</a></p>
                </div>
            `,
        });
        console.log('Low balance warning sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending low SMS balance warning:', error);
        return false;
    }
};

/**
 * Send Agent Sale Notification
 */
const sendAgentSaleNotification = async (adminEmail, agentName, amount, packageName, code, reference) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Agent System" <${process.env.EMAIL_FROM}>`,
            to: adminEmail,
            subject: `Agent Sale: ${agentName} - UGX ${amount}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 10px;">
                    <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Agent Sale Recorded</h2>
                    <p>Field Agent <b>${agentName}</b> has record a new physical sale.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <p style="margin: 5px 0;"><b>Package:</b> ${packageName}</p>
                        <p style="margin: 5px 0;"><b>Amount:</b> UGX ${amount.toLocaleString()}</p>
                        <p style="margin: 5px 0;"><b>Voucher Code:</b> <span style="font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 3px;">${code}</span></p>
                        <p style="margin: 5px 0;"><b>Reference:</b> ${reference}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">This sale is marked as <b>unsettled</b> in your dashboard until you collect the cash.</p>
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="https://ugpay.tech/dashboard.html" style="background: #6366f1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review in Dashboard</a>
                    </p>
                </div>
            `,
        });
        console.log('Agent sale notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending agent sale notification:', error);
        return false;
    }
};

/**
 * Send Registration Notification to Admin
 */
const sendRegistrationNotification = async (adminEmail, registrationData) => {
    try {
        const info = await transporter.sendMail({
            from: `"UGPAY Registration System" <${process.env.EMAIL_FROM}>`,
            to: adminEmail,
            subject: `New Registration Request: ${registrationData.first_name} ${registrationData.last_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; border-radius: 10px;">
                    <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">New Registration Request</h2>
                    <p>A new client has submitted a registration request and verified their email.</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <h3 style="margin-top: 0; color: #10b981;">Contact Information</h3>
                        <p style="margin: 5px 0;"><b>Name:</b> ${registrationData.first_name} ${registrationData.last_name}</p>
                        <p style="margin: 5px 0;"><b>Email:</b> ${registrationData.email}</p>
                        <p style="margin: 5px 0;"><b>Phone:</b> ${registrationData.phone_number}</p>
                        <p style="margin: 5px 0;"><b>WhatsApp:</b> ${registrationData.whatsapp_number || 'N/A'}</p>
                        
                        <h3 style="margin-top: 20px; color: #10b981;">Business Details</h3>
                        <p style="margin: 5px 0;"><b>Hotspot Name:</b> ${registrationData.hotspot_name}</p>
                        <p style="margin: 5px 0;"><b>Customer Care:</b> ${registrationData.customer_care_contacts || 'N/A'}</p>
                        <p style="margin: 5px 0;"><b>Address:</b> ${registrationData.address || 'N/A'}</p>
                        
                        <h3 style="margin-top: 20px; color: #10b981;">Technical Information</h3>
                        <p style="margin: 5px 0;"><b>Device Type:</b> ${registrationData.device_type || 'N/A'}</p>
                        <p style="margin: 5px 0;"><b>Login Method:</b> ${registrationData.login_method || 'N/A'}</p>
                        <p style="margin: 5px 0;"><b>System Usage:</b> ${registrationData.system_usage || 'N/A'}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">This request is <b>pending approval</b>. Please review and approve/reject in the dashboard.</p>
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="https://ugpay.tech/dashboard.html" style="background: #10b981; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review in Dashboard</a>
                    </p>
                </div>
            `,
        });
        console.log('Registration notification sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending registration notification:', error);
        return false;
    }
};

module.exports = { 
    sendOTP, 
    sendApprovalEmail, 
    sendPaymentNotification, 
    sendSMSPurchaseNotification, 
    sendWithdrawalOTP, 
    sendWithdrawalNotification, 
    sendLowSMSBalanceWarning,
    sendAgentSaleNotification,
    sendRegistrationNotification
};
