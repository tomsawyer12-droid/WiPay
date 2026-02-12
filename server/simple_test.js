require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    debug: true, // Enable debug
    logger: true // Log to console
});

async function test() {
    console.log("Starting Simple Test...");
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.EMAIL_USER,
            subject: 'SMTP Test',
            text: 'Hello from UGPAY test script'
        });
        console.log('Success:', info.messageId);
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
