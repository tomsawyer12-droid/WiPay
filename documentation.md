# WiPay Project Documentation

## 1. Project Overview
**WiPay** (Garuga Spot) is a multi-tenant application designed to manage and monetize Wi-Fi hotspots. It consists of:
1.  **Customer Portal (`index.html`)**: Allows users to view internet packages, pay via Mobile Money (Relworx), and connect. Supports multiple admins via URL or configuration.
2.  **Admin Dashboard (`dashboard.html`)**: Protected management interface for business owners to track sales, manage vouchers/packages, and monitor logs. Each admin sees ONLY their own data.
3.  **Backend (`server.js`)**: A Node.js/Express server handling APIs, JWT authentication, database interactions (MySQL), payment integration, and SMS notifications.

---

## 2. File Structure
### Frontend
*   **`index.html`**: The public landing page. Features package grid (filtered by admin), free trial, voucher redemption, and payment modal.
*   **`style.css`**: Styles for the public portal (dark theme, green accents).
*   **`dashboard.html`**: The admin interface. Manages Categories, Packages, Vouchers, and Logs. Includes Chart.js analytics.
*   **`dashboard.css`**: Admin theme styles.
*   **`login.html`**: Secure login page for admins.
*   **`login.css`**: Login styles.

### Backend
*   **`server.js`**: Core application logic.
    *   **Port**: 5001
    *   **Auth**: JSON Web Tokens (JWT).
    *   **Database**: MySQL (`wipay`).
*   **Scripts**:
    *   `create_admin.js`: CLI tool to create new admin accounts.
    *   `fix_voucher_index.js`: Utility to manage database constraints.
    *   `setup_multitenancy.js`: Initial migration script.

---

## 3. Key Features

### Multi-Tenancy & Security (NEW)
*   **Data Isolation**: Packages, Vouchers, Transactions, and Logs are strictly scoped to the `admin_id` of the logged-in user.
*   **Secure Auth**: Real password hashing (`bcrypt`) and session management (`jsonwebtoken`).
*   **Multiple Admins**: Unlimited admin accounts can coexist without seeing each other's data.

### Customer Features
*   **Admin Specific Portals**:
    *   **Link**: `/?admin=1` shows packages for Admin 1.
    *   **Router Config**: `index.html` can be hardcoded with `ROUTER_ADMIN_ID` for specific deployments.
*   **Mobile Money Payment**: Integrated with Relworx. Payments are automatically attributed to the correct admin.
*   **Voucher Redemption**: Users can redeem vouchers offline or online.

### Admin Features
*   **Dashboard Stats**: Real-time SMS Balance (loaded independently), Net Revenue, and Sales Graphs.
*   **Voucher Management**:
    *   **Import**: Bulk upload via CSV. Duplicates are allowed *across* admins but unique *per* admin.
    *   **Sell**: Send single vouchers via SMS.
*   **Account Management**:
    *   **Change Password**: Secure self-service password reset.

---

## 4. API Reference

### Public Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/packages?admin_id=X` | Fetches packages for a specific admin. Returns empty if no ID provided. |
| `POST` | `/api/purchase` | Initiates payment. Requires `package_id` and `phone_number`. |
| `POST` | `/api/connect` | Verifies active session. |

### Admin Endpoints (Protected)
*All request must include `Authorization: Bearer <token>`*

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Authenticate and receive JWT. |
| `POST` | `/api/admin/change-password` | Update admin password. |
| `GET` | `/api/admin/stats` | Internal financial stats. |
| `GET` | `/api/admin/sms-balance` | External SMS balance check. |
| `GET/POST`| `/api/admin/packages` | Manage packages. |
| `GET/DELETE` | `/api/admin/vouchers` | Manage vouchers. |
| `POST` | `/api/admin/vouchers/import` | Bulk import vouchers. |

---

## 5. Setup & Run

### Prerequisites
*   Node.js & MySQL.
*   `.env` file with API Keys.

### 1. Database Setup
```bash
node setup_multitenancy.js
```

### 2. Create Admin
```bash
node create_admin.js <username> <password>
```

### 3. Run Server
```bash
node server.js
```

### 4. Admin Portal Access
*   **Link**: `http://your-ip:5001/?admin=<YOUR_ID>`
*   **Router Setup**: Edit `index.html` and set `const ROUTER_ADMIN_ID = <YOUR_ID>;`.
