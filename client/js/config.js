// REPLACE '192.168.1.74' with your Computer's Static IP if it changes!
const SERVER_IP = '192.168.1.74';
const SERVER_PORT = '5002';

// Logic to determine API URL based on where the page is loaded
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNgrok = window.location.hostname.includes('ngrok') || window.location.hostname.includes('loca.lt'); // Common tunnels
const isServerDirect = window.location.port === SERVER_PORT; // Accessed via port 5002

const CONFIG = {
    API_BASE_URL: (isLocal || isNgrok || isServerDirect)
        ? `${window.location.origin}/api`  // Use relative/origin URL (supports HTTPS/ngrok)
        : `http://${SERVER_IP}:${SERVER_PORT}/api` // Fallback for Router Hotspot (served from 192.168.88.1)
};

// Global Security Helper
function escapeHtml(text) {
    if (!text) return text;
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
