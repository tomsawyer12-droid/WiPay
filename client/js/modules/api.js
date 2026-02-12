/**
 * API Module - Handles all server communication
 */

export async function fetchAuth(url, options = {}) {
    options.credentials = 'include'; // Send HttpOnly cookies
    options.headers = options.headers || {};

    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }

    // Auto-inject Idempotency-Key for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase()) && !options.headers['Idempotency-Key']) {
        options.headers['Idempotency-Key'] = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
        let targetUrl = url;
        if (url.startsWith('/') && typeof CONFIG !== 'undefined' && CONFIG.API_BASE_URL && CONFIG.API_BASE_URL.startsWith('http')) {
            if (url.startsWith('/api') && CONFIG.API_BASE_URL.endsWith('/api')) {
                targetUrl = CONFIG.API_BASE_URL + url.substring(4);
            } else {
                targetUrl = CONFIG.API_BASE_URL + url;
            }
        }

        const res = await fetch(targetUrl, options);
        if (res.status === 401 || res.status === 403) {
            console.warn('Session expired');
            localStorage.removeItem('wipay_token');
            localStorage.removeItem('wipay_role');
            localStorage.removeItem('wipay_user');
            window.location.href = 'login_dashboard.html';
            return Promise.reject('Unauthorized');
        }
        return res;
    } catch (err) {
        console.error('FetchAuth Error:', err);
        throw err;
    }
}

// Add common API calls here
export const api = {
    get: (url) => fetchAuth(url, { method: 'GET' }),
    post: (url, data) => fetchAuth(url, { method: 'POST', body: JSON.stringify(data) }),
    put: (url, data) => fetchAuth(url, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (url) => fetchAuth(url, { method: 'DELETE' }),
    upload: (url, formData) => fetchAuth(url, { method: 'POST', body: formData })
};
