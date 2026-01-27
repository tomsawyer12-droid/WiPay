const express = require('express');
const router = express.Router();
const db = require('../config/db');

// @route   POST /api/register-request
// @desc    Submit a new client registration request
// @access  Public
router.post('/register-request', async (req, res) => {
    const {
        first_name,
        last_name,
        email,
        phone_number,
        whatsapp_number,
        hotspot_name,
        customer_care_contacts,
        device_type,
        login_method,
        address,
        system_usage
    } = req.body;

    // Basic Validation
    if (!first_name || !last_name || !email || !phone_number || !hotspot_name) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    try {
        const query = `
            INSERT INTO registration_requests (
                first_name, last_name, email, phone_number, whatsapp_number, 
                hotspot_name, customer_care_contacts, device_type, login_method, 
                address, system_usage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            first_name, last_name, email, phone_number, whatsapp_number,
            hotspot_name, customer_care_contacts, device_type, login_method,
            address, system_usage
        ];

        await db.query(query, values);

        res.status(201).json({ message: 'Registration request submitted successfully.' });
    } catch (err) {
        console.error('Registration Request Error:', err);
        res.status(500).json({ error: 'Database error. Please try again later.' });
    }
});

module.exports = router;
