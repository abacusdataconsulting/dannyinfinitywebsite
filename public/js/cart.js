/**
 * Cart — lightweight page-scoped shopping cart for paid sheet music
 *
 * Usage:
 *   window.sheetCart.add({ sheetId, title, priceCents })
 *   window.sheetCart.remove(sheetId)
 *   window.sheetCart.has(sheetId)
 *   window.sheetCart.items()
 *   window.sheetCart.count()
 *   window.sheetCart.checkout()
 */
(function() {
    'use strict';

    var cart = [];
    var overlay = null;
    var widget = null;

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatPrice(cents) {
        return '$' + (cents / 100).toFixed(2);
    }

    // ============================
    // WIDGET (floating cart button)
    // ============================
    function ensureWidget() {
        if (widget) return;
        widget = document.createElement('div');
        widget.className = 'cart-widget';
        widget.innerHTML =
            '<span class="cart-widget-icon">&#9733;</span>' +
            '<span class="cart-widget-count">0</span>';
        widget.addEventListener('click', openCartModal);
        document.body.appendChild(widget);
    }

    function updateWidget() {
        ensureWidget();
        var countEl = widget.querySelector('.cart-widget-count');
        countEl.textContent = cart.length;
        widget.classList.toggle('has-items', cart.length > 0);
    }

    // ============================
    // CART MODAL
    // ============================
    function ensureModal() {
        if (overlay) return;
        overlay = document.createElement('div');
        overlay.className = 'cart-modal-overlay';
        overlay.innerHTML =
            '<div class="cart-modal">' +
                '<button class="cart-modal-close">&times;</button>' +
                '<div class="cart-modal-title">YOUR CART</div>' +
                '<div class="cart-items-list"></div>' +
                '<div class="cart-total"></div>' +
                '<button class="cart-checkout-btn" disabled>[CHECKOUT]</button>' +
                '<div class="cart-error"></div>' +
            '</div>';

        document.body.appendChild(overlay);

        overlay.querySelector('.cart-modal-close').addEventListener('click', closeCartModal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeCartModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
                closeCartModal();
            }
        });
        overlay.querySelector('.cart-checkout-btn').addEventListener('click', handleCheckout);
    }

    function renderCartModal() {
        ensureModal();
        var listEl = overlay.querySelector('.cart-items-list');
        var totalEl = overlay.querySelector('.cart-total');
        var checkoutBtn = overlay.querySelector('.cart-checkout-btn');
        var errorEl = overlay.querySelector('.cart-error');
        errorEl.textContent = '';

        listEl.innerHTML = '';

        if (cart.length === 0) {
            listEl.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
            totalEl.textContent = '';
            checkoutBtn.disabled = true;
            return;
        }

        var total = 0;
        cart.forEach(function(item) {
            total += item.priceCents;
            var row = document.createElement('div');
            row.className = 'cart-item';
            row.innerHTML =
                '<span class="cart-item-title">' + escapeHtml(item.title) + '</span>' +
                '<span class="cart-item-price">' + formatPrice(item.priceCents) + '</span>' +
                '<button class="cart-item-remove" data-id="' + item.sheetId + '">&times;</button>';
            row.querySelector('.cart-item-remove').addEventListener('click', function() {
                removeFromCart(item.sheetId);
                renderCartModal();
            });
            listEl.appendChild(row);
        });

        totalEl.innerHTML = '<span>Total:</span> <strong>' + formatPrice(total) + '</strong>';
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = '[CHECKOUT — ' + formatPrice(total) + ']';
    }

    function openCartModal() {
        ensureModal();
        renderCartModal();
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeCartModal() {
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ============================
    // CART OPERATIONS
    // ============================
    function addToCart(item) {
        if (hasInCart(item.sheetId)) return;
        cart.push({
            sheetId: item.sheetId,
            title: item.title,
            priceCents: item.priceCents
        });
        updateWidget();
        fireChange();
    }

    function removeFromCart(sheetId) {
        cart = cart.filter(function(i) { return i.sheetId !== sheetId; });
        updateWidget();
        fireChange();
    }

    function hasInCart(sheetId) {
        return cart.some(function(i) { return i.sheetId === sheetId; });
    }

    function fireChange() {
        document.dispatchEvent(new CustomEvent('cartchange', { detail: { cart: cart } }));
    }

    // ============================
    // CHECKOUT
    // ============================
    function handleCheckout() {
        if (cart.length === 0) return;

        var checkoutBtn = overlay.querySelector('.cart-checkout-btn');
        var errorEl = overlay.querySelector('.cart-error');
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = '[PROCESSING...]';
        errorEl.textContent = '';

        var payload = {
            items: cart.map(function(i) { return { sheetId: i.sheetId }; }),
            returnPath: window.location.pathname
        };

        fetch('/api/purchase/create-session', {
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
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = '[CHECKOUT]';
        });
    }

    // ============================
    // PUBLIC API
    // ============================
    window.sheetCart = {
        add: addToCart,
        remove: removeFromCart,
        has: hasInCart,
        toggle: function(item) {
            if (hasInCart(item.sheetId)) {
                removeFromCart(item.sheetId);
            } else {
                addToCart(item);
            }
        },
        items: function() { return cart.slice(); },
        count: function() { return cart.length; },
        checkout: handleCheckout,
        openModal: openCartModal
    };

    updateWidget();
})();
