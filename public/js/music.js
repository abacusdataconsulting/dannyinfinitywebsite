(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================
    // MUSIC DATA (loaded from API)
    // ============================
    var ALBUMS = [];

    // ============================
    // DOM ELEMENTS
    // ============================
    var browseView = document.getElementById('browse-view');
    var playerView = document.getElementById('player-view');
    var albumGrid = document.getElementById('album-grid');
    var backBtn = document.getElementById('back-btn');
    var audioPlayer = document.getElementById('audio-player');

    // Now Playing
    var nowPlayingArt = document.getElementById('now-playing-art');
    var nowPlayingTitle = document.getElementById('now-playing-title');
    var nowPlayingArtist = document.getElementById('now-playing-artist');

    // Progress
    var progressContainer = document.getElementById('progress-container');
    var progressFill = document.getElementById('progress-fill');
    var progressHandle = document.getElementById('progress-handle');
    var timeCurrent = document.getElementById('time-current');
    var timeTotal = document.getElementById('time-total');
    var progressBar = progressContainer.querySelector('.progress-bar');

    // Transport
    var playPauseBtn = document.getElementById('play-pause-btn');
    var prevBtn = document.getElementById('prev-btn');
    var nextBtn = document.getElementById('next-btn');
    var iconPlay = playPauseBtn.querySelector('.icon-play');
    var iconPause = playPauseBtn.querySelector('.icon-pause');

    // Tracklist
    var tracklistAlbumTitle = document.getElementById('tracklist-album-title');
    var tracklist = document.getElementById('tracklist');
    var recommendationsGrid = document.getElementById('recommendations-grid');

    // ============================
    // STATE
    // ============================
    var currentAlbum = null;
    var currentTrackIndex = 0;
    var isPlaying = false;
    var isSeeking = false;

    document.getElementById('current-year').textContent = new Date().getFullYear();

    // ============================
    // BROWSE VIEW
    // ============================
    function renderBrowseView() {
        albumGrid.innerHTML = '';
        ALBUMS.forEach(function(album) {
            var card = document.createElement('div');
            card.className = 'album-card';
            card.dataset.albumId = album.id;
            var viewBadge = album.showViews && album.viewCount > 0
                ? '<span class="view-count-badge">' + album.viewCount + ' views</span>'
                : '';
            var artHtml = album.coverUrl
                ? '<img class="album-art-img" src="' + escapeHtml(album.coverUrl) + '" alt="' + escapeHtml(album.title) + ' cover art" loading="lazy">'
                : '<div class="album-art-gradient ' + escapeHtml(album.gradient) + '">' +
                      '<span class="album-art-label">' + escapeHtml(album.type.toUpperCase()) + '</span>' +
                  '</div>';
            card.innerHTML =
                '<div class="album-art">' + artHtml + '</div>' +
                '<div class="album-card-info">' +
                    '<div class="album-card-title">' + escapeHtml(album.title) + '</div>' +
                    '<div class="album-card-meta">' + escapeHtml(album.type) + ' // ' + escapeHtml(album.year) + ' // ' + album.tracks.length + ' tracks ' + viewBadge + '</div>' +
                '</div>';
            card.addEventListener('click', function() {
                pushAlbumUrl(album);
                openAlbum(album);
            });
            albumGrid.appendChild(card);
        });
    }

    // ============================
    // PLAYER VIEW
    // ============================
    function recordView(contentType, contentId) {
        try {
            navigator.sendBeacon('/api/content-view', JSON.stringify({ contentType: contentType, contentId: contentId }));
        } catch (e) { /* ignore */ }
    }

    function openAlbum(album) {
        recordView('album', album.numericId);
        currentAlbum = album;
        currentTrackIndex = 0;

        // Switch views
        browseView.classList.add('hidden');
        playerView.classList.remove('hidden');

        // Update album art — cover image when present, gradient fallback
        nowPlayingArt.innerHTML = '';
        if (album.coverUrl) {
            var coverImg = document.createElement('img');
            coverImg.className = 'album-art-img';
            coverImg.src = album.coverUrl;
            coverImg.alt = album.title + ' cover art';
            nowPlayingArt.appendChild(coverImg);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className = 'art-placeholder ' + album.gradient;
            nowPlayingArt.appendChild(placeholder);
        }

        // Album description
        var albumDescription = document.getElementById('album-description');
        if (albumDescription) {
            var desc = (album.description || '').trim();
            albumDescription.textContent = desc;
            albumDescription.classList.toggle('hidden', !desc);
        }

        // Update tracklist header
        tracklistAlbumTitle.textContent = album.title.toUpperCase();

        // Render tracklist
        renderTracklist(album);

        // Render recommendations
        renderRecommendations(album.id);

        // Mount comments for this album
        if (window.Comments) {
            var commentsEl = document.getElementById('album-comments');
            if (commentsEl) window.Comments.mount(commentsEl, { type: 'album', id: album.numericId, pageSize: 10 });
        }

        // Load first track
        loadTrack(0);

        // Scroll to top
        window.scrollTo(0, 0);
    }

    function renderTracklist(album) {
        tracklist.innerHTML = '';
        album.tracks.forEach(function(track, index) {
            var row = document.createElement('div');
            row.className = 'track-row';
            row.dataset.index = index;
            row.innerHTML =
                '<span class="track-row-number">' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span class="track-row-play">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>' +
                '</span>' +
                '<div class="track-row-info">' +
                    '<span class="track-row-title">' + escapeHtml(track.title) + '</span>' +
                '</div>' +
                '<span class="track-row-duration">' + escapeHtml(track.duration) + '</span>';
            row.addEventListener('click', function() {
                playTrack(index);
            });
            tracklist.appendChild(row);

            // Expandable description + lyrics panel
            var description = (track.description || '').trim();
            var lyrics = (track.lyrics || '').trim();
            if (description || lyrics) {
                var expandBtn = document.createElement('button');
                expandBtn.className = 'track-row-expand';
                expandBtn.type = 'button';
                expandBtn.textContent = lyrics ? 'LYRICS' : 'INFO';
                expandBtn.setAttribute('aria-expanded', 'false');
                row.appendChild(expandBtn);

                var details = document.createElement('div');
                details.className = 'track-details hidden';
                if (description) {
                    var descEl = document.createElement('p');
                    descEl.className = 'track-details-description';
                    descEl.textContent = description;
                    details.appendChild(descEl);
                }
                if (lyrics) {
                    var lyricsLabel = document.createElement('div');
                    lyricsLabel.className = 'track-details-label';
                    lyricsLabel.textContent = 'LYRICS';
                    details.appendChild(lyricsLabel);
                    var lyricsEl = document.createElement('div');
                    lyricsEl.className = 'track-details-lyrics';
                    lyricsEl.textContent = lyrics;
                    details.appendChild(lyricsEl);
                }
                tracklist.appendChild(details);

                expandBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var open = details.classList.toggle('hidden');
                    expandBtn.setAttribute('aria-expanded', String(!open));
                    expandBtn.classList.toggle('open', !open);
                });
            }
        });
    }

    function renderRecommendations(excludeId) {
        recommendationsGrid.innerHTML = '';
        var others = ALBUMS.filter(function(a) { return a.id !== excludeId; });
        others.forEach(function(album) {
            var card = document.createElement('div');
            card.className = 'rec-card';
            var recArtHtml = album.coverUrl
                ? '<img class="album-art-img" src="' + escapeHtml(album.coverUrl) + '" alt="' + escapeHtml(album.title) + ' cover art" loading="lazy">'
                : '<div class="rec-art-gradient ' + escapeHtml(album.gradient) + '"></div>';
            card.innerHTML =
                '<div class="rec-art">' + recArtHtml + '</div>' +
                '<div class="rec-info">' +
                    '<div class="rec-title">' + escapeHtml(album.title) + '</div>' +
                    '<div class="rec-meta">' + escapeHtml(album.type) + ' // ' + escapeHtml(album.year) + '</div>' +
                '</div>';
            card.addEventListener('click', function() {
                stopPlayback();
                pushAlbumUrl(album);
                openAlbum(album);
            });
            recommendationsGrid.appendChild(card);
        });
    }

    // ============================
    // PLAYBACK
    // ============================
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60);
        return mins + ':' + String(secs).padStart(2, '0');
    }

    function loadTrack(index) {
        if (!currentAlbum) return;
        currentTrackIndex = index;
        var track = currentAlbum.tracks[index];

        // Update now playing info
        nowPlayingTitle.textContent = track.title;
        nowPlayingArtist.textContent = currentAlbum.artist;

        // Update active track in list
        var rows = tracklist.querySelectorAll('.track-row');
        rows.forEach(function(row, i) {
            row.classList.toggle('active', i === index);
            // Swap icon for active track
            var svg = row.querySelector('.track-row-play svg');
            if (i === index && isPlaying) {
                svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            } else {
                svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        });

        // Load audio
        if (track.src) {
            audioPlayer.src = track.src;
            audioPlayer.load();
        } else {
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
            // Show placeholder duration
            timeCurrent.textContent = '0:00';
            timeTotal.textContent = track.duration;
            progressFill.style.width = '0%';
            progressHandle.style.left = '0%';
        }
    }

    function playTrack(index) {
        var wasPlaying = isPlaying && index === currentTrackIndex;
        if (wasPlaying) {
            pausePlayback();
            return;
        }

        loadTrack(index);
        var track = currentAlbum.tracks[index];
        if (track.src) {
            audioPlayer.play().catch(function() {});
            isPlaying = true;
            updatePlayPauseUI();
        }
    }

    function togglePlayPause() {
        if (!currentAlbum) return;
        var track = currentAlbum.tracks[currentTrackIndex];
        if (!track.src) return;

        if (isPlaying) {
            pausePlayback();
        } else {
            audioPlayer.play().catch(function() {});
            isPlaying = true;
            updatePlayPauseUI();
        }
    }

    function pausePlayback() {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayPauseUI();
    }

    function stopPlayback() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        isPlaying = false;
        updatePlayPauseUI();
    }

    function playNext() {
        if (!currentAlbum) return;
        var nextIndex = (currentTrackIndex + 1) % currentAlbum.tracks.length;
        playTrack(nextIndex);
    }

    function playPrev() {
        if (!currentAlbum) return;
        // If more than 3 seconds in, restart current track
        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }
        var prevIndex = (currentTrackIndex - 1 + currentAlbum.tracks.length) % currentAlbum.tracks.length;
        playTrack(prevIndex);
    }

    function updatePlayPauseUI() {
        if (isPlaying) {
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            nowPlayingArt.classList.add('playing');
        } else {
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            nowPlayingArt.classList.remove('playing');
        }

        // Update tracklist row icons
        var rows = tracklist.querySelectorAll('.track-row');
        rows.forEach(function(row, i) {
            var svg = row.querySelector('.track-row-play svg');
            if (i === currentTrackIndex && isPlaying) {
                svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            } else {
                svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        });
    }

    // ============================
    // AUDIO EVENTS
    // ============================
    audioPlayer.addEventListener('timeupdate', function() {
        if (isSeeking) return;
        var current = audioPlayer.currentTime;
        var duration = audioPlayer.duration;
        if (isNaN(duration)) return;

        var pct = (current / duration) * 100;
        progressFill.style.width = pct + '%';
        progressHandle.style.left = pct + '%';
        timeCurrent.textContent = formatTime(current);
    });

    audioPlayer.addEventListener('loadedmetadata', function() {
        timeTotal.textContent = formatTime(audioPlayer.duration);
    });

    audioPlayer.addEventListener('ended', function() {
        // Auto-advance to next track
        playNext();
    });

    // ============================
    // SEEK
    // ============================
    function seekTo(e) {
        var rect = progressBar.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (!isNaN(audioPlayer.duration)) {
            audioPlayer.currentTime = pct * audioPlayer.duration;
            progressFill.style.width = (pct * 100) + '%';
            progressHandle.style.left = (pct * 100) + '%';
        }
    }

    progressBar.addEventListener('mousedown', function(e) {
        isSeeking = true;
        seekTo(e);
    });

    document.addEventListener('mousemove', function(e) {
        if (isSeeking) seekTo(e);
    });

    document.addEventListener('mouseup', function() {
        isSeeking = false;
    });

    // Touch support
    progressBar.addEventListener('touchstart', function(e) {
        isSeeking = true;
        seekTo(e.touches[0]);
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (isSeeking) seekTo(e.touches[0]);
    });

    document.addEventListener('touchend', function() {
        isSeeking = false;
    });

    // ============================
    // EVENT LISTENERS
    // ============================
    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);

    backBtn.addEventListener('click', function() {
        pushBrowseUrl();
        showBrowse();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (playerView.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        } else if (e.code === 'ArrowRight') {
            playNext();
        } else if (e.code === 'ArrowLeft') {
            playPrev();
        } else if (e.code === 'Escape') {
            pushBrowseUrl();
            showBrowse();
        }
    });

    // ============================
    // SORT TOGGLE
    // ============================
    var sortOrder = 'asc'; // default: oldest first
    var sortToggleBtn = document.getElementById('sort-toggle-btn');

    if (sortToggleBtn) {
        sortToggleBtn.addEventListener('click', function() {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            ALBUMS.reverse();
            renderBrowseView();
            sortToggleBtn.innerHTML = (sortOrder === 'asc' ? 'OLDEST FIRST' : 'NEWEST FIRST') +
                ' <span class="sort-arrow">&#9650;</span>';
            sortToggleBtn.classList.toggle('desc', sortOrder === 'desc');
        });
    }

    // ============================
    // DEEP LINKING — ?album=<slug>
    // ============================
    function findAlbumBySlug(slug) {
        for (var i = 0; i < ALBUMS.length; i++) {
            if (String(ALBUMS[i].id) === slug) return ALBUMS[i];
        }
        return null;
    }

    function pushAlbumUrl(album) {
        try { history.pushState({ album: String(album.id) }, '', '?album=' + encodeURIComponent(album.id)); } catch (e) {}
    }

    function pushBrowseUrl() {
        try { history.pushState({}, '', window.location.pathname); } catch (e) {}
    }

    function showBrowse() {
        stopPlayback();
        playerView.classList.add('hidden');
        browseView.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    function syncFromUrl() {
        var slug = new URLSearchParams(window.location.search).get('album');
        var album = slug ? findAlbumBySlug(slug) : null;
        if (album) openAlbum(album);
        else if (!playerView.classList.contains('hidden')) showBrowse();
    }

    window.addEventListener('popstate', syncFromUrl);

    // ============================
    // INIT — Fetch albums from API then render
    // ============================
    fetch('/api/music')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            ALBUMS = data.albums || [];
            renderBrowseView();
            if (data.locked && window.ContentGate) {
                window.ContentGate.render(albumGrid.parentNode, { total: data.total, label: 'releases', requiredLevel: data.requiredLevel });
            }
            syncFromUrl();
        })
        .catch(function() {
            albumGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load music</div>';
        });

})();
