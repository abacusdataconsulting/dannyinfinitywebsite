/**
 * Photos Gallery JavaScript
 * Fetches from API, handles filtering, lightbox, and keyboard navigation
 */
(function() {
    'use strict';

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
                ? '<img src="' + photo.imageUrl + '" alt="' + photo.title + '">'
                : '<div class="gallery-placeholder' + orientClass + '"><span class="placeholder-text">[' + photo.category.toUpperCase() + '_' + String(photo.id).padStart(3, '0') + ']</span></div>';

            item.innerHTML =
                content +
                '<div class="gallery-overlay">' +
                    '<span class="photo-title">' + photo.title + '</span>' +
                    '<span class="photo-date">' + (photo.date ? photo.date.split('-')[0] : '') + '</span>' +
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

    /**
     * Initialize gallery
     */
    function init() {
        filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                filterGallery(btn.dataset.filter);
            });
        });

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
