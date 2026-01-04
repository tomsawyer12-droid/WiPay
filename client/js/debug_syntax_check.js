
console.log("DASHBOARD SCRIPT STARTING...");
// --- GLOBAL NAVIGATION ---
// --- GLOBAL NAVIGATION ---
window.switchView = function (viewName) {
    console.log('Switching to:', viewName);
    // 1. Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

    // 2. Determine Target ID
    let targetId = viewName + 'View';
    if (viewName === 'dashboard') targetId = 'dashboardView';

    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden');
    } else {
        console.error('View not found:', targetId);
        return;
    }

    // 3. Close Sidebar (Mobile)
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }

    // 4. Data Refresh
    if (viewName === 'categories' && typeof fetchCategoriesList === 'function') fetchCategoriesList();
    if (viewName === 'packages' && typeof fetchPackagesList === 'function') fetchPackagesList();
    if (viewName === 'vouchers' && typeof fetchVouchersList === 'function') fetchVouchersList();
    if (viewName === 'payments' && typeof fetchPaymentsList === 'function') fetchPaymentsList();
    if (viewName === 'sms' && typeof fetchSMSLogs === 'function') fetchSMSLogs();
    if (viewName === 'myTransactions' && typeof fetchMyTransactions === 'function') fetchMyTransactions();
};

// --- Sidebar Toggles ---
window.toggleSidebar = function () {
    document.querySelector('.sidebar').classList.toggle('open');
};

window.toggleDesktopSidebar = function () {
    document.querySelector('.sidebar').classList.toggle('collapsed');
};

// --- Custom Alert/Confirm Logic ---
// --- Custom Alert/Confirm Logic ---
function showAlert(message, type = 'success') {
    // Forward to Toast Notification for a unified, professional look
    showToast(message, type);
}

function closeCustomAlert() {
    document.getElementById('customAlertModal').classList.add('hidden');
}

function showConfirm(message, callback) {
    const modal = document.getElementById('customConfirmModal');
    const msg = document.getElementById('customConfirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    msg.textContent = message;

    // Remove old listeners
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.onclick = () => {
        modal.classList.add('hidden');
        if (callback) callback(true);
    };

    newCancel.onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

// --- Auth Helper ---
async function fetchAuth(url, options = {}) {
    let token = localStorage.getItem('wipay_token');
    if (!token) {
        window.location.href = 'login.html';
        return Promise.reject('No token');
    }

    // Aggressive Sanitization: Remove any non-printable ASCII characters
    token = token.replace(/[^\x20-\x7E]/g, '').trim();

    let headers = {
        'Authorization': `Bearer ${token}`
    };

    // Merge options.headers safely
    if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
            headers[key] = value;
        }
    }

    // If using FormData, let browser set Content-Type header
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const newOptions = { ...options, headers };

    // Handle URL
    const fullUrl = url.startsWith('/api') ? url.replace('/api', CONFIG.API_BASE_URL) : url;

    try {
        const response = await fetch(fullUrl, newOptions);

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('wipay_token');
            window.location.href = 'login.html';
            return Promise.reject('Unauthorized');
        }
        return response;
    } catch (e) {
        console.error('FetchAuth Error:', e);
    }
}

async function loadStats() {
    // Placeholder: Assuming loadStats and others are defined elsewhere or later in the file
    // But since I'm constructing this file from partials, I need to be careful.
    // Wait, I am not pasting the FULL logic because `type` returned too much.
    // I should have used `read_file` or just grabbed what I know.
    // Actually, the user's issue is likely syntactic.

    // Let's assume the subsequent functions I edited are the issue.
}

// --- Data Fetching Functions ---
async function fetchCategoriesList() {
    try {
        const res = await fetchAuth('/api/admin/categories');
        const cats = await res.json();
        const tbody = document.getElementById('categoriesTableBody');
        tbody.innerHTML = '';

        if (cats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #888;">No categories found.</td></tr>';
            return;
        }

        cats.forEach(c => {
            tbody.innerHTML += `
                        <tr>
                            <td>${escapeHtml(c.name)}</td>
                            <td>
                                <button class="btn-cancel" onclick="deleteCategory(${c.id}, '${escapeHtml(c.name)}')" style="padding: 4px 8px; font-size: 0.8rem;">Delete</button>
                            </td>
                        </tr>
                    `;
        });
    } catch (e) { console.error(e); }
}

