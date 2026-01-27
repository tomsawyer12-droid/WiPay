<?php
/**
 * Mikhmon Auto-Login Bridge
 * Securely logs in a WiPay tenant into their isolated Mikhmon instance.
 */

// 1. Set Session Path (Mikhmon v3 uses include/tmp)
$session_path = __DIR__ . "/include/tmp";
if (is_writable($session_path)) {
    session_save_path($session_path);
}

session_start();

$token = isset($_GET['token']) ? $_GET['token'] : '';

if (empty($token)) {
    die("Error: Token required.");
}

// 2. Load WiPay .env to get DB credentials
// Path: /var/www/wipay-client/mikhmon/<user>/autologin.php
// .env is at /var/www/wipay-server/.env
$env_path = "../../../wipay-server/.env";

if (!file_exists($env_path)) {
    // Fallback/Debug: Try one deeper just in case
    $env_path_fallback = "../../../../wipay-server/.env";
    if (file_exists($env_path_fallback)) {
        $env_path = $env_path_fallback;
    } else {
        die("Error: System environment missing. Checked: $env_path");
    }
}

$env = parse_ini_file($env_path);
$db_host = isset($env['DB_HOST']) ? $env['DB_HOST'] : 'localhost';
$db_user = isset($env['DB_USER']) ? $env['DB_USER'] : '';
$db_pass = isset($env['DB_PASSWORD']) ? $env['DB_PASSWORD'] : '';
$db_name = isset($env['DB_NAME']) ? $env['DB_NAME'] : '';

// 3. Connect to WiPay Database
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    die("Database Connection failed.");
}

// 4. Verify Token
$stmt = $conn->prepare("SELECT admin_id FROM mikhmon_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1");
$stmt->bind_param("s", $token);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    die("Error: Invalid or expired session token.");
}

$row = $result->fetch_assoc();
$admin_id = $row['admin_id'];

// 5. Cleanup token (one-time use)
$del_stmt = $conn->prepare("DELETE FROM mikhmon_tokens WHERE token = ?");
$del_stmt->bind_param("s", $token);
$del_stmt->execute();

// 6. Inject Mikhmon Session
// Based on Mikhmon v3 source code
$_SESSION['mikhmon'] = "admin";

// 7. Redirect to Mikhmon Index
header("Location: index.php");
exit;
?>
