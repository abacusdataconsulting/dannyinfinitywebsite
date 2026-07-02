/**
 * Shared comments widget.
 *
 * Usage:  window.Comments.mount(containerEl, { type, id, pageSize });
 *   type    — 'album' | 'video' | 'photo' | 'blog'
 *   id      — numeric content id
 *   pageSize — comments per chunk (default 10)
 *
 * Rendering adapts to the section's admin settings returned by the API:
 *   isVisible=false        -> nothing is shown
 *   postMode 'open'        -> name + comment form
 *   postMode 'logged_in'   -> form only when signed in, otherwise a prompt
 *   postMode 'closed'      -> existing comments shown, no form
 */
(function () {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Remember an anonymous commenter's name so we can pre-fill it next time
    function storedName() {
        try { return localStorage.getItem('di_comment_name') || ''; } catch (e) { return ''; }
    }
    function saveName(name) {
        try { localStorage.setItem('di_comment_name', name); } catch (e) { /* ignore */ }
    }

    function formatDate(raw) {
        if (!raw) return '';
        // SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS"
        var d = new Date(String(raw).replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return escapeHtml(raw);
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function commentHtml(comment) {
        return '<div class="comment-item">' +
            '<div class="comment-meta">' +
                '<span class="comment-author">' + escapeHtml(comment.author_name) + '</span>' +
                '<span class="comment-date">' + formatDate(comment.created_at) + '</span>' +
            '</div>' +
            '<div class="comment-body">' + escapeHtml(comment.body) + '</div>' +
        '</div>';
    }

    function mount(container, opts) {
        if (!container) return;
        var type = opts.type;
        var id = opts.id;
        var pageSize = opts.pageSize || 10;

        var state = { offset: 0, total: 0, loaded: 0, settings: null, loggedIn: false, busy: false };

        container.innerHTML = '<div class="comments-widget"><div class="comments-loading">Loading comments…</div></div>';
        var widget = container.querySelector('.comments-widget');

        function apiUrl(offset) {
            return '/api/comments?type=' + encodeURIComponent(type) + '&id=' + encodeURIComponent(id) +
                '&limit=' + pageSize + '&offset=' + offset;
        }

        function renderShell() {
            var s = state.settings;

            // Section hidden by admin — render nothing at all
            if (!s || !s.isVisible) {
                container.innerHTML = '';
                return false;
            }

            var formArea;
            if (s.postMode === 'closed') {
                formArea = '<p class="comments-note">Comments are closed.</p>';
            } else if (s.postMode === 'logged_in' && !state.loggedIn) {
                formArea = '<p class="comments-note">Please <a href="/home.html">sign in</a> to leave a comment.</p>';
            } else {
                // Name is pre-filled for logged-in users (handled server-side, no field)
                // or from a remembered name for returning anonymous commenters.
                var known = (s.postMode === 'logged_in') ? '' : storedName();
                var nameField = (s.postMode === 'logged_in')
                    ? ''
                    : '<input type="text" class="comment-name" maxlength="60" placeholder="YOUR_NAME" aria-label="Your name" value="' + escapeHtml(known) + '">';
                // Collapsed by default: a one-line trigger that expands into the full form
                formArea =
                    '<div class="comment-compose">' +
                        '<button type="button" class="comment-add-trigger">+ ADD A COMMENT</button>' +
                        '<form class="comment-form" hidden>' +
                            nameField +
                            '<textarea class="comment-text" maxlength="2000" rows="3" placeholder="ADD_A_COMMENT..." aria-label="Your comment"></textarea>' +
                            '<div class="comment-form-row">' +
                                '<span class="comment-form-msg" role="status"></span>' +
                                '<button type="submit" class="comment-submit" hidden>POST</button>' +
                            '</div>' +
                        '</form>' +
                    '</div>';
            }

            widget.innerHTML =
                '<div class="comments-header">&gt; COMMENTS <span class="comments-count">[' + state.total + ']</span></div>' +
                formArea +
                '<div class="comments-list"></div>' +
                '<button class="comments-more" type="button" hidden>VIEW MORE</button>';

            var form = widget.querySelector('.comment-form');
            if (form) {
                form.addEventListener('submit', onSubmit);
                // POST button only appears once the visitor has typed something
                var textEl = form.querySelector('.comment-text');
                var submitEl = form.querySelector('.comment-submit');
                if (textEl && submitEl) {
                    textEl.addEventListener('input', function () {
                        submitEl.hidden = !textEl.value.trim();
                    });
                }
            }
            var trigger = widget.querySelector('.comment-add-trigger');
            if (trigger && form) {
                trigger.addEventListener('click', function () {
                    trigger.hidden = true;
                    form.hidden = false;
                    var nameEl = form.querySelector('.comment-name');
                    // Jump straight to the comment box if we already know the name
                    var focusEl = (nameEl && !nameEl.value.trim()) ? nameEl : form.querySelector('.comment-text');
                    if (focusEl) focusEl.focus();
                });
            }
            var moreBtn = widget.querySelector('.comments-more');
            moreBtn.addEventListener('click', function () { loadMore(); });
            return true;
        }

        function renderMoreButton() {
            var moreBtn = widget.querySelector('.comments-more');
            if (moreBtn) moreBtn.hidden = state.loaded >= state.total;
        }

        function appendComments(list) {
            var listEl = widget.querySelector('.comments-list');
            if (state.loaded === 0 && (!list || list.length === 0)) {
                listEl.innerHTML = '<p class="comments-empty">No comments yet. Be the first.</p>';
                return;
            }
            var empty = listEl.querySelector('.comments-empty');
            if (empty) empty.remove();
            list.forEach(function (comment) {
                listEl.insertAdjacentHTML('beforeend', commentHtml(comment));
            });
        }

        function loadMore() {
            if (state.busy) return;
            state.busy = true;
            fetch(apiUrl(state.offset))
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    state.total = data.total || 0;
                    var count = widget.querySelector('.comments-count');
                    if (count) count.textContent = '[' + state.total + ']';
                    appendComments(data.comments || []);
                    state.loaded += (data.comments || []).length;
                    state.offset += (data.comments || []).length;
                    renderMoreButton();
                })
                .catch(function () { /* leave existing content */ })
                .then(function () { state.busy = false; });
        }

        function onSubmit(e) {
            e.preventDefault();
            var form = e.currentTarget;
            var nameEl = form.querySelector('.comment-name');
            var textEl = form.querySelector('.comment-text');
            var msgEl = form.querySelector('.comment-form-msg');
            var submitBtn = form.querySelector('.comment-submit');
            var text = (textEl.value || '').trim();
            var name = nameEl ? (nameEl.value || '').trim() : '';

            msgEl.className = 'comment-form-msg';
            if (!text) { msgEl.textContent = 'Write something first.'; return; }
            if (nameEl && !name) { msgEl.textContent = 'Enter a name.'; return; }

            submitBtn.disabled = true;
            msgEl.textContent = 'Posting…';

            fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type, id: id, name: name, body: text }),
            })
                .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, status: res.status, data: d }; }); })
                .then(function (r) {
                    if (r.ok && r.data.comment) {
                        if (nameEl && name) saveName(name);
                        var listEl = widget.querySelector('.comments-list');
                        var empty = listEl.querySelector('.comments-empty');
                        if (empty) empty.remove();
                        listEl.insertAdjacentHTML('afterbegin', commentHtml(r.data.comment));
                        state.total += 1;
                        state.loaded += 1;
                        state.offset += 1;
                        var count = widget.querySelector('.comments-count');
                        if (count) count.textContent = '[' + state.total + ']';
                        textEl.value = '';
                        submitBtn.hidden = true;
                        msgEl.className = 'comment-form-msg success';
                        msgEl.textContent = 'Posted.';
                    } else {
                        msgEl.className = 'comment-form-msg error';
                        msgEl.textContent = (r.data && r.data.error) ? r.data.error : "Couldn't post your comment.";
                    }
                })
                .catch(function () {
                    msgEl.className = 'comment-form-msg error';
                    msgEl.textContent = 'Network error. Try again.';
                })
                .then(function () { submitBtn.disabled = false; });
        }

        // Initial load
        fetch(apiUrl(0))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                state.settings = data.settings || { postMode: 'open', isVisible: true };
                state.loggedIn = !!data.loggedIn;
                state.total = data.total || 0;
                if (!renderShell()) return; // hidden section
                appendComments(data.comments || []);
                state.loaded = (data.comments || []).length;
                state.offset = (data.comments || []).length;
                renderMoreButton();
            })
            .catch(function () {
                container.innerHTML = '<div class="comments-widget"><p class="comments-note">Comments unavailable.</p></div>';
            });
    }

    window.Comments = { mount: mount };
})();
