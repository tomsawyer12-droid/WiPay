# WiPay VPS Deployment Guide

Moving from a Local PC to a VPS (e.g., DigitalOcean, AWS, Linode) requires changing how the **Phone** talks to the **Server**.

**Architecture Change:**
- **Old**: Phone -> Local LAN -> Laptop (192.168.1.74)
- **New**: Phone -> Internet -> VPS (Public IP or Domain)

---

## 1. Codebase Changes

### A. Client Configuration (`client/js/config.js`)
You must update the client files **before** uploading them to the Router. The phones need to know the *Public* address of your VPS.

**Modify `client/js/config.js`:**
```javascript
// REPLACE with your VPS Domain or Public IP
const SERVER_IP = 'your-vps-public-ip-or-domain.com'; 
const SERVER_PORT = '5002'; // Or '443' if setting up SSL (Recommended)

// If using HTTPS/Domain (Recommended):
const CONFIG = {
    // If you set up Nginx with SSL, remove the port
    API_BASE_URL: `https://vps-domain.com/api` 
};
```
*Tip: If you use a domain (like `wipay.com`), getting SSL (HTTPS) is free and much safer.*

### B. Server Configuration (`server/.env`)
On the VPS, create a `.env` file same as your local one, but update the Database credentials if the database is also on the VPS.
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_vps_mysql_password
DB_NAME=wipay_db
PORT=5002
```

---

## 2. What to Add (Server Setup)

You need to install the environment on the VPS.

### A. Install Node.js & Database
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm mysql-server git -y
```

### B. Process Manager (PM2)
You don't want the server to stop if you close the terminal. Use PM2.
```bash
sudo npm install -g pm2
# Start your app
pm2 start server.js --name wipay
# Make it auto-restart on boot
pm2 startup
pm2 save
```

### C. Nginx (Reverse Proxy) - *Highly Recommended*
This lets you use `http://your-site.com` (Port 80/443) instead of `:5002`.
1. Install Nginx: `sudo apt install nginx`
2. Configure it to forward traffic to `localhost:5002`.

---

## 3. Database Migration

1.  **Export Local Data**:
    - Open your local database tool (e.g., HeidiSQL/phpMyAdmin).
    - Export the `wipay_db` to a `.sql` file (e.g., `backup.sql`).
2.  **Import on VPS**:
    - Upload `backup.sql` to VPS.
    - Run: `mysql -u root -p wipay_db < backup.sql`

---

## 4. RouterOS Updates (CRITICAL)

Since the server IP is new, you **MUST** update the Router.

1.  **Walled Garden**:
    - Remove the old `192.168.1.74` entry.
    - Add the **VPS Public IP** or **Domain**.
    ```bash
    /ip hotspot walled-garden ip add action=accept dst-address=YOUR_VPS_IP
    # OR if using domain
    /ip hotspot walled-garden add action=accept dst-host=your-domain.com
    ```
2.  **Upload New Files**:
    - Upload the updated `login.html` and `js/config.js` (pointing to VPS) to the router.
