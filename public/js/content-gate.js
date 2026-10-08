/**
 * ContentGate — shared "sign in to see more" prompt for media pages.
 * When a public list API returns { locked: true, total, previewCount },
 * call window.ContentGate.render(container, { total, label }) to append
 * the prompt below the preview items.
 */
(function() {
    'use strict';

    function render(container, opts) {
        if (!container) return null;
        opts = opts || {};

        // Only one gate per container
        var existing = container.querySelector(':scope > .content-gate');
        if (existing) existing.remove();

        var returnTo = window.location.pathname + window.location.search;

        var gate = document.createElement('div');
        gate.className = 'content-gate';

        var inner = document.createElement('div');
        inner.className = 'content-gate-inner';

        var level = opts.requiredLevel || 'logged_in';
        var titles = {
            subscriber: 'SUBSCRIBERS ONLY',
            vip: 'VIP ONLY',
        };
        var title = document.createElement('div');
        title.className = 'content-gate-title';
        title.textContent = titles[level] || 'MEMBERS ONLY';
        inner.appendChild(title);

        var text = document.createElement('p');
        text.className = 'content-gate-text';
        var label = opts.label || 'items';
        var suffix = titles[level] ? ' (requires a ' + (level === 'vip' ? 'VIP' : 'subscriber') + ' account)' : '';
        text.textContent = (opts.total
            ? 'Sign in to view all ' + opts.total + ' ' + label
            : 'Sign in to view the rest') + suffix;
        inner.appendChild(text);

        var btn = document.createElement('a');
        btn.className = 'content-gate-btn';
        btn.href = 'index.html?return=' + encodeURIComponent(returnTo);
        btn.textContent = '[SIGN IN]';
        inner.appendChild(btn);

        gate.appendChild(inner);
        container.appendChild(gate);
        return gate;
    }

    window.ContentGate = { render: render };
})();
