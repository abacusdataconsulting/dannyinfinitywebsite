/**
 * Photos Gallery JavaScript
 * Handles filtering, lightbox, and keyboard navigation
 */
(function() {
    'use strict';

    // DOM Elements
    const galleryGrid = document.getElementById('gallery-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDate = document.getElementById('lightbox-date');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');

    // State
    let currentFilter = 'all';
    let currentIndex = 0;
    let visibleItems = [];

    /**
     * Filter gallery items by category
     */
    function filterGallery(category) {
        currentFilter = category;
        visibleItems = [];

        galleryItems.forEach((item, index) => {
            const itemCategory = item.dataset.category;

            if (category === 'all' || itemCategory === category) {
                item.classList.remove('hidden');
                item.classList.remove('fade-out');
                visibleItems.push({ element: item, index: index });
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
     * Open lightbox with specific item
     */
    function openLightbox(item) {
        const title = item.querySelector('.photo-title')?.textContent || '';
        const date = item.querySelector('.photo-date')?.textContent || '';
        const placeholder = item.querySelector('.placeholder-text')?.textContent || '';
        const img = item.querySelector('img');

        // Set current index
        currentIndex = visibleItems.findIndex(v => v.element === item);

        // Update lightbox content
        if (img) {
            lightboxImage.innerHTML = `<img src="${img.src}" alt="${title}">`;
        } else {
            lightboxImage.innerHTML = `<span style="font-size: 2rem; letter-spacing: 3px; opacity: 0.5;">${placeholder}</span>`;
        }

        lightboxTitle.textContent = title;
        lightboxDate.textContent = date;

        // Show lightbox
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close lightbox
     */
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Navigate to previous image
     */
    function prevImage() {
        if (visibleItems.length === 0) return;
        currentIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        openLightbox(visibleItems[currentIndex].element);
    }

    /**
     * Navigate to next image
     */
    function nextImage() {
        if (visibleItems.length === 0) return;
        currentIndex = (currentIndex + 1) % visibleItems.length;
        openLightbox(visibleItems[currentIndex].element);
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyboard(e) {
        if (!lightbox.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                prevImage();
                break;
            case 'ArrowRight':
                nextImage();
                break;
        }
    }

    /**
     * Initialize gallery
     */
    function init() {
        // Initialize visible items
        filterGallery('all');

        // Filter button clicks
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterGallery(btn.dataset.filter);
            });
        });

        // Gallery item clicks
        galleryItems.forEach(item => {
            item.addEventListener('click', () => {
                openLightbox(item);
            });
        });

        // Lightbox controls
        lightboxClose.addEventListener('click', closeLightbox);
        lightboxPrev.addEventListener('click', prevImage);
        lightboxNext.addEventListener('click', nextImage);

        // Close lightbox when clicking outside
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
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
