# Backend Walkthrough ("The Brain")

This document explains the core logic of your server which lives in `server/`.

## 1. The Entry Point: `server/server.js`
This file is the generic entry point. It sets the rules of engagement.

- **Lines 1-6**: Imports libraries. `express` is the web server framework. `dotenv` loads your passwords from `.env`.
- **Lines 15-22 (`globalLimiter`)**: This is a traffic cop.
    -   It says: "Allow **3000** requests every **15 minutes** per IP."
    -   *Why 3000?* We increased it from 100 because your Dashboard now Auto-Refreshes every 10s.
- **Line 32 (`app.use(cors())`)**: Allows browsers (and tools like ngrok) to talk to your server without being blocked by security policies.
- **Lines 39-44**: **Route Imports**.
    -   This is where we tell the server: "The logic for Admins is in `adminRoutes.js`".
- **Line 57**: `app.listen(PORT, ...)` starts the engine on Port 5002.

---

## 2. The Logic Core: `server/src/routes/adminRoutes.js`
This file contains the **Business Logic**.

### A. Selling a Voucher (Lines 360-428)
This is the most critical function. `router.post('/admin/sell-voucher', ...)`

1.  **Safety First (Line 368)**: `connection.beginTransaction()`.
    -   This starts a "Transaction". It means: *If anything fails in the next steps, UNDO everything.*
2.  **Check Balance (Line 374)**:
    -   It runs SQL: `SELECT SUM(amount) ...`.
    -   If your balance is less than `SMS_COST` (35 UGX), it stops and says "Insufficient SMS balance".
3.  **Pick a Voucher (Line 391)**:
    -   SQl: `SELECT ... WHERE is_used = FALSE ... LIMIT 1 FOR UPDATE`.
    -   `FOR UPDATE` locks that row so two sold vouchers never collide.
4.  **Mark it Sold (Line 399)**:
    -   Updates the voucher to `is_used = 1`.
5.  **Deduct Money (Line 402)**:
    -   Inserts a new row into `sms_fees` with amount **-35**.
6.  **Send SMS (Line 407)**:
    -   Calls the helper `sendSMS` to text the code.
7.  **Commit (Line 418)**:
    -   Saves all changes. If we made it here, everything is perfect.

### B. Buying SMS Credits (Lines 248-304)
When you click "Pay" in the dashboard:

1.  **Create Reference (Line 259)**: Generates a unique ID like `SMS-1234...`.
2.  **Insert Pending (Line 264)**:
    -   Adds a row to `sms_fees` with status `'pending'`. It doesn't count towards your balance yet.
3.  **Call Relworx (Line 268)**:
    -   Sends a command to the payment gateway to trigger the prompt on your phone.

### C. Checking Payment Status (Lines 306-358)
This is the "Polling" logic we fixed. `router.get('/admin/sms-status/:reference')`.

1.  **Check Local DB (Line 308)**:
    -   Sometimes a Webhook arrives fast. If DB says "success", we return "success" immediately.
2.  **Active Poll (Line 319)**:
    -   If DB is still pending, we ask Relworx directly: `fetch(checkUrl)`.
    -   If Relworx confirms "SUCCESS", we:
        -   Update DB to "success".
        -   Return "success" to frontend.
    -   *This ensures payments work even on Localhost.*

### D. Revenue Stats (Lines 465-516)
`router.get('/admin/stats')` calculates your dashboard numbers.

-   **SQL Query (Lines 469-477)**:
    -   It uses `SUM(CASE WHEN ...)` logic.
    -   It calculates Daily, Weekly, Monthly, and Yearly revenue in **one single database call** for speed.
    -   It filters out `payment_method = 'manual'` so you only see real automated income.
