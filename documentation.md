# WiPay Project Documentation

## 1. Project Overview
**WiPay** (Garuga Spot) is a multi-tenant application designed to manage and monetize Wi-Fi hotspots. It consists of:
1.  **Customer Portal (`public/index.html`)**: Allows users to view internet packages, pay via Mobile Money (Relworx), and connect. Supports multiple admins via URL or configuration.
2.  **Admin Dashboard (`public/dashboard.html`)**: Protected management interface for business owners to track sales, manage vouchers/packages, and monitor logs. Each admin sees ONLY their own data.
3.  **Backend (`server.js`)**: A lean Node.js/Express server that serves as the entry point, importing logic from the `src/` directory.

---

## 2. File Structure (Refactored)
The project now follows a professional, modular structure:

### Root Directory
*   `server.js`: The main entry point. Sets up Express, Middleware, and Routes.
*   `.env`: Environment variables (API Keys, Database Config).

### `/public` (Frontend Assets)
Contains all static files served by Express.
*   `index.html`: Public landing page (Captive Portal).
*   `dashboard.html`: Admin management interface.
*   `login.html`: Admin login page.
*   **`/css`**: Contains `style.css`, `dashboard.css`, `login.css`.
*   **`/img`**: Contains images like `Wifi-Icon.png`, `favicon.png`.

### `/src` (Backend Logic)
*   **`/config`**:
    *   `db.js`: Database connection pool (MySQL).
    *   `session.js`: Simple in-memory session store.
*   **`/middleware`**:
    *   `auth.js`: JWT Authentication middleware (`authenticateToken`).
*   **`/routes`**:
    *   `authRoutes.js`: Login, Change Password.
    *   `adminRoutes.js`: Managing Categories, Packages, Vouchers, and Stats.
    *   `publicRoutes.js`: Fetching packages (public), Checking connection status.
    *   `paymentRoutes.js`: Payment initiation, Polling (Relworx API), Withdrawals.
*   **`/utils`**:
    *   `sms.js`: Utility to send SMS via UGSMS.

### `/scripts` (Utilities)
*   `create_admin.js`: CLI tool to create new admin accounts.
*   `setup_multitenancy.js`: Database schema migration script.

---

## 3. Key Features

### Multi-Tenancy & Security
*   **Data Isolation**: All queries are scoped by `admin_id`. Admin A cannot see Admin B's revenue or vouchers.
*   **Secure Auth**: Uses `bcrypt` for password hashing and `jsonwebtoken` for stateless session management.

### Payment & Withdrawals
*   **Integration**: Direct integration with Relworx Mobile Money API.
*   **Polling Mechanism**: The frontend polls `/api/check-payment-status` to confirm transactions without needing public-facing webhooks (useful for local/router deployments).
*   **Withdrawals**: Admins can withdraw funds to their mobile money number. The system calculates `Net Balance = Total Revenue - Total Withdrawals`.

### Voucher System
*   **Import**: Bulk CSV import supported.
*   **Sales**: "Sell Voucher" feature sends code via SMS and marks it as sold/used.
*   **Auto-Assignment**: Upon successful mobile money payment, a voucher is automatically assigned and texted to the user.

---

## 4. API Reference

### Public Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/packages?admin_id=X` | Fetches packages for a specific admin. |
| `POST` | `/api/purchase` | Initiates pay request to Relworx. |
| `POST` | `/api/check-payment-status` | Checks transaction status (Polling). |
| `POST` | `/api/connect` | Verifies active session for internet access. |

### Admin Endpoints (Protected)
*Headers: `Authorization: Bearer <token>`*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Get JWT Token. |
| `GET` | `/api/admin/stats` | Returns financial data (Revenue, Withdrawals, Graphs). |
| `POST` | `/api/admin/withdraw` | withdraw funds. |
| `GET/POST`| `/api/admin/packages` | Manage packages. |
| `GET/DEL` | `/api/admin/vouchers` | Manage vouchers. |

---

## 5. Setup & Run

1.  **Install Dependencies**: `npm install`
2.  **Database**: Ensure MySQL is running. Run `node scripts/setup_multitenancy.js`.
3.  **Config**: Update `.env` with credentials.
4.  **Start Server**: `node server.js`
5.  **Access**: `http://localhost:5002`
