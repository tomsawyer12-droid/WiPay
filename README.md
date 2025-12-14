# WiPay (WiFi Billing System)

WiPay is a robust, multi-tenant WiFi billing and management system designed for ISPs and Hotspot owners in Uganda. It allows admins to manage packages, sell vouchers, and accept Mobile Money payments automated via Relworx.

## 🚀 Features

-   **Captive Portal**: Professional, responsive landing page for users to buy data.
-   **Mobile Money Integration**: Automated Airtel/MTN payments via Relworx.
-   **Voucher Management**: Bulk import, selling via SMS, and auto-delivery after payment.
-   **Multi-Tenancy**: Single server supports multiple independent admins/routers.
-   **Financial Dashboard**: Real-time revenue tracking, withdrawal management, and sales graphs.

## 📂 Project Structure

Verified Professional Structure:
-   `public/`: Frontend assets (HTML, CSS, Images).
-   `src/`: Backend source code (Routes, Config, Middleware).
-   `scripts/`: Setup and utility scripts.
-   `server.js`: Main application entry point.

## 🛠️ Getting Started

### Prerequisites
-   Node.js (v14+)
-   MySQL Server

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository_url>
    cd WIPAY
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    PORT=5002
    DB_HOST=localhost
    DB_USER=root
    DB_PASS=
    DB_NAME=wipay
    JWT_SECRET=your_jwt_secret
    RELWORX_API_KEY=your_key
    RELWORX_ACCOUNT_NO=your_acc_no
    UGSMS_USERNAME=your_sms_user
    UGSMS_PASSWORD=your_sms_pass
    ```

4.  **Setup Database**
    Run the setup script to create tables:
    ```bash
    node scripts/setup_multitenancy.js
    ```

5.  **Create Admin Account**
    ```bash
    node scripts/create_admin.js myadmin securepassword
    ```

### ▶️ Running the Application

Start the server:
```bash
node server.js
```
*   **Public Portal**: `http://localhost:5002`
*   **Admin Dashboard**: `http://localhost:5002/dashboard.html` (Login required)

## 📡 Router Deployment

To deploy on a Mikrotik or other router:
1.  Host this application on a local server or cloud VPS.
2.  Edit `public/index.html`:
    ```javascript
    const ROUTER_ADMIN_ID = 1; // Set this to the Admin ID for this router
    ```
3.  Configure the router's Walled Garden to allow access to your server's IP/Domain and the Relworx API.

---
*Maintained by Garuga IT Team.*
