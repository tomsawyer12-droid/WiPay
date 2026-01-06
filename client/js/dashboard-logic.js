console.log("DASHBOARD LOGIC LOADED");

// --- Secure Fetch Wrapper (Cookie-based) ---
window.fetchAuth = async function (url, options = {}) {
    options.credentials = 'include'; // Send HttpOnly cookies
    options.headers = options.headers || {};

    // Default JSON check
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }

    try {
        // If relative URL, prepend API_BASE_URL from config if needed
        // But code uses fetchAuth('/api/...') so usually relative is fine proxy-wise or absolute if CONFIG.API_BASE_URL is set.
        // Let's rely on caller.

        let targetUrl = url;
        if (url.startsWith('/') && typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL && CONFIG.API_BASE_URL.startsWith('http')) {
            // If CONFIG.API_BASE_URL is http://localhost:5002, we might need to prepend.
            // But existing logic seemed to work with relative?
            // If we are on localhost:5500 (frontend) and API is 5002, we need absolute.
            if (url.startsWith('/api') && CONFIG.API_BASE_URL.endsWith('/api')) {
                // Avoid /api/api
                targetUrl = CONFIG.API_BASE_URL + url.substring(4);
            } else {
                targetUrl = CONFIG.API_BASE_URL + url;
            }
        }

        const res = await fetch(targetUrl, options);
        if (res.status === 401 || res.status === 403) {
            console.warn('Session expired');
            // Check if we are already on login page to avoid loop?
            if (!window.location.href.includes('login_dashboard.html')) {
                window.location.href = 'login_dashboard.html';
            }
            throw new Error('Unauthorized');
        }
        return res;
    } catch (err) {
        console.error('FetchAuth Error:', err);
        throw err;
    }
};


// --- DEBUG PROBE ---
try {
    if (typeof CONFIG === 'undefined') {
        alert("CRITICAL ERROR: CONFIG is undefined. config.js failed to load!");
    } else {
        console.log('API Target:', CONFIG.API_BASE_URL);
        // alert("Config OK. API URL: " + CONFIG.API_BASE_URL); // Commented out to reduce noise if it works
    }
} catch (e) {
    alert("CRITICAL CONFIG ERROR: " + e.message);
}

// --- Router Filter Logic ---
window.onRouterFilterChange = function (routerId) {
    console.log('Router Filter Changed:', routerId);
    currentRouterFilter = routerId;

    // Sync dropdowns
    const d1 = document.getElementById('routerFilterDashboard');
    const d2 = document.getElementById('routerFilterTransactions');
    if (d1) d1.value = routerId;
    if (d2) d2.value = routerId;

    // Reload active view data
    const activeView = document.querySelector('.view-section:not(.hidden)');
    if (activeView) {
        if (activeView.id === 'dashboardView') loadStats(); // Reload charts/stats
        if (activeView.id === 'paymentsView') fetchPaymentsList();
    }
    // Also reload stats anyway as they are on dashboard view
    // loadStats(); 
};

async function fetchRouterFilters() {
    try {
        const res = await fetchAuth('/api/admin/routers');
        const routers = await res.json();

        const options = '<option value="">All Routers</option>' +
            routers.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');

        const d1 = document.getElementById('routerFilterDashboard');
        const d2 = document.getElementById('routerFilterTransactions');

        if (d1) d1.innerHTML = options;
        if (d2) d2.innerHTML = options;

    } catch (e) { console.error('Failed to load router filters', e); }
}

// Call on load
document.addEventListener('DOMContentLoaded', fetchRouterFilters);

// --- Utility Functions ---
window.escapeHtml = function (text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function (m) { return map[m]; });
};

// --- GLOBAL NAVIGATION ---
window.switchView = function (viewName) {
    console.log('Switching to:', viewName);
    // 1. Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

    // 1.5. Update Active Navigation State (Sidebar)
    document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
    const activeNavItem = document.querySelector(`.sidebar-nav li[data-view="${viewName}"]`);
    if (activeNavItem) activeNavItem.classList.add('active');

    // 1.6. Update Active Navigation State (Mobile Nav)
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeMobileBtn = document.querySelector(`.mobile-nav-btn[data-view="${viewName}"]`);
    if (activeMobileBtn) activeMobileBtn.classList.add('active');

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
    if (viewName === 'routers' && typeof fetchRouters === 'function') fetchRouters();
};

// --- Sidebar Toggles ---
window.toggleSidebar = function () {
    const s = document.querySelector('.sidebar');
    if (s) s.classList.toggle('open');
};

window.toggleDesktopSidebar = function () {
    const s = document.querySelector('.sidebar');
    if (s) s.classList.toggle('collapsed');
};

// --- Missing UI Functions ---
window.toggleStats = function () {
    const grid = document.getElementById('statsGrid');
    const btn = document.querySelector('#viewMoreContainer button');
    if (grid) grid.classList.toggle('expanded');

    if (grid && btn) {
        const isExpanded = grid.classList.contains('expanded');
        btn.innerHTML = isExpanded ? 'Show Less <span class="arrow">↑</span>' : 'View More <span class="arrow">↓</span>';
    }
};

window.toggleUserMenu = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('userDropdown');
    if (menu) menu.classList.toggle('hidden');
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('userDropdown');
    if (menu && !menu.classList.contains('hidden') && !e.target.closest('.user-menu-container')) {
        menu.classList.add('hidden');
    }
});

window.toggleTheme = function () {
    const body = document.body;
    body.classList.toggle('light'); // Legacy
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeText(isDark);
};

function updateThemeText(isDark) {
    const el = document.getElementById('themeText');
    if (el) el.innerText = isDark ? 'Light Mode' : 'Dark Mode';
}

// Init Theme on Load
(function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme !== 'light'; // Default to dark if not set, or check logic

    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light');
        updateThemeText(false);
    } else {
        document.body.classList.add('dark-mode');
        updateThemeText(true);
    }
})();

