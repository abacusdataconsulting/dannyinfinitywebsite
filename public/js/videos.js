/**
 * Videos Gallery JavaScript
 * Fetches from API, handles filtering, lightbox with arrows, and auto-detection
 */
(function() {
    'use strict';

    // DOM Elements
    var videoGrid = document.getElementById('video-grid');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var lightbox = document.getElementById('video-lightbox');
    var videoPlayer = document.getElementById('video-player');
    var lightboxTitle = document.getElementById('lightbox-title');
    var lightboxMeta = document.getElementById('lightbox-meta');
    var lightboxClose = document.getElementById('lightbox-close');
    var lightboxPrev = document.getElementById('lightbox-prev');
    var lightboxNext = document.getElementById('lightbox-next');

    // State
    var currentFilter = 'all';
    var currentIndex = 0;
    var visibleItems = [];
    var videosData = [];

    // Category label map
    var categoryLabels = {
        'music-video': 'Music Video',
        'live': 'Live Performance',
        'bts': 'Behind The Scenes'
    };

    /**
     * Get YouTube thumbnail URL from video ID
     */
    function getYouTubeThumbnail(videoId) {
        return 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
    }

    /**
     * Auto-detect duration from a local video URL
     * Returns a promise that resolves with the duration string
     */
    function detectVideoDuration(src) {
        return new Promise(function(resolve) {
            var video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = function() {
                var secs = Math.floor(video.duration);
                var mins = Math.floor(secs / 60);
                var remainder = secs % 60;
                resolve(mins + ':' + String(remainder).padStart(2, '0'));
                video.src = '';
            };
            video.onerror = function() {
                resolve(null);
                video.src = '';
            };
            video.src = src;
        });
    }

    /**
     * Render video items from data
     */
    function renderVideos() {
        videoGrid.innerHTML = '';

        videosData.forEach(function(video, idx) {
            var item = document.createElement('div');
            item.className = 'video-item';
            item.dataset.category = video.category;
            item.dataset.index = idx;

            // Determine thumbnail
            var thumbnailSrc = video.thumbnailUrl;
            if (!thumbnailSrc && video.videoType === 'youtube' && video.videoSrc) {
                thumbnailSrc = getYouTubeThumbnail(video.videoSrc);
            }

            var content;
            if (thumbnailSrc) {
                content = '<img src="' + thumbnailSrc + '" alt="' + video.title + '">';
            } else if (video.videoType === 'local' && video.videoSrc) {
                // Use the video itself as a poster-frame thumbnail
                content = '<video src="' + video.videoSrc + '" preload="metadata" muted style="width:100%;height:auto;display:block;pointer-events:none;"></video>';
            } else {
                content = '<div class="video-placeholder"><span class="placeholder-text">[' + video.slug.toUpperCase().slice(0, 10) + ']</span></div>';
            }

            var durationBadge = video.duration && video.duration !== '0:00'
                ? '<span class="video-duration">' + video.duration + '</span>'
                : '<span class="video-duration" id="dur-' + idx + '"></span>';

            item.innerHTML =
                content +
                '<div class="play-button"><span class="play-icon">&#9654;</span></div>' +
                durationBadge +
                '<div class="video-overlay">' +
                    '<span class="video-overlay-title">' + video.title + '</span>' +
                    '<span class="video-overlay-meta">' + (categoryLabels[video.category] || video.category) + ' // ' + video.year + '</span>' +
                '</div>';

            item.addEventListener('click', function() {
                openLightbox(idx);
            });

            videoGrid.appendChild(item);

            // Auto-detect duration for local videos if not set
            if ((!video.duration || video.duration === '0:00') && video.videoType === 'local' && video.videoSrc) {
                (function(videoIdx) {
                    detectVideoDuration(video.videoSrc).then(function(dur) {
                        if (dur) {
                            videosData[videoIdx].duration = dur;
                            var badge = document.getElementById('dur-' + videoIdx);
                            if (badge) badge.textContent = dur;
                        }
                    });
                })(idx);
            }
        });

        filterVideos(currentFilter);
    }

    /**
     * Filter videos by category
     */
    function filterVideos(category) {
        currentFilter = category;
        visibleItems = [];

        var items = videoGrid.querySelectorAll('.video-item');
        items.forEach(function(item) {
            var itemCategory = item.dataset.category;
            var idx = parseInt(item.dataset.index);
            if (category === 'all' || itemCategory === category) {
                item.classList.remove('hidden');
                item.classList.remove('fade-out');
                visibleItems.push(idx);
            } else {
                item.classList.add('fade-out');
                setTimeout(function() { item.classList.add('hidden'); }, 200);
            }
        });

        filterBtns.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.filter === category);
        });
    }

    /**
     * Open lightbox for video at given data index
     */
    function openLightbox(dataIndex) {
        var video = videosData[dataIndex];
        if (!video) return;

        // Set current index in visibleItems
        currentIndex = visibleItems.indexOf(dataIndex);
        if (currentIndex === -1) currentIndex = 0;

        lightboxTitle.textContent = video.title;
        lightboxMeta.textContent = (categoryLabels[video.category] || video.category) + ' // ' + video.year +
            (video.duration && video.duration !== '0:00' ? ' // ' + video.duration : '');

        // Set player orientation
        videoPlayer.classList.remove('portrait');
        if (video.orientation === 'portrait') {
            videoPlayer.classList.add('portrait');
        }

        // Load video content
        if (video.videoSrc && video.videoType) {
            if (video.videoType === 'youtube') {
                videoPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + video.videoSrc + '?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'vimeo') {
                videoPlayer.innerHTML = '<iframe src="https://player.vimeo.com/video/' + video.videoSrc + '?autoplay=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'local') {
                videoPlayer.innerHTML = '<video controls autoplay><source src="' + video.videoSrc + '" type="video/mp4">Your browser does not support the video tag.</video>';
            }
        } else {
            videoPlayer.innerHTML = '<div class="player-placeholder"><span class="play-icon" style="font-size:3rem;margin-left:8px;">&#9654;</span><p>Video Player</p></div>';
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        videoPlayer.innerHTML = '';
    }

    function prevVideo() {
        if (visibleItems.length === 0) return;
        // Stop current video
        videoPlayer.innerHTML = '';
        currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        openLightbox(visibleItems[currentIndex]);
    }

    function nextVideo() {
        if (visibleItems.length === 0) return;
        // Stop current video
        videoPlayer.innerHTML = '';
        currentIndex = (currentIndex + 1) % visibleItems.length;
        openLightbox(visibleItems[currentIndex]);
    }

    function handleKeyboard(e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') prevVideo();
        else if (e.key === 'ArrowRight') nextVideo();
    }

    /**
     * Initialize
     */
    function init() {
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                filterVideos(btn.dataset.filter);
            });
        });

        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrev.addEventListener('click', prevVideo);
        lightboxNext.addEventListener('click', nextVideo);
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', handleKeyboard);

        var yearEl = document.getElementById('current-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        // Fetch videos from API
        fetch('/api/videos')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                videosData = data.videos || [];
                renderVideos();
            })
            .catch(function() {
                videoGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load videos</div>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
