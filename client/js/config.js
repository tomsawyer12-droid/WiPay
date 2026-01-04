// Production Config
const CONFIG = {
    // Since we are using Nginx to proxy /api -> localhost:5002
    // We can just use the relative path. This works for IP, Domain, and anything else.
    API_BASE_URL: '/api'
};

// DEV OVERRIDE (For when you open the file locally on your laptop)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    console.warn("Running in Development Mode");
    CONFIG.API_BASE_URL = 'http://localhost:5002'; // Or your local server IP
}