// --- Custom Alert/Confirm Logic ---
window.showToast = function (msg, type) {
    // Remove existing
    const existing = document.querySelectorAll('.popup-toast');
    existing.forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'popup-toast';

    let icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'; // Info
    let bg = '#333';
    let border = '#333';

    if (type === 'success') {
        border = '#4caf50';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${border}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        border = '#f44336';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${border}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-20px);
        z-index: 20001;
        background: #1e1e1e; color: #fff;
        border-left: 5px solid ${border};
        padding: 14px 20px;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
        font-weight: 500; font-size: 0.95rem;
        opacity: 0; transition: all 0.4s ease;
        min-width: 300px;
    `;

    toast.innerHTML = `
        <div style="display:flex; align-items:center;">${icon}</div>
        <div>${escapeHtml(msg)}</div>
    `;

    document.body.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

function showAlert(message, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

function closeCustomAlert() {
    const el = document.getElementById('customAlertModal');
    if (el) el.classList.add('hidden');
}

function showConfirm(message, callback) {
    const modal = document.getElementById('customConfirmModal');
    const msg = document.getElementById('customConfirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!modal) {
        if (confirm(message)) callback(true);
        return;
    }

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



// --- Main Helper Functions ---
function calculateSMSPreview(val) {
    const amount = parseInt(val) || 0;
    const count = Math.floor(amount / 50); // 50 UGX per SMS
    const el = document.getElementById('smsPreview');
    if (el) el.innerText = `~${count} SMS`;
}

function submitBuySMS() {
    const phone = document.getElementById('smsPhone').value;
    const amount = document.getElementById('smsAmount').value;
    if (!phone || !amount) return showAlert('Please fill all fields', 'error');

    // 1. Show Progress Bar
    const progCont = document.getElementById('smsProgressBarContainer');
    if (progCont) progCont.style.display = 'block';

    const progressBar = document.getElementById('smsProgressBar');
    if (progressBar) progressBar.style.width = '10%'; // Start

    // 2. Hide Buttons to prevent double-click
    const actionsDiv = document.querySelector('#buySMSModal .modal-actions');
    if (actionsDiv) {
        actionsDiv.style.opacity = '0.5';
        actionsDiv.style.pointerEvents = 'none';
    }

    // 3. Initiate
    fetchAuth('/api/admin/buy-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, phone_number: phone })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'pending') {
                // 4. Poll
                if (progressBar) progressBar.style.width = '40%';
                pollPaymentStatus(data.reference, 'sms', progressBar, actionsDiv);
            } else {
                showAlert(data.error || 'Failed to initiate', 'error');
                resetSMSModal(actionsDiv);
            }
        })
        .catch(err => {
            console.error(err);
            showAlert('Connection Error', 'error');
            resetSMSModal(actionsDiv);
        });
}

function resetSMSModal(actionsDiv) {
    const pc = document.getElementById('smsProgressBarContainer');
    if (pc) pc.style.display = 'none';

    const pb = document.getElementById('smsProgressBar');
    if (pb) pb.style.width = '0%';

    if (actionsDiv) {
        actionsDiv.style.opacity = '1';
        actionsDiv.style.pointerEvents = 'auto';
    }
}

function pollPaymentStatus(ref, type, progressBar, actionsDiv) {
    let attempts = 0;
    const interval = setInterval(async () => {
        attempts++;
        if (progressBar) {
            let w = parseFloat(progressBar.style.width);
            if (w < 90) progressBar.style.width = (w + 2) + '%';
        }

        try {
            const res = await fetchAuth(`/ api / admin / payment - status / ${ref} `);
            const data = await res.json();

            if (data.status === 'success') {
                clearInterval(interval);
                if (progressBar) progressBar.style.width = '100%';
                setTimeout(() => {
                    closeDashModal('buySMSModal');
                    showAlert('Payment Successful!', 'success');
                    resetSMSModal(actionsDiv);
                    if (document.getElementById('smsPhone')) document.getElementById('smsPhone').value = '';
                    if (document.getElementById('smsAmount')) document.getElementById('smsAmount').value = '';
                    if (type === 'sms') loadSMSBalance();
                }, 500);
            } else if (data.status === 'failed') {
                clearInterval(interval);
                showAlert('Payment Failed', 'error');
                resetSMSModal(actionsDiv);
            }

            if (attempts > 60) { // 3 mins
                clearInterval(interval);
                showAlert('Timeout waiting for payment', 'error');
                resetSMSModal(actionsDiv);
            }
        } catch (e) { console.error(e); }
    }, 3000);
}

// --- Modal Helpers ---
function openDashModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (id === 'addPackageModal') loadCategoriesForSelect();
}

function closeDashModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// --- Logic for Modals ---
async function createCategory() {
    const name = document.getElementById('newCatName').value;
    if (!name) return showAlert('Name required', 'error');

    if (!currentRouterFilter || currentRouterFilter === 'all') {
        return showAlert('Please select a specific Router from the top filter to create a Category.', 'info');
    }

    try {
        const res = await fetchAuth('/api/admin/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, router_id: currentRouterFilter })
        });
        if (res.ok) {
            closeDashModal('addCategoryModal');
            showAlert('Category created');
            document.getElementById('newCatName').value = ''; // Reset
            fetchCategoriesList();
            loadStats(); // refresh count
        }
    } catch (e) { console.error(e); }
}

async function loadCategoriesForSelect() {
    try {
        const routerQuery = currentRouterFilter !== 'all' ? `? router_id = ${currentRouterFilter} ` : '';
        const res = await fetchAuth(`/ api / admin / categories${routerQuery} `);
        const cats = await res.json();
        const sel = document.getElementById('pkgCategory');
        if (sel) {
            sel.innerHTML = '<option value="">Select Category</option>';
            cats.forEach(c => {
                sel.innerHTML += `< option value = "${c.id}" > ${escapeHtml(c.name)}</option > `;
            });
        }
    } catch (e) { console.error(e); }
}

async function createPackage() {
    const price = document.getElementById('pkgPrice').value;
    const catId = document.getElementById('pkgCategory').value;
    const name = document.getElementById('pkgName').value;

    if (!name || !price || !catId) return showAlert('All fields required', 'error');

    if (!currentRouterFilter || currentRouterFilter === 'all') {
        return showAlert('Please select a specific Router from the top filter to create a Package.', 'info');
    }

    try {
        const res = await fetchAuth('/api/admin/packages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, category_id: catId, router_id: currentRouterFilter })
        });
        if (res.ok) {
            closeDashModal('addPackageModal');
            showAlert('Package created');
            document.getElementById('pkgPrice').value = ''; // Reset
            document.getElementById('pkgCategory').value = ''; // Reset
            fetchPackagesList();
            loadStats();
        }
    } catch (e) {
        console.error(e);
        showAlert('Error creating package', 'error');
    }
}

// --- Edit Functions ---

// Category Edit
function openEditCategoryModal(id, name) {
    document.getElementById('editCatId').value = id;
    document.getElementById('editCatName').value = name;
    openDashModal('editCategoryModal');
}

async function submitEditCategory() {
    const id = document.getElementById('editCatId').value;
    const name = document.getElementById('editCatName').value;
    if (!name) return showAlert('Name required', 'error');

    try {
        const res = await fetchAuth(`/ api / admin / categories / ${id} `, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            closeDashModal('editCategoryModal');
            showAlert('Category updated');
            fetchCategoriesList();
            // Also refresh packages in case category name is shown there
            fetchPackagesList();
        } else {
            const d = await res.json();
            showAlert(d.error || 'Update failed', 'error');
        }
    } catch (e) { console.error(e); }
}

// Package Edit
async function openEditPackageModal(id, name, price, catId) {
    document.getElementById('editPkgId').value = id;
    document.getElementById('editPkgName').value = name;
    document.getElementById('editPkgPrice').value = price;

    // Load categories first to ensure dropdown is populated
    await loadCategoriesForSelect();

    // Now move options to the edit select if needed, OR just call API again 
    // Optimization: loadCategoriesForSelect targets 'pkgCategory' (Add Modal). 
    // We can reuse that logic or duplicate it. Let's make a helper.

    // Reuse the fetch but target the edit select
    const res = await fetchAuth('/api/admin/categories');
    const cats = await res.json();
    const sel = document.getElementById('editPkgCategory');
    if (sel) {
        sel.innerHTML = '<option value="">Select Category</option>';
        cats.forEach(c => {
            sel.innerHTML += `< option value = "${c.id}" ${c.id == catId ? 'selected' : ''}> ${escapeHtml(c.name)}</option > `;
        });
    }

    openDashModal('editPackageModal');
}

async function submitEditPackage() {
    const id = document.getElementById('editPkgId').value;
    const name = document.getElementById('editPkgName').value;
    const price = document.getElementById('editPkgPrice').value;
    const catId = document.getElementById('editPkgCategory').value;

    if (!name || !price || !catId) return showAlert('All fields required', 'error');

    try {
        const res = await fetchAuth(`/ api / admin / packages / ${id} `, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price, category_id: catId })
        });
        if (res.ok) {
            closeDashModal('editPackageModal');
            showAlert('Package updated');
            fetchPackagesList();
        } else {
            const d = await res.json();
            showAlert(d.error || 'Update failed', 'error');
        }
    } catch (e) { console.error(e); }
}

async function loadPackagesForImport() {
    const routerQuery = currentRouterFilter ? `? router_id = ${currentRouterFilter} ` : '';
    const res = await fetchAuth(`/ api / admin / packages${routerQuery} `);
    const pkgs = await res.json();
    const sel = document.getElementById('importPackageId');
    if (sel) {
        sel.innerHTML = '<option value="">Select Package</option>';
        pkgs.forEach(p => sel.innerHTML += `< option value = "${p.id}" > ${escapeHtml(p.name)} - ${p.price}</option > `);
    }
}

async function loadPackagesForSell() {
    const routerQuery = currentRouterFilter ? `? router_id = ${currentRouterFilter} ` : '';
    const res = await fetchAuth(`/ api / admin / packages${routerQuery} `);
    const pkgs = await res.json();
    const sel = document.getElementById('sellPackageId');
    if (sel) {
        sel.innerHTML = '<option value="">Select Package</option>';
        pkgs.forEach(p => sel.innerHTML += `< option value = "${p.id}" > ${escapeHtml(p.name)} (${p.price} UGX)</option > `);
    }
}

async function importVouchers() {
    const pkgId = document.getElementById('importPackageId').value;
    const file = document.getElementById('voucherCsv').files[0];
    if (!pkgId || !file) return showAlert('Select package and file', 'error');

    const formData = new FormData();
    formData.append('package_id', pkgId);
    formData.append('file', file);

    try {
        const res = await fetchAuth('/api/admin/vouchers/import', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            closeDashModal('importVoucherModal');
            showAlert(`Imported ${data.count} vouchers`);
            document.getElementById('importPackageId').value = ''; // Reset
            document.getElementById('voucherCsv').value = ''; // Reset
            fetchVouchersList();
            loadStats();
        } else {
            showAlert(data.error || 'Import Failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Upload Error', 'error');
    }
}

// --- Voucher Actions ---
async function deleteCategory(id, name) {
    showConfirm(`Delete category "${name}" ? `, async () => {
        try {
            const res = await fetchAuth(`/ api / admin / categories / ${id} `, { method: 'DELETE' });
            if (res.ok) {
                showAlert('Category deleted');
                fetchCategoriesList();
                loadStats();
            }
        } catch (e) { console.error(e); }
    });
}

function toggleVoucherRow(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function toggleAllVouchers(source) {
    const cbs = document.querySelectorAll('.voucher-cb');
    cbs.forEach(cb => cb.checked = source.checked);
    checkVoucherSelection();
}

function checkVoucherSelection() {
    const cbs = document.querySelectorAll('.voucher-cb:checked');
    const btn = document.getElementById('btnDeleteVouchers');
    if (btn) {
        if (cbs.length > 0) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }
}

async function deleteSelectedVouchers() {
    const cbs = document.querySelectorAll('.voucher-cb:checked');
    const ids = Array.from(cbs).map(cb => cb.value);
    showConfirm(`Delete ${ids.length} vouchers ? `, async () => {
        try {
            const res = await fetchAuth('/api/admin/vouchers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (res.ok) {
                showAlert('Vouchers deleted');
                fetchVouchersList();
                loadStats();
            }
        } catch (e) { console.error(e); }
    });
}

async function deleteSingleVoucher(id) {
    showConfirm("Delete this voucher?", async () => {
        try {
            const res = await fetchAuth('/api/admin/vouchers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });
            if (res.ok) {
                showAlert('Voucher deleted');
                fetchVouchersList();
                loadStats();
            }
        } catch (e) {
            console.error(e);
            showAlert('Error deleting voucher', 'error');
        }
    });
}

async function submitSellVoucher() {
    const pkgId = document.getElementById('sellPackageId').value;
    const phone = document.getElementById('sellPhone').value;
    if (!pkgId || !phone) return showAlert('Missing fields', 'error');

    try {
        const res = await fetchAuth('/api/admin/sell-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_id: pkgId, phone_number: phone })
        });
        const data = await res.json();
        if (res.ok) {
            closeDashModal('sellVoucherModal');
            loadStats();
            document.getElementById('sellPhone').value = ''; // Reset phone, keep package maybe? User said "all inputs" so reset.
            document.getElementById('sellPackageId').value = '';

            // SUCCESS MODAL
            const succMsg = document.getElementById('successMessage');
            if (succMsg) {
                succMsg.innerHTML = `
                    Voucher < strong > ${data.voucher.code}</strong > has been sent successfully to < strong > ${escapeHtml(phone)}</strong >.
                `;
            }
            openDashModal('successModal');
        } else {
            showAlert(data.error || 'Failed to sell', 'error');
        }
    } catch (e) { console.error(e); }
}

async function startSubscriptionRenewal() {
    const phone = document.getElementById('renewPhone').value;
    const months = document.getElementById('renewMonths').value;
    const amount = (months == 1) ? 20000 : (months == 3) ? 60000 : (months == 6) ? 120000 : 240000;

    if (!phone) return showAlert('Enter Phone', 'error');

    try {
        showAlert('Initiating Payment...', 'info');
        const res = await fetchAuth('/api/admin/renew-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone, months: months, amount: amount })
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Check your phone to approve payment', 'success');
            closeDashModal('subscriptionModal');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (e) { console.error(e); }
}

async function submitChangePass() {
    const current = document.getElementById('currentPass').value;
    const newP = document.getElementById('newPass').value;
    const confirmP = document.getElementById('confirmPass').value;

    if (newP !== confirmP) return showAlert('Passwords mismatch', 'error');

    try {
        const res = await fetchAuth('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: newP })
        });
        if (res.ok) {
            closeDashModal('changePassModal');
            showAlert('Password changed');
        } else {
            const d = await res.json();
            showAlert(d.error, 'error');
        }
    } catch (e) { console.error(e); }
}

// --- Initial Stats Load ---
async function loadSMSBalance() {
    try {
        const res = await fetchAuth('/api/admin/sms-balance');
        const data = await res.json();
        const el = document.getElementById('sms-balance');
        if (el) {
            if (data.balance !== undefined) {
                el.innerText = data.balance + ' SMS';
                el.className = 'stat-value'; // remove spinner
            }
            else el.innerText = 'Err';
        }
    } catch (e) { console.error(e); }
}

async function loadStats() {
    try {
        let url = '/api/admin/stats';
        if (typeof currentRouterFilter !== 'undefined' && currentRouterFilter) {
            url += `? router_id = ${currentRouterFilter} `;
        }
        const res = await fetchAuth(url);
        const data = await res.json();


        const counts = data.counts || {};
        const finance = data.finance || {};

        // Update UI - Counts
        if (document.getElementById('cat-count')) document.getElementById('cat-count').innerText = counts.categories_count || 0;
        if (document.getElementById('pkg-count')) document.getElementById('pkg-count').innerText = counts.packages_count || 0;
        if (document.getElementById('voucher-count')) document.getElementById('voucher-count').innerText = counts.vouchers_count || 0;
        if (document.getElementById('bought-vouchers')) document.getElementById('bought-vouchers').innerText = counts.bought_vouchers_count || 0;
        if (document.getElementById('payments-count')) document.getElementById('payments-count').innerText = counts.payments_count || 0;

        // Transaction/Finance Aggregates
        if (document.getElementById('daily-trans')) document.getElementById('daily-trans').innerText = (finance.daily_revenue || 0).toLocaleString();
        if (document.getElementById('weekly-trans')) document.getElementById('weekly-trans').innerText = (finance.weekly_revenue || 0).toLocaleString();
        if (document.getElementById('monthly-trans')) document.getElementById('monthly-trans').innerText = (finance.monthly_revenue || 0).toLocaleString();
        if (document.getElementById('yearly-trans')) document.getElementById('yearly-trans').innerText = (finance.yearly_revenue || 0).toLocaleString();
        if (document.getElementById('total-trans')) document.getElementById('total-trans').innerText = (finance.gross_revenue || 0).toLocaleString();

        // Balance Logic
        const balEl = document.getElementById('balance');
        if (balEl) {
            balEl.innerText = Number(finance.net_balance || 0).toLocaleString() + ' UGX';
        }

    } catch (e) {
        console.error('LoadStats Error:', e);
        showAlert('Network Error: ' + e.message, 'error');
    }
}

function checkSubscriptionStatus(subData) {
    // Left empty for now
}

function showExpiryBanner(date) {
    const banner = document.getElementById('expiryBanner');
    if (banner) {
        banner.style.display = 'block';
    }
}

function showSubscriptionWarning(days, date) {
    const div = document.createElement('div');
    div.id = 'sub-alert';
    div.style.cssText = `
    background: #ff9800; color: #000; padding: 15px;
    text - align: center; font - weight: bold;
    position: fixed; bottom: 20px; right: 20px; z - index: 9000;
    border - radius: 5px; box - shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    `;
    const daysLeft = Math.ceil(days);
    div.innerHTML = `
        ⚠ Subscription expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${date.toLocaleDateString()}).
    <button onclick="this.parentElement.remove()" style="margin-left: 10px; background:none; border:none; cursor:pointer; font-weight:bold;">✕</button>
    `;
    document.body.appendChild(div);
}

async function submitWithdrawal() {

    const amount = document.getElementById('withdrawAmount').value;
    const phone = document.getElementById('withdrawPhone').value;
    const desc = document.getElementById('withdrawDesc').value;
    const otp = document.getElementById('withdrawOTP').value;

    console.log('Withdrawal Data:', { amount: amount, phone: phone });

    if (!otp) {
        console.warn('Missing OTP');
        return showAlert('Please enter the OTP code', 'error');
    }

    const btn = document.getElementById('btnWithdrawConfirm');
    if (btn) {
        btn.innerText = 'Processing...';
        btn.disabled = true;
    }

    try {
        const res = await fetchAuth('/api/admin/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, phone_number: phone, description: desc, otp })
        });

        const data = await res.json();

        if (res.ok) {
            closeDashModal('withdrawModal');
            showAlert('Withdrawal Successful!', 'success');
            // Reset fields
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawPhone').value = '';
            document.getElementById('withdrawDesc').value = '';
            document.getElementById('withdrawOTP').value = '';
            loadStats();
            fetchPaymentsList();
        } else {
            showAlert(data.error || 'Withdrawal Failed', 'error');
        }
    } catch (e) {
        console.error('Submit Withdrawal Error:', e);
        showAlert('Connection Error', 'error');
    } finally {
        if (btn) {
            btn.innerText = 'Confirm & Withdraw';
            btn.disabled = false;
        }
    }
}

// --- Initialize ---
window.submitWithdrawal = submitWithdrawal;


// --- Logout Logic ---
// MOVED TO initDashboard()


// Actual Logout Action
function performLogout() {
    localStorage.removeItem('wipay_token');
    localStorage.removeItem('wipay_user');
    window.location.href = 'login_dashboard.html';
}
function initDashboard() {
    // Initializing Dashboard

    // --- Logout Logic ---
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.onclick = (e) => {
            e.preventDefault();
            openDashModal('logoutConfirmModal');
        };
    }

    // 0. Set User Name
    const username = localStorage.getItem('wipay_user');
    if (username) {
        const welcomeEl = document.getElementById('welcomeMsg');
        if (welcomeEl) welcomeEl.innerText = `WELCOME, ${username.toUpperCase()} `;
    }

    // 1. Mobile Menus
    initMobileMenus();

    // 2. Initial    // Load Stats & Analytics
    loadStats();
    loadAnalytics('weekly'); // Default load
    loadSMSBalance();

    // 3. Restore View
    const savedView = localStorage.getItem('currentView') || 'dashboard';
    switchView(savedView);

    // 4. Listeners
    const nextBtn = document.getElementById('btnWithdrawNext');
    const confirmBtn = document.getElementById('btnWithdrawConfirm');
    const logoutBtn = document.getElementById('logoutLink');

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            initiateWithdrawal();
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitWithdrawal();
        });
    }



    // 5. Socket.IO
    if (typeof io !== 'undefined') {
        try {
            const socket = io('https://ugpay.tech', { path: '/socket.io' });
            socket.on('connect', () => console.log('Connected to WebSocket server'));
            socket.on('data_update', (data) => {
                console.log('Real-time Update:', data.type);
                loadStats();
                loadSMSBalance();
                const activeView = document.querySelector('.view-section:not(.hidden)');
                if (activeView) {
                    const viewId = activeView.id;
                    if (viewId === 'categoriesView' && data.type === 'categories') fetchCategoriesList();
                    if (viewId === 'packagesView' && data.type === 'packages') fetchPackagesList();
                    if (viewId === 'vouchersView' && data.type === 'vouchers') fetchVouchersList();
                    if (viewId === 'paymentsView' && data.type === 'payments') fetchPaymentsList();
                    if (viewId === 'smsView' && data.type === 'sms') fetchSMSLogs();
                    if (viewId === 'myTransactionsView' && data.type === 'myTransactions') fetchMyTransactions();
                }
            });
        } catch (e) { console.error("Socket Error:", e); }
    }
}

function initMobileMenus() {
    const sidebar = document.querySelector('.sidebar');
    const links = document.querySelectorAll('.sidebar-nav li a');
    const hamburger = document.querySelector('.mobile-menu-btn');

    if (links) {
        links.forEach(l => {
            l.addEventListener('click', () => {
                if (window.innerWidth <= 768 && sidebar) {
                    sidebar.classList.remove('open');
                }
            });
        });
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
            // If click is NOT inside sidebar AND NOT the hamburger button
            if (!sidebar.contains(e.target) && (!hamburger || !hamburger.contains(e.target))) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// Shimmer Helper
function showTableShimmer(tbodyId, colCount) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        let cols = '';
        for (let j = 0; j < colCount; j++) {
            cols += '<td><div class="shimmer-line"></div></td>';
        }
        tbody.innerHTML += `< tr class="shimmer-row" > ${cols}</tr > `;
    }
}

// Data Fetching Logic (Consolidated)
// --- Analytics / Charts ---
let transactionChartInstance = null;

async function loadAnalytics(period = 'weekly') {
    // 1. Update Buttons UI
    ['btnWeekly', 'btnMonthly', 'btnYearly'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.background = (id.toLowerCase().includes(period)) ? 'var(--primary-color)' : 'var(--input-bg)';
            btn.style.color = (id.toLowerCase().includes(period)) ? '#fff' : 'var(--text-main)';
        }
    });

    try {
        let url = `/ api / admin / analytics / transactions ? period = ${period} `;
        if (currentRouterFilter) {
            url += `& router_id=${currentRouterFilter} `;
        }
        const res = await fetchAuth(url);
        const data = await res.json();

        if (!Array.isArray(data)) return;

        const labels = data.map(d => d.label);
        const amounts = data.map(d => Number(d.total_amount));
        const counts = data.map(d => Number(d.count));

        renderChart(labels, amounts, counts);
    } catch (e) {
        console.error('Analytics Error:', e);
    }
}

function renderChart(labels, amounts, counts) {
    const ctx = document.getElementById('transactionChart');
    if (!ctx) return;

    if (transactionChartInstance) {
        transactionChartInstance.destroy();
    }

    // Determine colors based on theme (simple check)
    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#b0b3b8' : '#4b5563';

    transactionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue (UGX)',
                    data: amounts,
                    borderColor: '#3b82f6', // Primary Blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true
                },
                {
                    label: 'Transactions',
                    data: counts,
                    borderColor: '#10b981', // Green
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: textColor }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // only want the grid lines for one axis to show up
                    ticks: { color: textColor }
                }
            }
        }
    });
}



// --- Support Widget ---
function toggleSupport() {
    const popover = document.getElementById('supportPopover');
    if (popover) {
        popover.classList.toggle('visible');
    }
}

// Close support popover when clicking outside
window.addEventListener('click', function (e) {
    const fabContainer = document.querySelector('.support-fab-container');
    if (fabContainer && !fabContainer.contains(e.target)) {
        const popover = document.getElementById('supportPopover');
        if (popover) {
            popover.classList.remove('visible');
        }
    }
});

async function fetchCategoriesList() {
    showTableShimmer('categoriesTableBody', 2);
    try {
        const routerQuery = currentRouterFilter !== 'all' ? `? router_id = ${currentRouterFilter} ` : '';
        const res = await fetchAuth(`/ api / admin / categories${routerQuery} `);
        const rows = await res.json();
        const tbody = document.getElementById('categoriesTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #888;">No categories found.</td></tr>';
                return;
            }

            rows.forEach(r => {
                tbody.innerHTML += `
        < tr >
        <td>
            <span>${escapeHtml(r.name)}</span>
            <button class="hover-edit-btn" onclick="openEditCategoryModal(${r.id}, '${r.name.replace(/'/g, "\\'")}')" title="Edit">
            <i class="fas fa-pen"></i>
        </button>
                    </td >
        <td><button class="btn-cancel btn-sm" onclick="deleteCategory(${r.id}, '${r.name.replace(/'/g, "\\'")}')">Delete</button></td >
                </tr >
        `;
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchPackagesList() {
    showTableShimmer('packagesTableBody', 5);
    try {
        const routerQuery = currentRouterFilter ? `? router_id = ${currentRouterFilter} ` : '';
        const res = await fetchAuth(`/ api / admin / packages${routerQuery} `);
        const pkgs = await res.json();
        const tbody = document.getElementById('packagesTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (pkgs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #888;">No packages found.</td></tr>';
                return;
            }

            pkgs.forEach(p => {
                const isActive = p.is_active === 1 || p.is_active === true;
                const statusBadge = isActive
                    ? '<span class="badge bg-success" style="background:#4caf50; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Active</span>'
                    : '<span class="badge bg-danger" style="background:#f44336; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Inactive</span>';

                const toggleTitle = isActive ? 'Deactivate' : 'Activate';
                const toggleIcon = isActive ? 'fa-toggle-on' : 'fa-toggle-off';
                const toggleColor = isActive ? '#4caf50' : '#888';

                tbody.innerHTML += `
        < tr >
        <td>
            <span>${escapeHtml(p.name)}</span>
            <button class="hover-edit-btn" onclick="openEditPackageModal(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.category_id})" title="Edit">
            <i class="fas fa-pen"></i>
        </button>
                    </td >
                    <td>${Number(p.price).toLocaleString()} UGX</td>
                    <td>${escapeHtml(p.category_name || '-')}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn-icon" onclick="togglePackageStatus(${p.id})" title="${toggleTitle}" style="background:none; border:none; color:${toggleColor}; font-size:1.2rem; cursor:pointer;">
                            <i class="fas ${toggleIcon}"></i>
                        </button>
                    </td>
                </tr >
        `;
            });
        }
    } catch (e) {
        console.error(e);
        showAlert('Failed to load packages: ' + e.message, 'error');
    }
}

async function togglePackageStatus(id) {
    try {
        const res = await fetchAuth(`/ api / admin / packages / ${id}/toggle`, {
            method: 'PATCH'
        });
        const data = await res.json();

        if (res.ok) {
            // Update UI immediately or fetch list
            fetchPackagesList();
            showAlert(`Package ${data.is_active ? 'Activated' : 'Deactivated'}`);
        } else {
            showAlert(data.error || 'Failed to update status', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Connection error', 'error');
    }
}

async function fetchVouchersList() {
    showTableShimmer('vouchersTableBody', 2);
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/vouchers${routerQuery}`);
        const vouchers = await res.json();
        const tbody = document.getElementById('vouchersTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (vouchers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #888;">No available vouchers found.</td></tr>';
                const btn = document.getElementById('btnDeleteVouchers');
                if (btn) btn.classList.add('hidden');
                return;
            }

            vouchers.forEach(v => {
                const uniqueId = `v-details-${v.id}`;
                tbody.innerHTML += `
                <tr onclick="toggleVoucherRow('${uniqueId}')" style="cursor: pointer;">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" class="voucher-cb" value="${v.id}" onchange="checkVoucherSelection()">
                    </td>
                    <td style="font-weight: bold; color: #03a9f4;">
                        <span style="margin-right: 10px;">▶</span> ${v.code}
                    </td>
                </tr>
                <tr id="${uniqueId}" class="hidden detail-row">
                    <td></td>
                    <td>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                            <div><strong>Package:</strong> ${v.package_name}</div>
                            <div><strong>Ref:</strong> <span class="detail-text-muted">${v.package_ref || '-'}</span></div>
                            <div><strong>Created:</strong> ${new Date(v.created_at).toLocaleDateString()}</div>
                            <div><strong>Status:</strong> Available</div>
                            <div style="grid-column: span 2;">
                                <strong>Comment:</strong> <span class="detail-text-muted">${v.comment || '-'}</span>
                            </div>
                            <div style="grid-column: span 2; margin-top: 5px;">
                                <button class="btn-cancel" style="font-size: 0.8rem; padding: 4px 8px;" onclick="deleteSingleVoucher(${v.id})">Delete</button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            });
        }
    } catch (e) {
        console.error(e);
        showAlert('Failed to load vouchers: ' + e.message, 'error');
    }
}

async function fetchSMSLogs() {
    try {
        const res = await fetchAuth('/api/admin/sms-logs');
        const logs = await res.json();
        const tbody = document.getElementById('smsTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #888;">No SMS logs found.</td></tr>';
                return;
            }

            logs.forEach(l => {
                const statusColor = l.status === 'sent' ? '#4caf50' : (l.status === 'pending' ? '#ff9800' : '#f44336');
                tbody.innerHTML += `
                <tr>
                    <td>${new Date(l.created_at).toLocaleString()}</td>
                    <td>${escapeHtml(l.phone_number)}</td>
                    <td>${escapeHtml(l.message)}</td>
                    <td style="color: ${statusColor}; font-weight: 500;">${escapeHtml(l.status.toUpperCase())}</td>
                </tr>
            `;
            });
        }
    } catch (e) {
        console.error(e);
        showAlert('Failed to load logs: ' + e.message, 'error');
    }
}

async function fetchMyTransactions() {
    showTableShimmer('myTransactionsTableBody', 6);
    try {
        const res = await fetchAuth('/api/admin/my-transactions');
        const rows = await res.json();
        const tbody = document.getElementById('myTransactionsTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">No transactions found.</td></tr>';
                return;
            }

            rows.forEach(r => {
                let typeBadge = '';
                // Amount color ignored, hardcoded to white as requested
                let amountColor = '#ffffff';

                if (r.type === 'Withdrawal') {
                    typeBadge = '<span class="badge bg-danger">Withdrawal</span>';
                } else if (r.type === 'Subscription') {
                    typeBadge = '<span class="badge bg-warning">Subscription</span>';
                } else {
                    typeBadge = `<span class="badge bg-secondary">${escapeHtml(r.type)}</span>`;
                }

                let statusColor = '#888';
                if (r.status === 'success') statusColor = '#4caf50';
                else if (r.status === 'failed') statusColor = '#f44336';
                else if (r.status === 'pending') statusColor = '#ff9800';

                tbody.innerHTML += `
                <tr>
                    <td>${new Date(r.created_at).toLocaleString()}</td>
                    <td>${typeBadge}</td>
                    <td style="color: #ffffff; font-weight: bold;">${Number(r.amount).toLocaleString()} UGX</td>
                    <td style="color: ${statusColor}; font-weight: 500;">${escapeHtml((r.status || 'success').toUpperCase())}</td>
                    <td>${escapeHtml(r.description || '-')}</td>
                    <td><small style="color:#aaa">${escapeHtml(r.reference || '-')}</small></td>
                </tr>
            `;
            });
        }
    } catch (e) {
        console.error(e);
        showAlert('Failed to load transactions: ' + e.message, 'error');
    }
}

/* loadStats removed - using implementation at line 803 */

async function fetchPaymentsList() {
    try {
        let url = '/api/admin/transactions';
        if (currentRouterFilter) {
            url += `?router_id=${currentRouterFilter}`;
        }
        const res = await fetchAuth(url);
        const txs = await res.json();
        const tbody = document.getElementById('paymentsTableBody');
        if (tbody) {
            tbody.innerHTML = '';

            if (txs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">No transactions found.</td></tr>';
                return;
            }

            txs.forEach(t => {
                const statusColor = t.status === 'success' ? '#4caf50' : '#f44336';
                const method = t.payment_method === 'manual' ? '<span class="badge bg-secondary">Manual</span>' : '<span class="badge bg-primary">MoMo</span>';

                tbody.innerHTML += `
                <tr>
                    <td>${new Date(t.created_at).toLocaleString()}</td>
                    <td>${escapeHtml(t.phone_number)}</td>
                    <td>${Number(t.amount).toLocaleString()} UGX</td>
                    <td>${escapeHtml(t.package_name || '-')}</td>
                    <td>${method}</td>
                    <td style="color: ${statusColor}; font-weight: 500;">${escapeHtml(t.status.toUpperCase())}</td>
                    <td><small style="color:#aaa">${escapeHtml(t.transaction_ref)}</small></td>
                </tr>
            `;
            });
        }
    } catch (e) { console.error(e); }
}

async function initiateWithdrawal() {

    const amount = document.getElementById('withdrawAmount').value;
    const phone = document.getElementById('withdrawPhone').value;

    if (!amount || !phone) {
        console.warn('Withdrawal Missing Fields:', { amount, phone });
        return showAlert('Please enter amount and phone number', 'error');
    }

    const btn = document.getElementById('btnWithdrawNext');
    const originalText = btn.innerText;
    btn.innerText = 'Sending OTP...';
    btn.disabled = true;

    try {
        const res = await fetchAuth('/api/admin/withdraw/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, phone_number: phone })
        });

        const data = await res.json();

        if (res.ok) {
            // Switch to Step 2
            document.getElementById('withdrawStep1').classList.add('hidden');
            document.getElementById('withdrawStep2').classList.remove('hidden');
            document.getElementById('btnWithdrawNext').classList.add('hidden');
            document.getElementById('btnWithdrawConfirm').classList.remove('hidden');
            showAlert('OTP sent to your email!', 'success');
        } else {
            showAlert(data.error || 'Failed to initiate', 'error');
        }
    } catch (e) {
        console.error('Initiate Withdrawal Error:', e);
        showAlert('Connection Error', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- Expose Functions to Window (Required for HTML onclick) ---
window.submitWithdrawal = submitWithdrawal;
window.openEditCategoryModal = openEditCategoryModal;
window.submitEditCategory = submitEditCategory;
window.openEditPackageModal = openEditPackageModal;
window.submitEditPackage = submitEditPackage;
window.togglePackageStatus = togglePackageStatus;
window.loadAnalytics = loadAnalytics; // Expose for buttons
window.toggleSupport = toggleSupport; // Expose FAB
window.createCategory = createCategory;  // Ensure these are also exposed if not already
window.createPackage = createPackage;


// Robust Initialization Pattern
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    // DOM already ready
    initDashboard();
}

// --- Router Management ---
window.fetchRouters = async function () {
    try {
        const res = await fetchAuth('/api/admin/routers');
        const routers = await res.json();
        renderRouters(routers);
    } catch (err) {
        console.error('Fetch Routers Error:', err);
    }
};

function renderRouters(routers) {
    const tbody = document.getElementById('routersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    routers.forEach(router => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(router.name)}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <a href="${escapeHtml(router.mikhmon_url)}" target="_blank" style="color: var(--primary-color); text-decoration: none;">${escapeHtml(router.mikhmon_url)}</a>
            </td>
            <td>
                <button class="btn-success btn-sm" onclick="window.open('${escapeHtml(router.mikhmon_url)}', '_blank')">Manage</button>
                <button class="btn-cancel btn-sm" onclick="deleteRouter(${router.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.submitAddRouter = async function () {
    const name = document.getElementById('routerName').value;
    const url = document.getElementById('routerUrl').value;

    if (!name || !url) {
        showAlert('Please fill in name and URL', 'error');
        return;
    }

    try {
        const res = await fetchAuth('/api/admin/routers', {
            method: 'POST',
            body: JSON.stringify({ name, mikhmon_url: url })
        });

        if (res.ok) {
            showAlert('Router added successfully', 'success');
            closeDashModal('addRouterModal');
            document.getElementById('routerName').value = '';
            document.getElementById('routerUrl').value = '';
            fetchRouters();
        } else {
            const err = await res.json();
            showAlert(err.error || 'Failed to add router', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Network error', 'error');
    }
};

window.deleteRouter = async function (id) {
    if (!confirm('Are you sure you want to delete this router link?')) return;

    try {
        const res = await fetchAuth(`/api/admin/routers/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showAlert('Router deleted', 'success');
            fetchRouters();
        } else {
            showAlert('Failed to delete router', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Network error', 'error');
    }
};

// --- SMS Purchase Logic ---
window.calculateSMSPreview = function (amount) {
    const preview = document.getElementById('smsPreview');
    if (!preview) return;
    if (!amount || amount < 500) {
        preview.innerText = 'Unknown SMS count';
        return;
    }
    const count = Math.floor(amount / 35);
    preview.innerText = `~${count} SMS Credits`;
};

window.submitBuySMS = async function () {
    const phone = document.getElementById('smsPhone').value;
    const amount = document.getElementById('smsAmount').value;

    if (!phone || !amount) return showAlert('Please fill in all fields', 'error');

    const btn = document.querySelector('#buySMSModal .btn-submit');
    const originalText = btn ? btn.innerText : 'Pay & Topup';
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Processing...';
    }

    try {
        const res = await fetchAuth('/api/admin/buy-sms', {
            method: 'POST',
            body: JSON.stringify({ phone_number: phone, amount: amount })
        });
        const data = await res.json();

        if (res.ok) {
            // Show Progress Bar
            const progContainer = document.getElementById('smsProgressBarContainer');
            if (progContainer) progContainer.style.display = 'block';

            let bar = document.getElementById('smsProgressBar');
            if (bar) bar.style.width = '20%';

            // Start Polling
            pollPaymentStatus(data.reference, (status) => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }

                if (status === 'SUCCESS') {
                    if (bar) bar.style.width = '100%';
                    showAlert('SMS Credits Added Successfully!', 'success');
                    closeDashModal('buySMSModal');
                    loadSMSBalance();
                    fetchSMSLogs();
                    // Reset
                    if (progContainer) progContainer.style.display = 'none';
                    if (bar) bar.style.width = '0%';
                } else if (status === 'FAILED') {
                    if (bar) bar.style.width = '0%';
                    showAlert('Payment Failed or Cancelled', 'error');
                } else {
                    // Timeout
                    if (bar) bar.style.width = '0%';
                    showAlert('Payment Pending or Timeout. check logs later.', 'info');
                    closeDashModal('buySMSModal');
                }
            });

        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
            showAlert(data.error || 'Failed to initiate payment', 'error');
        }
    } catch (e) {
        console.error(e);
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
        showAlert('Network Error', 'error');
    }
};

window.pollPaymentStatus = async function (reference, callback) {
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes approx (3s interval)

    // Immediate disabling of cancel? No, user wants to minimize.

    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            callback('TIMEOUT');
            return;
        }

        try {
            const res = await fetchAuth('/api/check-payment-status', {
                method: 'POST',
                body: JSON.stringify({ transaction_ref: reference })
            });

            if (!res.ok) return; // Wait for next tick

            const data = await res.json();

            if (data.status === 'SUCCESS') {
                clearInterval(interval);
                callback('SUCCESS');
            } else if (data.status === 'FAILED') {
                clearInterval(interval);
                callback('FAILED');
            }
            // If PENDING, continue
        } catch (e) {
            console.error('Polling Error', e);
        }
    }, 3000); // Poll every 3 seconds
};

window.performLogout = async function () {
    console.log('Logging out...');
    try {
        await fetchAuth('/api/auth/logout', { method: 'POST' });
    } catch (e) { console.error('Logout server-side failed', e); }

    localStorage.removeItem('wipay_user');
    localStorage.removeItem('wipay_role');
    localStorage.removeItem('wipay_token');

    window.location.href = 'login_dashboard.html';
};
