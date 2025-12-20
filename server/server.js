const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { limiter, authLimiter } = require('./src/middleware/rateLimiter');

const app = express();
const PORT = 5002;

// Middleware
app.use(cors()); // Allow all origins for now
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client'))); // Serve frontend files

// Routes
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const publicRoutes = require('./src/routes/publicRoutes');
const superAdminRoutes = require('./src/routes/superAdminRoutes');

app.use('/api', limiter); // Apply general limits to all API routes
app.use('/api/auth', authLimiter); // Apply strict limits to auth routes (if you have a specific auth path suffix)
// Note: Since routes are mounted on /api, we should apply specific middleware carefully or in the route files.
// However, the user asked for protections. Let's apply authLimiter carefully.
// Actually, looking at routes, authRoutes is mounted on /api. 
// authRoutes has /login. So path is /api/login.
// We can apply authLimiter specifically to the login route or generally to authRoutes if they were separated.
// But wait, authRoutes is mounted at /api. 
// Let's refine the approach: apply limiter globally to /api, and authLimiter to specific paths.

app.use('/api/login', authLimiter); // Protect login specifically
app.use('/api', authRoutes);
app.use('/api', publicRoutes); // Packages, Connect
app.use('/api', paymentRoutes); // Payments - moved up to avoid admin middleware capture
app.use('/api/super', superAdminRoutes); // Super Admin Routes
app.use('/api', adminRoutes);  // Protected Admin Routes

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});