/**
 * Passive page-view tracker
 * Included on every page to log visits to /api/pageview.
 * Fire-and-forget — never blocks page load, silent on error.
 */
(function() {
    'use strict';

    // Generate or reuse a per-tab session ID
    var sid = sessionStorage.getItem('_pvSessionId');
    if (!sid) {
        sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('_pvSessionId', sid);
    }

    var ua = navigator.userAgent;

    function deviceType() {
        if (/ipad|tablet|playbook|silk/i.test(ua) ||
            (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
        if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    function detectOS() {
        if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
        if (/android/i.test(ua)) return 'Android';
        if (/windows nt/i.test(ua)) return 'Windows';
        if (/mac os x/i.test(ua)) return 'macOS';
        if (/cros/i.test(ua)) return 'Chrome OS';
        if (/linux/i.test(ua)) return 'Linux';
        return 'Unknown';
    }

    function detectBrowser() {
        if (/edg\//i.test(ua)) return 'Edge';
        if (/opr|opera/i.test(ua)) return 'Opera';
        if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) return 'Chrome';
        if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) return 'Safari';
        if (/firefox|fxios/i.test(ua)) return 'Firefox';
        return 'Unknown';
    }

    var payload = JSON.stringify({
        sessionId: sid,
        pageUrl: location.pathname + location.search,
        referrer: document.referrer || null,
        userAgent: ua,
        deviceType: deviceType(),
        os: detectOS(),
        browser: detectBrowser(),
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height
    });

    // Use fetch as primary — reliable JSON Content-Type across all browsers.
    // keepalive: true ensures the request completes even if the page navigates away.
    fetch('/api/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
    }).catch(function() {});
})();
