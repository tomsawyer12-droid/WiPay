# Client Files Walkthrough

We are starting with **`client/index.html`**. This is the **Public Landing Page** where customers buy Wi-Fi.

## File: `client/index.html`

### 1. The Setup (Lines 1-10)
- **Lines 1-7**: Standard HTML setup. Sets title to "Garuga Spot".
- **Line 8**: `<link rel="stylesheet" href="css/style.css">`. This loads the styling (colors, fonts, layout) from the CSS file.

### 2. The Visible Body (Lines 11-58)
This is what the user *sees*.
- **Lines 13-17 (`<header>`)**: Shows the Wi-Fi icon, Title ("Garuga Spot"), and slogan.
- **Lines 20-23 (`.free-trial`)**: A card for "Free trial". Currently just a button.
- **Lines 25-27 (`.voucher-section`)**: The input box where users type a voucher code if they already have one.
- **Lines 41-43 (`#packages-container`)**: **CRITICAL**. This is an *empty* div initially.
    -   *Why?* Because we don't know the prices yet. The JavaScript will fetch them from the server and inject them here.
- **Lines 60-79 (`#paymentModal`)**: The "Pop-up" window for entering a phone number. It is hidden by default (`class="hidden"`) until someone clicks "Buy".

### 3. The Script / Logic (Lines 81-306)
This is the "Brain" of the page.

#### Initializing (Lines 83-102)
- **Line 81**: Loads `config.js` (which tells us where the API is, e.g., `localhost:5002`).
- **Line 102 (`ROUTER_ADMIN_ID`)**: This is hardcoded to `18`. This means "Show packages created by Admin #18".

#### Loading Packages (Lines 109-146)
- **Line 116 (`fetch(fetchUrl)`)**: As soon as the page loads, it asks the server: "Give me packages for Admin 18".
- **Line 129 (`packages.forEach`)**: The server returns a list (e.g., "1 Hour", "1 Day"). We loop through them.
- **Line 134**: For each package, we create HTML:
    -   Name (`${pkg.name}`)
    -   Price (`${pkg.price}`)
    -   **Important**: A "PAY" button that calls `initiatePay(...)` when clicked.
- **Line 140**: We put this new HTML inside the `#packages-container`.

#### The "Buy" Flow (Lines 150-217)
- **Line 150 (`initiatePay`)**: Runs when you click "PAY". It opens the Modal and remembers which package you chose.
- **Line 184 (`modalPayBtn.click`)**: Runs when you click "Pay Now" in the popup.
- **Line 195**: It calls `POST /api/purchase` to the server with your phone number.
- **Line 202**: If the server says "Created", it calls `startPolling`.

#### Polling (Lines 220-254)
This waits for the payment to complete.
- **Line 226 (`setInterval`)**: Every **5 seconds**...
- **Line 236**: It asks the server: "Is transaction `txRef` paid yet?"
- **Line 243**: If the server says `SUCCESS`, it shows "Payment Confirmed!" and stops checking.

#### UI Helpers (Lines 258-301)
- **`showMessage`**: Creates a temporary green/red banner (Toast) at the top of the screen.
- **`showProgress`**: Shows the full-screen "Waiting..." overlay.
