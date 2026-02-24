/**
 * Videos Gallery JavaScript
 * Fetches from API, handles filtering and video modal playback
 */
(function() {
    'use strict';

    // DOM Elements
    var videoGrid = document.getElementById('video-grid');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var videoModal = document.getElementById('video-modal');
    var videoPlayer = document.getElementById('video-player');
    var modalTitle = document.getElementById('modal-title');
    var modalMeta = document.getElementById('modal-meta');
    var modalClose = document.getElementById('modal-close');

    // State
    var currentFilter = 'all';
    var videosData = [];

    // Category label map
    var categoryLabels = {
        'music-video': 'Music Video',
        'live': 'Live Performance',
        'bts': 'Behind The Scenes'
    };

    /**
     * Render video items from data
     */
    function renderVideos() {
        videoGrid.innerHTML = '';

        videosData.forEach(function(video) {
            var item = document.createElement('div');
            item.className = 'video-item';
            item.dataset.category = video.category;
            item.dataset.orientation = video.orientation || 'landscape';
            if (video.videoType) item.dataset.videoType = video.videoType;
            if (video.videoSrc) item.dataset.videoSrc = video.videoSrc;

            var thumbnailContent = video.thumbnailUrl
                ? '<img src="' + video.thumbnailUrl + '" alt="' + video.title + '">'
                : '<div class="thumbnail-placeholder"><span class="placeholder-text">[' + video.slug.toUpperCase().slice(0, 10) + ']</span></div>';

            item.innerHTML =
                '<div class="video-thumbnail">' +
                    thumbnailContent +
                    '<div class="play-button"><span class="play-icon">&#9654;</span></div>' +
                    '<span class="video-duration">' + (video.duration || '') + '</span>' +
                '</div>' +
                '<div class="video-info">' +
                    '<h3 class="video-title">' + video.title + '</h3>' +
                    '<p class="video-meta">' + (categoryLabels[video.category] || video.category) + ' // ' + video.year + '</p>' +
                '</div>';

            item.addEventListener('click', function() {
                openModal(video, item);
            });

            videoGrid.appendChild(item);
        });

        filterVideos(currentFilter);
    }

    /**
     * Filter videos by category
     */
    function filterVideos(category) {
        currentFilter = category;

        var items = videoGrid.querySelectorAll('.video-item');
        items.forEach(function(item) {
            var itemCategory = item.dataset.category;
            if (category === 'all' || itemCategory === category) {
                item.classList.remove('hidden');
                item.classList.remove('fade-out');
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
     * Open video modal
     */
    function openModal(video, item) {
        modalTitle.textContent = video.title;
        modalMeta.textContent = (categoryLabels[video.category] || video.category) + ' // ' + video.year;

        videoPlayer.classList.remove('portrait');
        if (video.orientation === 'portrait') {
            videoPlayer.classList.add('portrait');
        }

        if (video.videoSrc && video.videoType) {
            if (video.videoType === 'youtube') {
                videoPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + video.videoSrc + '?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'vimeo') {
                videoPlayer.innerHTML = '<iframe src="https://player.vimeo.com/video/' + video.videoSrc + '?autoplay=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
            } else if (video.videoType === 'local') {
                videoPlayer.innerHTML = '<video controls autoplay><source src="' + video.videoSrc + '" type="video/mp4">Your browser does not support the video tag.</video>';
            }
        } else {
            videoPlayer.innerHTML = '<div class="player-placeholder"><span class="play-icon large">&#9654;</span><p>Video Player</p></div>';
        }

        videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close video modal
     */
    function closeModal() {
        videoModal.classList.remove('active');
        document.body.style.overflow = '';
        videoPlayer.innerHTML = '';
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

        modalClose.addEventListener('click', closeModal);
        videoModal.addEventListener('click', function(e) {
            if (e.target === videoModal) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && videoModal.classList.contains('active')) closeModal();
        });

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
