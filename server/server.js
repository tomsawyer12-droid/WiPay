const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (for ngrok/local)
        methods: ["GET", "POST"]
    }
});

const PORT = 5002;

app.set('trust proxy', 1);

// Attach IO to request for routes to use
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- Security Middleware ---

// 1. Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many login attempts, please try again later.',
});

// 2. CORS Policy
app.use(cors());

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
app.use('/api', authRoutes);
app.use('/api', publicRoutes);
app.use('/api', paymentRoutes);
app.use('/api/super', superAdminRoutes);
app.use('/api', adminRoutes);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});