# WiPay Project Documentation

## 1. Project Overview
**WiPay** (Garuga Spot) is a dual-interface application designed to manage and monetize Wi-Fi hotspots. It consists of:
1.  **Customer Portal (`index.html`)**: Allows users to view internet packages, pay via Mobile Money (Relworx), and connect.
2.  **Admin Dashboard (`dashboard.html`)**: General management for the business owner to track sales, manage vouchers/packages, and monitor logs.
3.  **Backend (`server.js`)**: A Node.js/Express server handling APIs, database interactions (MySQL), payment integration, and SMS notifications.

---

## 2. File Structure
### Frontend
*   **`index.html`**: The public landing page. Features package grid, free trial access, voucher redemption, and payment modal.
*   **`style.css`**: Styles for the public portal, featuring a dark theme with green accents and glassmorphism elements.
*   **`dashboard.html`**: The protected admin interface. Single-page application (SPA) style with views for Dashboard, Categories, Packages, Vouchers, and SMS Logs.
*   **`dashboard.css`**: Specialized dark theme styles for the admin panel, including sidebar, data tables, and modal components.
*   **`login.html`**: The entry point for admins. Features a secure-looking dark glass login form (mock authentication: `admin`/`password`).
*   **`login.css`**: Styles for the login page, matching the main index theme.

### Backend
*   **`server.js`**: The core application logic.
    *   **Port**: 5001
    *   **Database**: MySQL (`wipay` database)
    *   **Integrations**: Relworx (Payments), UGSMS (SMS).

---

## 3. Key Features

### Customer Features
*   **Package Browsing**: Dynamic list of packages fetched from the database.
*   **Mobile Money Payment**: Integrated with Relworx. Users enter their phone number to receive a PIN prompt.
*   **Automatic Voucher Delivery**: Upon successful payment, a voucher code is assigned and sent via SMS.
*   **Voucher Redemption**: Input field to redeem codes for internet access.

### Admin Features
*   **Dashboard Stats**: Real-time view of SMS Balance, Net Revenue (Total - Withdrawals), Transaction Counts, and Weekly Sales Graph.
*   **Category & Package Management**: Create and manage the internet plans offered to customers.
*   **Voucher Management**:
    *   **Import**: Bulk upload vouchers via CSV.
    *   **Sell**: Manually sell/send a voucher via SMS from the dashboard.
    *   **Delete**: Bulk delete functionality.
*   **Financial Control**:
    *   **Withdrawals**: Initiate logic transfers from Relworx account to a phone number, with strict local balance checks.
    *   **Payment Logs**: View full history of successful and failed transactions.
*   **SMS Logs**: Monitor status of all sent messages.

---

## 4. API Reference

### Public Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/packages` | Fetches available packages (grouped by validity) for display. |
| `POST` | `/api/purchase` | Initiates a mobile money payment request. |
| `POST` | `/api/connect` | Checks if a user has a valid active session. |
| `POST` | `/api/payment-webhook` | Callback URL for Relworx to update transaction status. |

### Admin Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Returns finance stats, counts, and graph data. |
| `GET/POST`| `/api/admin/categories` | Manage package categories. |
| `GET/POST`| `/api/admin/packages` | Manage internet packages. |
| `GET` | `/api/admin/vouchers` | List available vouchers. |
| `POST` | `/api/admin/vouchers/import` | Bulk import vouchers from CSV/JSON. |
| `DELETE` | `/api/admin/vouchers` | Bulk delete vouchers by ID. |
| `POST` | `/api/admin/sell-voucher` | Assign a voucher + Send SMS manually. |
| `POST` | `/api/admin/withdraw` | Initiate a withdrawal from the business wallet. |
| `GET` | `/api/admin/sms-logs` | Fetch history of sent SMS. |

---

## 5. Setup & Run

### Prerequisites
*   Node.js Installed.
*   MySQL Database running (`wipay`).
*   `.env` file configured with:
    *   `RELWORX_API_KEY`, `RELWORX_ACCOUNT_NO`
    *   `UGSMS_USERNAME`, `UGSMS_PASSWORD`

### Running the App
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start Server**:
    ```bash
    node server.js
    ```
3.  **Access**:
    *   **Public Portal**: `http://localhost:5001/` (redirects to `dashboard.html` currently due to root config, configurable in `server.js`).
    *   **Admin Login**: `http://localhost:5001/login.html`
