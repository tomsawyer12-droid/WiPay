const db = require("../config/db");

async function runPendingMigrations() {
  console.log("Checking for pending database migrations...");
  try {
    // Migration 1: Add is_active to packages
    const addColumnQuery = `
            ALTER TABLE packages
            ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
        `;

    await db.query(addColumnQuery);
    console.log("Migration Success: Added is_active column to packages table.");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      // This is fine, column exists
      console.log("Migration Info: is_active column already exists.");
    } else {
      console.error("Migration Error:", err);
      // Don't crash the server, just log
    }
  }

  try {
    // Migration 2: Create routers table
    const createRoutersTableQuery = `
            CREATE TABLE IF NOT EXISTS routers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                mikhmon_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
            );
        `;
    await db.query(createRoutersTableQuery);
    console.log("Migration Success: Routers table checked/created.");
  } catch (err) {
    console.error("Migration Error (Routers Table):", err);
  }

  try {
    // Migration 3: Add router_id to transactions
    const addRouterColumnQuery = `
            ALTER TABLE transactions
            ADD COLUMN router_id INT DEFAULT NULL;
        `;
    await db.query(addRouterColumnQuery);
    console.log("Migration Success: Added router_id to transactions table.");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log(
        "Migration Info: router_id column already exists in transactions.",
      );
    } else {
      console.error("Migration Error (Transactions router_id):", err);
    }
  }

  try {
    // Migration 4: Allow NULL for package_id in transactions (for safe deletion)
    const alterPackageIdQuery = `
            ALTER TABLE transactions
            MODIFY COLUMN package_id INT NULL;
        `;
    await db.query(alterPackageIdQuery);
    console.log("Migration Success: transactions.package_id is now nullable.");
  } catch (err) {
    console.error("Migration Error (Transactions package_id):", err);
  }

  try {
    // Migration 5: Add subscription_expiry to admins
    const addSubExpiryQuery = `
            ALTER TABLE admins
            ADD COLUMN subscription_expiry DATETIME DEFAULT NULL AFTER billing_type;
        `;
    await db.query(addSubExpiryQuery);
    console.log(
      "Migration Success: Added subscription_expiry to admins table.",
    );
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log(
        "Migration Info: subscription_expiry column already exists in admins.",
      );
    } else {
      console.error("Migration Error (Admins sub_expiry):", err);
    }
  }
  try {
    // Migration 6: Add fee column to withdrawals
    const addWithdrawalFeeQuery = `
            ALTER TABLE withdrawals
            ADD COLUMN fee INT DEFAULT 0 AFTER amount;
        `;
    await db.query(addWithdrawalFeeQuery);
    console.log("Migration Success: Added fee column to withdrawals table.");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Migration Info: fee column already exists in withdrawals.");
    } else {
      console.error("Migration Error (Withdrawals fee):", err);
    }
  }

  try {
    // Migration 7: Mikhmon Auto-Login Tokens Table
    const createMikhmonTokensTableQuery = `
            CREATE TABLE IF NOT EXISTS mikhmon_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                token VARCHAR(64) NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (token),
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
            );
        `;
    await db.query(createMikhmonTokensTableQuery);
    console.log("Migration Success: mikhmon_tokens table checked/created.");
  } catch (err) {
    console.error("Migration Error (Mikhmon Tokens Table):", err);
  }

  try {
    // Migration 8: Idempotency Keys Table
    const createIdempotencyTableQuery = `
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                idempotency_key VARCHAR(255) NOT NULL UNIQUE,
                user_id INT,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                request_hash VARCHAR(64),
                status_code INT,
                response_body LONGTEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR),
                INDEX (idempotency_key),
                INDEX (expires_at)
            );
        `;
    await db.query(createIdempotencyTableQuery);
    console.log("Migration Success: idempotency_keys table checked/created.");
  } catch (err) {
    console.error("Migration Error (Idempotency Keys Table):", err);
  }

  try {
    // Migration 9: Cleanup expired idempotency keys (run periodically)
    await db.query("DELETE FROM idempotency_keys WHERE expires_at < NOW()");
    console.log("Migration Success: Expired idempotency keys cleaned up.");
  } catch (err) {
    console.error("Migration Error (Cleanup Idempotency):", err);
  }
}

module.exports = { runPendingMigrations };
