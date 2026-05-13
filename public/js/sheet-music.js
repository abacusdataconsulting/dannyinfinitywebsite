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
    // AUTH STATE
    // ============================
    var currentUser = null;
    var authToken = null;

    function loadAuthState() {
        authToken = localStorage.getItem('userAuthToken');
        var userData = localStorage.getItem('userData');
        if (authToken && userData) {
            try { currentUser = JSON.parse(userData); } catch (e) { currentUser = null; }
        }
    }

    function saveAuthState(token, user) {
        authToken = token;
        currentUser = user;
        localStorage.setItem('userAuthToken', token);
        localStorage.setItem('userData', JSON.stringify(user));
    }

    function clearAuthState() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('userAuthToken');
        localStorage.removeItem('userData');
    }

    function getAuthHeaders() {
        if (!authToken) return {};
        return { 'Authorization': 'Bearer ' + authToken };
    }

    loadAuthState();

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
    var buyNowBtn = document.getElementById('buy-now-btn');
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
    // USER ACCOUNT BAR (handled globally by cart.js, listen for auth changes)
    // ============================
    function renderAccountBar() {
        // Auth state is now rendered in the site-nav by cart.js
        // Just reload auth state from localStorage
        loadAuthState();
    }

    // ============================
    // AUTH MODAL
    // ============================
    function openAuthModal(mode) {
        var existing = document.getElementById('auth-modal');
        if (existing) existing.remove();

        var modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;';

        var title = mode === 'register' ? 'Create Account' : 'Log In';
        var submitText = mode === 'register' ? '[CREATE ACCOUNT]' : '[LOG IN]';
        var switchText = mode === 'register'
            ? 'Already have an account? <a href="#" id="auth-switch" style="text-decoration:underline;">Log in</a>'
            : 'Need an account? <a href="#" id="auth-switch" style="text-decoration:underline;">Create one</a>';

        modal.innerHTML =
            '<div style="background:var(--bg-primary);border:1px solid var(--border-color);padding:35px;max-width:400px;width:90%;position:relative;">' +
                '<button id="auth-modal-close" style="position:absolute;top:10px;right:15px;background:none;border:none;color:var(--text-primary);font-size:1.5rem;cursor:pointer;font-family:inherit;">&times;</button>' +
                '<h2 style="text-align:center;letter-spacing:2px;margin-bottom:20px;font-size:1.1rem;">' + title + '</h2>' +
                '<form id="auth-modal-form" style="display:flex;flex-direction:column;gap:12px;">' +
                    '<input type="text" name="username" placeholder="Username" required minlength="2" autocomplete="username" style="padding:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:1px;">' +
                    '<input type="password" name="password" placeholder="Password" required ' + (mode === 'register' ? 'minlength="4" autocomplete="new-password"' : 'autocomplete="current-password"') + ' style="padding:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:1px;">' +
                    '<button type="submit" id="auth-submit-btn" style="padding:14px;border:2px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:2px;cursor:pointer;transition:all 0.2s;">' + submitText + '</button>' +
                '</form>' +
                '<div id="auth-message" style="text-align:center;font-size:0.8rem;padding:8px 0;letter-spacing:1px;min-height:20px;"></div>' +
                '<p style="text-align:center;font-size:0.8rem;opacity:0.5;margin-top:5px;">' + switchText + '</p>' +
            '</div>';

        document.body.appendChild(modal);

        // Close
        modal.addEventListener('click', function(e) { if (e.target === modal) closeAuthModal(); });
        document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);

        // Switch mode
        setTimeout(function() {
            var switchLink = document.getElementById('auth-switch');
            if (switchLink) {
                switchLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    closeAuthModal();
                    openAuthModal(mode === 'register' ? 'login' : 'register');
                });
            }
        }, 0);

        // Form submit
        document.getElementById('auth-modal-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var username = this.username.value.trim();
            var password = this.password.value;
            var btn = document.getElementById('auth-submit-btn');
            var msgEl = document.getElementById('auth-message');

            btn.disabled = true;
            btn.textContent = mode === 'register' ? 'Creating...' : 'Logging in...';
            msgEl.textContent = '';

            var doAuth;
            if (mode === 'register') {
                doAuth = fetch('/api/user/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: username, password: password })
                }).then(function(res) {
                    return res.json().then(function(data) {
                        if (!res.ok) throw new Error(data.error || 'Registration failed');
                        return data;
                    });
                }).then(function() {
                    return fetch('/api/user/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: username, password: password })
                    }).then(function(res) {
                        return res.json().then(function(d) {
                            if (!res.ok) throw new Error(d.error || 'Login failed');
                            return d;
                        });
                    });
                });
            } else {
                doAuth = fetch('/api/user/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: username, password: password })
                }).then(function(res) {
                    return res.json().then(function(data) {
                        if (!res.ok) throw new Error(data.error || 'Login failed');
                        return data;
                    });
                });
            }

            doAuth.then(function(loginData) {
                saveAuthState(loginData.token, loginData.user);
                closeAuthModal();
                renderAccountBar();
                fetchAndRenderSheets();
            }).catch(function(err) {
                msgEl.textContent = err.message;
                msgEl.style.color = '#f87171';
                btn.disabled = false;
                btn.textContent = mode === 'register' ? '[CREATE ACCOUNT]' : '[LOG IN]';
            });
        });

        // Focus first input
        modal.querySelector('input[name="username"]').focus();
    }

    function closeAuthModal() {
        var modal = document.getElementById('auth-modal');
        if (modal) modal.remove();
    }

    // Close auth modal on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModal();
        }
    });

    // ============================
    // RENDER GRID
    // ============================
    function renderGrid() {
        sheetsGrid.innerHTML = '';

        var itemListElements = [];

        SHEETS.forEach(function(sheet, index) {
            var card = document.createElement('div');
            card.className = 'sheet-card';
            card.dataset.sheetId = sheet.id;

            var descSnippet = '<p class="sheet-description" style="opacity:0.6;font-size:0.8rem;margin-top:4px;">' + (sheet.description ? escapeHtml(sheet.description) : '&nbsp;') + '</p>';

            var priceBadge = '';
            if (sheet.owned) {
                priceBadge = '<span class="sheet-price-badge" style="background:rgba(74,222,128,0.15);color:#4ade80;">PURCHASED</span>';
            } else if (sheet.price > 0) {
                priceBadge = '<span class="sheet-price-badge paid">' + formatPrice(sheet.price) + '</span>';
            } else {
                priceBadge = '<span class="sheet-price-badge free">FREE</span>';
            }

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

            card.addEventListener('click', function(e) {
                e.preventDefault();
                openPreview(sheet);
            });

            sheetsGrid.appendChild(card);

            if (sheet.pdfUrl || sheet.previewUrl) {
                renderThumbnail(sheet);
            }

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

        var isPaid = sheet.price > 0 && !sheet.owned;

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

        var isPaid = sheet.price > 0 && !sheet.owned;

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

    previewCanvas.addEventListener('contextmenu', function(e) {
        if (currentPreviewSheet && currentPreviewSheet.price > 0 && !currentPreviewSheet.owned) {
            e.preventDefault();
        }
    });

    // ============================
    // MODAL
    // ============================
    function openPreview(sheet) {
        currentPreviewSheet = sheet;
        previewTitle.textContent = sheet.title;

        var fields = '';
        if (sheet.composer) fields += '<p class="preview-field"><span class="field-label">Composer:</span> ' + escapeHtml(sheet.composer) + '</p>';
        if (sheet.arrangement) fields += '<p class="preview-field"><span class="field-label">Arrangement:</span> ' + escapeHtml(sheet.arrangement) + '</p>';
        if (sheet.year) fields += '<p class="preview-field"><span class="field-label">Date:</span> ' + escapeHtml(sheet.year) + '</p>';
        if (sheet.pages) fields += '<p class="preview-field"><span class="field-label">Pages:</span> ' + escapeHtml(sheet.pages) + '</p>';

        previewFields.innerHTML = fields;

        previewDescription.textContent = sheet.description;
        previewDescription.style.display = sheet.description ? '' : 'none';

        var noticeEl = document.getElementById('preview-notice');
        if (sheet.owned) {
            noticeEl.textContent = 'PURCHASED — Full PDF access';
            noticeEl.style.display = '';
            noticeEl.style.color = '#4ade80';
            noticeEl.style.fontStyle = 'normal';
            noticeEl.style.letterSpacing = '1px';
        } else if (sheet.price > 0) {
            noticeEl.textContent = 'Page 1 preview only — purchase for full PDF';
            noticeEl.style.display = '';
            noticeEl.style.color = '';
            noticeEl.style.fontStyle = 'italic';
            noticeEl.style.letterSpacing = '';
        } else {
            noticeEl.style.display = 'none';
        }

        if (sheet.owned) {
            // PURCHASED: show download button
            buyNowBtn.style.display = 'none';
            downloadBtn.href = '/api/user/library/download/' + sheet.numericId;
            downloadBtn.setAttribute('download', '');
            downloadBtn.setAttribute('aria-label', 'Download ' + sheet.title + ' sheet music PDF');
            downloadBtn.style.opacity = '1';
            downloadBtn.textContent = '[DOWNLOAD PDF]';
            downloadBtn.className = 'action-btn download-btn';
            downloadBtn.onclick = function(e) {
                e.preventDefault();
                var a = document.createElement('a');
                fetch('/api/user/library/download/' + sheet.numericId, {
                    headers: getAuthHeaders()
                }).then(function(res) {
                    if (!res.ok) throw new Error('Download failed');
                    return res.blob();
                }).then(function(blob) {
                    var url = URL.createObjectURL(blob);
                    a.href = url;
                    a.download = sheet.title.replace(/[^a-zA-Z0-9 _-]/g, '') + '.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }).catch(function(err) {
                    alert('Download failed: ' + err.message);
                });
            };
            tipActionBtn.style.display = 'none';
        } else if (sheet.price > 0) {
            // PAID: show buy now + add to cart
            buyNowBtn.style.display = '';
            buyNowBtn.textContent = '[BUY NOW — ' + formatPrice(sheet.price) + ']';
            downloadBtn.onclick = null;
            updatePurchaseButton(sheet);
            tipActionBtn.style.display = 'none';
        } else {
            // FREE: show download + tip
            buyNowBtn.style.display = 'none';
            downloadBtn.onclick = null;
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

        renderFullPreview(sheet);

        previewModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Push slug URL for SEO and shareability
        if (sheet.id && window.history.pushState) {
            history.pushState({ sheetSlug: sheet.id }, '', '/sheets/' + encodeURIComponent(sheet.id));
        }
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

    var closingFromPopstate = false;

    function closePreview() {
        previewModal.classList.remove('active');
        document.body.style.overflow = '';
        previewCanvas.style.display = 'none';
        previewLoading.textContent = 'Loading preview...';
        previewLoading.classList.remove('hidden');

        // Restore original URL (skip if triggered by browser back button)
        if (!closingFromPopstate && window.history.pushState) {
            history.pushState(null, '', '/sheet-music.html');
        }
        closingFromPopstate = false;
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

    downloadBtn.addEventListener('click', function(e) {
        if (!currentPreviewSheet) return;

        // Skip if owned (handled by onclick above)
        if (currentPreviewSheet.owned) return;

        if (currentPreviewSheet.price > 0) {
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
            if (!downloadBtn.hasAttribute('download')) {
                e.preventDefault();
            }
        }
    });

    // Buy Now — direct checkout for a single sheet
    buyNowBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentPreviewSheet || !currentPreviewSheet.price) return;

        buyNowBtn.style.pointerEvents = 'none';
        buyNowBtn.textContent = '[PROCESSING...]';

        fetch('/api/purchase/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: [{ sheetId: currentPreviewSheet.numericId }],
                returnPath: window.location.pathname
            })
        })
        .then(function(res) {
            return res.json().then(function(data) {
                if (!res.ok) throw new Error(data.error || 'Something went wrong');
                return data;
            });
        })
        .then(function(data) {
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        })
        .catch(function(err) {
            alert('Checkout error: ' + err.message);
            buyNowBtn.style.pointerEvents = '';
            buyNowBtn.textContent = '[BUY NOW — ' + formatPrice(currentPreviewSheet.price) + ']';
        });
    });

    tipActionBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.openTipModal && tipActionBtn._tipSheet) {
            window.openTipModal(tipActionBtn._tipSheet);
        } else if (window.openTipModal) {
            window.openTipModal();
        }
    });

    var globalTipBtn = document.getElementById('global-tip-btn');
    if (globalTipBtn) {
        globalTipBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.openTipModal) {
                window.openTipModal();
            }
        });
    }

    document.addEventListener('cartchange', function() {
        if (currentPreviewSheet && currentPreviewSheet.price > 0 && !currentPreviewSheet.owned) {
            updatePurchaseButton(currentPreviewSheet);
        }
    });

    // ============================
    // FETCH & RENDER
    // ============================
    function fetchAndRenderSheets() {
        var headers = getAuthHeaders();

        fetch('/api/sheet-music', { headers: headers })
            .then(function(res) {
                // If auth token was rejected, clear it and retry without auth
                if (res.status === 401 && authToken) {
                    clearAuthState();
                    renderAccountBar();
                    return fetch('/api/sheet-music').then(function(r) { return r.json(); });
                }
                return res.json();
            })
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
                        previewUrl: s.previewUrl || '',
                        owned: s.owned || false,
                        visibility: s.visibility || 'public'
                    };
                });
                renderGrid();
                // Auto-open sheet if hash is present (e.g. /sheet-music.html#slug)
                openSheetFromHash();
            })
            .catch(function() {
                sheetsGrid.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load sheet music</div>';
            });
    }

    function openSheetFromHash() {
        var hash = window.location.hash.replace('#', '');
        if (!hash) return;
        var sheet = SHEETS.find(function(s) { return s.id === hash; });
        if (sheet) openPreview(sheet);
    }

    // Handle browser back/forward
    window.addEventListener('popstate', function() {
        if (previewModal.classList.contains('active')) {
            closingFromPopstate = true;
            closePreview();
        }
    });

    // Listen for auth changes from the global account widget (cart.js logout)
    document.addEventListener('userAuthChanged', function() {
        loadAuthState();
        fetchAndRenderSheets();
    });

    // ============================
    // INIT
    // ============================
    renderAccountBar();
    fetchAndRenderSheets();

})();
