/**
 * Streaming page — YouTube embed, polled live chat, viewer presence.
 * Chat polls /api/streaming/chat every ~4s while the tab is visible;
 * presence heartbeats every 30s. All user content hits the DOM via
 * textContent only.
 */
(function() {
    'use strict';

    var CHAT_POLL_MS = 4000;
    var PRESENCE_MS = 30000;

    // DOM
    var liveBadge = document.getElementById('live-badge');
    var streamTitle = document.getElementById('stream-title');
    var streamPlayer = document.getElementById('stream-player');
    var viewersCount = document.getElementById('viewers-count');
    var viewersList = document.getElementById('viewers-list');
    var chatMessages = document.getElementById('chat-messages');
    var chatForm = document.getElementById('chat-form');
    var chatInput = document.getElementById('chat-input');
    var chatSend = document.getElementById('chat-send');
    var chatNote = document.getElementById('chat-note');
    var newPill = document.getElementById('chat-new-pill');
    var loginDialog = document.getElementById('login-dialog');

    // State
    var info = null;
    var lastId = 0;
    var seenIds = {};
    var chatTimer = null;
    var presenceTimer = null;
    var polling = false;

    document.getElementById('current-year').textContent = new Date().getFullYear();

    var TIER_CHIP_LABELS = {
        subscriber: 'SUB',
        vip: 'VIP',
        admin: 'ADMIN',
        super_admin: 'ADMIN',
    };

    // ============================
    // PLAYER
    // ============================
    function renderPlayer() {
        streamPlayer.innerHTML = '';

        var src = null;
        if (info.mode === 'video' && info.videoId) {
            src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(info.videoId) + '?autoplay=1&mute=1';
        } else if (info.mode === 'channel_live' && info.channelId) {
            src = 'https://www.youtube.com/embed/live_stream?channel=' + encodeURIComponent(info.channelId) + '&autoplay=1&mute=1';
        }

        if (src) {
            var iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.allowFullscreen = true;
            iframe.title = info.title || 'Live stream';
            streamPlayer.appendChild(iframe);
        } else {
            // Branded offline screen
            var offline = document.createElement('div');
            offline.className = 'stream-offline';

            var mark = document.createElement('div');
            mark.className = 'stream-offline-mark';
            mark.innerHTML = '&#8734;';
            offline.appendChild(mark);

            var brand = document.createElement('div');
            brand.className = 'stream-offline-brand';
            brand.textContent = 'DANNY';
            var accent = document.createElement('span');
            accent.className = 'logo-accent';
            accent.textContent = 'INFINITY';
            brand.appendChild(accent);
            offline.appendChild(brand);

            var label = document.createElement('div');
            label.className = 'stream-offline-label';
            label.textContent = 'STREAM OFFLINE';
            offline.appendChild(label);

            var text = document.createElement('p');
            text.className = 'stream-offline-text';
            text.textContent = info.offlineMessage || 'Check back soon!';
            offline.appendChild(text);

            streamPlayer.appendChild(offline);
        }

        streamTitle.textContent = info.title || '';
        liveBadge.classList.toggle('hidden', !info.isLive);
    }

    // ============================
    // CHAT RENDERING
    // ============================
    function isNearBottom() {
        return chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 60;
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        newPill.classList.add('hidden');
    }

    function formatTime(createdAt) {
        try {
            // D1 timestamps are UTC without a zone suffix
            var iso = String(createdAt);
            if (iso.indexOf('T') === -1) iso = iso.replace(' ', 'T');
            if (!/Z$|[+-]\d\d:?\d\d$/.test(iso)) iso += 'Z';
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    }

    function buildMessageEl(msg) {
        var el = document.createElement('div');
        el.className = 'chat-msg';
        el.dataset.msgId = msg.id;

        var time = document.createElement('span');
        time.className = 'chat-msg-time';
        time.textContent = formatTime(msg.createdAt);
        el.appendChild(time);

        var chipLabel = TIER_CHIP_LABELS[msg.tier];
        if (chipLabel) {
            var chip = document.createElement('span');
            chip.className = 'tier-chip tier-' + msg.tier;
            chip.textContent = chipLabel;
            el.appendChild(chip);
        }

        var name = document.createElement('span');
        name.className = 'chat-msg-name';
        name.textContent = msg.name;
        el.appendChild(name);

        var body = document.createElement('span');
        body.className = 'chat-msg-body';
        body.textContent = msg.body;
        el.appendChild(body);

        if (info && info.isAdmin) {
            var actions = document.createElement('div');
            actions.className = 'chat-mod-actions';

            var hideBtn = document.createElement('button');
            hideBtn.className = 'chat-mod-btn';
            hideBtn.type = 'button';
            hideBtn.textContent = 'HIDE';
            hideBtn.addEventListener('click', function() {
                fetch('/api/admin/streaming/chat/' + msg.id + '/hide', { method: 'PUT', headers: { 'Content-Type': 'application/json' } })
                    .then(function() { el.remove(); })
                    .catch(function() {});
            });
            actions.appendChild(hideBtn);

            var muteBtn = document.createElement('button');
            muteBtn.className = 'chat-mod-btn';
            muteBtn.type = 'button';
            muteBtn.textContent = 'MUTE 1H';
            muteBtn.addEventListener('click', function() {
                if (!confirm('Mute ' + msg.name + ' for 1 hour?')) return;
                fetch('/api/admin/streaming/bans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetType: 'user', value: msg.name, type: 'mute', durationMinutes: 60 })
                }).catch(function() {});
            });
            actions.appendChild(muteBtn);

            var banBtn = document.createElement('button');
            banBtn.className = 'chat-mod-btn';
            banBtn.type = 'button';
            banBtn.textContent = 'BAN';
            banBtn.addEventListener('click', function() {
                if (!confirm('Permanently ban ' + msg.name + ' from chat?')) return;
                fetch('/api/admin/streaming/bans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetType: 'user', value: msg.name, type: 'ban' })
                }).catch(function() {});
            });
            actions.appendChild(banBtn);

            el.appendChild(actions);
        }

        return el;
    }

    function appendMessages(messages) {
        if (!messages.length) return;
        var stick = isNearBottom();

        messages.forEach(function(msg) {
            if (seenIds[msg.id]) return;
            seenIds[msg.id] = true;
            chatMessages.appendChild(buildMessageEl(msg));
            if (msg.id > lastId) lastId = msg.id;
        });

        // Bound the DOM: keep the latest 200 messages
        while (chatMessages.children.length > 200) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        if (stick) {
            scrollToBottom();
        } else {
            newPill.classList.remove('hidden');
        }
    }

    // ============================
    // CHAT POLLING
    // ============================
    function pollChat() {
        fetch('/api/streaming/chat?since=' + lastId + '&limit=50')
            .then(function(res) { return res.ok ? res.json() : null; })
            .then(function(data) {
                if (data && data.messages) {
                    appendMessages(data.messages);
                    if (data.latestId > lastId) lastId = data.latestId;
                }
            })
            .catch(function() {})
            .then(scheduleChatPoll);
    }

    function scheduleChatPoll() {
        clearTimeout(chatTimer);
        if (document.visibilityState !== 'visible') { polling = false; return; }
        polling = true;
        chatTimer = setTimeout(pollChat, CHAT_POLL_MS + Math.random() * 1000);
    }

    // ============================
    // CHAT SENDING
    // ============================
    function setNote(text, isError) {
        chatNote.textContent = text || '';
        chatNote.classList.toggle('hidden', !text);
        chatNote.classList.toggle('error', !!isError);
    }

    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();

        var text = chatInput.value.trim();
        if (!text) return;

        if (!info || !info.loggedIn) {
            if (typeof loginDialog.showModal === 'function') {
                loginDialog.showModal();
            } else {
                window.location.href = 'index.html?return=/streaming.html';
            }
            return;
        }

        chatSend.disabled = true;
        fetch('/api/streaming/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: text })
        })
        .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
        .then(function(result) {
            chatSend.disabled = false;
            if (!result.ok) {
                if (result.data.code === 'login_required') {
                    info.loggedIn = false;
                    if (typeof loginDialog.showModal === 'function') loginDialog.showModal();
                    return;
                }
                setNote(result.data.error || 'Could not send message', true);
                return;
            }
            setNote('');
            chatInput.value = '';
            if (result.data.message) {
                appendMessages([result.data.message]);
                scrollToBottom();
            }
        })
        .catch(function() {
            chatSend.disabled = false;
            setNote('Could not send message — try again', true);
        });
    });

    document.getElementById('login-dialog-cancel').addEventListener('click', function() {
        loginDialog.close();
    });

    newPill.addEventListener('click', scrollToBottom);

    // ============================
    // PRESENCE
    // ============================
    function getGuestId() {
        try {
            var id = sessionStorage.getItem('streamGuestId');
            if (!id) {
                id = (window.crypto && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : 'g' + Date.now() + '-' + Math.random().toString(36).slice(2, 12);
                sessionStorage.setItem('streamGuestId', id);
            }
            return id;
        } catch (e) {
            return 'g-fallback-' + Math.random().toString(36).slice(2, 14);
        }
    }

    function sendHeartbeat() {
        var payload = (info && info.loggedIn) ? {} : { guestId: getGuestId() };
        fetch('/api/streaming/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
            if (data) renderViewerCount(data.viewerCount);
        })
        .catch(function() {});
    }

    function renderViewerCount(n) {
        viewersCount.textContent = (n || 0) + ' WATCHING';
    }

    function fetchViewers() {
        fetch('/api/streaming/viewers')
            .then(function(res) { return res.ok ? res.json() : null; })
            .then(function(data) {
                if (!data) return;
                renderViewerCount(data.total);
                viewersList.innerHTML = '';
                (data.viewers || []).forEach(function(v) {
                    var chip = document.createElement('span');
                    chip.className = 'viewer-chip';
                    var label = v.name || 'Guest';
                    if (v.country) label += ' · ' + v.country;
                    chip.textContent = label;
                    viewersList.appendChild(chip);
                });
            })
            .catch(function() {});
    }

    function presenceTick() {
        if (document.visibilityState !== 'visible') return;
        sendHeartbeat();
        fetchViewers();
    }

    // ============================
    // VISIBILITY
    // ============================
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            if (!polling && (!info || info.chatVisible !== false)) pollChat(); // immediate catch-up, then reschedules
            presenceTick();
        } else {
            clearTimeout(chatTimer);
            polling = false;
        }
    });

    // ============================
    // INIT
    // ============================
    fetch('/api/streaming/info')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            info = data;
            renderPlayer();

            if (info.chatVisible === false) {
                // Chat hidden entirely (disabled, or stream offline with
                // "hide chat when offline" on) — player takes full width.
                document.getElementById('stream-chat').classList.add('hidden');
                document.querySelector('.stream-layout').classList.add('no-chat');
            } else {
                if (!info.loggedIn) {
                    chatInput.placeholder = 'Sign in to chat...';
                }
                pollChat();
            }

            presenceTick();
            presenceTimer = setInterval(presenceTick, PRESENCE_MS);
        })
        .catch(function() {
            streamTitle.textContent = 'Failed to load stream';
        });
})();
