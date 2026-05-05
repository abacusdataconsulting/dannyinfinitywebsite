(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatPrice(cents) {
        return '$' + (cents / 100).toFixed(2);
    }

    // ============================
    // TIP SUCCESS: noindex to prevent duplicate content
    // ============================
    if (window.location.search.indexOf('tip=success') !== -1) {
        var noindex = document.createElement('meta');
        noindex.name = 'robots';
        noindex.content = 'noindex';
        document.head.appendChild(noindex);
    }

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

    // Current sheet in preview
    var currentPreviewSheet = null;

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

    document.getElementById('current-year').textContent = new Date().getFullYear();

    // ============================
    // RENDER GRID
    // ============================
    function renderGrid() {
        sheetsGrid.innerHTML = '';

        // Build JSON-LD ItemList for SEO
        var itemListElements = [];

        SHEETS.forEach(function(sheet, index) {
            var card = document.createElement('div');
            card.className = 'sheet-card';
            card.dataset.sheetId = sheet.id;

            var descSnippet = sheet.description
                ? '<p class="sheet-description" style="opacity:0.6;font-size:0.8rem;margin-top:4px;">' + escapeHtml(sheet.description.slice(0, 120)) + '</p>'
                : '';

            var priceBadge = sheet.price > 0
                ? '<span class="sheet-price-badge paid">' + formatPrice(sheet.price) + '</span>'
                : '<span class="sheet-price-badge free">FREE</span>';

            card.innerHTML =
                '<div class="sheet-info">' +
                    '<h2 class="sheet-title" style="font-size:1rem;margin:0;">' + escapeHtml(sheet.title) + '</h2>' +
                    '<div class="sheet-meta">' + escapeHtml(sheet.arrangement) + ' // ' + escapeHtml(sheet.year) + '</div>' +
                    descSnippet +
                    priceBadge +
                '</div>' +
                '<div class="sheet-preview" id="preview-' + escapeHtml(sheet.id) + '">' +
                    '<div class="sheet-placeholder">' +
                        '<span class="sheet-placeholder-icon">&#9835;</span>' +
                        '<span class="sheet-placeholder-text">' + escapeHtml(sheet.pages) + ' pages</span>' +
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

            // Render first page thumbnail (free or paid preview)
            if (sheet.pdfUrl || sheet.previewUrl) {
                renderThumbnail(sheet);
            }

            // Add to JSON-LD ItemList
            var itemData = {
                '@type': 'MusicComposition',
                name: sheet.title,
                composer: { '@type': 'Person', name: sheet.composer || 'Danny Infinity' },
                description: sheet.description || '',
            };
            if (sheet.price > 0) {
                itemData.offers = {
                    '@type': 'Offer',
                    price: (sheet.price / 100).toFixed(2),
                    priceCurrency: 'USD'
                };
            }
            itemListElements.push({
                '@type': 'ListItem',
                position: index + 1,
                item: itemData
            });
        });

        // Inject JSON-LD for sheet music
        if (itemListElements.length > 0) {
            var script = document.createElement('script');
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'Sheet Music by Danny Infinity',
                itemListElement: itemListElements
            });
            document.head.appendChild(script);
        }
    }

    // ============================
    // PDF RENDERING
    // ============================

    function drawWatermark(ctx, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        var tileSize = Math.max(16, Math.floor(width / 16));
        ctx.font = 'bold ' + tileSize + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Rotate and tile the watermark
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 6);

        var text = 'DANNYINFINITY.COM';
        var spacingY = Math.max(100, Math.floor(width / 3));
        var spacingX = Math.max(200, Math.floor(width / 1.8));
        for (var y = -height; y < height * 2; y += spacingY) {
            for (var x = -width; x < width * 2; x += spacingX) {
                ctx.fillText(text, x - width / 2, y - height / 2);
            }
        }

        ctx.restore();

        // Draw a more visible centered watermark
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        var centerSize = Math.max(22, Math.floor(width / 10));
        ctx.font = 'bold ' + centerSize + 'px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText('DANNYINFINITY.COM', 0, -centerSize);
        ctx.fillText('PREVIEW ONLY', 0, centerSize);
        ctx.restore();
    }

    function renderThumbnail(sheet) {
        var container = document.getElementById('preview-' + sheet.id);
        if (!container) return;

        var url = sheet.pdfUrl || sheet.previewUrl;
        if (!url) return;

        var isPaid = sheet.price > 0;

        getPdfjs().then(function(lib) {
            if (!lib) return;
            return lib.getDocument(url).promise;
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
                if (isPaid) {
                    drawWatermark(ctx, canvas.width, canvas.height);
                }
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

        var url = sheet.pdfUrl || sheet.previewUrl;

        if (!url) {
            previewLoading.textContent = sheet.price > 0 ? 'No preview available' : 'No PDF available yet';
            return;
        }

        var isPaid = sheet.price > 0;

        getPdfjs().then(function(lib) {
            if (!lib) {
                previewLoading.textContent = 'PDF viewer unavailable';
                return;
            }
            return lib.getDocument(url).promise;
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
                if (isPaid) {
                    drawWatermark(ctx, previewCanvas.width, previewCanvas.height);
                }
                previewLoading.classList.add('hidden');
                previewCanvas.style.display = 'block';
            });
        }).catch(function() {
            previewLoading.textContent = 'Failed to load PDF';
        });
    }

    // Prevent right-click save on preview canvas
    previewCanvas.addEventListener('contextmenu', function(e) {
        if (currentPreviewSheet && currentPreviewSheet.price > 0) {
            e.preventDefault();
        }
    });

    // ============================
    // MODAL
    // ============================
    function openPreview(sheet) {
        currentPreviewSheet = sheet;
        previewTitle.textContent = sheet.title;

        // Build detail fields conditionally
        var fields = '';
        if (sheet.composer) fields += '<p class="preview-field"><span class="field-label">Composer:</span> ' + escapeHtml(sheet.composer) + '</p>';
        if (sheet.arrangement) fields += '<p class="preview-field"><span class="field-label">Arrangement:</span> ' + escapeHtml(sheet.arrangement) + '</p>';
        if (sheet.year) fields += '<p class="preview-field"><span class="field-label">Date:</span> ' + escapeHtml(sheet.year) + '</p>';
        if (sheet.pages) fields += '<p class="preview-field"><span class="field-label">Pages:</span> ' + escapeHtml(sheet.pages) + '</p>';

        // Show price and preview notice for paid sheets
        if (sheet.price > 0) {
            fields += '<p class="preview-price">' + formatPrice(sheet.price) + '</p>';
            fields += '<p class="preview-field" style="opacity:0.5;font-size:0.8rem;font-style:italic;">Page 1 preview only — purchase for full PDF</p>';
        }

        previewFields.innerHTML = fields;

        previewDescription.textContent = sheet.description;
        previewDescription.style.display = sheet.description ? '' : 'none';

        // Configure action buttons based on free vs paid
        if (sheet.price > 0) {
            // PAID: show add to cart / in cart button
            updatePurchaseButton(sheet);
            tipActionBtn.style.display = 'none';
        } else {
            // FREE: show download + tip
            if (sheet.pdfUrl) {
                downloadBtn.href = sheet.pdfUrl;
                downloadBtn.setAttribute('download', '');
                downloadBtn.setAttribute('aria-label', 'Download ' + sheet.title + ' sheet music PDF');
                downloadBtn.style.opacity = '1';
                downloadBtn.textContent = '[DOWNLOAD PDF]';
                downloadBtn.className = 'action-btn download-btn';
            } else {
                downloadBtn.href = '#';
                downloadBtn.removeAttribute('download');
                downloadBtn.setAttribute('aria-label', 'Download not available');
                downloadBtn.style.opacity = '0.4';
                downloadBtn.textContent = '[DOWNLOAD PDF]';
                downloadBtn.className = 'action-btn download-btn';
            }
            tipActionBtn.style.display = '';
            tipActionBtn.setAttribute('aria-label', 'Leave a tip for ' + sheet.title);
            tipActionBtn._tipSheet = {
                sheetMusicId: sheet.numericId,
                sheetTitle: sheet.title
            };
        }

        // Render PDF preview
        renderFullPreview(sheet);

        // Show modal
        previewModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function updatePurchaseButton(sheet) {
        var inCart = window.sheetCart && window.sheetCart.has(sheet.numericId);

        if (inCart) {
            downloadBtn.href = '#';
            downloadBtn.removeAttribute('download');
            downloadBtn.textContent = '[IN CART — REMOVE]';
            downloadBtn.className = 'action-btn in-cart-btn';
            downloadBtn.style.opacity = '1';
        } else {
            downloadBtn.href = '#';
            downloadBtn.removeAttribute('download');
            downloadBtn.textContent = '[ADD TO CART — ' + formatPrice(sheet.price) + ']';
            downloadBtn.className = 'action-btn purchase-btn';
            downloadBtn.style.opacity = '1';
        }
    }

    function closePreview() {
        previewModal.classList.remove('active');
        document.body.style.overflow = '';
        previewCanvas.style.display = 'none';
        previewLoading.textContent = 'Loading preview...';
        previewLoading.classList.remove('hidden');
        currentPreviewSheet = null;
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

    // Download / purchase button click
    downloadBtn.addEventListener('click', function(e) {
        if (!currentPreviewSheet) return;

        if (currentPreviewSheet.price > 0) {
            // Paid sheet: toggle cart
            e.preventDefault();
            if (window.sheetCart) {
                window.sheetCart.toggle({
                    sheetId: currentPreviewSheet.numericId,
                    title: currentPreviewSheet.title,
                    priceCents: currentPreviewSheet.price
                });
                updatePurchaseButton(currentPreviewSheet);
            }
        } else {
            // Free sheet: allow default download behavior, block if no PDF
            if (!downloadBtn.hasAttribute('download')) {
                e.preventDefault();
            }
        }
    });

    // Per-sheet tip button in preview modal
    tipActionBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.openTipModal && tipActionBtn._tipSheet) {
            window.openTipModal(tipActionBtn._tipSheet);
        } else if (window.openTipModal) {
            window.openTipModal();
        }
    });

    // Global tip button
    var globalTipBtn = document.getElementById('global-tip-btn');
    if (globalTipBtn) {
        globalTipBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.openTipModal) {
                window.openTipModal();
            }
        });
    }

    // Listen for cart changes to update modal button if open
    document.addEventListener('cartchange', function() {
        if (currentPreviewSheet && currentPreviewSheet.price > 0) {
            updatePurchaseButton(currentPreviewSheet);
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
                    numericId: s.id,
                    title: s.title,
                    composer: s.composer,
                    arrangement: s.arrangement,
                    year: String(s.year),
                    pages: s.pages,
                    description: s.description || '',
                    price: s.price || 0,
                    pdfUrl: s.pdfUrl || '',
                    previewUrl: s.previewUrl || ''
                };
            });
            renderGrid();
        })
        .catch(function() {
            sheetsGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load sheet music</div>';
        });

})();
