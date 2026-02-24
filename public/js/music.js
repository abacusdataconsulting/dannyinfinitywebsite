(function() {
    'use strict';

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

    // ============================
    // SESSION
    // ============================
    var accessLevel = sessionStorage.getItem('accessLevel') || 'guest';
    var authToken = sessionStorage.getItem('authToken');

    var membersLink = document.getElementById('members-link');
    if (!(accessLevel === 'member' && authToken)) {
        membersLink.classList.add('locked');
    }

    document.getElementById('current-year').textContent = new Date().getFullYear();
    var currentTimeEl = document.getElementById('current-time');
    function updateClock() {
        currentTimeEl.textContent = new Date().toLocaleTimeString();
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================
    // BROWSE VIEW
    // ============================
    function renderBrowseView() {
        albumGrid.innerHTML = '';
        ALBUMS.forEach(function(album) {
            var card = document.createElement('div');
            card.className = 'album-card';
            card.dataset.albumId = album.id;
            card.innerHTML =
                '<div class="album-art">' +
                    '<div class="album-art-gradient ' + album.gradient + '">' +
                        '<span class="album-art-label">' + album.type.toUpperCase() + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="album-card-info">' +
                    '<div class="album-card-title">' + album.title + '</div>' +
                    '<div class="album-card-meta">' + album.type + ' // ' + album.year + ' // ' + album.tracks.length + ' tracks</div>' +
                '</div>';
            card.addEventListener('click', function() {
                openAlbum(album);
            });
            albumGrid.appendChild(card);
        });
    }

    // ============================
    // PLAYER VIEW
    // ============================
    function openAlbum(album) {
        currentAlbum = album;
        currentTrackIndex = 0;

        // Switch views
        browseView.classList.add('hidden');
        playerView.classList.remove('hidden');

        // Update album art
        var artPlaceholder = nowPlayingArt.querySelector('.art-placeholder');
        artPlaceholder.className = 'art-placeholder ' + album.gradient;

        // Update tracklist header
        tracklistAlbumTitle.textContent = album.title.toUpperCase();

        // Render tracklist
        renderTracklist(album);

        // Render recommendations
        renderRecommendations(album.id);

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
                    '<span class="track-row-title">' + track.title + '</span>' +
                '</div>' +
                '<span class="track-row-duration">' + track.duration + '</span>';
            row.addEventListener('click', function() {
                playTrack(index);
            });
            tracklist.appendChild(row);
        });
    }

    function renderRecommendations(excludeId) {
        recommendationsGrid.innerHTML = '';
        var others = ALBUMS.filter(function(a) { return a.id !== excludeId; });
        others.forEach(function(album) {
            var card = document.createElement('div');
            card.className = 'rec-card';
            card.innerHTML =
                '<div class="rec-art">' +
                    '<div class="rec-art-gradient ' + album.gradient + '"></div>' +
                '</div>' +
                '<div class="rec-info">' +
                    '<div class="rec-title">' + album.title + '</div>' +
                    '<div class="rec-meta">' + album.type + ' // ' + album.year + '</div>' +
                '</div>';
            card.addEventListener('click', function() {
                stopPlayback();
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
        stopPlayback();
        playerView.classList.add('hidden');
        browseView.classList.remove('hidden');
        window.scrollTo(0, 0);
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
            stopPlayback();
            playerView.classList.add('hidden');
            browseView.classList.remove('hidden');
        }
    });

    // ============================
    // INIT — Fetch albums from API then render
    // ============================
    fetch('/api/music')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            ALBUMS = data.albums || [];
            renderBrowseView();
        })
        .catch(function() {
            albumGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load music</div>';
        });

})();
