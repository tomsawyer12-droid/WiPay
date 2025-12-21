# WiPay System Documentation

**WiPay (Garuga Spot)** is a multi-tenant Wi-Fi monetization platform. It enables admins (Tenants) to sell Wi-Fi vouchers to customers via Mobile Money or Cash.

---

## 1. System Architecture

The application follows a **Monolithic Client-Server Architecture**.

### 1.1 The Frontend (Client)
*   **Technology**: Vanilla HTML, CSS, JavaScript.
*   **Location**: `client/` folder.
*   **Role**:
    *   **`index.html`**: The Public Landing Page. Customers select packages and pay via Mobile Money.
    *   **`dashboard.html`**: The Admin Interface. Admins manage vouchers, view sales stats, and sell vouchers manually.
    *   **`login.html`**: Authentication portal for Admins and Super Admins.

### 1.2 The Backend (Server)
*   **Technology**: Node.js (Express framework).
*   **Location**: `server/` folder.
*   **Entry Point**: `server.js` (Port 5002).
*   **Role**: Handles Business Logic, Database interactions, and 3rd Party APIs.

### 1.3 The Database
*   **Technology**: MySQL.
*   **Key Tables**:
    *   `admins`: User accounts and billing settings.
    *   `vouchers`: Wi-Fi codes (linked to packages).
    *   `transactions`: Log of all Mobile Money payments.
    *   `sms_fees`: **The Ledger** for SMS credits (Deposit vs Usage).

---

## 2. Key Features & Workflows

### 2.1 Multi-Tenancy
*   Each Admin (Tenant) has their own "Space".
*   They create their own **Packages** (e.g., "1 Hour - 500 UGX") and **Categories**.
*   Data Isolation: Admin A cannot see Admin B's vouchers or revenue.

### 2.2 Payment Processing (Mobile Money)
*   **Provider**: Relworx API.
*   **Flow**:
    1.  User enters Phone Number on `index.html`.
    2.  Server calls Relworx to trigger a generic prompt.
    3.  **Verification**:
        *   **Webhook**: Relworx notifies Server (Updates status instantly).
        *   **Active Polling**: If Webhook fails (e.g., Localhost), Frontend asks Server to manually check Relworx status every 5s.
    4.  **Completion**: On success, a voucher is allocated and sent via SMS.

### 2.3 SMS & Voucher System
*   **Selling Vouchers**:
    *   Admins can "Sell" a voucher manually from the Dashboard.
    *   **Cost**: Each sale deducts **35 UGX** from the Admin's `sms_fees` wallet.
    *   **Logic**: DB Transaction ensures no voucher is sold twice.
*   **Buying SMS Credits**:
    *   Admins "Top Up" their SMS wallet using Mobile Money.
    *   Balance Calculation: `SUM(Successful Deposits) - SUM(Usage)`.

### 2.4 Admin Dashboard
*   **Real-Time Context**:
    *   **Auto-Refresh**: Views update every 10 seconds.
    *   **Online Status**: Green dot indicates recent activity.
*   **Financials**:
    *   Tracks Daily, Weekly, Monthly, and Yearly Revenue.
    *   Calculates `Net Balance` (Revenue - Withdrawals).

---

## 3. Directory Structure

```text
WIPAY/
├── client/                  # [Frontend]
│   ├── dashboard.html       # Admin SPA
│   ├── index.html           # Public Landing
│   └── js/config.js         # API Configuration
│
├── server/                  # [Backend]
│   ├── server.js            # Entry Point (CORS, Rate Limiting)
│   ├── .env                 # API Keys & Secrets
│   ├── src/
│   │   ├── config/db.js     # MySQL Connection
│   │   ├── middleware/      # Auth & Security
│   │   └── routes/          # API Instructions
│   │       ├── adminRoutes.js   # Core Logic (Vouchers, SMS, Stats)
│   │       ├── paymentRoutes.js # Relworx Integration
│   │       └── authRoutes.js    # Login/JWT
│   └── scripts/             # Maintenance Tools
```

---

## 4. API Reference

### Public Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/packages` | Public list of internet packages. |
| `POST` | `/api/purchase` | Initiate Mobile Money payment. |
| `POST` | `/api/check-payment-status` | Poll for payment completion. |

### Admin Endpoints (Protected)
*Headers: `Authorization: Bearer <token>`*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/sell-voucher` | Sell voucher & Send SMS (-35 SMS Fee). |
| `POST` | `/api/admin/buy-sms` | Top up SMS wallet. |
| `GET` | `/api/admin/sms-balance` | Get current SMS credit balance. |
| `GET` | `/api/admin/stats` | Get financial reports. |

---

## 5. Security Measures

1.  **Rate Limiting**:
    *   Global Limit: 3000 requests / 15 mins (Accommodates Auto-Refresh).
    *   Login Limit: 10 attempts / hour (Brute-force protection).
2.  **Transactions**:
    *   MySQL Transactions (`BEGIN` ... `COMMIT`) prevent race conditions when selling vouchers.
3.  **Authentication**:
    *   JWT (JSON Web Tokens) used for all protected routes.

---

## 6. How to Run

1.  **Database**: Start MySQL. Run `node server/scripts/setup_multitenancy.js`.
2.  **Server**:
    ```bash
    cd server
    npm install
    node server.js
    ```
3.  **Client**: Open `http://localhost:5002` in your browser.
