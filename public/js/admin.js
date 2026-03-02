/**
 * Admin Dashboard JavaScript
 * Handles admin authentication, data fetching, display, and CMS CRUD
 */
(function() {
    'use strict';

    const CONFIG = {
        visitsPerPage: 50
    };

    // State
    let currentVisitsOffset = 0;
    let hasMoreVisits = true;
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

    // Donations DOM
    const donationsStats = document.getElementById('donations-stats');
    const donationsBody = document.getElementById('donations-body');

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
            visitsBody.innerHTML = '<tr class="empty-row"><td colspan="10">No visits recorded yet</td></tr>';
            return;
        }

        visits.forEach(function(visit) {
            var row = document.createElement('tr');
            row.innerHTML =
                '<td title="' + (visit.visited_at || '') + '">' + formatDate(visit.visited_at) + '</td>' +
                '<td title="' + (visit.client_timestamp || '') + (visit.timezone ? ' (' + visit.timezone + ')' : '') + '">' + formatClientTime(visit.client_timestamp) + '</td>' +
                '<td>' + (visit.name || '-') + '</td>' +
                '<td></td>' +
                '<td></td>' +
                '<td>' + (visit.os || '-') + (visit.os_version ? ' ' + visit.os_version : '') + '</td>' +
                '<td>' + (visit.browser || '-') + (visit.browser_version ? ' ' + visit.browser_version : '') + '</td>' +
                '<td class="engine-cell">' + (visit.browser_engine || '-') + '</td>' +
                '<td>' + [visit.city, visit.region, visit.country].filter(Boolean).join(', ') + '</td>' +
                '<td>' + (visit.ip_address || '-') + '</td>';

            // Add badges
            row.cells[3].innerHTML = '';
            row.cells[3].appendChild(createLoginBadge(visit.login_type));
            row.cells[4].innerHTML = '';
            row.cells[4].appendChild(createDeviceBadge(visit.device_type));
            visitsBody.appendChild(row);
        });
    }

    async function loadVisits() {
        if (isLoading) return;
        isLoading = true;
        visitsBody.innerHTML = '<tr class="loading-row"><td colspan="10">Loading...</td></tr>';

        try {
            var data = await fetchVisits(0, CONFIG.visitsPerPage);
            currentVisitsOffset = data.visits.length;
            hasMoreVisits = data.hasMore;
            renderVisits(data.visits);
            visitCount.textContent = 'Showing ' + data.visits.length + ' of ' + data.total;
            loadMoreBtn.disabled = !hasMoreVisits;
            if (!hasMoreVisits) loadMoreBtn.textContent = 'No More Visits';
        } catch (e) {
            visitsBody.innerHTML = '<tr class="empty-row"><td colspan="10">Failed to load visits</td></tr>';
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
                    '<td>' + user.id + '</td>' +
                    '<td>' + user.name + '</td>' +
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
    // STATS
    // =========================================
    async function loadStats() {
        statsGrid.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';

        try {
            var res = await fetch('/api/admin/stats', { headers: authHeaders() });
            var stats = await res.json();
            statsGrid.innerHTML = '';

            var items = [
                { label: 'Total Visits', value: stats.totalVisits },
                { label: 'Unique Visitors', value: stats.uniqueVisitors },
                { label: 'Registered Users', value: stats.totalUsers },
                { label: 'Visits Today', value: stats.visitsToday },
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

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + sheet.title + '</div>' +
                    '<div class="cms-item-meta">' +
                        sheet.arrangement + ' // ' + sheet.year + ' // ' + sheet.pages + ' pages' +
                        ' // <span class="cms-status ' + statusClass + '">' + statusText + '</span> ' +
                        pdfStatus +
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
            document.getElementById('sheet-tip-link').value = sheet.tip_link || '';
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

    async function uploadFile(file, folder) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        var res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: authHeaders(),
            body: formData
        });

        if (!res.ok) {
            var err = await res.json();
            throw new Error(err.error || 'Upload failed');
        }

        return res.json();
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
                var uploadResult = await uploadFile(pdfFile, 'sheets');
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
                tipLink: document.getElementById('sheet-tip-link').value || null,
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
                    '<div class="cms-item-title">' + album.title + '</div>' +
                    '<div class="cms-item-meta">' +
                        album.type + ' // ' + album.year + ' // ' + (album.trackCount || 0) + ' tracks' +
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
    async function openTracksEditor(albumId, albumTitle) {
        editingAlbumId = albumId;
        tracksEditorTitle.textContent = 'Tracks: ' + albumTitle;
        albumsList.style.display = 'none';
        albumFormContainer.style.display = 'none';
        tracksEditor.style.display = 'block';
        document.getElementById('new-album-btn').style.display = 'none';
        await loadTracks(albumId);
    }

    function closeTracksEditor() {
        tracksEditor.style.display = 'none';
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
                    '<div class="cms-item-title">' + track.track_number + '. ' + track.title + '</div>' +
                    '<div class="cms-item-meta">' + track.duration + ' ' + audioTag + '</div>' +
                '</div>' +
                '<div class="cms-item-actions">' +
                    '<button class="cms-btn cms-btn-sm cms-btn-danger" data-action="delete-track" data-id="' + track.id + '">Delete</button>' +
                '</div>';

            item.querySelector('[data-action="delete-track"]').addEventListener('click', function() {
                deleteTrack(track.id, track.title);
            });

            tracksList.appendChild(item);
        });
    }

    async function addTrack() {
        var title = prompt('Track title:');
        if (!title) return;
        var duration = prompt('Duration (e.g. 3:45):', '0:00');

        try {
            var res = await fetch('/api/admin/music/' + editingAlbumId + '/tracks', {
                method: 'POST',
                headers: jsonAuthHeaders(),
                body: JSON.stringify({ title: title, duration: duration || '0:00' })
            });

            if (!res.ok) throw new Error('Add failed');
            loadTracks(editingAlbumId);
        } catch (err) {
            alert('Error: ' + err.message);
        }
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
                    '<div class="cms-item-title">' + post.title + '</div>' +
                    '<div class="cms-item-meta">[' + (post.tag || 'UPDATE') + '] // ' + (post.published_at || '-') +
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
            var srcTag = video.video_type ? '<span class="cms-tag pdf">' + video.video_type + '</span>' : '<span class="cms-tag no-pdf">No source</span>';

            item.innerHTML =
                '<div class="cms-item-info">' +
                    '<div class="cms-item-title">' + video.title + '</div>' +
                    '<div class="cms-item-meta">' + video.category + ' // ' + video.orientation + ' // ' + video.duration +
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
        } else {
            document.getElementById('video-form-title').textContent = 'New Video';
            document.getElementById('video-form').reset();
            document.getElementById('video-edit-id').value = '';
            document.getElementById('video-year').value = new Date().getFullYear();
            document.getElementById('video-published').checked = true;
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
            var body = {
                title: document.getElementById('video-title').value,
                category: document.getElementById('video-category').value,
                orientation: document.getElementById('video-orientation').value,
                duration: document.getElementById('video-duration').value || '0:00',
                videoType: document.getElementById('video-type').value || null,
                videoSrc: document.getElementById('video-src').value || null,
                year: parseInt(document.getElementById('video-year').value),
                sortOrder: parseInt(document.getElementById('video-sort-order').value) || 0,
                isPublished: document.getElementById('video-published').checked,
            };

            var editId = document.getElementById('video-edit-id').value;
            var url = editId ? '/api/admin/videos/' + editId : '/api/admin/videos';
            var method = editId ? 'PUT' : 'POST';

            var res = await fetch(url, { method: method, headers: jsonAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) throw new Error((await res.json()).error || 'Save failed');

            closeVideoForm();
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
                    '<div class="cms-item-title">' + photo.title + '</div>' +
                    '<div class="cms-item-meta">' + photo.category + ' // ' + photo.orientation + ' // ' + (photo.date || '-') +
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
                var uploadResult = await uploadFile(imageFile, 'images');
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
    async function loadDonations() {
        donationsStats.innerHTML = '<div class="stat-card"><div class="stat-label">Loading...</div></div>';
        donationsBody.innerHTML = '<tr class="loading-row"><td colspan="6">Loading...</td></tr>';

        try {
            // Fetch stats and records in parallel
            var [statsRes, listRes] = await Promise.all([
                fetch('/api/admin/donations/stats', { headers: authHeaders() }),
                fetch('/api/admin/donations', { headers: authHeaders() })
            ]);

            var stats = await statsRes.json();
            var list = await listRes.json();

            // Render stats
            donationsStats.innerHTML = '';
            var statItems = [
                { label: 'Total Donations', value: stats.totalDonations },
                { label: 'Total Amount', value: '$' + ((stats.totalAmount || 0) / 100).toFixed(2) },
                { label: 'Unique Donors', value: stats.uniqueDonors }
            ];

            statItems.forEach(function(s) {
                var card = document.createElement('div');
                card.className = 'stat-card';
                card.innerHTML = '<div class="stat-value">' + s.value + '</div>' +
                    '<div class="stat-label">' + s.label + '</div>';
                donationsStats.appendChild(card);
            });

            // Render table
            donationsBody.innerHTML = '';
            if (list.donations.length === 0) {
                donationsBody.innerHTML = '<tr class="empty-row"><td colspan="6">No donations recorded yet</td></tr>';
                return;
            }

            list.donations.forEach(function(d) {
                var row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + formatDate(d.created_at) + '</td>' +
                    '<td>' + (d.donor_name || '-') + '</td>' +
                    '<td>' + (d.donor_email || '-') + '</td>' +
                    '<td>' + (d.sheet_title || '-') + '</td>' +
                    '<td>$' + ((d.amount || 0) / 100).toFixed(2) + '</td>' +
                    '<td>' + (d.currency || 'usd').toUpperCase() + '</td>';
                donationsBody.appendChild(row);
            });
        } catch (e) {
            donationsStats.innerHTML = '<div class="stat-card"><div class="stat-label">Failed to load</div></div>';
            donationsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Failed to load donations</td></tr>';
        }
    }

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
            if (tabName === 'users') loadUsers();
            else if (tabName === 'stats') loadStats();
            else if (tabName === 'sheet-music') loadSheets();
            else if (tabName === 'music') loadAlbums();
            else if (tabName === 'blog') loadPosts();
            else if (tabName === 'videos') loadVideos();
            else if (tabName === 'photos') loadPhotos();
            else if (tabName === 'donations') loadDonations();
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
        document.getElementById('add-track-btn').addEventListener('click', addTrack);
        document.getElementById('tracks-done-btn').addEventListener('click', closeTracksEditor);

        // Blog form
        document.getElementById('new-post-btn').addEventListener('click', function() { openPostForm(null); });
        document.getElementById('post-cancel-btn').addEventListener('click', closePostForm);
        document.getElementById('post-form').addEventListener('submit', savePost);

        // Videos form
        document.getElementById('new-video-btn').addEventListener('click', function() { openVideoForm(null); });
        document.getElementById('video-cancel-btn').addEventListener('click', closeVideoForm);
        document.getElementById('video-form').addEventListener('submit', saveVideo);

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
