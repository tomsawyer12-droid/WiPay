/**
 * Data Handlers Module - Handles all data fetching and processing
 */

import { fetchAuth, api } from './api.js';
import * as ui from './ui.js';
import { loadAnalytics } from './charts.js';

// State
let currentPackages = [];
let currentTransactions = [];
let currentMyTransactions = [];
let currentBoughtVouchers = [];
let currentRouterFilter = "";
let countdownInterval = null;

export function setCurrentRouterFilter(val) {
    currentRouterFilter = val;
}

export function getCurrentPackages() { return currentPackages; }
export function getCurrentTransactions() { return currentTransactions; }
export function getCurrentMyTransactions() { return currentMyTransactions; }
export function getCurrentBoughtVouchers() { return currentBoughtVouchers; }

// --- DASHBOARD STATS ---
export async function loadStats() {
    try {
        let url = '/api/admin/stats';
        if (currentRouterFilter) {
            url += `?router_id=${currentRouterFilter}`;
        }
        const res = await fetchAuth(url);
        const data = await res.json();
        console.log('DEBUG: Stats Data Received:', data);

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
        const totalBalEl = document.getElementById('total-wallet-balance');
        if (totalBalEl) {
            totalBalEl.innerText = Number(finance.total_balance || 0).toLocaleString() + ' UGX';
        }
        
        const balEl = document.getElementById('balance');
        if (balEl) {
            balEl.innerText = Number(finance.net_balance || 0).toLocaleString() + ' UGX';
        }

        // Subscription Banner Logic
        const banner = document.getElementById('expiryBanner');
        if (banner) {
            const hasExpiry = data.subscription && data.subscription.expiry;
            
            if (!hasExpiry) {
                banner.style.display = 'none';
                if (countdownInterval) clearInterval(countdownInterval);
            } else {
                const expiry = new Date(data.subscription.expiry);
                const now = new Date();
                const threeDays = 3 * 24 * 60 * 60 * 1000;
                const diff = expiry - now;

                console.log('DEBUG: Subscription Check', {
                    expiryStr: data.subscription.expiry,
                    expiryDate: expiry.toLocaleString(),
                    now: now.toLocaleString(),
                    diffMs: diff,
                    isExpired: expiry < now,
                    isSoon: diff < threeDays && diff > 0
                });

                if (countdownInterval) clearInterval(countdownInterval);

                if (expiry < now) {
                    // Expired - Red
                    banner.style.display = 'flex';
                    banner.style.background = 'var(--grad-red)'; 
                    banner.innerHTML = `<span class="banner-icon">⚠️</span> <strong>ALERT:</strong> Your Subscription has EXPIRED. <span class="renew-link">Click here to Renew</span>`;
                } else if (diff < threeDays) {
                    // Expiring Soon - Amber/Orange
                    banner.style.display = 'flex';
                    banner.style.background = 'var(--grad-orange)'; 
                    
                    const updateTimer = () => {
                        const currentNow = new Date();
                        const currentDiff = expiry - currentNow;
                        
                        if (currentDiff <= 0) {
                            console.log('DEBUG: Countdown hit zero, reloading stats.');
                            clearInterval(countdownInterval);
                            loadStats();
                            return;
                        }
                        
                        const d = Math.floor(currentDiff / (1000 * 60 * 60 * 24));
                        const h = Math.floor((currentDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const m = Math.floor((currentDiff % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((currentDiff % (1000 * 60)) / 1000);
                        
                        banner.innerHTML = `<span class="banner-icon">⚠️</span> <strong>WARNING:</strong> Subscription expires in <strong>${d}d ${h}h ${m}m ${s}s</strong>. <span class="renew-link">Renew Now</span>`;
                    };
                    
                    updateTimer(); 
                    countdownInterval = setInterval(updateTimer, 1000);
                } else {
                    // Active and not soon - Hide
                    banner.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.error('LoadStats Error:', e);
    }
}

export async function loadSMSBalance() {
    try {
        const res = await fetchAuth('/api/admin/sms-balance');
        const data = await res.json();
        const el = document.getElementById('sms-balance');
        if (el) {
            if (data.balance !== undefined) {
                el.innerText = data.balance + ' SMS';
                el.className = 'stat-value';
            }
            else el.innerText = 'Err';
        }
    } catch (e) { console.error(e); }
}

// --- CATEGORIES ---
export async function fetchCategoriesList() {
    ui.showTableShimmer('categoriesTableBody', 2);
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/categories${routerQuery}`);
        const rows = await res.json();
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(rows) || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #888;">No categories found.</td></tr>';
            return;
        }

        rows.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>
                        <span>${ui.escapeHtml(r.name)}</span>
                        <button class="hover-edit-btn" onclick="openEditCategoryModal(${r.id}, '${r.name.replace(/'/g, "\\'")}')" title="Edit">
                            <i class="fas fa-pen"></i>
                        </button>
                    </td>
                    <td><button class="btn-cancel btn-sm" onclick="deleteCategory(${r.id}, '${r.name.replace(/'/g, "\\'")}')">Delete</button></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

export async function createCategory() {
    const name = document.getElementById('newCatName').value;
    if (!name) return ui.showAlert('Name required', 'error');

    if (!currentRouterFilter || currentRouterFilter === 'all') {
        return ui.showAlert('Please select a specific Router to create a Category.', 'info');
    }

    try {
        const res = await api.post('/api/admin/categories', { name, router_id: currentRouterFilter });
        if (res.ok) {
            ui.closeDashModal('addCategoryModal');
            ui.showAlert('Category created');
            document.getElementById('newCatName').value = '';
            fetchCategoriesList();
            loadStats();
        }
    } catch (e) { console.error(e); }
}

export async function submitEditCategory() {
    const id = document.getElementById('editCatId').value;
    const name = document.getElementById('editCatName').value;
    if (!name) return ui.showAlert('Name required', 'error');

    try {
        const res = await api.put(`/api/admin/categories/${id}`, { name });
        if (res.ok) {
            ui.closeDashModal('editCategoryModal');
            ui.showAlert('Category updated');
            fetchCategoriesList();
        } else {
            const d = await res.json();
            ui.showAlert(d.error || 'Update failed', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function deleteCategory(id, name) {
    ui.showConfirm(`Delete category "${name}"?`, async () => {
        try {
            const res = await api.delete(`/api/admin/categories/${id}`);
            if (res.ok) {
                ui.showAlert('Category deleted');
                fetchCategoriesList();
                loadStats();
            }
        } catch (e) { console.error(e); }
    });
}


// --- PACKAGES ---
export async function fetchPackagesList() {
    ui.showTableShimmer('packagesTableBody', 6);
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/packages${routerQuery}`);
        const pkgs = await res.json();
        const tbody = document.getElementById('packagesTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(pkgs) || pkgs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">No packages found.</td></tr>';
            return;
        }

        currentPackages = pkgs;

        pkgs.forEach((p, index) => {
            const isActive = p.is_active === 1 || p.is_active === true;
            const statusBadge = isActive
                ? '<span class="badge bg-success" style="background:#4caf50; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Active</span>'
                : '<span class="badge bg-danger" style="background:#f44336; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">Inactive</span>';

            const toggleTitle = isActive ? 'Deactivate' : 'Activate';
            const toggleIcon = isActive ? 'fa-toggle-on' : 'fa-toggle-off';
            const toggleColor = isActive ? '#4caf50' : '#888';
            const count = p.vouchers_count || 0;
            const countColor = count > 0 ? '#4caf50' : '#f44336';
            const voucherBadge = `<span style="color: ${countColor}; font-weight: bold;">${count}</span>`;

            tbody.innerHTML += `
                <tr onclick="viewPackageDetails(${index})" style="cursor: pointer;">
                    <td>
                        <span>${ui.escapeHtml(p.name)}</span>
                        <button class="hover-edit-btn" onclick="event.stopPropagation(); openEditPackageModal(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.category_id})" title="Edit">
                            <i class="fas fa-pen"></i>
                        </button>
                    </td>
                    <td>${Number(p.price).toLocaleString()} UGX</td>
                    <td class="mobile-hide">${ui.escapeHtml(p.category_name || '-')}</td>
                    <td class="mobile-hide">${voucherBadge}</td>
                    <td class="mobile-hide">${statusBadge}</td>
                    <td class="mobile-hide">
                        <button class="btn-icon" onclick="event.stopPropagation(); togglePackageStatus(${p.id})" title="${toggleTitle}" style="background:none; border:none; color:${toggleColor}; font-size:1.2rem; cursor:pointer;">
                            <i class="fas ${toggleIcon}"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

export async function createPackage() {
    const price = document.getElementById('pkgPrice').value;
    const catId = document.getElementById('pkgCategory').value;
    const name = document.getElementById('pkgName').value;

    if (!name || !price || !catId) return ui.showAlert('All fields required', 'error');

    if (!currentRouterFilter || currentRouterFilter === 'all') {
        return ui.showAlert('Please select a specific Router to create a Package.', 'info');
    }

    try {
        const res = await api.post('/api/admin/packages', { name, price, category_id: catId, router_id: currentRouterFilter });
        if (res.ok) {
            ui.closeDashModal('addPackageModal');
            ui.showAlert('Package created');
            document.getElementById('pkgPrice').value = '';
            document.getElementById('pkgCategory').value = '';
            fetchPackagesList();
            loadStats();
        }
    } catch (e) { console.error(e); }
}

export async function submitEditPackage() {
    const id = document.getElementById('editPkgId').value;
    const name = document.getElementById('editPkgName').value;
    const price = document.getElementById('editPkgPrice').value;
    const catId = document.getElementById('editPkgCategory').value;

    if (!name || !price || !catId) return ui.showAlert('All fields required', 'error');

    try {
        const res = await api.put(`/api/admin/packages/${id}`, { name, price, category_id: catId });
        if (res.ok) {
            ui.closeDashModal('editPackageModal');
            ui.showAlert('Package updated');
            fetchPackagesList();
        } else {
            const d = await res.json();
            ui.showAlert(d.error || 'Update failed', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function togglePackageStatus(id) {
    try {
        const res = await fetchAuth(`/api/admin/packages/${id}/toggle`, { method: 'PATCH' });
        const data = await res.json();
        if (res.ok) {
            fetchPackagesList();
            ui.showAlert(`Package ${data.is_active ? 'Activated' : 'Deactivated'}`);
        } else {
            ui.showAlert(data.error || 'Failed to update status', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function loadCategoriesForSelect(targetId = 'pkgCategory', selectedCatId = null) {
    try {
        const routerQuery = currentRouterFilter !== 'all' ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/categories${routerQuery}`);
        const cats = await res.json();
        const sel = document.getElementById(targetId);
        if (sel) {
            sel.innerHTML = '<option value="">Select Category</option>';
            cats.forEach(c => {
                sel.innerHTML += `<option value="${c.id}" ${c.id == selectedCatId ? 'selected' : ''}>${ui.escapeHtml(c.name)}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

// --- VOUCHERS ---
export async function fetchVouchersList() {
    ui.showTableShimmer('vouchersTableBody', 2);
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/vouchers${routerQuery}`);
        const vouchers = await res.json();
        const tbody = document.getElementById('vouchersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(vouchers) || vouchers.length === 0) {
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
    } catch (e) { console.error(e); }
}

export async function importVouchers() {
    const pkgId = document.getElementById('importPackageId').value;
    const file = document.getElementById('voucherCsv').files[0];
    if (!pkgId || !file) return ui.showAlert('Select package and file', 'error');

    const formData = new FormData();
    formData.append('package_id', pkgId);
    formData.append('file', file);

    try {
        const res = await api.upload('/api/admin/vouchers/import', formData);
        const data = await res.json();
        if (res.ok) {
            ui.closeDashModal('importVoucherModal');
            ui.showAlert(`Imported ${data.count} vouchers`);
            document.getElementById('importPackageId').value = '';
            document.getElementById('voucherCsv').value = '';
            fetchVouchersList();
            loadStats();
        } else {
            ui.showAlert(data.error || 'Import Failed', 'error');
        }
    } catch (e) {
        console.error(e);
        ui.showAlert('Upload Error', 'error');
    }
}

export async function deleteSelectedVouchers() {
    const cbs = document.querySelectorAll('.voucher-cb:checked');
    const ids = Array.from(cbs).map(cb => cb.value);
    ui.showConfirm(`Delete ${ids.length} vouchers ? `, async () => {
        try {
            const res = await api.post('/api/admin/vouchers/batch-delete', { ids }); // Using POST or DELETE with body usually
            // wait, dashboard-logic used DELETE with body. api.delete doesn't support body.
            // Let's use fetchAuth directly or update api.delete
            // Actually dashboard-logic used fetchAuth('/api/admin/vouchers', { method: 'DELETE', body... })
            
            const delRes = await fetchAuth('/api/admin/vouchers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (delRes.ok) {
                ui.showAlert('Vouchers deleted');
                fetchVouchersList();
                loadStats();
            }
        } catch (e) { console.error(e); }
    });
}

export async function deleteSingleVoucher(id) {
    ui.showConfirm("Delete this voucher?", async () => {
        try {
            const res = await fetchAuth('/api/admin/vouchers', {
                 method: 'DELETE',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ ids: [id] })
            });
            if (res.ok) {
                ui.showAlert('Voucher deleted');
                fetchVouchersList();
                loadStats();
            }
        } catch (e) { console.error(e); }
    });
}

export async function loadPackagesForImport() {
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/packages${routerQuery}`);
        const pkgs = await res.json();
        const sel = document.getElementById('importPackageId');
        if (sel) {
            sel.innerHTML = '<option value="">Select Package</option>';
            pkgs.forEach(p => sel.innerHTML += `<option value="${p.id}">${ui.escapeHtml(p.name)} - ${p.price}</option>`);
        }
        
        // Also load for sell modal while we are at it?
        const sellSel = document.getElementById('sellPackageId');
        if (sellSel) {
            sellSel.innerHTML = '<option value="">Select Package</option>';
             pkgs.forEach(p => sellSel.innerHTML += `<option value="${p.id}">${ui.escapeHtml(p.name)} (${p.price} UGX)</option>`);
        }
    } catch(e) { console.error(e); }
}

export async function loadPackagesForSell() {
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/packages${routerQuery}`);
        const pkgs = await res.json();
        const sellSel = document.getElementById('sellPackageId');
        if (sellSel) {
            sellSel.innerHTML = '<option value="">Select Package</option>';
            pkgs.forEach(p => sellSel.innerHTML += `<option value="${p.id}">${ui.escapeHtml(p.name)} (${p.price} UGX)</option>`);
        }
    } catch(e) { console.error(e); }
}

export async function submitSellVoucher() {
    const pkgId = document.getElementById('sellPackageId').value;
    const phone = document.getElementById('sellPhone').value;
    if (!pkgId || !phone) return ui.showAlert('Missing fields', 'error');

    try {
        const res = await api.post('/api/admin/sell-voucher', { package_id: pkgId, phone_number: phone });
        const data = await res.json();
        if (res.ok) {
            ui.closeDashModal('sellVoucherModal');
            loadStats();
            document.getElementById('sellPhone').value = '';
            document.getElementById('sellPackageId').value = '';

            const succMsg = document.getElementById('successMessage');
            if (succMsg) {
                succMsg.innerHTML = `Voucher <strong>${data.voucher.code}</strong> has been sent successfully to <strong>${ui.escapeHtml(phone)}</strong>.`;
            }
            ui.openDashModal('successModal');
        } else {
            ui.showAlert(data.error || 'Failed to sell', 'error');
        }
    } catch (e) { console.error(e); }
}

// --- PAYMENTS ---
export async function fetchPaymentsList() {
    try {
        let url = '/api/admin/transactions';
        if (currentRouterFilter) {
            url += `?router_id=${currentRouterFilter}`;
        }
        const res = await fetchAuth(url);
        const txs = await res.json();
        const tbody = document.getElementById('paymentsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(txs) || txs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #888;">No transactions found.</td></tr>';
            return;
        }

        currentTransactions = txs;

        txs.forEach((t, index) => {
            const statusColor = t.status === 'success' ? '#4caf50' : '#f44336';
            const method = t.payment_method === 'manual' ? '<span class="badge bg-secondary">Manual</span>' : '<span class="badge bg-primary">MoMo</span>';

            tbody.innerHTML += `
                <tr onclick="viewTransactionDetails(${index})" style="cursor: pointer;">
                    <td>${new Date(t.created_at).toLocaleString()}</td>
                    <td>${ui.escapeHtml(t.phone_number)}</td>
                    <td class="mobile-hide">${Number(t.amount).toLocaleString()} UGX</td>
                    <td class="mobile-hide">${ui.escapeHtml(t.package_name || '-')}</td>
                    <td class="mobile-hide">${method}</td>
                    <td class="mobile-hide" style="color: ${statusColor}; font-weight: 500;">${ui.escapeHtml(t.status.toUpperCase())}</td>
                    <td class="mobile-hide"><small style="color:#aaa">${ui.escapeHtml(t.transaction_ref)}</small></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

export async function initiateWithdrawal() {
    const amount = document.getElementById('withdrawAmount').value;
    const phone = document.getElementById('withdrawPhone').value;

    if (!amount || !phone) {
        return ui.showAlert('Please enter amount and phone number', 'error');
    }

    const btn = document.getElementById('btnWithdrawNext');
    const originalText = btn.innerText;
    btn.innerText = 'Sending OTP...';
    btn.disabled = true;

    try {
        const res = await api.post('/api/admin/withdraw/initiate', { amount, phone_number: phone });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('withdrawStep1').classList.add('hidden');
            document.getElementById('withdrawStep2').classList.remove('hidden');
            document.getElementById('btnWithdrawNext').classList.add('hidden');
            document.getElementById('btnWithdrawConfirm').classList.remove('hidden');
            ui.showAlert('OTP sent to your email!', 'success');
        } else {
            ui.showAlert(data.error || 'Failed to initiate', 'error');
        }
    } catch (e) {
        console.error(e);
        ui.showAlert('Connection Error', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

export async function submitWithdrawal() {
    const amount = document.getElementById('withdrawAmount').value;
    const phone = document.getElementById('withdrawPhone').value;
    const desc = document.getElementById('withdrawDesc').value;
    const otp = document.getElementById('withdrawOTP').value;

    if (!otp) return ui.showAlert('Please enter the OTP code', 'error');

    const btn = document.getElementById('btnWithdrawConfirm');
    if (btn) {
        btn.innerText = 'Processing...';
        btn.disabled = true;
    }

    try {
        const res = await api.post('/api/admin/withdraw', { amount, phone_number: phone, description: desc, otp });
        const data = await res.json();

        if (res.ok) {
            ui.closeDashModal('withdrawModal');
            ui.showAlert('Withdrawal Successful!', 'success');
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawPhone').value = '';
            document.getElementById('withdrawDesc').value = '';
            document.getElementById('withdrawOTP').value = '';
            loadStats();
            fetchPaymentsList();
        } else {
            ui.showAlert(data.error || 'Withdrawal Failed', 'error');
        }
    } catch (e) {
        ui.showAlert('Connection Error', 'error');
    } finally {
        if (btn) {
            btn.innerText = 'Confirm & Withdraw';
            btn.disabled = false;
        }
    }
}

export function resetWithdrawalModal() {
    document.getElementById('withdrawStep1').classList.remove('hidden');
    document.getElementById('withdrawStep2').classList.add('hidden');
    document.getElementById('btnWithdrawNext').classList.remove('hidden');
    document.getElementById('btnWithdrawConfirm').classList.add('hidden');
    
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawPhone').value = '';
    document.getElementById('withdrawDesc').value = '';
    document.getElementById('withdrawOTP').value = '';
}

// --- SMS LOGS ---
export async function fetchSMSLogs() {
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
        const res = await fetchAuth(`/api/admin/sms-logs${routerQuery}`);
        const logs = await res.json();
        const tbody = document.getElementById('smsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(logs) || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #888;">No SMS logs found.</td></tr>';
            return;
        }

        logs.forEach(l => {
            const statusColor = l.status === 'sent' ? '#4caf50' : (l.status === 'pending' ? '#ff9800' : '#f44336');
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(l.created_at).toLocaleString()}</td>
                    <td>${ui.escapeHtml(l.phone_number)}</td>
                    <td>${ui.escapeHtml(l.message)}</td>
                    <td style="color: ${statusColor}; font-weight: 500;">${ui.escapeHtml(l.status.toUpperCase())}</td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

export function calculateSMSPreview(amount) {
    const preview = document.getElementById('smsPreview');
    if (!preview) return;
    if (!amount || amount < 500) {
        preview.innerText = 'Unknown SMS count';
        return;
    }
    const count = Math.floor(amount / 35); // Re-verified logic
    preview.innerText = `~${count} SMS Credits`;
}

export async function submitBuySMS() {
    const phone = document.getElementById('smsPhone').value;
    const amount = document.getElementById('smsAmount').value;

    if (!phone || !amount) return ui.showAlert('Please fill in all fields', 'error');

    const btn = document.querySelector('#buySMSModal .btn-submit');
    const originalText = btn ? btn.innerText : 'Pay & Topup';
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Processing...';
    }

    try {
        const res = await api.post('/api/admin/buy-sms', { phone_number: phone, amount });
        const data = await res.json();

        if (res.ok) {
            const progContainer = document.getElementById('smsProgressBarContainer');
            if (progContainer) progContainer.style.display = 'block';
            let bar = document.getElementById('smsProgressBar');
            if (bar) bar.style.width = '20%';

            pollPaymentStatus(data.reference, (status) => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
                if (status === 'SUCCESS') {
                    if (bar) bar.style.width = '100%';
                    ui.showAlert('SMS Credits Added Successfully!', 'success');
                    ui.closeDashModal('buySMSModal');
                    loadSMSBalance();
                    fetchSMSLogs();
                    if (progContainer) progContainer.style.display = 'none';
                    if (bar) bar.style.width = '0%';
                } else if (status === 'FAILED') {
                    ui.showAlert('Payment Failed', 'error');
                } else {
                    ui.showAlert('Payment Timeout', 'info');
                    ui.closeDashModal('buySMSModal');
                }
            });
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
            ui.showAlert(data.error || 'Failed to initiate', 'error');
        }
    } catch (e) { console.error(e); }
}

function pollPaymentStatus(reference, callback) {
    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            callback('TIMEOUT');
            return;
        }

        try {
            const res = await api.post('/api/check-payment-status', { transaction_ref: reference });
            if (!res.ok) return;
            const data = await res.json();

            if (data.status === 'SUCCESS') {
                clearInterval(interval);
                callback('SUCCESS');
            } else if (data.status === 'FAILED') {
                clearInterval(interval);
                callback('FAILED');
            }
        } catch (e) { console.error(e); }
    }, 3000);
}

// --- ROUTERS ---
export async function fetchRouters() {
    try {
        const res = await fetchAuth('/api/admin/routers');
        const routers = await res.json();
        const tbody = document.getElementById('routersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        routers.forEach(router => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span>${ui.escapeHtml(router.name)}</span>
                    <button class="hover-edit-btn" onclick="openEditRouterModal(${router.id}, '${router.name.replace(/'/g, "\\'")}', '${router.mikhmon_url.replace(/'/g, "\\'")}')" title="Edit">
                        <i class="fas fa-pen"></i>
                    </button>
                </td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="#" onclick="openMikhmon('${ui.escapeHtml(router.mikhmon_url)}'); return false;" style="color: var(--primary-color); text-decoration: none;">${ui.escapeHtml(router.mikhmon_url)}</a>
                </td>
                <td>
                    <button class="btn-success btn-sm" onclick="openMikhmon('${ui.escapeHtml(router.mikhmon_url)}')">Manage</button>
                    <button class="btn-cancel btn-sm" onclick="deleteRouter(${router.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

export async function submitAddRouter() {
    const name = document.getElementById('routerName').value;
    const url = document.getElementById('routerUrl').value;
    if (!name || !url) return ui.showAlert('Please fill in name and URL', 'error');

    try {
        const res = await api.post('/api/admin/routers', { name, mikhmon_url: url });
        if (res.ok) {
            ui.showAlert('Router added successfully', 'success');
            ui.closeDashModal('addRouterModal');
            document.getElementById('routerName').value = '';
            document.getElementById('routerUrl').value = '';
            fetchRouters();
        } else {
            const err = await res.json();
            ui.showAlert(err.error || 'Failed to add router', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function submitEditRouter() {
    const id = document.getElementById('editRouterId').value;
    const name = document.getElementById('editRouterName').value;
    const url = document.getElementById('editRouterUrl').value;
    if (!name || !url) return ui.showAlert('Please fill in all fields', 'error');

    try {
        const res = await api.put(`/api/admin/routers/${id}`, { name, mikhmon_url: url });
        if (res.ok) {
            ui.showAlert('Router updated');
            ui.closeDashModal('editRouterModal');
            fetchRouters();
        } else {
            const d = await res.json();
            ui.showAlert(d.error || 'Update failed', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function deleteRouter(id) {
    if (!confirm('Delete this router link?')) return;
    try {
        const res = await api.delete(`/api/admin/routers/${id}`);
        if (res.ok) {
            ui.showAlert('Router deleted');
            fetchRouters();
        } else {
            ui.showAlert('Failed to delete', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function openMikhmon(baseUrl, routerName = null) {
    try {
        const res = await fetchAuth('/api/admin/mikhmon-token');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Auth failed');
        const token = data.token;

        // Construct URL carefully. 
        let urlObj = new URL(baseUrl);
        let path = urlObj.pathname;
        if (!path.endsWith('/')) path += '/';
        
        let redirectUrl = `${urlObj.origin}${path}autologin.php?token=${token}`;
        
        // If we have a router name or it's in the original URL, pass it as session
        let session = routerName || urlObj.searchParams.get('session');
        if (session) {
            redirectUrl += `&session=${encodeURIComponent(session)}`;
        }
        
        window.open(redirectUrl, '_blank');
    } catch (e) {
        console.error('Mikhmon Auto-Login Error:', e);
        window.open(baseUrl, '_blank');
    }
}


// --- OTHER ---
export async function fetchDownloadsList() {
    const tbody = document.getElementById('downloadsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Fetching...</td></tr>';

    try {
        const res = await fetchAuth('/api/admin/resources');
        const files = await res.json();
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!Array.isArray(files) || files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#ccc;">No files available yet.</td></tr>';
            return;
        }

        files.forEach(f => {
            tbody.innerHTML += `
                <tr>
                    <td style="color:white; font-weight:500;">${ui.escapeHtml(f.title || 'Untitled')}</td>
                    <td style="color:#aaa;">${ui.escapeHtml(f.description || '-')}</td>
                    <td>
                        <a href="${f.file_path}" download target="_blank" class="btn-submit" style="text-decoration:none; display:inline-block; padding: 6px 12px; font-size: 0.8rem;">Download</a>
                    </td>
                </tr>
            `;
        });
    } catch (e) { 
        console.error(e);
        if(tbody) tbody.innerHTML = '<tr><td colspan="3">or loading</td></tr>';
    }
}

export async function fetchBoughtVouchersList() {
    const tbody = document.getElementById('boughtVouchersTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Fetching...</td></tr>';
    try {
        const routerQuery = currentRouterFilter ? `?router_id=${currentRouterFilter}` : '';
         // NOTE: Bought vouchers logic calls transactions and filters
        const res = await fetchAuth(`/api/admin/transactions${routerQuery}`);
        const all = await res.json();
        const sales = all.filter(t => t.status === 'success' && t.payment_method !== 'manual' && !t.transaction_ref.startsWith('SMS-'));
        
        currentBoughtVouchers = sales;
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (sales.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#ccc;">No vouchers sold yet.</td></tr>';
             return;
        }

        sales.forEach((t, index) => {
            tbody.innerHTML += `
                <tr onclick="viewGenericDetails('boughtVouchers', ${index})" style="cursor: pointer;">
                    <td class="mobile-hide" style="color:#aaa;">${new Date(t.created_at).toLocaleString()}</td>
                    <td style="font-weight:500;">${ui.escapeHtml(t.phone_number)}</td>
                    <td class="mobile-hide"><span class="badge badge-blue">${ui.escapeHtml(t.package_name || 'Unknown')}</span></td>
                    <td class="mobile-hide">${t.amount ? t.amount.toLocaleString() : 0}</td>
                    <td><span style="font-family:monospace; background:#333; padding:2px 5px; border-radius:4px;">${t.voucher_code ? ui.escapeHtml(t.voucher_code) : 'Auto-Assigned'}</span></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}


export async function fetchMyTransactions() {
    ui.showTableShimmer('myTransactionsTableBody', 6);
    try {
        const res = await fetchAuth('/api/admin/my-transactions');
        const rows = await res.json();
        const tbody = document.getElementById('myTransactionsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #888;">No transactions found.</td></tr>';
            return;
        }
        currentMyTransactions = rows;

        rows.forEach((r, index) => {
             let typeBadge = `<span class="badge bg-secondary">${ui.escapeHtml(r.type)}</span>`;
             if (r.type === 'Withdrawal') typeBadge = '<span class="badge bg-danger">Withdrawal</span>';
             if (r.type === 'Subscription') typeBadge = '<span class="badge bg-warning">Subscription</span>';

             let statusColor = '#888';
             if (r.status === 'success') statusColor = '#4caf50';
             else if (r.status === 'failed') statusColor = '#f44336';
             else if (r.status === 'pending') statusColor = '#ff9800';

             tbody.innerHTML += `
                <tr onclick="viewGenericDetails('myTransactions', ${index})" style="cursor: pointer;">
                    <td>${new Date(r.created_at).toLocaleString()}</td>
                    <td class="mobile-hide">${typeBadge}</td>
                    <td style="color: #ffffff; font-weight: bold;">${Number(r.amount).toLocaleString()} UGX</td>
                    <td class="mobile-hide" style="color: ${statusColor}; font-weight: 500;">${ui.escapeHtml((r.status || 'success').toUpperCase())}</td>
                    <td class="mobile-hide">${ui.escapeHtml(r.description || '-')}</td>
                    <td class="mobile-hide"><small style="color:#aaa">${ui.escapeHtml(r.reference || '-')}</small></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

export async function submitChangePass() {
    const current = document.getElementById('currentPass').value;
    const newP = document.getElementById('newPass').value;
    const confirmP = document.getElementById('confirmPass').value;

    if (newP !== confirmP) return ui.showAlert('Passwords mismatch', 'error');

    try {
        const res = await api.post('/api/admin/change-password', { currentPassword: current, newPassword: newP });
        if (res.ok) {
            ui.closeDashModal('changePassModal');
            ui.showAlert('Password changed');
        } else {
            const d = await res.json();
            ui.showAlert(d.error, 'error');
        }
    } catch (e) { console.error(e); }
}

export async function startSubscriptionRenewal() {
    const phone = document.getElementById('renewPhone').value;
    const months = document.getElementById('renewMonths').value;
    const amount = (months == 1) ? 20000 : (months == 3) ? 60000 : (months == 6) ? 120000 : 240000;

    if (!phone) return ui.showAlert('Enter Phone', 'error');

    try {
        ui.showAlert('Initiating Payment...', 'info');
        const res = await api.post('/api/admin/renew-subscription', { phone_number: phone, months, amount });
        const data = await res.json();
        if (res.ok) {
            ui.showAlert('Check your phone to approve payment', 'success');
            ui.closeDashModal('subscriptionModal');
        } else {
            ui.showAlert(data.error || 'Failed', 'error');
        }
    } catch (e) { console.error(e); }
}

export async function openCheckSiteModal() {
    ui.openDashModal('checkSiteModal');
    const list = document.getElementById('checkSiteRouterList');
    if (list) list.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">Fetching routers...</div>';

    try {
         const res = await fetchAuth('/api/admin/routers');
         const routers = await res.json();
         if (list) {
            list.innerHTML = '';
            if (!routers || routers.length === 0) {
                list.innerHTML = '<div style="text-align: center; color: #aaa; padding: 20px;">No routers found.</div>';
                return;
            }
            routers.forEach(r => {
                 const btn = document.createElement('button');
                 btn.className = 'btn-router-select';
                 // Styles are in CSS or inline
                 btn.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #2a2a2a; border: 1px solid #333; border-radius: 10px; color: white; cursor: pointer; text-align: left; width: 100%; margin-bottom: 8px;";
                 btn.onclick = () => {
                     ui.closeDashModal('checkSiteModal');
                     openMikhmon(r.mikhmon_url, r.name);
                 };
                 btn.innerHTML = `<div><strong>${ui.escapeHtml(r.name)}</strong><br><small>${ui.escapeHtml(r.mikhmon_url)}</small></div> <i class="fas fa-chevron-right"></i>`;
                 list.appendChild(btn);
            });
         }
    } catch (e) { console.error(e); }
}

export function performLogout() {
    fetchAuth('/api/auth/logout', { method: 'POST' }).catch(console.error);
    localStorage.removeItem('wipay_token');
    localStorage.removeItem('wipay_user');
    window.location.href = 'login_dashboard.html';
}

