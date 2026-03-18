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
     * Capture a single frame from a video URL and return it as a data-URL image.
     *
     * Safari iOS refuses to load video data for off-DOM elements. The fix is to
     * insert a hidden, muted, playsinline video into the DOM and call play().
     * Safari iOS explicitly allows autoplay for muted+playsinline videos, which
     * forces the browser to fetch frame data so we can draw it to a canvas.
     */
    function captureVideoFrame(src, callback) {
        var video = document.createElement('video');
        video.muted = true;
        video.setAttribute('muted', '');          // belt-and-suspenders for Safari
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'auto';

        // Must be in the DOM for Safari iOS to autoplay — hide it off-screen
        video.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-9999';
        document.body.appendChild(video);

        var done = false;
        function finish(dataUrl, w, h, duration) {
            if (done) return;
            done = true;
            video.pause();
            video.removeAttribute('src');
            video.load();
            if (video.parentNode) video.parentNode.removeChild(video);
            callback(dataUrl, w, h, duration);
        }

        video.addEventListener('seeked', function() {
            try {
                var canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 180;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                var dur = (video.duration && isFinite(video.duration)) ? video.duration : 0;
                finish(canvas.toDataURL('image/jpeg', 0.7), video.videoWidth, video.videoHeight, dur);
            } catch (e) {
                finish(null);
            }
        });

        video.addEventListener('loadeddata', function() {
            video.pause();
            video.currentTime = 0.1;
        });

        video.addEventListener('error', function() { finish(null); });
        setTimeout(function() { finish(null); }, 12000);

        video.src = src;
        // Trigger load — muted+playsinline autoplay is allowed on Safari iOS
        video.play().catch(function() {});
    }

    /**
     * Auto-detect duration from a local video URL
     * Returns a promise that resolves with the duration string
     * Uses loadeddata event for Safari compatibility
     */
    function detectVideoDuration(src) {
        return new Promise(function(resolve) {
            var video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            var resolved = false;
            function done(dur) {
                if (resolved) return;
                resolved = true;
                resolve(dur);
                video.removeAttribute('src');
                video.load();
            }

            function extractDuration() {
                if (video.duration && isFinite(video.duration)) {
                    var secs = Math.floor(video.duration);
                    var mins = Math.floor(secs / 60);
                    var remainder = secs % 60;
                    done(mins + ':' + String(remainder).padStart(2, '0'));
                }
            }

            video.onloadedmetadata = extractDuration;
            video.onloadeddata = extractDuration;
            video.onerror = function() { done(null); };
            // Timeout fallback — Safari may stall on metadata
            setTimeout(function() { done(null); }, 8000);

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
            item.className = 'video-item' + (video.orientation === 'portrait' ? ' portrait' : '');
            item.dataset.category = video.category;
            item.dataset.index = idx;

            // Determine thumbnail
            var thumbnailSrc = video.thumbnailUrl;
            if (!thumbnailSrc && video.videoType === 'youtube' && video.videoSrc) {
                thumbnailSrc = getYouTubeThumbnail(video.videoSrc);
            }

            var content;
            var needsFrameCapture = false;
            if (thumbnailSrc) {
                content = '<img src="' + thumbnailSrc + '" alt="' + video.title + '">';
            } else if (video.videoType === 'local' && video.videoSrc) {
                // Transparent pixel placeholder — captureVideoFrame will replace with real frame
                content = '<img class="video-thumb" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="' + video.title + '">';
                needsFrameCapture = true;
            } else {
                content = '<div class="video-placeholder"><span class="placeholder-text">' + video.title + '</span></div>';
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

            // Capture first frame via offscreen video + canvas (works reliably in Safari)
            if (needsFrameCapture) {
                (function(thumbItem, videoSrc, videoIdx) {
                    captureVideoFrame(videoSrc, function(dataUrl, w, h, duration) {
                        var thumbImg = thumbItem.querySelector('.video-thumb');
                        if (thumbImg && dataUrl) {
                            thumbImg.src = dataUrl;
                            if (w && h) {
                                thumbImg.style.aspectRatio = w + ' / ' + h;
                            }
                        }
                        // Also backfill duration if we got it from the same load
                        if (duration && (!videosData[videoIdx].duration || videosData[videoIdx].duration === '0:00')) {
                            var secs = Math.floor(duration);
                            var mins = Math.floor(secs / 60);
                            var remainder = secs % 60;
                            var dur = mins + ':' + String(remainder).padStart(2, '0');
                            videosData[videoIdx].duration = dur;
                            var badge = document.getElementById('dur-' + videoIdx);
                            if (badge) badge.textContent = dur;
                        }
                    });
                })(item, video.videoSrc, idx);
            } else if ((!video.duration || video.duration === '0:00') && video.videoType === 'local' && video.videoSrc) {
                // Detect duration for local videos that already have a thumbnail image
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
                videoPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + video.videoSrc + '?autoplay=1&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'vimeo') {
                videoPlayer.innerHTML = '<iframe src="https://player.vimeo.com/video/' + video.videoSrc + '?autoplay=1&playsinline=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'local') {
                // Build video element programmatically — Safari needs load() called explicitly
                var vid = document.createElement('video');
                vid.controls = true;
                vid.playsInline = true;
                vid.setAttribute('webkit-playsinline', '');
                vid.preload = 'auto';

                var source = document.createElement('source');
                source.src = video.videoSrc;
                // Match type to actual file extension
                source.type = video.videoSrc.match(/\.webm(\?|#|$)/i) ? 'video/webm' : 'video/mp4';
                vid.appendChild(source);

                videoPlayer.innerHTML = '';
                videoPlayer.appendChild(vid);

                // Explicit load() is required for Safari to begin fetching
                vid.load();
                vid.play().catch(function() {
                    // Autoplay blocked — user can tap play manually
                });
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
