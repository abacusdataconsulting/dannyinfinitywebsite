(function() {
    'use strict';

    // ============================
    // SHEET MUSIC DATA (loaded from API)
    // ============================
    var SHEETS = [];

    // ============================
    // DOM ELEMENTS
    // ============================
    var sheetsGrid = document.getElementById('sheets-grid');
    var previewModal = document.getElementById('preview-modal');
    var modalClose = document.getElementById('modal-close');
    var previewCanvas = document.getElementById('preview-canvas');
    var previewLoading = document.getElementById('preview-loading');
    var previewTitle = document.getElementById('preview-title');
    var previewFields = document.getElementById('preview-fields');
    var previewDescription = document.getElementById('preview-description');
    var downloadBtn = document.getElementById('download-btn');
    var tipActionBtn = document.getElementById('tip-action-btn');

    // ============================
    // PDF.js setup (loaded via script tag as window.pdfjsLib)
    // ============================
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    function getPdfjs() {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
        return Promise.resolve(null);
    }

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

    // ============================
    // RENDER GRID
    // ============================
    function renderGrid() {
        sheetsGrid.innerHTML = '';
        SHEETS.forEach(function(sheet) {
            var card = document.createElement('div');
            card.className = 'sheet-card';
            card.dataset.sheetId = sheet.id;

            card.innerHTML =
                '<div class="sheet-info">' +
                    '<div class="sheet-title">' + sheet.title + '</div>' +
                    '<div class="sheet-meta">' + sheet.arrangement + ' // ' + sheet.year + '</div>' +
                '</div>' +
                '<div class="sheet-preview" id="preview-' + sheet.id + '">' +
                    '<div class="sheet-placeholder">' +
                        '<span class="sheet-placeholder-icon">&#9835;</span>' +
                        '<span class="sheet-placeholder-text">' + sheet.pages + ' pages</span>' +
                    '</div>' +
                '</div>' +
                '<div class="sheet-see-more">' +
                    '<a href="#" class="see-more-link">See More</a>' +
                '</div>';

            // Click anywhere on card opens modal
            card.addEventListener('click', function(e) {
                e.preventDefault();
                openPreview(sheet);
            });

            sheetsGrid.appendChild(card);

            // Try to render first page thumbnail if PDF exists
            if (sheet.pdfUrl) {
                renderThumbnail(sheet);
            }
        });
    }

    // ============================
    // PDF RENDERING
    // ============================
    function renderThumbnail(sheet) {
        var container = document.getElementById('preview-' + sheet.id);
        if (!container || !sheet.pdfUrl) return;

        getPdfjs().then(function(lib) {
            if (!lib) return;
            return lib.getDocument(sheet.pdfUrl).promise;
        }).then(function(pdf) {
            if (!pdf) return;
            return pdf.getPage(1);
        }).then(function(page) {
            if (!page) return;
            var viewport = page.getViewport({ scale: 0.5 });
            var canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            var ctx = canvas.getContext('2d');

            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                container.innerHTML = '';
                container.appendChild(canvas);
            });
        }).catch(function() {
            // Keep placeholder on error
        });
    }

    function renderFullPreview(sheet) {
        previewLoading.classList.remove('hidden');
        previewCanvas.style.display = 'none';

        if (!sheet.pdfUrl) {
            previewLoading.textContent = 'No PDF available yet';
            return;
        }

        getPdfjs().then(function(lib) {
            if (!lib) {
                previewLoading.textContent = 'PDF viewer unavailable';
                return;
            }
            return lib.getDocument(sheet.pdfUrl).promise;
        }).then(function(pdf) {
            if (!pdf) return;
            return pdf.getPage(1);
        }).then(function(page) {
            if (!page) return;
            var scale = 1.5;
            var viewport = page.getViewport({ scale: scale });
            previewCanvas.width = viewport.width;
            previewCanvas.height = viewport.height;
            var ctx = previewCanvas.getContext('2d');

            return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
                previewLoading.classList.add('hidden');
                previewCanvas.style.display = 'block';
            });
        }).catch(function() {
            previewLoading.textContent = 'Failed to load PDF';
        });
    }

    // ============================
    // MODAL
    // ============================
    function openPreview(sheet) {
        previewTitle.textContent = sheet.title;

        // Build detail fields conditionally
        var fields = '';
        if (sheet.composer) fields += '<p class="preview-field"><span class="field-label">Composed by:</span> ' + sheet.composer + '</p>';
        if (sheet.arrangement) fields += '<p class="preview-field"><span class="field-label">Arrangement:</span> ' + sheet.arrangement + '</p>';
        if (sheet.year) fields += '<p class="preview-field"><span class="field-label">Year:</span> ' + sheet.year + '</p>';
        if (sheet.pages) fields += '<p class="preview-field"><span class="field-label">Pages:</span> ' + sheet.pages + '</p>';
        previewFields.innerHTML = fields;

        previewDescription.textContent = sheet.description;
        previewDescription.style.display = sheet.description ? '' : 'none';

        // Set download link
        if (sheet.pdfUrl) {
            downloadBtn.href = sheet.pdfUrl;
            downloadBtn.setAttribute('download', '');
            downloadBtn.style.opacity = '1';
        } else {
            downloadBtn.href = '#';
            downloadBtn.removeAttribute('download');
            downloadBtn.style.opacity = '0.4';
        }

        // Set tip link
        tipActionBtn.href = sheet.tipLink || '#';

        // Render PDF preview
        renderFullPreview(sheet);

        // Show modal
        previewModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePreview() {
        previewModal.classList.remove('active');
        document.body.style.overflow = '';
        previewCanvas.style.display = 'none';
        previewLoading.textContent = 'Loading preview...';
        previewLoading.classList.remove('hidden');
    }

    // ============================
    // EVENT LISTENERS
    // ============================
    modalClose.addEventListener('click', closePreview);

    previewModal.addEventListener('click', function(e) {
        if (e.target === previewModal) {
            closePreview();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && previewModal.classList.contains('active')) {
            closePreview();
        }
    });

    // Prevent download button default when no PDF
    downloadBtn.addEventListener('click', function(e) {
        if (downloadBtn.href === '#' || !downloadBtn.hasAttribute('download')) {
            e.preventDefault();
        }
    });

    // ============================
    // INIT — Fetch sheets from API then render
    // ============================
    fetch('/api/sheet-music')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            SHEETS = (data.sheets || []).map(function(s) {
                return {
                    id: s.slug || s.id,
                    title: s.title,
                    composer: s.composer,
                    arrangement: s.arrangement,
                    year: String(s.year),
                    pages: s.pages,
                    description: s.description || '',
                    pdfUrl: s.pdfUrl || '',
                    tipLink: s.tipLink || '#'
                };
            });
            renderGrid();
        })
        .catch(function() {
            sheetsGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load sheet music</div>';
        });

})();
