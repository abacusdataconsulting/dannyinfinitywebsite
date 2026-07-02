/**
 * Photos Gallery JavaScript
 * Fetches from API, handles filtering, lightbox, and keyboard navigation
 */
(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function recordView(contentType, contentId) {
        try {
            navigator.sendBeacon('/api/content-view', JSON.stringify({ contentType: contentType, contentId: contentId }));
        } catch (e) { /* ignore */ }
    }

    // DOM Elements
    var galleryGrid = document.getElementById('gallery-grid');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var lightbox = document.getElementById('lightbox');
    var lightboxImage = document.getElementById('lightbox-image');
    var lightboxTitle = document.getElementById('lightbox-title');
    var lightboxDate = document.getElementById('lightbox-date');
    var lightboxClose = document.getElementById('lightbox-close');
    var lightboxPrev = document.getElementById('lightbox-prev');
    var lightboxNext = document.getElementById('lightbox-next');
    var commentsBox = document.getElementById('photo-comments');
    var currentPhotoId = null;

    // State
    var currentFilter = 'all';
    var currentIndex = 0;
    var visibleItems = [];
    var photosData = [];

    /**
     * Render gallery items from data
     */
    function renderGallery() {
        galleryGrid.innerHTML = '';

        photosData.forEach(function(photo) {
            var item = document.createElement('div');
            item.className = 'gallery-item';
            item.dataset.category = photo.category;
            item.dataset.orientation = photo.orientation || 'landscape';

            var orientClass = photo.orientation === 'portrait' ? ' portrait' : (photo.orientation === 'square' ? ' square' : '');

            var content = photo.imageUrl
                ? '<img src="' + escapeHtml(photo.imageUrl) + '" alt="' + escapeHtml(photo.title) + '">'
                : '<div class="gallery-placeholder' + orientClass + '"><span class="placeholder-text">[' + escapeHtml(photo.category.toUpperCase()) + '_' + String(photo.id).padStart(3, '0') + ']</span></div>';

            var viewBadge = photo.showViews && photo.viewCount > 0
                ? ' <span class="view-count-badge">' + photo.viewCount + ' views</span>'
                : '';
            item.innerHTML =
                content +
                '<div class="gallery-overlay">' +
                    '<span class="photo-title">' + escapeHtml(photo.title) + '</span>' +
                    '<span class="photo-date">' + escapeHtml(photo.date ? photo.date.split('-')[0] : '') + viewBadge + '</span>' +
                '</div>';

            item.addEventListener('click', function() {
                openLightbox(item);
            });

            galleryGrid.appendChild(item);
        });

        filterGallery(currentFilter);
    }

    /**
     * Filter gallery items by category
     */
    function filterGallery(category) {
        currentFilter = category;
        visibleItems = [];

        var items = galleryGrid.querySelectorAll('.gallery-item');
        items.forEach(function(item, index) {
            var itemCategory = item.dataset.category;
            if (category === 'all' || itemCategory === category) {
                item.classList.remove('hidden');
                item.classList.remove('fade-out');
                visibleItems.push({ element: item, index: index });
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
     * Open lightbox with specific item
     */
    function openLightbox(item) {
        var title = item.querySelector('.photo-title');
        var date = item.querySelector('.photo-date');
        var img = item.querySelector('img');
        var placeholder = item.querySelector('.placeholder-text');

        currentIndex = visibleItems.findIndex(function(v) { return v.element === item; });
        // Record view — find the photo data by matching the DOM index
        var domItems = galleryGrid.querySelectorAll('.gallery-item');
        currentPhotoId = null;
        for (var vi = 0; vi < domItems.length; vi++) {
            if (domItems[vi] === item && photosData[vi]) {
                currentPhotoId = photosData[vi].id;
                recordView('photo', photosData[vi].id);
                break;
            }
        }
        mountComments();

        if (img) {
            lightboxImage.innerHTML = '<img src="' + img.src + '" alt="' + (title ? title.textContent : '') + '">';
        } else {
            lightboxImage.innerHTML = '<span style="font-size: 2rem; letter-spacing: 3px; opacity: 0.5;">' + (placeholder ? placeholder.textContent : '') + '</span>';
        }

        lightboxTitle.textContent = title ? title.textContent : '';
        lightboxDate.textContent = date ? date.textContent : '';

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        if (commentsBox) commentsBox.innerHTML = '';
    }

    // Comments auto-display below the expanded photo
    function mountComments() {
        if (!commentsBox || !window.Comments || currentPhotoId == null) return;
        window.Comments.mount(commentsBox, { type: 'photo', id: currentPhotoId, pageSize: 10 });
    }

    function prevImage() {
        if (visibleItems.length === 0) return;
        currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        openLightbox(visibleItems[currentIndex].element);
    }

    function nextImage() {
        if (visibleItems.length === 0) return;
        currentIndex = (currentIndex + 1) % visibleItems.length;
        openLightbox(visibleItems[currentIndex].element);
    }

    function handleKeyboard(e) {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') prevImage();
        else if (e.key === 'ArrowRight') nextImage();
    }

    // Sort toggle state
    var sortOrder = 'asc'; // default: oldest first

    /**
     * Initialize gallery
     */
    function init() {
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                filterGallery(btn.dataset.filter);
            });
        });

        // Sort toggle
        var sortToggleBtn = document.getElementById('sort-toggle-btn');
        if (sortToggleBtn) {
            sortToggleBtn.addEventListener('click', function() {
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                photosData.reverse();
                renderGallery();
                sortToggleBtn.innerHTML = (sortOrder === 'asc' ? 'OLDEST FIRST' : 'NEWEST FIRST') +
                    ' <span class="sort-arrow">&#9650;</span>';
                sortToggleBtn.classList.toggle('desc', sortOrder === 'desc');
            });
        }

        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrev.addEventListener('click', prevImage);
        lightboxNext.addEventListener('click', nextImage);
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', handleKeyboard);

        var yearEl = document.getElementById('current-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        // Fetch photos from API
        fetch('/api/photos')
            .then(function(res) { return res.json(); })
            .then(function(data) {
                photosData = data.photos || [];
                renderGallery();
            })
            .catch(function() {
                galleryGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load photos</div>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
