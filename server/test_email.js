const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const transporter = nodemailer.createTransport(
    process.env.EMAIL_HOST
        ? {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        }
        : {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        }
);

async function testEmail() {
    const to = process.env.EMAIL_USER;
    console.log(`Attempting to send test email to ${to}...`);

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'WiPay Email Test',
            text: 'This is a test email from your WiPay server to verify that the email system is working correctly.'
        });
        console.log('SUCCESS: Test email sent!');
    } catch (err) {
        console.error('FAILURE: Could not send email:', err.message);
    }
}

testEmail();
