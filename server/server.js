const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = 5002;

app.set('trust proxy', 1); // Trust first proxy (ngrok) for rate limiting




// --- Security Middleware ---

// 1. Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000, // Increased from 100 to 3000 to allow auto-refresh (Every 10s = ~270 reqs/15m per user)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 login attempts per hour
    message: 'Too many login attempts, please try again later.',
});

// 2. CORS Policy
// 2. CORS Policy
app.use(cors()); // Allow all origins (essential for ngrok dynamic URLs)

// --- Middleware ---
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client')));

// --- Routes ---
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const superAdminRoutes = require('./src/routes/superAdminRoutes');

// Apply Limiters
app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);

// Mount Routes
app.use('/api', authRoutes); // Includes /auth/login
app.use('/api', publicRoutes);
app.use('/api', paymentRoutes);
app.use('/api/super', superAdminRoutes);
app.use('/api', adminRoutes);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});