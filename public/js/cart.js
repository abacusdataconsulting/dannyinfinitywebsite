/**
 * Cart — session-persistent shopping cart for paid sheet music
 * Injects a [CART] link into the site-nav on every page.
 * Cart data persists across pages via sessionStorage.
 *
 * Usage:
 *   window.sheetCart.add({ sheetId, title, priceCents })
 *   window.sheetCart.remove(sheetId)
 *   window.sheetCart.has(sheetId)
 *   window.sheetCart.items()
 *   window.sheetCart.count()
 *   window.sheetCart.checkout()
 *   window.sheetCart.openModal()
 */
(function() {
    'use strict';

    var STORAGE_KEY = 'sheetCart';
    var cart = loadCart();
    var overlay = null;
    var navLink = null;
    var floatingBtn = null;

    function loadCart() {
        try {
            var data = sessionStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveCart() {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }
        catch (e) { /* quota exceeded */ }
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatPrice(cents) {
        return '$' + (cents / 100).toFixed(2);
    }

    // ============================
    // NAV LINK (injected into site-nav)
    // ============================
    function ensureNavLink() {
        if (navLink) return;
        var nav = document.querySelector('.site-nav');
        if (!nav) return;

        navLink = document.createElement('a');
        navLink.href = '#';
        navLink.className = 'nav-link cart-nav-link';
        navLink.innerHTML = '<span class="cart-nav-text">CART</span> <span class="cart-nav-count">(0)</span>';
        navLink.addEventListener('click', function(e) {
            e.preventDefault();
            openCartModal();
        });
        nav.appendChild(navLink);
    }

    function updateNavLink() {
        ensureNavLink();
        if (!navLink) return;
        var countEl = navLink.querySelector('.cart-nav-count');
        countEl.textContent = '(' + cart.length + ')';
        navLink.classList.toggle('cart-has-items', cart.length > 0);
    }

    // ============================
    // FLOATING CHECKOUT BUTTON (sheets page only)
    // ============================
    function ensureFloatingBtn() {
        if (floatingBtn) return;
        // Only show on sheets page
        if (window.location.pathname.indexOf('sheet-music') === -1) return;

        floatingBtn = document.createElement('button');
        floatingBtn.className = 'cart-floating-btn';
        floatingBtn.innerHTML = '[CHECKOUT <span class="cart-floating-count">(0)</span>]';
        floatingBtn.addEventListener('click', openCartModal);
        document.body.appendChild(floatingBtn);
    }

    function updateFloatingBtn() {
        ensureFloatingBtn();
        if (!floatingBtn) return;
        var countEl = floatingBtn.querySelector('.cart-floating-count');
        countEl.textContent = '(' + cart.length + ')';
        floatingBtn.classList.toggle('visible', cart.length > 0);
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
            checkoutBtn.textContent = '[CHECKOUT]';
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
        saveCart();
        updateNavLink();
        updateFloatingBtn();
        fireChange();
    }

    function removeFromCart(sheetId) {
        cart = cart.filter(function(i) { return i.sheetId !== sheetId; });
        saveCart();
        updateNavLink();
        updateFloatingBtn();
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
                // Clear cart on successful checkout redirect
                cart = [];
                saveCart();
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

    // ============================
    // GLOBAL ACCOUNT LINK (injected into site-nav, to the left of cart)
    // ============================
    var accountLink = null;

    function getStoredUser() {
        try {
            var token = localStorage.getItem('userAuthToken');
            var data = localStorage.getItem('userData');
            if (token && data) return { token: token, user: JSON.parse(data) };
        } catch (e) {}
        return null;
    }

    function ensureAccountLink() {
        if (accountLink) return;
        var nav = document.querySelector('.site-nav');
        if (!nav) return;

        var auth = getStoredUser();
        if (!auth) return;

        accountLink = document.createElement('a');
        accountLink.href = '#';
        accountLink.className = 'nav-link account-nav-link';
        accountLink.textContent = auth.user.name.toUpperCase();
        accountLink.style.opacity = '0.7';
        accountLink.addEventListener('click', function(e) {
            e.preventDefault();
            openAccountModal();
        });

        // Insert before cart link
        if (navLink) {
            nav.insertBefore(accountLink, navLink);
        } else {
            nav.appendChild(accountLink);
        }
    }

    function openAccountModal() {
        var existing = document.getElementById('account-modal');
        if (existing) existing.remove();

        var auth = getStoredUser();
        if (!auth) return;

        var modal = document.createElement('div');
        modal.id = 'account-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;';

        modal.innerHTML =
            '<div style="background:var(--bg-primary);border:1px solid var(--border-color);padding:35px;max-width:400px;width:90%;position:relative;">' +
                '<button id="acct-modal-close" style="position:absolute;top:10px;right:15px;background:none;border:none;color:var(--text-primary);font-size:1.5rem;cursor:pointer;font-family:inherit;">&times;</button>' +
                '<h2 style="text-align:center;letter-spacing:2px;margin-bottom:6px;font-size:1.1rem;">Account</h2>' +
                '<p style="text-align:center;opacity:0.6;font-size:0.85rem;margin-bottom:25px;">Logged in as <strong>' + escapeHtml(auth.user.name) + '</strong></p>' +
                '<form id="acct-pw-form" style="display:flex;flex-direction:column;gap:12px;">' +
                    '<label style="font-size:0.8rem;letter-spacing:1px;opacity:0.6;">Change Password</label>' +
                    '<input type="password" name="current" placeholder="Current password" required autocomplete="current-password" style="padding:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:1px;">' +
                    '<input type="password" name="newpw" placeholder="New password (min 4 chars)" required minlength="4" autocomplete="new-password" style="padding:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:1px;">' +
                    '<button type="submit" id="acct-pw-btn" style="padding:14px;border:2px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.9rem;letter-spacing:2px;cursor:pointer;transition:all 0.2s;">[UPDATE PASSWORD]</button>' +
                '</form>' +
                '<div id="acct-message" style="text-align:center;font-size:0.8rem;padding:8px 0;letter-spacing:1px;min-height:20px;"></div>' +
                '<hr style="border:none;border-top:1px solid var(--border-color);margin:15px 0;">' +
                '<button id="acct-logout-btn" style="width:100%;padding:12px;border:1px solid var(--border-color);background:transparent;color:var(--text-primary);font-family:inherit;font-size:0.85rem;letter-spacing:2px;cursor:pointer;opacity:0.6;transition:all 0.2s;">[LOG OUT]</button>' +
            '</div>';

        document.body.appendChild(modal);

        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.getElementById('acct-modal-close').addEventListener('click', function() { modal.remove(); });

        // Change password
        document.getElementById('acct-pw-form').addEventListener('submit', function(e) {
            e.preventDefault();
            var currentPw = this.current.value;
            var newPw = this.newpw.value;
            var btn = document.getElementById('acct-pw-btn');
            var msg = document.getElementById('acct-message');
            btn.disabled = true;
            btn.textContent = 'Updating...';
            msg.textContent = '';

            // Verify current password by logging in
            fetch('/api/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: auth.user.name, password: currentPw })
            })
            .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
            .then(function(result) {
                if (!result.ok) throw new Error('Current password is incorrect');
                // Now register with new password by using the check flow
                // Actually we need a password change endpoint. Let's use login + re-register approach.
                // We'll call the user register endpoint — but user already exists.
                // Best approach: log in (verified above), then we need a change-password endpoint.
                // For now, the simplest safe approach: just tell them to contact admin if no endpoint exists.
                // Actually, let me just add an API call for self-password-change.
                return fetch('/api/user/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + result.data.token
                    },
                    body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
                });
            })
            .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
            .then(function(result) {
                if (!result.ok) throw new Error(result.data.error || 'Failed to update password');
                msg.textContent = 'Password updated!';
                msg.style.color = '#4ade80';
                btn.textContent = '[UPDATE PASSWORD]';
                btn.disabled = false;
                e.target.reset();
            })
            .catch(function(err) {
                msg.textContent = err.message;
                msg.style.color = '#f87171';
                btn.textContent = '[UPDATE PASSWORD]';
                btn.disabled = false;
            });
        });

        // Logout
        document.getElementById('acct-logout-btn').addEventListener('click', function() {
            var token = localStorage.getItem('userAuthToken');
            if (token) {
                fetch('/api/user/logout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                }).catch(function() {});
            }
            localStorage.removeItem('userAuthToken');
            localStorage.removeItem('userData');
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('user');
            modal.remove();
            if (accountLink) { accountLink.remove(); accountLink = null; }
            // Dispatch event so sheet-music.js can re-fetch
            document.dispatchEvent(new CustomEvent('userAuthChanged'));
            window.location.reload();
        });

        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', handler); }
        });
    }

    // Expose for other scripts
    window.openAccountModal = openAccountModal;

    // Init: inject nav link, floating button, account link
    updateNavLink();
    ensureAccountLink();
    updateFloatingBtn();
})();

