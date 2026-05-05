/**
 * Admin Dashboard JavaScript
 * Handles admin authentication, data fetching, display, and CMS CRUD
 */
(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const CONFIG = {
        visitsPerPage: 50
    };

    // State
    let currentVisitsOffset = 0;
    let hasMoreVisits = true;
    let currentPVOffset = 0;
    let hasMorePV = true;
    let isLoading = false;

    // Auth helper
    function getToken() {
        return sessionStorage.getItem('authToken');
    }

    function authHeaders() {
        return { 'Authorization': 'Bearer ' + getToken() };
    }

    function jsonAuthHeaders() {
        return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
    }

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

    // Sheet Music DOM
    const sheetsList = document.getElementById('sheets-list');
    const sheetFormContainer = document.getElementById('sheet-form-container');
    const sheetForm = document.getElementById('sheet-form');
    const sheetFormTitle = document.getElementById('sheet-form-title');
    const sheetEditId = document.getElementById('sheet-edit-id');
    const sheetDropZone = document.getElementById('sheet-drop-zone');
    const sheetDropText = document.getElementById('sheet-drop-text');
    const sheetPdfInput = document.getElementById('sheet-pdf-input');
    const sheetR2Key = document.getElementById('sheet-r2-key');

    // Music DOM
    const albumsList = document.getElementById('albums-list');
    const albumFormContainer = document.getElementById('album-form-container');
    const albumForm = document.getElementById('album-form');
    const albumFormTitle = document.getElementById('album-form-title');
    const albumEditId = document.getElementById('album-edit-id');
    const tracksEditor = document.getElementById('tracks-editor');
    const tracksEditorTitle = document.getElementById('tracks-editor-title');
    const tracksList = document.getElementById('tracks-list');

    // Page Views DOM
    const pageviewsBody = document.getElementById('pageviews-body');
    const pageviewCount = document.getElementById('pageview-count');
    const loadMorePVBtn = document.getElementById('load-more-pv-btn');

    // Donations DOM
    const donationsStats = document.getElementById('donations-stats');
    const donationsBody = document.getElementById('donations-body');
    const donationCount = document.getElementById('donation-count');
    const donationsBreakdown = document.getElementById('donations-breakdown');
    const topSheetsList = document.getElementById('top-sheets-list');
    const donationSearch = document.getElementById('donation-search');
    const filterSource = document.getElementById('filter-source');
    const filterTipType = document.getElementById('filter-tip-type');
    const filterSheet = document.getElementById('filter-sheet');
    const clearFiltersBtn = document.getElementById('clear-donation-filters');
    const donationsLoadMore = document.getElementById('donations-load-more');
    const donationsLoadMoreBtn = document.getElementById('donations-load-more-btn');

    // Donations state
    let donationsOffset = 0;
    let hasMoreDonations = true;
    let donationSearchTimer = null;

    /**
     * Check if user is admin
     */
    function checkAdminAccess() {
        const accessLevel = sessionStorage.getItem('accessLevel');
        const user = sessionStorage.getItem('user');
        const token = getToken();

        if (accessLevel !== 'member' || !token) {
            return false;
        }

        if (user) {
            const userData = JSON.parse(user);
            if (userData.isAdmin) {
                adminUser.textContent = 'Logged in as ' + userData.name;
                return true;
            }
        }

        return false;
    }

    /**
     * Format date for display
     */
    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + 'm ago';
        if (diffHours < 24) return diffHours + 'h ago';
        if (diffDays < 7) return diffDays + 'd ago';

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
        badge.className = 'login-badge ' + (type || 'guest');
        badge.textContent = type || 'guest';
        return badge;
    }

    /**
     * Create device badge
     */
    function createDeviceBadge(type) {
        const badge = document.createElement('span');
        badge.className = 'device-badge ' + (type || 'unknown');
        badge.textContent = type || '-';
        return badge;
    }

    /**
     * Create role badge
     */
    function createRoleBadge(isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'role-badge ' + (isAdmin ? 'admin' : 'user');
        badge.textContent = isAdmin ? 'Admin' : 'User';
        return badge;
    }

    // =========================================
    // VISITS
    // =========================================
    async function fetchVisits(offset, limit) {
        const response = await fetch(
            '/api/admin/visits?offset=' + offset + '&limit=' + limit,
            { headers: authHeaders() }
        );
        if (!response.ok) throw new Error('Failed to fetch visits');
        return response.json();
    }

    function formatClientTime(timestamp) {
        if (!timestamp) return '-';
        try {
            var date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch (e) { return '-'; }
    }

    function renderVisits(visits, append) {
        if (!append) visitsBody.innerHTML = '';

        if (visits.length === 0 && !append) {
            visitsBody.innerHTML = '<tr class="empty-row"><td colspan="11">No visits recorded yet</td></tr>';
            return;
        }

        visits.forEach(function(visit) {
            var row = document.createElement('tr');
            var pageUrl = visit.page_url || '/';
            row.innerHTML =
                '<td title="' + escapeHtml(visit.visited_at) + '">' + formatDate(visit.visited_at) + '</td>' +
                '<td title="' + escapeHtml(visit.client_timestamp) + (visit.timezone ? ' (' + escapeHtml(visit.timezone) + ')' : '') + '">' + formatClientTime(visit.client_timestamp) + '</td>' +
                '<td>' + escapeHtml(visit.name || '-') + '</td>' +
                '<td></td>' +
                '<td>' + escapeHtml(pageUrl) + '</td>' +
                '<td></td>' +
                '<td>' + escapeHtml(visit.os || '-') + (visit.os_version ? ' ' + escapeHtml(visit.os_version) : '') + '</td>' +
                '<td>' + escapeHtml(visit.browser || '-') + (visit.browser_version ? ' ' + escapeHtml(visit.browser_version) : '') + '</td>' +
                '<td class="engine-cell">' + escapeHtml(visit.browser_engine || '-') + '</td>' +
                '<td>' + escapeHtml([visit.city, visit.region, visit.country].filter(Boolean).join(', ')) + '</td>' +
                '<td>' + escapeHtml(visit.ip_address || '-') + '</td>';

            // Add badges
            row.cells[3].innerHTML = '';
            row.cells[3].appendChild(createLoginBadge(visit.login_type));
            row.cells[5].innerHTML = '';
            row.cells[5].appendChild(createDeviceBadge(visit.device_type));
            visitsBody.appendChild(row);
        });
    }

    async function loadVisits() {
        if (isLoading) return;
        isLoading = true;
        visitsBody.innerHTML = '<tr class="loading-row"><td colspan="11">Loading...</td></tr>';

        try {
            var data = await fetchVisits(0, CONFIG.visitsPerPage);
            currentVisitsOffset = data.visits.length;
            hasMoreVisits = data.hasMore;
            renderVisits(data.visits);
            visitCount.textContent = 'Showing ' + data.visits.length + ' of ' + data.total;
            loadMoreBtn.disabled = !hasMoreVisits;
            if (!hasMoreVisits) loadMoreBtn.textContent = 'No More Visits';
        } catch (e) {
            visitsBody.innerHTML = '<tr class="empty-row"><td colspan="11">Failed to load visits</td></tr>';
        }
        isLoading = false;
    }

    async function loadMoreVisits() {
        if (isLoading || !hasMoreVisits) return;
        isLoading = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';

        try {
            var data = await fetchVisits(currentVisitsOffset, CONFIG.visitsPerPage);
            currentVisitsOffset += data.visits.length;
            hasMoreVisits = data.hasMore;
            renderVisits(data.visits, true);
            visitCount.textContent = 'Showing ' + currentVisitsOffset + ' of ' + data.total;
            loadMoreBtn.disabled = !hasMoreVisits;
            loadMoreBtn.textContent = hasMoreVisits ? 'Load More' : 'No More Visits';
        } catch (e) {
            loadMoreBtn.textContent = 'Failed - Try Again';
            loadMoreBtn.disabled = false;
        }
        isLoading = false;
    }

    // =========================================
    // USERS
    // =========================================
    async function loadUsers() {
        usersBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading...</td></tr>';

        try {
            var res = await fetch('/api/admin/users', { headers: authHeaders() });
            var data = await res.json();
            usersBody.innerHTML = '';

            if (data.users.length === 0) {
                usersBody.innerHTML = '<tr class="empty-row"><td colspan="6">No users registered</td></tr>';
                return;
            }

            data.users.forEach(function(user) {
                var row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + escapeHtml(user.id) + '</td>' +
                    '<td>' + escapeHtml(user.name) + '</td>' +
                    '<td></td>' +
                    '<td>' + (user.has_password ? 'Yes' : 'No') + '</td>' +
                    '<td>' + formatDate(user.created_at) + '</td>' +
                    '<td>' + formatDate(user.last_seen) + '</td>';
                row.cells[2].appendChild(createRoleBadge(user.is_admin));
                usersBody.appendChild(row);
            });

            userCount.textContent = data.users.length + ' users';
        } catch (e) {
            usersBody.innerHTML = '<tr class="empty-row"><td colspan="6">Failed to load users</td></tr>';
        }
    }

    // =========================================
    // PAGE VIEWS
    // =========================================
    async function fetchPageViews(offset, limit) {
        var res = await fetch('/api/admin/pageviews?offset=' + offset + '&limit=' + limit, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to fetch page views');
        return res.json();
    }

    function renderPageViews(pvList, append) {
        if (!append) pageviewsBody.innerHTML = '';
        if (pvList.length === 0 && !append) {
            pageviewsBody.innerHTML = '<tr class="empty-row"><td colspan="8">No page views recorded yet</td></tr>';
            return;
        }
        pvList.forEach(function(pv) {
            var row = document.createElement('tr');
            var loc = [pv.city, pv.region, pv.country].filter(Boolean).join(', ');
            var ref = pv.referrer || '-';
            if (ref.length > 40) ref = ref.substring(0, 40) + '...';
            row.innerHTML =
                '<td title="' + escapeHtml(pv.visited_at) + '">' + formatDate(pv.visited_at) + '</td>' +
                '<td>' + escapeHtml(pv.page_url || '-') + '</td>' +
                '<td></td>' +
                '<td>' + escapeHtml(pv.os || '-') + '</td>' +
                '<td>' + escapeHtml(pv.browser || '-') + '</td>' +
                '<td>' + escapeHtml(loc || '-') + '</td>' +
                '<td>' + escapeHtml(pv.ip_address || '-') + '</td>' +
                '<td title="' + escapeHtml(pv.referrer) + '">' + escapeHtml(ref) + '</td>';
            row.cells[2].innerHTML = '';
            row.cells[2].appendChild(createDeviceBadge(pv.device_type));
            pageviewsBody.appendChild(row);
        });
    }

    async function loadPageViews() {
        if (isLoading) return;
        isLoading = true;
        pageviewsBody.innerHTML = '<tr class="loading-row"><td colspan="8">Loading...</td></tr>';
        try {
            var data = await fetchPageViews(0, CONFIG.visitsPerPage);
            currentPVOffset = data.pageviews.length;
            hasMorePV = data.hasMore;
            renderPageViews(data.pageviews);
            pageviewCount.textContent = 'Showing ' + data.pageviews.length + ' of ' + data.total;
            loadMorePVBtn.disabled = !hasMorePV;
            if (!hasMorePV) loadMorePVBtn.textContent = 'No More Page Views';
        } catch (e) {
            pageviewsBody.innerHTML = '<tr class="empty-row"><td colspan="8">Failed to load page views</td></tr>';
        }
        isLoading = false;
    }

    async function loadMorePageViews() {
        if (isLoading || !hasMorePV) return;
        isLoading = true;
        loadMorePVBtn.disabled = true;
        loadMorePVBtn.textContent = 'Loading...';
        try {
            var data = await fetchPageViews(currentPVOffset, CONFIG.visitsPerPage);
            currentPVOffset += data.pageviews.length;
            hasMorePV = data.hasMore;
            renderPageViews(data.pageviews, true);
            pageviewCount.textContent = 'Showing ' + currentPVOffset + ' of ' + data.total;
            loadMorePVBtn.disabled = !hasMorePV;
            loadMorePVBtn.textContent = hasMorePV ? 'Load More' : 'No More Page Views';
        } catch (e) {
            loadMorePVBtn.textContent = 'Failed - Try Again';
            loadMorePVBtn.disabled = false;
        }
        isLoading = false;
    }

    // =========================================
    // STATS
    // =========================================
    async function loadStats() {
        statsGrid.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';

        try {
            var res = await fetch('/api/admin/stats', { headers: authHeaders() });
            var stats = await res.json();
            statsGrid.innerHTML = '';

            var items = [
                { label: 'Total Page Views', value: stats.totalPageViews || 0 },
                { label: 'Page Views Today', value: stats.pageViewsToday || 0 },
                { label: 'Unique Sessions', value: stats.uniquePageSessions || 0 },
                { label: 'Auth Visits', value: stats.totalVisits },
                { label: 'Unique IPs (Auth)', value: stats.uniqueVisitors },
                { label: 'Registered Users', value: stats.totalUsers },
                { label: 'Auth Visits Today', value: stats.visitsToday },
                { label: 'Desktop', value: (stats.deviceStats || {}).desktop || 0 },
                { label: 'Mobile', value: (stats.deviceStats || {}).mobile || 0 },
                { label: 'Tablet', value: (stats.deviceStats || {}).tablet || 0 },
                { label: 'Admin Logins', value: (stats.loginStats || {}).admin || 0 },
                { label: 'Member Logins', value: (stats.loginStats || {}).member || 0 },
                { label: 'Guest Sessions', value: (stats.loginStats || {}).guest || 0 }
            ];

            items.forEach(function(stat) {
                var card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = '<div class="stat-value">' + (stat.value || 0) + '</div>' +
                    '<div class="stat-label">' + stat.label + '</div>';
                statsGrid.appendChild(card);
            });

            // Top Pages list
            if (stats.topPages && stats.topPages.length > 0) {
                var pagesCard = document.createElement('div');
                pagesCard.className = 'stat-card stat-card-wide';
                var pagesHtml = '<div class="stat-label" style="margin-bottom:8px;">Top Pages</div>';
                stats.topPages.forEach(function(p) {
                    pagesHtml += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.85rem;">' +
                        '<span>' + escapeHtml(p.page_url) + '</span><span style="opacity:0.7;">' + escapeHtml(p.count) + '</span></div>';
                });
                pagesCard.innerHTML = pagesHtml;
                statsGrid.appendChild(pagesCard);
            }

            // Top Countries list
            if (stats.topCountries && stats.topCountries.length > 0) {
                var countriesCard = document.createElement('div');
                countriesCard.className = 'stat-card stat-card-wide';
                var countriesHtml = '<div class="stat-label" style="margin-bottom:8px;">Top Countries</div>';
                stats.topCountries.forEach(function(c) {
                    countriesHtml += '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.85rem;">' +
                        '<span>' + escapeHtml(c.country) + '</span><span style="opacity:0.7;">' + escapeHtml(c.count) + '</span></div>';
                });
                countriesCard.innerHTML = countriesHtml;
                statsGrid.appendChild(countriesCard);
            }
        } catch (e) {
            statsGrid.innerHTML = '<div class="stat-card"><div class="stat-label">Failed to load stats</div></div>';
        }
    }

    // =========================================
    // SHEET MUSIC CMS
    // =========================================
    let sheetsData = [];

    async function loadSheets() {
        sheetsList.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/sheet-music', { headers: authHeaders() });
            var data = await res.json();
            sheetsData = data.sheets || [];
            renderSheetsList();
        } catch (e) {
            sheetsList.innerHTML = '<div class="cms-empty">Failed to load sheet music</div>';
        }
    }

    function renderSheetsList() {
        sheetsList.innerHTML = '';

        if (sheetsData.length === 0) {
            sheetsList.innerHTML = '<div class="cms-empty">No sheet music yet. Click "+ New Sheet" to add one.</div>';
            return;
        }

        sheetsData.forEach(function(sheet) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';

            var statusClass = sheet.is_published ? 'published' : 'draft';
            var statusText = sheet.is_published ? 'Published' : 'Draft';
            var pdfStatus = sheet.pdf_r2_key ? '<span class="cms-tag pdf">PDF</span>' : '<span class="cms-tag no-pdf">No PDF</span>';
            var priceTag = sheet.price_cents > 0
                ? '<span class="cms-tag pdf">$' + (sheet.price_cents / 100).toFixed(2) + '</span>'
                : '<span class="cms-tag no-pdf">FREE</span>';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(sheet.title) + '</div>' +
                    '<div class="cms-item-meta">' +
                        escapeHtml(sheet.arrangement) + ' // ' + escapeHtml(sheet.year) + ' // ' + escapeHtml(sheet.pages) + ' pages' +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span> ' +
                        pdfStatus + ' ' + priceTag +
                    '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit" data-id="' + sheet.id + '">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete" data-id="' + sheet.id + '">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="edit"]').addEventListener('click', function() {
                openSheetForm(sheet);
            });
            item.querySelector('[data-action="delete"]').addEventListener('click', function() {
                deleteSheet(sheet.id, sheet.title);
            });

            sheetsList.appendChild(item);
        });
    }

    function openSheetForm(sheet) {
        if (sheet) {
            sheetFormTitle.textContent = 'Edit: ' + sheet.title;
            sheetEditId.value = sheet.id;
            document.getElementById('sheet-title').value = sheet.title;
            document.getElementById('sheet-composer').value = sheet.composer || 'Danny Infinity';
            document.getElementById('sheet-arrangement').value = sheet.arrangement;
            document.getElementById('sheet-year').value = sheet.year;
            document.getElementById('sheet-pages').value = sheet.pages;
            document.getElementById('sheet-sort-order').value = sheet.sort_order || 0;
            document.getElementById('sheet-description').value = sheet.description || '';
            document.getElementById('sheet-price').value = sheet.price_cents ? (sheet.price_cents / 100).toFixed(2) : '0';
            document.getElementById('sheet-published').checked = !!sheet.is_published;
            sheetR2Key.value = sheet.pdf_r2_key || '';
            sheetDropText.textContent = sheet.pdf_r2_key ? 'Current: ' + sheet.pdf_r2_key.split('/').pop() : 'Drag & drop PDF here or click to browse';
        } else {
            sheetFormTitle.textContent = 'New Sheet Music';
            sheetForm.reset();
            sheetEditId.value = '';
            sheetR2Key.value = '';
            document.getElementById('sheet-composer').value = 'Danny Infinity';
            document.getElementById('sheet-year').value = new Date().getFullYear();
            document.getElementById('sheet-published').checked = true;
            document.getElementById('sheet-price').value = '0';
            sheetDropText.textContent = 'Drag & drop PDF here or click to browse';
        }

        sheetFormContainer.style.display = 'block';
        sheetsList.style.display = 'none';
        document.getElementById('new-sheet-btn').style.display = 'none';
    }

    function closeSheetForm() {
        sheetFormContainer.style.display = 'none';
        sheetsList.style.display = '';
        document.getElementById('new-sheet-btn').style.display = '';
    }

    function uploadFile(file, folder, onProgress) {
        return new Promise(function(resolve, reject) {
            var formData = new FormData();
            formData.append('file', file);
            formData.append('folder', folder);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/admin/upload');
            xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());

            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable && onProgress) {
                    var pct = Math.round((e.loaded / e.total) * 100);
                    onProgress(pct);
                }
            };

            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    try {
                        var err = JSON.parse(xhr.responseText);
                        reject(new Error(err.error || 'Upload failed'));
                    } catch (_) {
                        reject(new Error('Upload failed (' + xhr.status + ')'));
                    }
                }
            };

            xhr.onerror = function() {
                reject(new Error('Upload failed — network error'));
            };

            xhr.send(formData);
        });
    }

    async function saveSheet(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('sheet-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Upload PDF if a file was selected
            var pdfFile = sheetPdfInput.files[0];
            if (pdfFile) {
                var uploadResult = await uploadFile(pdfFile, 'sheets', function(pct) {
                    saveBtn.textContent = 'Uploading... ' + pct + '%';
                });
                sheetR2Key.value = uploadResult.r2Key;
            }

            var body = {
                title: document.getElementById('sheet-title').value,
                composer: document.getElementById('sheet-composer').value,
                arrangement: document.getElementById('sheet-arrangement').value,
                year: parseInt(document.getElementById('sheet-year').value),
                pages: parseInt(document.getElementById('sheet-pages').value) || 1,
                description: document.getElementById('sheet-description').value || null,
                sortOrder: parseInt(document.getElementById('sheet-sort-order').value) || 0,
                priceCents: Math.round((parseFloat(document.getElementById('sheet-price').value) || 0) * 100),
                pdfR2Key: sheetR2Key.value || null,
                isPublished: document.getElementById('sheet-published').checked,
            };

            var editId = sheetEditId.value;
            var url = editId ? '/api/admin/sheet-music/' + editId : '/api/admin/sheet-music';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, {
                method: method,
                headers: jsonAuthHeaders(),
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                var err = await res.json();
                throw new Error(err.error || 'Save failed');
            }

            closeSheetForm();
            sheetPdfInput.value = '';
            loadSheets();
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    async function deleteSheet(id, title) {
        if (!confirm('Delete "' + title + '"? This cannot be undone.')) return;

        try {
            var res = await fetch('/api/admin/sheet-music/' + id, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (!res.ok) {
                var err = await res.json();
                throw new Error(err.error || 'Delete failed');
            }

            loadSheets();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // Drop zone handlers
    function initDropZone() {
        sheetDropZone.addEventListener('click', function() {
            sheetPdfInput.click();
        });

        sheetPdfInput.addEventListener('change', function() {
            if (sheetPdfInput.files[0]) {
                sheetDropText.textContent = sheetPdfInput.files[0].name;
                sheetDropZone.classList.add('has-file');
            }
        });

        sheetDropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            sheetDropZone.classList.add('drag-over');
        });

        sheetDropZone.addEventListener('dragleave', function() {
            sheetDropZone.classList.remove('drag-over');
        });

        sheetDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            sheetDropZone.classList.remove('drag-over');
            var file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                // Set the file on the input
                var dt = new DataTransfer();
                dt.items.add(file);
                sheetPdfInput.files = dt.files;
                sheetDropText.textContent = file.name;
                sheetDropZone.classList.add('has-file');
            } else {
                alert('Please drop a PDF file.');
            }
        });
    }

    // =========================================
    // MUSIC CMS
    // =========================================
    let albumsData = [];
    let editingAlbumId = null;

    async function loadAlbums() {
        albumsList.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/music', { headers: authHeaders() });
            var data = await res.json();
            albumsData = data.albums || [];
            renderAlbumsList();
        } catch (e) {
            albumsList.innerHTML = '<div class="cms-empty">Failed to load music</div>';
        }
    }

    function renderAlbumsList() {
        albumsList.innerHTML = '';

        if (albumsData.length === 0) {
            albumsList.innerHTML = '<div class="cms-empty">No albums yet. Click "+ New Album" to add one.</div>';
            return;
        }

        albumsData.forEach(function(album) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';

            var statusClass = album.is_published ? 'published' : 'draft';
            var statusText = album.is_published ? 'Published' : 'Draft';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(album.title) + '</div>' +
                    '<div class="cms-item-meta">' +
                        escapeHtml(album.type) + ' // ' + escapeHtml(album.year) + ' // ' + escapeHtml(album.trackCount || 0) + ' tracks' +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="tracks" data-id="' + album.id + '">Tracks</button>' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit" data-id="' + album.id + '">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete" data-id="' + album.id + '">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="tracks"]').addEventListener('click', function() {
                openTracksEditor(album.id, album.title);
            });
            item.querySelector('[data-action="edit"]').addEventListener('click', function() {
                openAlbumForm(album);
            });
            item.querySelector('[data-action="delete"]').addEventListener('click', function() {
                deleteAlbum(album.id, album.title);
            });

            albumsList.appendChild(item);
        });
    }

    function openAlbumForm(album) {
        if (album) {
            albumFormTitle.textContent = 'Edit: ' + album.title;
            albumEditId.value = album.id;
            document.getElementById('album-title').value = album.title;
            document.getElementById('album-artist').value = album.artist || 'Danny Infinity';
            document.getElementById('album-type').value = album.type || 'Album';
            document.getElementById('album-year').value = album.year;
            document.getElementById('album-gradient').value = album.gradient || 'gradient-1';
            document.getElementById('album-sort-order').value = album.sort_order || 0;
            document.getElementById('album-published').checked = !!album.is_published;
        } else {
            albumFormTitle.textContent = 'New Album';
            albumForm.reset();
            albumEditId.value = '';
            document.getElementById('album-artist').value = 'Danny Infinity';
            document.getElementById('album-year').value = new Date().getFullYear();
            document.getElementById('album-published').checked = true;
        }

        albumFormContainer.style.display = 'block';
        albumsList.style.display = 'none';
        tracksEditor.style.display = 'none';
        document.getElementById('new-album-btn').style.display = 'none';
    }

    function closeAlbumForm() {
        albumFormContainer.style.display = 'none';
        albumsList.style.display = '';
        document.getElementById('new-album-btn').style.display = '';
    }

    async function saveAlbum(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('album-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            var body = {
                title: document.getElementById('album-title').value,
                artist: document.getElementById('album-artist').value,
                type: document.getElementById('album-type').value,
                year: parseInt(document.getElementById('album-year').value),
                gradient: document.getElementById('album-gradient').value,
                sortOrder: parseInt(document.getElementById('album-sort-order').value) || 0,
                isPublished: document.getElementById('album-published').checked,
            };

            var editId = albumEditId.value;
            var url = editId ? '/api/admin/music/' + editId : '/api/admin/music';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, {
                method: method,
                headers: jsonAuthHeaders(),
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                var err = await res.json();
                throw new Error(err.error || 'Save failed');
            }

            closeAlbumForm();
            loadAlbums();
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    async function deleteAlbum(id, title) {
        if (!confirm('Delete "' + title + '" and all its tracks? This cannot be undone.')) return;

        try {
            var res = await fetch('/api/admin/music/' + id, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (!res.ok) throw new Error('Delete failed');
            loadAlbums();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    // --- Track Editor ---
    var trackFormContainer = document.getElementById('track-form-container');
    var trackForm = document.getElementById('track-form');
    var trackDropZone = document.getElementById('track-drop-zone');
    var trackDropText = document.getElementById('track-drop-text');
    var trackAudioInput = document.getElementById('track-audio-input');

    async function openTracksEditor(albumId, albumTitle) {
        editingAlbumId = albumId;
        tracksEditorTitle.textContent = 'Tracks: ' + albumTitle;
        albumsList.style.display = 'none';
        albumFormContainer.style.display = 'none';
        trackFormContainer.style.display = 'none';
        tracksEditor.style.display = 'block';
        document.getElementById('new-album-btn').style.display = 'none';
        await loadTracks(albumId);
    }

    function closeTracksEditor() {
        tracksEditor.style.display = 'none';
        trackFormContainer.style.display = 'none';
        albumsList.style.display = '';
        document.getElementById('new-album-btn').style.display = '';
        editingAlbumId = null;
        loadAlbums();
    }

    async function loadTracks(albumId) {
        tracksList.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/music/' + albumId, { headers: authHeaders() });
            var data = await res.json();
            renderTracksList(data.tracks || []);
        } catch (e) {
            tracksList.innerHTML = '<div class="cms-empty">Failed to load tracks</div>';
        }
    }

    function renderTracksList(tracks) {
        tracksList.innerHTML = '';

        if (tracks.length === 0) {
            tracksList.innerHTML = '<div class="cms-empty">No tracks yet. Click "+ Add Track".</div>';
            return;
        }

        tracks.forEach(function(track) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';

            var audioTag = track.audio_r2_key ? '<span class="cms-tag pdf">Audio</span>' : '<span class="cms-tag no-pdf">No Audio</span>';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(track.track_number) + '. ' + escapeHtml(track.title) + '</div>' +
                    '<div class="cms-item-meta">' + escapeHtml(track.duration) + ' ' + audioTag + '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit-track">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete-track" data-id="' + track.id + '">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="edit-track"]').addEventListener('click', function() {
                openTrackForm(track);
            });
            item.querySelector('[data-action="delete-track"]').addEventListener('click', function() {
                deleteTrack(track.id, track.title);
            });

            tracksList.appendChild(item);
        });
    }

    /**
     * Detect audio duration from a File object
     * Returns a promise that resolves with "m:ss" string
     */
    function detectAudioDuration(file) {
        return new Promise(function(resolve) {
            var url = URL.createObjectURL(file);
            var audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = function() {
                var secs = Math.floor(audio.duration);
                var mins = Math.floor(secs / 60);
                var remainder = secs % 60;
                resolve(mins + ':' + String(remainder).padStart(2, '0'));
                URL.revokeObjectURL(url);
            };
            audio.onerror = function() {
                resolve(null);
                URL.revokeObjectURL(url);
            };
            audio.src = url;
        });
    }

    function openTrackForm(track) {
        trackFormContainer.style.display = 'block';
        tracksEditor.style.display = 'none';

        // Reset
        trackAudioInput.value = '';
        trackDropZone.classList.remove('has-file');

        if (track) {
            document.getElementById('track-form-title').textContent = 'Edit Track';
            document.getElementById('track-edit-id').value = track.id;
            document.getElementById('track-title').value = track.title;
            document.getElementById('track-duration').value = track.duration || '';
            document.getElementById('track-audio-r2-key').value = track.audio_r2_key || '';

            if (track.audio_r2_key) {
                trackDropText.textContent = 'Current: ' + track.audio_r2_key.split('/').pop() + ' (drop new file to replace)';
                trackDropZone.classList.add('has-file');
            } else {
                trackDropText.textContent = 'Drag & drop audio file here or click to browse';
            }
        } else {
            document.getElementById('track-form-title').textContent = 'New Track';
            trackForm.reset();
            document.getElementById('track-edit-id').value = '';
            document.getElementById('track-audio-r2-key').value = '';
            document.getElementById('track-duration').value = '';
            trackDropText.textContent = 'Drag & drop audio file here or click to browse';
        }
    }

    function closeTrackForm() {
        trackFormContainer.style.display = 'none';
        tracksEditor.style.display = 'block';
    }

    async function saveTrack(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('track-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            var audioR2Key = document.getElementById('track-audio-r2-key').value || null;
            var duration = document.getElementById('track-duration').value || '0:00';

            // Upload audio file if one was selected
            var audioFile = trackAudioInput.files[0];
            if (audioFile) {
                saveBtn.textContent = 'Uploading audio...';
                var uploadResult = await uploadFile(audioFile, 'audio', function(pct) {
                    saveBtn.textContent = 'Uploading audio... ' + pct + '%';
                });
                audioR2Key = uploadResult.r2Key;

                // Auto-detect duration if not already set
                if (!duration || duration === '0:00') {
                    var detected = await detectAudioDuration(audioFile);
                    if (detected) duration = detected;
                }
            }

            var editId = document.getElementById('track-edit-id').value;
            var title = document.getElementById('track-title').value;

            saveBtn.textContent = 'Saving...';

            if (editId) {
                // Update existing track
                var res = await fetch('/api/admin/music/tracks/' + editId, {
                    method: 'PUT',
                    headers: jsonAuthHeaders(),
                    body: JSON.stringify({
                        title: title,
                        duration: duration,
                        audioR2Key: audioR2Key
                    })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
            } else {
                // Create new track
                var res = await fetch('/api/admin/music/' + editingAlbumId + '/tracks', {
                    method: 'POST',
                    headers: jsonAuthHeaders(),
                    body: JSON.stringify({
                        title: title,
                        duration: duration,
                        audioR2Key: audioR2Key
                    })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Add failed');
            }

            closeTrackForm();
            trackAudioInput.value = '';
            loadTracks(editingAlbumId);
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Track';
    }

    async function deleteTrack(id, title) {
        if (!confirm('Delete track "' + title + '"?')) return;

        try {
            var res = await fetch('/api/admin/music/tracks/' + id, {
                method: 'DELETE',
                headers: authHeaders()
            });

            if (!res.ok) throw new Error('Delete failed');
            loadTracks(editingAlbumId);
        } catch (err) {
            alert('Error: ' + err.message);
        }
    }

    function initTrackDropZone() {
        trackDropZone.addEventListener('click', function() { trackAudioInput.click(); });

        trackAudioInput.addEventListener('change', function() {
            if (trackAudioInput.files[0]) {
                var file = trackAudioInput.files[0];
                trackDropText.textContent = file.name;
                trackDropZone.classList.add('has-file');

                // Auto-detect duration
                detectAudioDuration(file).then(function(dur) {
                    if (dur) {
                        document.getElementById('track-duration').value = dur;
                    }
                });
            }
        });

        trackDropZone.addEventListener('dragover', function(e) { e.preventDefault(); trackDropZone.classList.add('drag-over'); });
        trackDropZone.addEventListener('dragleave', function() { trackDropZone.classList.remove('drag-over'); });
        trackDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            trackDropZone.classList.remove('drag-over');
            var file = e.dataTransfer.files[0];
            if (file && (file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a)$/i.test(file.name))) {
                var dt = new DataTransfer();
                dt.items.add(file);
                trackAudioInput.files = dt.files;
                trackDropText.textContent = file.name;
                trackDropZone.classList.add('has-file');

                // Auto-detect duration
                detectAudioDuration(file).then(function(dur) {
                    if (dur) {
                        document.getElementById('track-duration').value = dur;
                    }
                });
            } else {
                alert('Please drop an audio file (MP3, WAV, FLAC, or M4A).');
            }
        });
    }

    // =========================================
    // BLOG CMS
    // =========================================
    let postsData = [];

    async function loadPosts() {
        var list = document.getElementById('posts-list');
        list.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/blog', { headers: authHeaders() });
            var data = await res.json();
            postsData = data.posts || [];
            renderPostsList();
        } catch (e) {
            list.innerHTML = '<div class="cms-empty">Failed to load posts</div>';
        }
    }

    function renderPostsList() {
        var list = document.getElementById('posts-list');
        list.innerHTML = '';

        if (postsData.length === 0) {
            list.innerHTML = '<div class="cms-empty">No posts yet. Click "+ New Post".</div>';
            return;
        }

        postsData.forEach(function(post) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';
            var statusClass = post.is_published ? 'published' : 'draft';
            var statusText = post.is_published ? 'Published' : 'Draft';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(post.title) + '</div>' +
                    '<div class="cms-item-meta">[' + escapeHtml(post.tag || 'UPDATE') + '] // ' + escapeHtml(post.published_at || '-') +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span></div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="edit"]').addEventListener('click', function() { openPostForm(post); });
            item.querySelector('[data-action="delete"]').addEventListener('click', function() { deletePost(post.id, post.title); });
            list.appendChild(item);
        });
    }

    function openPostForm(post) {
        var container = document.getElementById('post-form-container');
        var list = document.getElementById('posts-list');

        if (post) {
            document.getElementById('post-form-title').textContent = 'Edit: ' + post.title;
            document.getElementById('post-edit-id').value = post.id;
            document.getElementById('post-title').value = post.title;
            document.getElementById('post-tag').value = post.tag || 'UPDATE';
            document.getElementById('post-date').value = post.published_at || '';
            document.getElementById('post-body').value = post.body || '';
            document.getElementById('post-published').checked = !!post.is_published;
        } else {
            document.getElementById('post-form-title').textContent = 'New Post';
            document.getElementById('post-form').reset();
            document.getElementById('post-edit-id').value = '';
            document.getElementById('post-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('post-published').checked = true;
        }

        container.style.display = 'block';
        list.style.display = 'none';
        document.getElementById('new-post-btn').style.display = 'none';
    }

    function closePostForm() {
        document.getElementById('post-form-container').style.display = 'none';
        document.getElementById('posts-list').style.display = '';
        document.getElementById('new-post-btn').style.display = '';
    }

    async function savePost(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('post-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            var body = {
                title: document.getElementById('post-title').value,
                tag: document.getElementById('post-tag').value,
                publishedAt: document.getElementById('post-date').value || null,
                body: document.getElementById('post-body').value,
                isPublished: document.getElementById('post-published').checked,
            };

            var editId = document.getElementById('post-edit-id').value;
            var url = editId ? '/api/admin/blog/' + editId : '/api/admin/blog';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, { method: method, headers: jsonAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) throw new Error((await res.json()).error || 'Save failed');

            closePostForm();
            loadPosts();
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    async function deletePost(id, title) {
        if (!confirm('Delete "' + title + '"?')) return;
        try {
            var res = await fetch('/api/admin/blog/' + id, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) throw new Error('Delete failed');
            loadPosts();
        } catch (err) { alert('Error: ' + err.message); }
    }

    // =========================================
    // VIDEOS CMS
    // =========================================
    let videosData = [];
    var videoDropZone = document.getElementById('video-drop-zone');
    var videoDropText = document.getElementById('video-drop-text');
    var videoFileInput = document.getElementById('video-file-input');
    var videoSrcHint = document.getElementById('video-src-hint');

    /**
     * Parse a pasted URL and extract video type + ID
     * Supports YouTube and Vimeo URLs in various formats
     */
    function parseVideoUrl(url) {
        if (!url) return null;
        url = url.trim();

        // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID
        var ytMatch = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (ytMatch) return { type: 'youtube', id: ytMatch[1] };

        // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
        var vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
        if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };

        return null;
    }

    async function loadVideos() {
        var list = document.getElementById('videos-list');
        list.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/videos', { headers: authHeaders() });
            var data = await res.json();
            videosData = data.videos || [];
            renderVideosList();
        } catch (e) {
            list.innerHTML = '<div class="cms-empty">Failed to load videos</div>';
        }
    }

    function renderVideosList() {
        var list = document.getElementById('videos-list');
        list.innerHTML = '';

        if (videosData.length === 0) {
            list.innerHTML = '<div class="cms-empty">No videos yet. Click "+ New Video".</div>';
            return;
        }

        videosData.forEach(function(video) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';
            var statusClass = video.is_published ? 'published' : 'draft';
            var statusText = video.is_published ? 'Published' : 'Draft';
            var srcTag = video.video_type ? '<span class="cms-tag pdf">' + escapeHtml(video.video_type) + '</span>' : '<span class="cms-tag no-pdf">No source</span>';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(video.title) + '</div>' +
                    '<div class="cms-item-meta">' + escapeHtml(video.category) + ' // ' + escapeHtml(video.orientation) + ' // ' + escapeHtml(video.duration) +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span> ' + srcTag + '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="edit"]').addEventListener('click', function() { openVideoForm(video); });
            item.querySelector('[data-action="delete"]').addEventListener('click', function() { deleteVideo(video.id, video.title); });
            list.appendChild(item);
        });
    }

    function openVideoForm(video) {
        var container = document.getElementById('video-form-container');
        var list = document.getElementById('videos-list');

        // Reset drop zone
        videoFileInput.value = '';
        videoDropZone.classList.remove('has-file');
        videoSrcHint.style.display = 'none';
        videoSrcHint.textContent = '';

        if (video) {
            document.getElementById('video-form-title').textContent = 'Edit: ' + video.title;
            document.getElementById('video-edit-id').value = video.id;
            document.getElementById('video-title').value = video.title;
            document.getElementById('video-category').value = video.category || 'music-video';
            document.getElementById('video-orientation').value = video.orientation || 'landscape';
            document.getElementById('video-duration').value = video.duration || '';
            document.getElementById('video-type').value = video.video_type || '';
            document.getElementById('video-src').value = video.video_src || '';
            document.getElementById('video-year').value = video.year || new Date().getFullYear();
            document.getElementById('video-sort-order').value = video.sort_order || 0;
            document.getElementById('video-published').checked = !!video.is_published;

            // Show current file info for local uploads
            if (video.video_type === 'local' && video.video_src) {
                videoDropText.textContent = 'Current: ' + video.video_src.split('/').pop();
                videoDropZone.classList.add('has-file');
            } else {
                videoDropText.textContent = 'Drag & drop video (MP4/WebM/MOV) here or click to browse';
            }
        } else {
            document.getElementById('video-form-title').textContent = 'New Video';
            document.getElementById('video-form').reset();
            document.getElementById('video-edit-id').value = '';
            document.getElementById('video-year').value = new Date().getFullYear();
            document.getElementById('video-published').checked = true;
            videoDropText.textContent = 'Drag & drop video (MP4/WebM/MOV) here or click to browse';
        }

        container.style.display = 'block';
        list.style.display = 'none';
        document.getElementById('new-video-btn').style.display = 'none';
    }

    function closeVideoForm() {
        document.getElementById('video-form-container').style.display = 'none';
        document.getElementById('videos-list').style.display = '';
        document.getElementById('new-video-btn').style.display = '';
    }

    async function saveVideo(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('video-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            var videoType = document.getElementById('video-type').value || null;
            var videoSrc = document.getElementById('video-src').value || null;

            // Upload video file if one was selected
            var videoFile = videoFileInput.files[0];
            if (videoFile) {
                saveBtn.textContent = 'Uploading video...';
                var uploadResult = await uploadFile(videoFile, 'videos', function(pct) {
                    saveBtn.textContent = 'Uploading video... ' + pct + '%';
                });
                videoType = 'local';
                videoSrc = uploadResult.url;
            }

            var body = {
                title: document.getElementById('video-title').value,
                category: document.getElementById('video-category').value,
                orientation: document.getElementById('video-orientation').value,
                duration: document.getElementById('video-duration').value || '0:00',
                videoType: videoType,
                videoSrc: videoSrc,
                year: parseInt(document.getElementById('video-year').value),
                sortOrder: parseInt(document.getElementById('video-sort-order').value) || 0,
                isPublished: document.getElementById('video-published').checked,
            };

            saveBtn.textContent = 'Saving...';
            var editId = document.getElementById('video-edit-id').value;
            var url = editId ? '/api/admin/videos/' + editId : '/api/admin/videos';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, { method: method, headers: jsonAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) throw new Error((await res.json()).error || 'Save failed');

            closeVideoForm();
            videoFileInput.value = '';
            loadVideos();
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    async function deleteVideo(id, title) {
        if (!confirm('Delete "' + title + '"?')) return;
        try {
            var res = await fetch('/api/admin/videos/' + id, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) throw new Error('Delete failed');
            loadVideos();
        } catch (err) { alert('Error: ' + err.message); }
    }

    function initVideoDropZone() {
        // Click to browse
        videoDropZone.addEventListener('click', function() { videoFileInput.click(); });

        videoFileInput.addEventListener('change', function() {
            if (videoFileInput.files[0]) {
                videoDropText.textContent = videoFileInput.files[0].name;
                videoDropZone.classList.add('has-file');
                // Auto-set type to local when file is chosen
                document.getElementById('video-type').value = 'local';
                // Clear the link field since we're uploading
                document.getElementById('video-src').value = '';
                videoSrcHint.style.display = 'block';
                videoSrcHint.textContent = 'File selected — link field cleared. Video will be uploaded on save.';
            }
        });

        // Drag and drop
        videoDropZone.addEventListener('dragover', function(e) { e.preventDefault(); videoDropZone.classList.add('drag-over'); });
        videoDropZone.addEventListener('dragleave', function() { videoDropZone.classList.remove('drag-over'); });
        videoDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            videoDropZone.classList.remove('drag-over');
            var file = e.dataTransfer.files[0];
            if (file && (file.type === 'video/mp4' || file.type === 'video/webm' || file.type === 'video/quicktime')) {
                var dt = new DataTransfer();
                dt.items.add(file);
                videoFileInput.files = dt.files;
                videoDropText.textContent = file.name;
                videoDropZone.classList.add('has-file');
                document.getElementById('video-type').value = 'local';
                document.getElementById('video-src').value = '';
                videoSrcHint.style.display = 'block';
                videoSrcHint.textContent = 'File selected — link field cleared. Video will be uploaded on save.';
            } else {
                alert('Please drop an MP4, WebM, or MOV video file.');
            }
        });

        // Auto-parse pasted URLs in the video source field
        var videoSrcInput = document.getElementById('video-src');
        videoSrcInput.addEventListener('input', function() {
            var val = videoSrcInput.value.trim();
            var parsed = parseVideoUrl(val);
            if (parsed) {
                document.getElementById('video-type').value = parsed.type;
                videoSrcInput.value = parsed.id;
                videoSrcHint.style.display = 'block';
                videoSrcHint.textContent = 'Detected ' + parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1) + ' — ID extracted: ' + parsed.id;
                // Clear any file selection since we're using a link
                videoFileInput.value = '';
                videoDropZone.classList.remove('has-file');
                videoDropText.textContent = 'Drag & drop video (MP4/WebM/MOV) here or click to browse';
            } else if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
                videoSrcHint.style.display = 'block';
                videoSrcHint.textContent = 'URL not recognized as YouTube/Vimeo. Set video type manually or upload a file instead.';
            } else {
                videoSrcHint.style.display = 'none';
            }
        });
    }

    // =========================================
    // PHOTOS CMS
    // =========================================
    let photosData = [];
    var photoDropZone = document.getElementById('photo-drop-zone');
    var photoDropText = document.getElementById('photo-drop-text');
    var photoImageInput = document.getElementById('photo-image-input');
    var photoR2Key = document.getElementById('photo-r2-key');

    async function loadPhotos() {
        var list = document.getElementById('photos-list');
        list.innerHTML = '<div class="cms-loading">Loading...</div>';

        try {
            var res = await fetch('/api/admin/photos', { headers: authHeaders() });
            var data = await res.json();
            photosData = data.photos || [];
            renderPhotosList();
        } catch (e) {
            list.innerHTML = '<div class="cms-empty">Failed to load photos</div>';
        }
    }

    function renderPhotosList() {
        var list = document.getElementById('photos-list');
        list.innerHTML = '';

        if (photosData.length === 0) {
            list.innerHTML = '<div class="cms-empty">No photos yet. Click "+ New Photo".</div>';
            return;
        }

        photosData.forEach(function(photo) {
            var item = document.createElement('div');
            item.className = 'cms-list-item';
            var statusClass = photo.is_published ? 'published' : 'draft';
            var statusText = photo.is_published ? 'Published' : 'Draft';
            var imgTag = photo.image_r2_key ? '<span class="cms-tag pdf">Image</span>' : '<span class="cms-tag no-pdf">No Image</span>';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + escapeHtml(photo.title) + '</div>' +
                    '<div class="cms-item-meta">' + escapeHtml(photo.category) + ' // ' + escapeHtml(photo.orientation) + ' // ' + escapeHtml(photo.date || '-') +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span> ' + imgTag + '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm" data-action="edit">Edit</button>' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="edit"]').addEventListener('click', function() { openPhotoForm(photo); });
            item.querySelector('[data-action="delete"]').addEventListener('click', function() { deletePhoto(photo.id, photo.title); });
            list.appendChild(item);
        });
    }

    function openPhotoForm(photo) {
        var container = document.getElementById('photo-form-container');
        var list = document.getElementById('photos-list');

        if (photo) {
            document.getElementById('photo-form-title').textContent = 'Edit: ' + photo.title;
            document.getElementById('photo-edit-id').value = photo.id;
            document.getElementById('photo-title').value = photo.title;
            document.getElementById('photo-category').value = photo.category || 'live';
            document.getElementById('photo-orientation').value = photo.orientation || 'landscape';
            document.getElementById('photo-date').value = photo.date || '';
            document.getElementById('photo-sort-order').value = photo.sort_order || 0;
            document.getElementById('photo-published').checked = !!photo.is_published;
            photoR2Key.value = photo.image_r2_key || '';
            photoDropText.textContent = photo.image_r2_key ? 'Current: ' + photo.image_r2_key.split('/').pop() : 'Drag & drop image here or click to browse';
        } else {
            document.getElementById('photo-form-title').textContent = 'New Photo';
            document.getElementById('photo-form').reset();
            document.getElementById('photo-edit-id').value = '';
            document.getElementById('photo-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('photo-published').checked = true;
            photoR2Key.value = '';
            photoDropText.textContent = 'Drag & drop image here or click to browse';
        }

        container.style.display = 'block';
        list.style.display = 'none';
        document.getElementById('new-photo-btn').style.display = 'none';
    }

    function closePhotoForm() {
        document.getElementById('photo-form-container').style.display = 'none';
        document.getElementById('photos-list').style.display = '';
        document.getElementById('new-photo-btn').style.display = '';
    }

    async function savePhoto(e) {
        e.preventDefault();
        var saveBtn = document.getElementById('photo-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // Upload image if selected
            var imageFile = photoImageInput.files[0];
            if (imageFile) {
                var uploadResult = await uploadFile(imageFile, 'images', function(pct) {
                    saveBtn.textContent = 'Uploading... ' + pct + '%';
                });
                photoR2Key.value = uploadResult.r2Key;
            }

            var body = {
                title: document.getElementById('photo-title').value,
                category: document.getElementById('photo-category').value,
                orientation: document.getElementById('photo-orientation').value,
                date: document.getElementById('photo-date').value || null,
                sortOrder: parseInt(document.getElementById('photo-sort-order').value) || 0,
                imageR2Key: photoR2Key.value || null,
                isPublished: document.getElementById('photo-published').checked,
            };

            var editId = document.getElementById('photo-edit-id').value;
            var url = editId ? '/api/admin/photos/' + editId : '/api/admin/photos';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, { method: method, headers: jsonAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) throw new Error((await res.json()).error || 'Save failed');

            closePhotoForm();
            photoImageInput.value = '';
            loadPhotos();
        } catch (err) {
            alert('Error: ' + err.message);
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }

    async function deletePhoto(id, title) {
        if (!confirm('Delete "' + title + '"?')) return;
        try {
            var res = await fetch('/api/admin/photos/' + id, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) throw new Error('Delete failed');
            loadPhotos();
        } catch (err) { alert('Error: ' + err.message); }
    }

    function initPhotoDropZone() {
        photoDropZone.addEventListener('click', function() { photoImageInput.click(); });

        photoImageInput.addEventListener('change', function() {
            if (photoImageInput.files[0]) {
                photoDropText.textContent = photoImageInput.files[0].name;
                photoDropZone.classList.add('has-file');
            }
        });

        photoDropZone.addEventListener('dragover', function(e) { e.preventDefault(); photoDropZone.classList.add('drag-over'); });
        photoDropZone.addEventListener('dragleave', function() { photoDropZone.classList.remove('drag-over'); });
        photoDropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            photoDropZone.classList.remove('drag-over');
            var file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                var dt = new DataTransfer();
                dt.items.add(file);
                photoImageInput.files = dt.files;
                photoDropText.textContent = file.name;
                photoDropZone.classList.add('has-file');
            } else {
                alert('Please drop an image file.');
            }
        });
    }

    // =========================================
    // DONATIONS
    // =========================================

    function formatTipType(tipType) {
        switch (tipType) {
            case 'preset_5': return '<span class="type-badge preset">$5</span>';
            case 'preset_10': return '<span class="type-badge preset">$10</span>';
            case 'preset_25': return '<span class="type-badge preset">$25</span>';
            case 'custom': return '<span class="type-badge custom">Custom</span>';
            default: return '<span class="type-badge preset">-</span>';
        }
    }

    function formatSource(source, sheetMusicId) {
        // Infer from sheet_music_id for older records without source field
        var s = source;
        if (!s || s === 'unknown') s = sheetMusicId ? 'sheet' : 'general';
        if (s === 'sheet') return '<span class="source-badge sheet">Sheet</span>';
        return '<span class="source-badge general">General</span>';
    }

    function buildDonationFilterQuery() {
        var params = [];
        var source = filterSource.value;
        var tipType = filterTipType.value;
        var sheetId = filterSheet.value;
        var search = donationSearch.value.trim();
        if (source) params.push('source=' + encodeURIComponent(source));
        if (tipType) params.push('tip_type=' + encodeURIComponent(tipType));
        if (sheetId) params.push('sheet_music_id=' + encodeURIComponent(sheetId));
        if (search) params.push('search=' + encodeURIComponent(search));
        return params.join('&');
    }

    async function loadDonations() {
        donationsStats.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';
        donationsBody.innerHTML = '<tr class="loading-row"><td colspan="7">Loading...</td></tr>';
        donationsOffset = 0;
        hasMoreDonations = true;

        try {
            var filterQuery = buildDonationFilterQuery();

            var [statsRes, listRes] = await Promise.all([
                fetch('/api/admin/donations/stats', { headers: authHeaders() }),
                fetch('/api/admin/donations?limit=50&offset=0' + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() })
            ]);

            var stats = await statsRes.json();
            var list = await listRes.json();

            // Stats cards
            donationsStats.innerHTML = '';
            var statItems = [
                { label: 'Total Tips', value: stats.totalDonations },
                { label: 'Total Revenue', value: '$' + ((stats.totalAmount || 0) / 100).toFixed(2) },
                { label: 'Unique Donors', value: stats.uniqueDonors },
                { label: 'General Tips', value: (stats.generalTips ? stats.generalTips.count : 0) + ' ($' + ((stats.generalTips ? stats.generalTips.amount : 0) / 100).toFixed(2) + ')' },
                { label: 'Sheet Tips', value: (stats.sheetTips ? stats.sheetTips.count : 0) + ' ($' + ((stats.sheetTips ? stats.sheetTips.amount : 0) / 100).toFixed(2) + ')' }
            ];

            statItems.forEach(function(s) {
                var card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = '<div class="stat-value">' + s.value + '</div>' +
                    '<div class="stat-label">' + s.label + '</div>';
                donationsStats.appendChild(card);
            });

            // Top sheets breakdown
            if (stats.bySheet && stats.bySheet.length > 0) {
                donationsBreakdown.style.display = 'block';
                topSheetsList.innerHTML = '';

                // Populate the sheet filter dropdown
                filterSheet.innerHTML = '<option value="">All Sheets</option>';
                stats.bySheet.forEach(function(s) {
                    var opt = document.createElement('option');
                    opt.value = s.sheet_music_id;
                    opt.textContent = s.title;
                    filterSheet.appendChild(opt);
                });

                stats.bySheet.forEach(function(s) {
                    var item = document.createElement('div');
                    item.className = 'breakdown-item';
                    item.innerHTML =
                        '<span class="breakdown-item-title">' + escapeHtml(s.title) + '</span>' +
                        '<span class="breakdown-item-stats">' +
                            '<span>' + s.count + ' tip' + (s.count !== 1 ? 's' : '') + '</span>' +
                            '<span class="breakdown-item-amount">$' + ((s.total_amount || 0) / 100).toFixed(2) + '</span>' +
                        '</span>';
                    item.addEventListener('click', function() {
                        filterSheet.value = s.sheet_music_id;
                        fetchDonations();
                    });
                    topSheetsList.appendChild(item);
                });
            } else {
                donationsBreakdown.style.display = 'none';
            }

            // Render table
            renderDonationRows(list.donations, true);
            donationCount.textContent = list.total + ' total';
            donationsOffset = list.donations.length;
            hasMoreDonations = list.donations.length >= 50 && donationsOffset < list.total;
            donationsLoadMore.style.display = hasMoreDonations ? 'flex' : 'none';

        } catch (e) {
            donationsStats.innerHTML = '<div class="stat-card"><div class="stat-label">Failed to load</div></div>';
            donationsBody.innerHTML = '<tr class="empty-row"><td colspan="7">Failed to load donations</td></tr>';
        }
    }

    function renderDonationRows(donations, clear) {
        if (clear) donationsBody.innerHTML = '';

        if (donations.length === 0 && clear) {
            donationsBody.innerHTML = '<tr class="empty-row"><td colspan="7">No donations found</td></tr>';
            return;
        }

        donations.forEach(function(d) {
            var row = document.createElement('tr');
            row.innerHTML =
                '<td>' + formatDate(d.created_at) + '</td>' +
                '<td>' + escapeHtml(d.donor_name || '-') + '</td>' +
                '<td>' + escapeHtml(d.donor_email || '-') + '</td>' +
                '<td>' + formatSource(d.source, d.sheet_music_id) + '</td>' +
                '<td>' + escapeHtml(d.sheet_title || '-') + '</td>' +
                '<td>' + formatTipType(d.tip_type) + '</td>' +
                '<td>$' + ((d.amount || 0) / 100).toFixed(2) + '</td>';
            donationsBody.appendChild(row);
        });
    }

    async function fetchDonations() {
        donationsOffset = 0;
        hasMoreDonations = true;
        donationsBody.innerHTML = '<tr class="loading-row"><td colspan="7">Loading...</td></tr>';

        try {
            var filterQuery = buildDonationFilterQuery();
            var res = await fetch('/api/admin/donations?limit=50&offset=0' + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() });
            var list = await res.json();

            renderDonationRows(list.donations, true);
            donationCount.textContent = list.total + ' total';
            donationsOffset = list.donations.length;
            hasMoreDonations = list.donations.length >= 50 && donationsOffset < list.total;
            donationsLoadMore.style.display = hasMoreDonations ? 'flex' : 'none';
        } catch (e) {
            donationsBody.innerHTML = '<tr class="empty-row"><td colspan="7">Failed to load donations</td></tr>';
        }
    }

    async function loadMoreDonations() {
        if (!hasMoreDonations) return;
        donationsLoadMoreBtn.disabled = true;
        donationsLoadMoreBtn.textContent = 'Loading...';

        try {
            var filterQuery = buildDonationFilterQuery();
            var res = await fetch('/api/admin/donations?limit=50&offset=' + donationsOffset + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() });
            var list = await res.json();

            renderDonationRows(list.donations, false);
            donationsOffset += list.donations.length;
            hasMoreDonations = list.donations.length >= 50 && donationsOffset < list.total;
            donationsLoadMore.style.display = hasMoreDonations ? 'flex' : 'none';
        } catch (e) {
            // silently fail
        }
        donationsLoadMoreBtn.disabled = false;
        donationsLoadMoreBtn.textContent = 'Load More';
    }

    // Filter event listeners
    if (filterSource) filterSource.addEventListener('change', fetchDonations);
    if (filterTipType) filterTipType.addEventListener('change', fetchDonations);
    if (filterSheet) filterSheet.addEventListener('change', fetchDonations);
    if (donationSearch) {
        donationSearch.addEventListener('input', function() {
            clearTimeout(donationSearchTimer);
            donationSearchTimer = setTimeout(fetchDonations, 400);
        });
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            donationSearch.value = '';
            filterSource.value = '';
            filterTipType.value = '';
            filterSheet.value = '';
            fetchDonations();
        });
    }
    if (donationsLoadMoreBtn) {
        donationsLoadMoreBtn.addEventListener('click', loadMoreDonations);
    }

    // =========================================
    // SALES
    // =========================================
    var salesStats = document.getElementById('sales-stats');
    var salesBody = document.getElementById('sales-body');
    var saleCount = document.getElementById('sale-count');
    var salesBreakdown = document.getElementById('sales-breakdown');
    var topSellersList = document.getElementById('top-sellers-list');
    var saleSearch = document.getElementById('sale-search');
    var filterSaleSheet = document.getElementById('filter-sale-sheet');
    var clearSaleFiltersBtn = document.getElementById('clear-sale-filters');
    var salesLoadMore = document.getElementById('sales-load-more');
    var salesLoadMoreBtn = document.getElementById('sales-load-more-btn');

    var salesOffset = 0;
    var hasMoreSales = true;
    var saleSearchTimer = null;

    function buildSaleFilterQuery() {
        var params = [];
        var sheetId = filterSaleSheet ? filterSaleSheet.value : '';
        var search = saleSearch ? saleSearch.value.trim() : '';
        if (sheetId) params.push('sheet_music_id=' + encodeURIComponent(sheetId));
        if (search) params.push('search=' + encodeURIComponent(search));
        return params.join('&');
    }

    async function loadSales() {
        if (salesStats) salesStats.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';
        if (salesBody) salesBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading...</td></tr>';
        salesOffset = 0;
        hasMoreSales = true;

        try {
            var filterQuery = buildSaleFilterQuery();

            var [statsRes, listRes] = await Promise.all([
                fetch('/api/admin/purchases/stats', { headers: authHeaders() }),
                fetch('/api/admin/purchases?limit=50&offset=0' + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() })
            ]);

            var stats = await statsRes.json();
            var list = await listRes.json();

            // Stats cards
            if (salesStats) {
                salesStats.innerHTML = '';
                var statItems = [
                    { label: 'Total Purchases', value: stats.totalPurchases },
                    { label: 'Total Revenue', value: '$' + ((stats.totalRevenue || 0) / 100).toFixed(2) },
                    { label: 'Unique Buyers', value: stats.uniqueBuyers }
                ];

                statItems.forEach(function(s) {
                    var card = document.createElement('div');
                    card.className = 'stat-card';
                    card.innerHTML = '<div class="stat-value">' + s.value + '</div>' +
                        '<div class="stat-label">' + s.label + '</div>';
                    salesStats.appendChild(card);
                });
            }

            // Top sellers breakdown
            if (salesBreakdown && stats.bySheet && stats.bySheet.length > 0) {
                salesBreakdown.style.display = 'block';
                topSellersList.innerHTML = '';

                if (filterSaleSheet) {
                    filterSaleSheet.innerHTML = '<option value="">All Sheets</option>';
                    stats.bySheet.forEach(function(s) {
                        var opt = document.createElement('option');
                        opt.value = s.sheet_music_id;
                        opt.textContent = s.title;
                        filterSaleSheet.appendChild(opt);
                    });
                }

                stats.bySheet.forEach(function(s) {
                    var item = document.createElement('div');
                    item.className = 'breakdown-item';
                    item.innerHTML =
                        '<span class="breakdown-item-title">' + escapeHtml(s.title) + '</span>' +
                        '<span class="breakdown-item-stats">' +
                            '<span>' + s.units_sold + ' sold</span>' +
                            '<span class="breakdown-item-amount">$' + ((s.total_revenue || 0) / 100).toFixed(2) + '</span>' +
                        '</span>';
                    item.addEventListener('click', function() {
                        if (filterSaleSheet) filterSaleSheet.value = s.sheet_music_id;
                        fetchSales();
                    });
                    topSellersList.appendChild(item);
                });
            } else if (salesBreakdown) {
                salesBreakdown.style.display = 'none';
            }

            renderSaleRows(list.purchases, true);
            if (saleCount) saleCount.textContent = list.total + ' total';
            salesOffset = list.purchases.length;
            hasMoreSales = list.purchases.length >= 50 && salesOffset < list.total;
            if (salesLoadMore) salesLoadMore.style.display = hasMoreSales ? 'flex' : 'none';

        } catch (e) {
            if (salesStats) salesStats.innerHTML = '<div class="stat-card"><div class="stat-label">Failed to load</div></div>';
            if (salesBody) salesBody.innerHTML = '<tr class="empty-row"><td colspan="6">Failed to load sales</td></tr>';
        }
    }

    function renderSaleRows(purchases, clear) {
        if (!salesBody) return;
        if (clear) salesBody.innerHTML = '';

        if (purchases.length === 0 && clear) {
            salesBody.innerHTML = '<tr class="empty-row"><td colspan="6">No purchases found</td></tr>';
            return;
        }

        purchases.forEach(function(p) {
            var row = document.createElement('tr');
            var itemNames = (p.items || []).map(function(i) { return escapeHtml(i.title); }).join(', ');
            var tokenExpired = new Date(p.token_expires_at) < new Date();
            var statusBadge = tokenExpired
                ? '<span class="source-badge general">Expired</span>'
                : '<span class="source-badge sheet">Active</span>';

            row.innerHTML =
                '<td>' + formatDate(p.created_at) + '</td>' +
                '<td>' + escapeHtml(p.buyer_name || '-') + '</td>' +
                '<td>' + escapeHtml(p.buyer_email || '-') + '</td>' +
                '<td>' + (itemNames || '-') + '</td>' +
                '<td>$' + ((p.amount_total || 0) / 100).toFixed(2) + '</td>' +
                '<td>' + statusBadge + '</td>';
            salesBody.appendChild(row);
        });
    }

    async function fetchSales() {
        salesOffset = 0;
        hasMoreSales = true;
        if (salesBody) salesBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading...</td></tr>';

        try {
            var filterQuery = buildSaleFilterQuery();
            var res = await fetch('/api/admin/purchases?limit=50&offset=0' + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() });
            var list = await res.json();

            renderSaleRows(list.purchases, true);
            if (saleCount) saleCount.textContent = list.total + ' total';
            salesOffset = list.purchases.length;
            hasMoreSales = list.purchases.length >= 50 && salesOffset < list.total;
            if (salesLoadMore) salesLoadMore.style.display = hasMoreSales ? 'flex' : 'none';
        } catch (e) {
            if (salesBody) salesBody.innerHTML = '<tr class="empty-row"><td colspan="6">Failed to load sales</td></tr>';
        }
    }

    async function loadMoreSales() {
        if (!hasMoreSales) return;
        if (salesLoadMoreBtn) { salesLoadMoreBtn.disabled = true; salesLoadMoreBtn.textContent = 'Loading...'; }

        try {
            var filterQuery = buildSaleFilterQuery();
            var res = await fetch('/api/admin/purchases?limit=50&offset=' + salesOffset + (filterQuery ? '&' + filterQuery : ''), { headers: authHeaders() });
            var list = await res.json();

            renderSaleRows(list.purchases, false);
            salesOffset += list.purchases.length;
            hasMoreSales = list.purchases.length >= 50 && salesOffset < list.total;
            if (salesLoadMore) salesLoadMore.style.display = hasMoreSales ? 'flex' : 'none';
        } catch (e) { /* silently fail */ }
        if (salesLoadMoreBtn) { salesLoadMoreBtn.disabled = false; salesLoadMoreBtn.textContent = 'Load More'; }
    }

    if (filterSaleSheet) filterSaleSheet.addEventListener('change', fetchSales);
    if (saleSearch) {
        saleSearch.addEventListener('input', function() {
            clearTimeout(saleSearchTimer);
            saleSearchTimer = setTimeout(fetchSales, 400);
        });
    }
    if (clearSaleFiltersBtn) {
        clearSaleFiltersBtn.addEventListener('click', function() {
            if (saleSearch) saleSearch.value = '';
            if (filterSaleSheet) filterSaleSheet.value = '';
            fetchSales();
        });
    }
    if (salesLoadMoreBtn) salesLoadMoreBtn.addEventListener('click', loadMoreSales);

    // =========================================
    // TAB SWITCHING
    // =========================================
    var tabLoaded = {};

    function switchTab(tabName) {
        navBtns.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        tabContents.forEach(function(content) {
            content.classList.toggle('active', content.id === tabName + '-tab');
        });

        // Lazy-load tab data
        if (!tabLoaded[tabName]) {
            tabLoaded[tabName] = true;
            if (tabName === 'pageviews') loadPageViews();
            else if (tabName === 'users') loadUsers();
            else if (tabName === 'stats') loadStats();
            else if (tabName === 'sheet-music') loadSheets();
            else if (tabName === 'music') loadAlbums();
            else if (tabName === 'blog') loadPosts();
            else if (tabName === 'videos') loadVideos();
            else if (tabName === 'photos') loadPhotos();
            else if (tabName === 'donations') loadDonations();
            else if (tabName === 'sales') loadSales();
        }
    }

    // =========================================
    // LOGOUT
    // =========================================
    function logout() {
        sessionStorage.clear();
        window.location.href = 'index.html';
    }

    // =========================================
    // INIT
    // =========================================
    function init() {
        if (!checkAdminAccess()) {
            accessDenied.classList.remove('hidden');
            return;
        }

        accessDenied.classList.add('hidden');

        // Load initial data (visits tab is default)
        tabLoaded['visits'] = true;
        loadVisits();

        // Event listeners
        loadMoreBtn.addEventListener('click', loadMoreVisits);
        loadMorePVBtn.addEventListener('click', loadMorePageViews);
        logoutBtn.addEventListener('click', logout);

        navBtns.forEach(function(btn) {
            btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
        });

        // Sheet music form
        document.getElementById('new-sheet-btn').addEventListener('click', function() { openSheetForm(null); });
        document.getElementById('sheet-cancel-btn').addEventListener('click', closeSheetForm);
        sheetForm.addEventListener('submit', saveSheet);
        initDropZone();

        // Music form
        document.getElementById('new-album-btn').addEventListener('click', function() { openAlbumForm(null); });
        document.getElementById('album-cancel-btn').addEventListener('click', closeAlbumForm);
        albumForm.addEventListener('submit', saveAlbum);
        document.getElementById('add-track-btn').addEventListener('click', function() { openTrackForm(null); });
        document.getElementById('tracks-done-btn').addEventListener('click', closeTracksEditor);
        document.getElementById('track-cancel-btn').addEventListener('click', closeTrackForm);
        trackForm.addEventListener('submit', saveTrack);
        initTrackDropZone();

        // Blog form
        document.getElementById('new-post-btn').addEventListener('click', function() { openPostForm(null); });
        document.getElementById('post-cancel-btn').addEventListener('click', closePostForm);
        document.getElementById('post-form').addEventListener('submit', savePost);

        // Videos form
        document.getElementById('new-video-btn').addEventListener('click', function() { openVideoForm(null); });
        document.getElementById('video-cancel-btn').addEventListener('click', closeVideoForm);
        document.getElementById('video-form').addEventListener('submit', saveVideo);
        initVideoDropZone();

        // Photos form
        document.getElementById('new-photo-btn').addEventListener('click', function() { openPhotoForm(null); });
        document.getElementById('photo-cancel-btn').addEventListener('click', closePhotoForm);
        document.getElementById('photo-form').addEventListener('submit', savePhoto);
        initPhotoDropZone();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