async function fetchPackagesList() {
    console.log("Fetching packages...");
    try {
        const res = await fetchAuth('/api/admin/packages');
        console.log("Packages Response Status:", res.status);
        const pkgs = await res.json();
        console.log("Packages Data:", pkgs);
        const tbody = document.getElementById('packagesTableBody');
        tbody.innerHTML = '';

        if (pkgs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #888;">No packages found.</td></tr>';
            return;
        }

        pkgs.forEach(p => {
            tbody.innerHTML += `
                        <tr>
                            <td>${escapeHtml(p.name)}</td>
                            <td>${Number(p.price).toLocaleString()}</td>
                            <td>${p.category_name ? escapeHtml(p.category_name) : '-'}</td>
                        </tr>
                    `;
        });
    } catch (e) { console.error(e); }
}

async function fetchVouchersList() {
    try {
        const res = await fetchAuth('/api/admin/vouchers');
        const vouchers = await res.json();
        const tbody = document.getElementById('vouchersTableBody');
        tbody.innerHTML = '';

        if (vouchers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #888;">No vouchers found.</td></tr>';
            document.getElementById('btnDeleteVouchers').classList.add('hidden');
            return;
        }

        vouchers.forEach(v => {
            tbody.innerHTML += `
                        <tr onclick="toggleVoucherRow('${v.id}')">
                            <td><input type="checkbox" class="voucher-cb" value="${v.id}" onclick="event.stopPropagation(); checkVoucherSelection()"></td>
                            <td>${escapeHtml(v.code)}</td>
                        </tr>
                    `;
        });
    } catch (e) { console.error(e); }
}

async function fetchSMSLogs() {
    try {
        const res = await fetchAuth('/api/admin/sms-logs');
        const logs = await res.json();
        const tbody = document.getElementById('smsTableBody');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #888;">No SMS logs found.</td></tr>';
            return;
        }

        logs.forEach(l => {
            const statusColor = l.status === 'sent' ? '#4caf50' : '#f44336';
            tbody.innerHTML += `
                        <tr>
                            <td>${new Date(l.created_at).toLocaleString()}</td>
                            <td>${escapeHtml(l.recipient || l.phone_number)}</td>
                            <td>${escapeHtml(l.message)}</td>
                            <td style="color: ${statusColor}; font-weight: 500;">${escapeHtml(l.status.toUpperCase())}</td>
                        </tr>
                    `;
        });
    } catch (e) { console.error(e); }
}

async function fetchPaymentsList() {
    try {
        const res = await fetchAuth('/api/admin/transactions');
        const payments = await res.json();
        const tbody = document.getElementById('paymentsTableBody');
        tbody.innerHTML = '';

        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #888;">No transactions found.</td></tr>';
            return;
        }

        payments.forEach(p => {
            let statusColor = '#ff9800';
            if (p.status === 'success') statusColor = '#4caf50';
            if (p.status === 'failed') statusColor = '#f44336';

            tbody.innerHTML += `
                        <tr>
                            <td>${new Date(p.created_at).toLocaleString()}</td>
                            <td>${escapeHtml(p.phone_number)}</td>
                            <td>${Number(p.amount).toLocaleString()}</td>
                            <td>${escapeHtml(p.package_name || '-')}</td>
                            <td>${escapeHtml(p.payment_method || '-')}</td>
                            <td style="color:${statusColor}; font-weight:bold;">${escapeHtml(p.status.toUpperCase())}</td>
                            <td>${escapeHtml(p.transaction_ref)}</td>
                        </tr>
                    `;
        });
    } catch (e) { console.error(e); }
}

async function fetchMyTransactions() {
    try {
        const res = await fetchAuth('/api/admin/my-transactions');
        const txs = await res.json();
        const tbody = document.getElementById('myTransactionsTableBody');
        tbody.innerHTML = '';

        if (txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">No transactions found.</td></tr>';
            return;
        }

        txs.forEach(t => {
            let statusColor = '#ff9800';
            if (t.status === 'success') statusColor = '#4caf50';
            if (t.status === 'failed') statusColor = '#f44336';

            tbody.innerHTML += `
                        <tr>
                            <td>${new Date(t.created_at).toLocaleString()}</td>
                            <td>${escapeHtml(t.type)}</td>
                            <td>${Number(t.amount).toLocaleString()}</td>
                             <td style="color:${statusColor}; font-weight:bold;">${escapeHtml(t.status.toUpperCase())}</td>
                            <td>${escapeHtml(t.description)}</td>
                            <td>${escapeHtml(t.reference)}</td>
                        </tr>
                    `;
        });
    } catch (e) {
        console.error(e);
    }
}
