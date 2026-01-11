const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken, verifySuperAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/resources');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp-original
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

// Middleware for all super admin routes
router.use(authenticateToken);
router.use(verifySuperAdmin);

// Get All Tenants (Admins) with their routers
router.get('/tenants', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id, a.username, a.role, a.billing_type, a.subscription_expiry, a.last_active_at, a.created_at,
                a.email, a.business_name, a.business_phone,
                JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'id', r.id,
                        'name', r.name,
                        'mikhmon_url', r.mikhmon_url
                    )
                ) as routers
            FROM admins a
            LEFT JOIN routers r ON a.id = r.admin_id
            GROUP BY a.id
            ORDER BY a.created_at DESC
        `;
        const [admins] = await db.query(query);

        // Clean up JSON_ARRAYAGG if no routers (MySQL returns [null] or similar)
        const cleanedAdmins = admins.map(admin => ({
            ...admin,
            routers: (admin.routers && admin.routers[0] && admin.routers[0].id !== null) ? admin.routers : []
        }));

        res.json(cleanedAdmins);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching tenants' });
    }
});

// Create New Tenant
router.post('/tenants', async (req, res) => {
    const { username, password, email, business_name, business_phone } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Check if username exists
        const [existing] = await db.query('SELECT id FROM admins WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const billingType = req.body.billing_type || 'commission';
        const userEmail = email || null;
        const bName = business_name || 'UGPAY';
        const bPhone = business_phone || null;

        await db.query('INSERT INTO admins (username, password_hash, role, billing_type, email, business_name, business_phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, hash, 'admin', billingType, userEmail, bName, bPhone]);

        res.status(201).json({ message: 'Tenant created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create tenant' });
    }
});

// Delete Tenant
router.delete('/tenants/:id', async (req, res) => {
    const tenantId = req.params.id;

    // Prevent deleting self
    if (parseInt(tenantId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    try {
        await db.query('DELETE FROM admins WHERE id = ?', [tenantId]);
        res.json({ message: 'Tenant deleted successfully' });
        // Note: In a real production app, we should probably soft-delete or handle their associated data.
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete tenant' });
    }
});

// Renew Subscription
router.patch('/tenants/:id/subscription', async (req, res) => {
    const tenantId = req.params.id;
    const { expiry_date } = req.body; // YYYY-MM-DD or Valid Date String

    if (!expiry_date) return res.status(400).json({ error: 'Date required' });

    try {
        await db.query('UPDATE admins SET subscription_expiry = ? WHERE id = ?', [expiry_date, tenantId]);
        res.json({ message: 'Subscription updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

// Update Tenant Profile
router.patch('/tenants/:id', async (req, res) => {
    const tenantId = req.params.id;
    const { business_name, business_phone, email } = req.body;

    try {
        await db.query(
            'UPDATE admins SET business_name = ?, business_phone = ?, email = ? WHERE id = ?',
            [business_name, business_phone, email, tenantId]
        );
        res.json({ message: 'Tenant updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update tenant' });
    }
});

// Reset Tenant Password
router.patch('/tenants/:id/password', async (req, res) => {
    const tenantId = req.params.id;
    const { new_password } = req.body;

    if (!new_password) return res.status(400).json({ error: 'New password is required' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(new_password, salt);

        await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, tenantId]);
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// System Stats
router.get('/stats', async (req, res) => {
    try {
        const [admins] = await db.query('SELECT COUNT(*) as count FROM admins WHERE role = "admin"');
        const [vouchers] = await db.query('SELECT COUNT(*) as count FROM vouchers');
        const [totalRevenue] = await db.query('SELECT SUM(amount) as total FROM transactions WHERE status = "SUCCESS"');
        const [totalFees] = await db.query('SELECT SUM(fee) as total FROM transactions WHERE status = "SUCCESS"');
        const [totalSubscriptions] = await db.query('SELECT SUM(amount) as total FROM admin_subscriptions WHERE status = "success"');

        res.json({
            tenantCount: admins[0].count,
            totalVouchers: vouchers[0].count,
            totalRevenue: totalRevenue[0].total || 0,
            totalCommission: totalFees[0].total || 0,
            totalSubscriptions: totalSubscriptions[0].total || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// --- RESOURCES (FILE UPLOAD) ---

// Upload Resource
router.post('/resources', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const { title, description } = req.body;
        // Path relative to server root for public access (served via static /uploads)
        const publicPath = '/uploads/resources/' + req.file.filename;

        await db.query(
            'INSERT INTO resources (title, file_path, description) VALUES (?, ?, ?)',
            [title, publicPath, description || '']
        );

        res.status(201).json({ message: 'File uploaded successfully', file: req.file });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// List Resources
router.get('/resources', async (req, res) => {
    try {
        const [files] = await db.query('SELECT * FROM resources ORDER BY created_at DESC');
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});

// Delete Resource
router.delete('/resources/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query('SELECT file_path FROM resources WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'File not found' });

        const filePath = rows[0].file_path; // e.g., /uploads/resources/filename
        const absolutePath = path.join(__dirname, '../../', filePath);

        // Remove from DB
        await db.query('DELETE FROM resources WHERE id = ?', [id]);

        // Remove from Disk
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }

        res.json({ message: 'Resource deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;
