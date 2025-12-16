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
*   `super_dashboard.html`: Super Admin interface (New).
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
    *   `superAdminRoutes.js`: Tenant management and System stats.
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

---

## 6. System Updates (Dec 2025)

### Hybrid Billing Model
The system now supports two billing types for Tenants (Admins):
1.  **Commission Based**: The tenant pays a 5% fee on every transaction. The fee is automatically deducted from `Total Revenue` to calculate `Net Balance`.
2.  **Subscription Based**: The tenant pays a fixed monthly fee (handled offline). The admin has full revenue access (`Net Balance` = `Total Revenue`). However, they must renew their subscription periodically.

**Implementation Steps**:
- Added `billing_type` ENUM('commission', 'subscription') to `admins` table.
- Added `subscription_expiry` DATETIME to `admins` table.
- Updated `paymentRoutes.js` to conditionally calculate commission:
  - If `billing_type = 'commission'`: `commission = amount * 0.05`.
  - If `billing_type = 'subscription'`: `commission = 0`.

### Subscription Expiry & Enforcement
For subscription-based tenants, the system enforces validity:
- **Public Portal**: Packages are HIDDEN if the subscription is expired.
- **Admin Dashboard**:
  - Displays a **YELLOW WARNING** if expiry is within 2 days.
  - Displays a **RED BLOCKING OVERLAY** if expired, preventing dashboard access until renewed.

### Super Admin Dashboard (`super_dashboard.html`)
A new high-level dashboard was introduced for the platform owner.
- **Access**: Login via `login.html` using a user with role `super_admin`.
- **Capabilities**:
  - **Tenant Management**: Create new admins, View list, Delete admins.
  - **Billing Management**: Set billing type (Commission/Subscription) during creation.
  - **Subscription Renewal**: Update the `subscription_expiry` date for tenants.
  - **System Stats**: View total system-wide revenue and accumulated commission (approximate platform profit).

### Updated API Reference
**Super Admin Endpoints**:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/super/tenants` | List all tenants. |
| `POST` | `/api/super/tenants` | Create new tenant. |
| `PATCH` | `/api/super/tenants/:id/subscription` | Renew subscription. |
| `GET` | `/api/super/stats` | System-wide statistics. |
