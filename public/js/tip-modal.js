/**
 * Tip Modal — Shared, page-agnostic tipping component
 *
 * Usage on any page:
 *   1. Include css/tip-modal.css in <head>
 *   2. Include js/tip-modal.js before </body>
 *   3. Call: openTipModal({ sheetMusicId: 123, sheetTitle: 'My Song' })
 *      or:  openTipModal()  — for a generic tip with no sheet association
 */
(function() {
    'use strict';

    var PRESETS = [
        { cents: 500,  label: '$5',  priceId: 'price_1TRZ6kHHtHBqUIGao40NEFos' },
        { cents: 1000, label: '$10', priceId: 'price_1TRZ7DHHtHBqUIGasXNJabWH' },
        { cents: 2500, label: '$25', priceId: 'price_1TRZ7iHHtHBqUIGaTdrasWn9' }
    ];
    var CUSTOM_TIP_PRICE_ID = 'price_1TRYyIHHtHBqUIGaGOihMBz4';
    var overlay = null;
    var selectedAmount = null;
    var selectedPriceId = null;
    var currentOptions = {};

    // ============================
    // BUILD MODAL DOM (once, lazily)
    // ============================
    function ensureModal() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.className = 'tip-modal-overlay';
        overlay.innerHTML =
            '<div class="tip-modal">' +
                '<button class="tip-modal-close">&times;</button>' +
                '<div class="tip-modal-title">LEAVE A TIP</div>' +
                '<div class="tip-modal-subtitle">Support the Music</div>' +
                '<div class="tip-amounts"></div>' +
                '<div class="tip-custom-row">' +
                    '<span class="tip-custom-label">$</span>' +
                    '<input type="number" class="tip-custom-input" placeholder="0.00" min="1" max="1000" step="0.01">' +
                '</div>' +
                '<button class="tip-submit-btn" disabled>[CONTINUE TO CHECKOUT]</button>' +
                '<div class="tip-error"></div>' +
            '</div>';

        document.body.appendChild(overlay);

        // Render preset buttons
        var amountsContainer = overlay.querySelector('.tip-amounts');
        PRESETS.forEach(function(preset) {
            var btn = document.createElement('button');
            btn.className = 'tip-amount-btn';
            btn.textContent = preset.label;
            btn.dataset.amount = preset.cents;
            btn.dataset.priceId = preset.priceId;
            btn.addEventListener('click', function() {
                selectPreset(preset);
            });
            amountsContainer.appendChild(btn);
        });

        // Custom input
        var customInput = overlay.querySelector('.tip-custom-input');
        customInput.addEventListener('input', function() {
            var presetBtns = overlay.querySelectorAll('.tip-amount-btn');
            for (var i = 0; i < presetBtns.length; i++) {
                presetBtns[i].classList.remove('selected');
            }
            var val = parseFloat(customInput.value);
            if (val && val >= 1 && val <= 1000) {
                selectedAmount = Math.round(val * 100);
                selectedPriceId = CUSTOM_TIP_PRICE_ID;
                overlay.querySelector('.tip-submit-btn').disabled = false;
            } else {
                selectedAmount = null;
                selectedPriceId = null;
                overlay.querySelector('.tip-submit-btn').disabled = true;
            }
            overlay.querySelector('.tip-error').textContent = '';
        });

        // Close handlers
        overlay.querySelector('.tip-modal-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
                closeModal();
            }
        });

        // Submit
        overlay.querySelector('.tip-submit-btn').addEventListener('click', handleSubmit);
    }

    function selectPreset(preset) {
        selectedAmount = preset.cents;
        selectedPriceId = preset.priceId;
        var presetBtns = overlay.querySelectorAll('.tip-amount-btn');
        for (var i = 0; i < presetBtns.length; i++) {
            if (parseInt(presetBtns[i].dataset.amount) === preset.cents) {
                presetBtns[i].classList.add('selected');
            } else {
                presetBtns[i].classList.remove('selected');
            }
        }
        overlay.querySelector('.tip-custom-input').value = '';
        overlay.querySelector('.tip-submit-btn').disabled = false;
        overlay.querySelector('.tip-error').textContent = '';
    }

    // ============================
    // OPEN / CLOSE
    // ============================
    function openModal(options) {
        ensureModal();
        options = options || {};
        currentOptions = options;

        // Reset state
        selectedAmount = null;
        selectedPriceId = null;
        var presetBtns = overlay.querySelectorAll('.tip-amount-btn');
        for (var i = 0; i < presetBtns.length; i++) {
            presetBtns[i].classList.remove('selected');
        }
        overlay.querySelector('.tip-custom-input').value = '';
        overlay.querySelector('.tip-submit-btn').disabled = true;
        overlay.querySelector('.tip-submit-btn').textContent = '[CONTINUE TO CHECKOUT]';
        overlay.querySelector('.tip-error').textContent = '';

        // Set subtitle
        var subtitle = options.sheetTitle
            ? 'for \u201C' + options.sheetTitle + '\u201D'
            : 'Support the Music';
        overlay.querySelector('.tip-modal-subtitle').textContent = subtitle;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ============================
    // SUBMIT
    // ============================
    function handleSubmit() {
        if (!selectedAmount) return;

        var submitBtn = overlay.querySelector('.tip-submit-btn');
        var errorEl = overlay.querySelector('.tip-error');
        submitBtn.disabled = true;
        submitBtn.textContent = '[PROCESSING...]';
        errorEl.textContent = '';

        // Strip any existing ?tip=success from return path
        var returnPath = window.location.pathname +
            window.location.search.replace(/[?&]tip=success/g, '').replace(/^\?$/, '');

        var payload = {
            amount: selectedAmount,
            priceId: selectedPriceId,
            returnPath: returnPath
        };

        if (currentOptions.sheetMusicId) {
            payload.sheetMusicId = currentOptions.sheetMusicId;
        }
        if (currentOptions.sheetTitle) {
            payload.sheetTitle = currentOptions.sheetTitle;
        }

        fetch('/api/tip/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
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
            errorEl.textContent = err.message || 'Failed to start checkout';
            submitBtn.disabled = false;
            submitBtn.textContent = '[CONTINUE TO CHECKOUT]';
        });
    }

    // ============================
    // SUCCESS BANNER
    // ============================
    function checkSuccess() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('tip') !== 'success') return;

        // Clean URL without reload
        params.delete('tip');
        var remaining = params.toString();
        var cleanUrl = window.location.pathname + (remaining ? '?' + remaining : '');
        history.replaceState(null, '', cleanUrl);

        // Show banner
        var banner = document.createElement('div');
        banner.className = 'tip-success-banner';
        banner.innerHTML =
            '&#9829; Thank you for your generous tip!' +
            '<button class="banner-close">&times;</button>';
        document.body.appendChild(banner);

        banner.querySelector('.banner-close').addEventListener('click', function() {
            banner.remove();
        });

        setTimeout(function() {
            if (banner.parentNode) banner.remove();
        }, 8000);
    }

    checkSuccess();

    // ============================
    // PUBLIC API
    // ============================
    window.openTipModal = openModal;

})();
