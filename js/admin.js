/**
 * Admin Dashboard JavaScript
 * Handles admin authentication, data fetching, and display
 */
(function() {
    'use strict';

    const CONFIG = {
        apiUrl: 'http://localhost:8787',
        visitsPerPage: 50
    };

    // State
    let currentVisitsOffset = 0;
    let hasMoreVisits = true;
    let isLoading = false;

    // DOM Elements
    const accessDenied = document.getElementById('access-denied');
    const adminUser = document.getElementById('admin-user');
    const logoutBtn = document.getElementById('logout-btn');
    const visitsBody = document.getElementById('visits-body');
    const visitCount = document.getElementById('visit-count');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const usersBody = document.getElementById('users-body');
    const userCount = document.getElementById('user-count');
    const statsGrid = document.getElementById('stats-grid');
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    /**
     * Check if user is admin
     */
    function checkAdminAccess() {
        const accessLevel = sessionStorage.getItem('accessLevel');
        const user = sessionStorage.getItem('user');
        const token = sessionStorage.getItem('authToken');

        if (accessLevel !== 'member' || !token) {
            return false;
        }

        if (user) {
            const userData = JSON.parse(user);
            if (userData.isAdmin) {
                adminUser.textContent = `Logged in as ${userData.name}`;
                return true;
            }
        }

        return false;
    }

    /**
     * Format date for display
     */
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Create login type badge
     */
    function createLoginBadge(type) {
        const badge = document.createElement('span');
        badge.className = `login-badge ${type || 'guest'}`;
        badge.textContent = type || 'guest';
        return badge;
    }

    /**
     * Create device badge
     */
    function createDeviceBadge(type) {
        const badge = document.createElement('span');
        badge.className = `device-badge ${type || 'unknown'}`;
        badge.textContent = type || '-';
        return badge;
    }

    /**
     * Create role badge
     */
    function createRoleBadge(isAdmin) {
        const badge = document.createElement('span');
        badge.className = `role-badge ${isAdmin ? 'admin' : 'user'}`;
        badge.textContent = isAdmin ? 'Admin' : 'User';
        return badge;
    }

    /**
     * Fetch visits from API
     */
    async function fetchVisits(offset = 0, limit = CONFIG.visitsPerPage) {
        const token = sessionStorage.getItem('authToken');

        const response = await fetch(
            `${CONFIG.apiUrl}/api/admin/visits?offset=${offset}&limit=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch visits');
        }

        return response.json();
    }

    /**
     * Fetch users from API
     */
    async function fetchUsers() {
        const token = sessionStorage.getItem('authToken');

        const response = await fetch(`${CONFIG.apiUrl}/api/admin/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        return response.json();
    }

    /**
     * Fetch stats from API
     */
    async function fetchStats() {
        const token = sessionStorage.getItem('authToken');

        const response = await fetch(`${CONFIG.apiUrl}/api/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch stats');
        }

        return response.json();
    }

    /**
     * Format client timestamp
     */
    function formatClientTime(timestamp) {
        if (!timestamp) return '-';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return '-';
        }
    }

    /**
     * Render visits table
     */
    function renderVisits(visits, append = false) {
        if (!append) {
            visitsBody.innerHTML = '';
        }

        if (visits.length === 0 && !append) {
            const row = document.createElement('tr');
            row.className = 'empty-row';
            row.innerHTML = '<td colspan="10">No visits recorded yet</td>';
            visitsBody.appendChild(row);
            return;
        }

        visits.forEach(visit => {
            const row = document.createElement('tr');

            // Server Time
            const serverTimeCell = document.createElement('td');
            serverTimeCell.textContent = formatDate(visit.visited_at);
            serverTimeCell.title = visit.visited_at;
            row.appendChild(serverTimeCell);

            // Client Time
            const clientTimeCell = document.createElement('td');
            clientTimeCell.textContent = formatClientTime(visit.client_timestamp);
            if (visit.timezone) {
                clientTimeCell.title = `${visit.client_timestamp} (${visit.timezone})`;
            }
            row.appendChild(clientTimeCell);

            // Name
            const nameCell = document.createElement('td');
            nameCell.textContent = visit.name || '-';
            row.appendChild(nameCell);

            // Login Type
            const typeCell = document.createElement('td');
            typeCell.appendChild(createLoginBadge(visit.login_type));
            row.appendChild(typeCell);

            // Device
            const deviceCell = document.createElement('td');
            deviceCell.appendChild(createDeviceBadge(visit.device_type));
            row.appendChild(deviceCell);

            // OS with version
            const osCell = document.createElement('td');
            let osText = visit.os || '-';
            if (visit.os_version) {
                osText += ` ${visit.os_version}`;
            }
            osCell.textContent = osText;
            row.appendChild(osCell);

            // Browser with version
            const browserCell = document.createElement('td');
            let browserText = visit.browser || '-';
            if (visit.browser_version) {
                browserText += ` ${visit.browser_version}`;
            }
            browserCell.textContent = browserText;
            row.appendChild(browserCell);

            // Browser Engine
            const engineCell = document.createElement('td');
            engineCell.textContent = visit.browser_engine || '-';
            engineCell.className = 'engine-cell';
            row.appendChild(engineCell);

            // Location
            const locationCell = document.createElement('td');
            const location = [visit.city, visit.region, visit.country]
                .filter(Boolean)
                .join(', ');
            locationCell.textContent = location || '-';
            row.appendChild(locationCell);

            // IP
            const ipCell = document.createElement('td');
            ipCell.textContent = visit.ip_address || '-';
            row.appendChild(ipCell);

            visitsBody.appendChild(row);
        });
    }

    /**
     * Render users table
     */
    function renderUsers(users) {
        usersBody.innerHTML = '';

        if (users.length === 0) {
            const row = document.createElement('tr');
            row.className = 'empty-row';
            row.innerHTML = '<td colspan="6">No users registered</td>';
            usersBody.appendChild(row);
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');

            // ID
            const idCell = document.createElement('td');
            idCell.textContent = user.id;
            row.appendChild(idCell);

            // Name
            const nameCell = document.createElement('td');
            nameCell.textContent = user.name;
            row.appendChild(nameCell);

            // Role
            const roleCell = document.createElement('td');
            roleCell.appendChild(createRoleBadge(user.is_admin));
            row.appendChild(roleCell);

            // Has Password
            const passwordCell = document.createElement('td');
            passwordCell.textContent = user.password_hash ? 'Yes' : 'No';
            row.appendChild(passwordCell);

            // Created
            const createdCell = document.createElement('td');
            createdCell.textContent = formatDate(user.created_at);
            row.appendChild(createdCell);

            // Last Seen
            const lastSeenCell = document.createElement('td');
            lastSeenCell.textContent = formatDate(user.last_seen);
            row.appendChild(lastSeenCell);

            usersBody.appendChild(row);
        });

        userCount.textContent = `${users.length} users`;
    }

    /**
     * Render stats
     */
    function renderStats(stats) {
        statsGrid.innerHTML = '';

        const statItems = [
            { label: 'Total Visits', value: stats.totalVisits },
            { label: 'Unique Visitors', value: stats.uniqueVisitors },
            { label: 'Registered Users', value: stats.totalUsers },
            { label: 'Visits Today', value: stats.visitsToday },
            { label: 'Desktop', value: stats.deviceStats?.desktop || 0 },
            { label: 'Mobile', value: stats.deviceStats?.mobile || 0 },
            { label: 'Tablet', value: stats.deviceStats?.tablet || 0 },
            { label: 'Admin Logins', value: stats.loginStats?.admin || 0 },
            { label: 'Member Logins', value: stats.loginStats?.member || 0 },
            { label: 'Guest Sessions', value: stats.loginStats?.guest || 0 }
        ];

        statItems.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <div class="stat-value">${stat.value || 0}</div>
                <div class="stat-label">${stat.label}</div>
            `;
            statsGrid.appendChild(card);
        });
    }

    /**
     * Load initial visits
     */
    async function loadVisits() {
        if (isLoading) return;
        isLoading = true;

        // Show loading state
        visitsBody.innerHTML = '<tr class="loading-row"><td colspan="8">Loading...</td></tr>';

        try {
            const data = await fetchVisits(0, CONFIG.visitsPerPage);
            currentVisitsOffset = data.visits.length;
            hasMoreVisits = data.hasMore;

            renderVisits(data.visits);
            visitCount.textContent = `Showing ${data.visits.length} of ${data.total}`;

            loadMoreBtn.disabled = !hasMoreVisits;
            if (!hasMoreVisits) {
                loadMoreBtn.textContent = 'No More Visits';
            }
        } catch (error) {
            console.error('Failed to load visits:', error);
            visitsBody.innerHTML = '<tr class="empty-row"><td colspan="8">Failed to load visits</td></tr>';
        }

        isLoading = false;
    }

    /**
     * Load more visits
     */
    async function loadMoreVisits() {
        if (isLoading || !hasMoreVisits) return;
        isLoading = true;

        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';

        try {
            const data = await fetchVisits(currentVisitsOffset, CONFIG.visitsPerPage);
            currentVisitsOffset += data.visits.length;
            hasMoreVisits = data.hasMore;

            renderVisits(data.visits, true);
            visitCount.textContent = `Showing ${currentVisitsOffset} of ${data.total}`;

            loadMoreBtn.disabled = !hasMoreVisits;
            loadMoreBtn.textContent = hasMoreVisits ? 'Load More' : 'No More Visits';
        } catch (error) {
            console.error('Failed to load more visits:', error);
            loadMoreBtn.textContent = 'Failed - Try Again';
            loadMoreBtn.disabled = false;
        }

        isLoading = false;
    }

    /**
     * Load users
     */
    async function loadUsers() {
        usersBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading...</td></tr>';

        try {
            const data = await fetchUsers();
            renderUsers(data.users);
        } catch (error) {
            console.error('Failed to load users:', error);
            usersBody.innerHTML = '<tr class="empty-row"><td colspan="6">Failed to load users</td></tr>';
        }
    }

    /**
     * Load stats
     */
    async function loadStats() {
        statsGrid.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';

        try {
            const data = await fetchStats();
            renderStats(data);
        } catch (error) {
            console.error('Failed to load stats:', error);
            statsGrid.innerHTML = '<div class="stat-card"><div class="stat-label">Failed to load stats</div></div>';
        }
    }

    /**
     * Switch tabs
     */
    function switchTab(tabName) {
        // Update nav buttons
        navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab contents
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Load data for tab if needed
        if (tabName === 'users' && usersBody.children.length === 0) {
            loadUsers();
        } else if (tabName === 'stats' && statsGrid.children.length === 0) {
            loadStats();
        }
    }

    /**
     * Logout
     */
    function logout() {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }

    /**
     * Initialize
     */
    function init() {
        // Check admin access
        if (!checkAdminAccess()) {
            accessDenied.classList.remove('hidden');
            return;
        }

        // Hide access denied overlay
        accessDenied.classList.add('hidden');

        // Load initial data
        loadVisits();

        // Event listeners
        loadMoreBtn.addEventListener('click', loadMoreVisits);
        logoutBtn.addEventListener('click', logout);

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
