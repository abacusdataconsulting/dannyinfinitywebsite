/**
 * Videos Gallery JavaScript
 * Handles filtering and video modal playback
 */
(function() {
    'use strict';

    // DOM Elements
    const videoGrid = document.getElementById('video-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const videoItems = document.querySelectorAll('.video-item');
    const videoModal = document.getElementById('video-modal');
    const videoPlayer = document.getElementById('video-player');
    const modalTitle = document.getElementById('modal-title');
    const modalMeta = document.getElementById('modal-meta');
    const modalClose = document.getElementById('modal-close');

    // State
    let currentFilter = 'all';

    /**
     * Filter videos by category
     */
    function filterVideos(category) {
        currentFilter = category;

        videoItems.forEach(item => {
            const itemCategory = item.dataset.category;

            if (category === 'all' || itemCategory === category) {
                item.classList.remove('hidden');
                item.classList.remove('fade-out');
            } else {
                item.classList.add('fade-out');
                setTimeout(() => {
                    item.classList.add('hidden');
                }, 200);
            }
        });

        // Update active button
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === category);
        });
    }

    /**
     * Open video modal
     */
    function openModal(item) {
        const title = item.querySelector('.video-title')?.textContent || '';
        const meta = item.querySelector('.video-meta')?.textContent || '';
        const placeholder = item.querySelector('.placeholder-text')?.textContent || '';
        const videoSrc = item.dataset.videoSrc;
        const videoType = item.dataset.videoType; // 'youtube', 'vimeo', 'local'

        // Update modal content
        modalTitle.textContent = title;
        modalMeta.textContent = meta;

        // Handle different video types
        if (videoSrc) {
            if (videoType === 'youtube') {
                videoPlayer.innerHTML = `
                    <iframe
                        src="https://www.youtube.com/embed/${videoSrc}?autoplay=1"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>`;
            } else if (videoType === 'vimeo') {
                videoPlayer.innerHTML = `
                    <iframe
                        src="https://player.vimeo.com/video/${videoSrc}?autoplay=1"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowfullscreen>
                    </iframe>`;
            } else if (videoType === 'local') {
                videoPlayer.innerHTML = `
                    <video controls autoplay>
                        <source src="${videoSrc}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>`;
            }
        } else {
            // Placeholder
            videoPlayer.innerHTML = `
                <div class="player-placeholder">
                    <span class="play-icon large">&#9654;</span>
                    <p>${placeholder || 'Video Player'}</p>
                </div>`;
        }

        // Show modal
        videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close video modal
     */
    function closeModal() {
        videoModal.classList.remove('active');
        document.body.style.overflow = '';

        // Stop any playing video
        videoPlayer.innerHTML = '';
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyboard(e) {
        if (!videoModal.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeModal();
        }
    }

    /**
     * Initialize
     */
    function init() {
        // Filter button clicks
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterVideos(btn.dataset.filter);
            });
        });

        // Video item clicks
        videoItems.forEach(item => {
            item.addEventListener('click', () => {
                openModal(item);
            });
        });

        // Modal close
        modalClose.addEventListener('click', closeModal);

        // Close modal when clicking outside
        videoModal.addEventListener('click', (e) => {
            if (e.target === videoModal) {
                closeModal();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyboard);

        // Update year
        const yearEl = document.getElementById('current-year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
