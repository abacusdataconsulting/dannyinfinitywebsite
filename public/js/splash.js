/**
 * Splash Page - Terminal Experience
 * Handles typewriter effect, user flow, data collection, and door animation
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        typingSpeed: 7,
        startDelay: 500,
        showInputDelay: 300,
        doorAnimationSpeed: 150,
        redirectUrl: 'home.html'
    };

    // The text to be typed out
    const WELCOME_TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

    // DOM Elements
    const typedTextEl = document.getElementById('typed-text');
    const inputSection = document.getElementById('input-section');
    const userInput = document.getElementById('user-input');
    const enterBtn = document.getElementById('enter-btn');
    const textCursor = document.querySelector('.terminal-text .cursor');
    const inputCursor = document.getElementById('input-cursor');

    // Password section elements
    const passwordSection = document.getElementById('password-section');
    const passwordPrompt = document.getElementById('password-prompt');
    const passwordButtons = document.getElementById('password-buttons');
    const yesPasswordBtn = document.getElementById('yes-password-btn');
    const guestBtn = document.getElementById('guest-btn');
    const passwordInputWrapper = document.getElementById('password-input-wrapper');
    const passwordInput = document.getElementById('password-input');
    const passwordCursor = document.getElementById('password-cursor');

    // Registration section elements
    const registerSection = document.getElementById('register-section');
    const registerPrompt = document.getElementById('register-prompt');
    const registerButtons = document.getElementById('register-buttons');
    const createAccountBtn = document.getElementById('create-account-btn');
    const skipRegisterBtn = document.getElementById('skip-register-btn');
    const registerInputWrapper = document.getElementById('register-input-wrapper');
    const newPasswordInput = document.getElementById('new-password-input');
    const newPasswordCursor = document.getElementById('new-password-cursor');
    const completeRegisterBtn = document.getElementById('complete-register-btn');
    const backRegisterBtn = document.getElementById('back-register-btn');

    // Door animation elements
    const doorAnimation = document.getElementById('door-animation');
    const doorAscii = document.getElementById('door-ascii');

    // For measuring text width
    let measureSpan = null;

    // ASCII Animation Frames - Cyber Portal Sequence
    const ANIMATION_FRAMES = [


        // Frame 3: Portal forming
`

                              ░░░░░░░░░
                          ░░░░░░░░░░░░░░░░░
                       ░░░░░░░░░░░░░░░░░░░░░░░
                     ░░░░░░░░░▒▒▒▒▒▒▒▒▒░░░░░░░░░
                   ░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░
                  ░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░
                 ░░░░░░▒▒▒▒▒▒▒▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░
                 ░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░
                 ░░░░░▒▒▒▒▒▓▓▓▓████▓▓▓▓▒▒▒▒▒▒░░░░░░
                 ░░░░░▒▒▒▒▒▓▓▓▓████▓▓▓▓▒▒▒▒▒▒░░░░░░
                 ░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░
                 ░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░
                  ░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░
                   ░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░
                     ░░░░░░░░░▒▒▒▒▒▒▒░░░░░░░░░
                       ░░░░░░░░░░░░░░░░░░░░░░░
                          ░░░░░░░░░░░░░░░░░
                              ░░░░░░░░░
`,
        // Frame 4: Portal opening
`

                              ▓▓▓▓▓▓▓▓▓
                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                       ▓▓▓▓▓▓▓░░░░░░░░░▓▓▓▓▓▓▓
                     ▓▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓▓
                   ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓
                  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓
                 ▓▓▓▓░░░░░░░░░▒▒▒▒▒▒▒░░░░░░░░░░▓▓▓▓
                 ▓▓▓░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░▓▓▓
                 ▓▓▓░░░░░░░▒▒▒▒▒███▒▒▒▒▒░░░░░░░░▓▓▓
                 ▓▓▓░░░░░░░▒▒▒▒▒███▒▒▒▒▒░░░░░░░░▓▓▓
                 ▓▓▓░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░▓▓▓
                 ▓▓▓▓░░░░░░░░░▒▒▒▒▒▒▒░░░░░░░░░░▓▓▓▓
                  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓
                   ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓
                     ▓▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓▓
                       ▓▓▓▓▓▓▓░░░░░░░░░▓▓▓▓▓▓▓
                          ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                              ▓▓▓▓▓▓▓▓▓
`,
        // Frame 5: Portal expanding
`

                            ██████████████
                        ████░░░░░░░░░░░░░░████
                     ███░░░░░░░░░░░░░░░░░░░░░░███
                   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░██
                 ██░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░██
                █░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░█
               █░░░░░░░░▒▒▒▒▒▒▒▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░█
               █░░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░█
               █░░░░░░░▒▒▒▒▒▓▓▓▓████▓▓▓▓▒▒▒▒▒░░░░░░░█
               █░░░░░░░▒▒▒▒▒▓▓▓▓████▓▓▓▓▒▒▒▒▒░░░░░░░█
               █░░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░█
               █░░░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░░█
                █░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░█
                 ██░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░██
                   ██░░░░░░░░░░░░░░░░░░░░░░░░░░██
                     ███░░░░░░░░░░░░░░░░░░░░███
                        ████░░░░░░░░░░░░████
                            ██████████████
`,
        // Frame 6: Vortex spinning
`
                    ╲                               ╱
                      ╲    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄    ╱
                        ╲▄█▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▄╱
                     ▄▄█▓▓▓▓▓▓░░░░░░░▓▓▓▓▓▓▓█▄▄
                   ▄█▓▓▓▓▓░░░░░░░░░░░░░░░▓▓▓▓▓█▄
                 ▄█▓▓▓▓░░░░░░░░░░░░░░░░░░░░░▓▓▓▓█▄
                █▓▓▓░░░░░░░░░▒▒▒▒▒▒▒░░░░░░░░░░▓▓▓█
               █▓▓░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░▓▓█
              █▓▓░░░░░░░▒▒▒▒▒▒█████▒▒▒▒▒▒░░░░░░░░▓▓█
              █▓░░░░░░░▒▒▒▒▒██     ██▒▒▒▒▒░░░░░░░░▓█
              █▓░░░░░░░▒▒▒▒▒██     ██▒▒▒▒▒░░░░░░░░▓█
              █▓▓░░░░░░░▒▒▒▒▒█████▒▒▒▒▒▒░░░░░░░░▓▓█
               █▓▓░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░▓▓█
                █▓▓▓░░░░░░░░░▒▒▒▒▒▒▒░░░░░░░░░░▓▓▓█
                 ▀█▓▓▓▓░░░░░░░░░░░░░░░░░░░░▓▓▓▓█▀
                   ▀█▓▓▓▓▓░░░░░░░░░░░░░▓▓▓▓▓█▀
                        ╱▀█▓▓▓▓▓▓▓▓▓▓▓█▀╲
                      ╱    ▀▀▀▀▀▀▀▀▀▀▀    ╲
                    ╱                        ╲
`,
        // Frame 7: Being pulled in
`
               ═══════════════════════════════════════════
               ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                   ╲   ╲   ╲   ╲   ╲   ╱   ╱   ╱   ╱   ╱
                     ╲   ╲   ╲   ╲ ╲ ╱ ╱   ╱   ╱   ╱
                       ╲   ╲   ╲  ╲ ╳ ╱  ╱   ╱   ╱
                         ╲   ╲  ╲ ███ ╱  ╱   ╱
                           ╲   ╲ █████ ╱   ╱
                             ╲  ███████  ╱
                               █████████
                             ╱  ███████  ╲
                           ╱   ╱ █████ ╲   ╲
                         ╱   ╱  ╱ ███ ╲  ╲   ╲
                       ╱   ╱   ╱  ╱ ╳ ╲  ╲   ╲   ╲
                     ╱   ╱   ╱   ╱ ╱ ╲ ╲   ╲   ╲   ╲
                   ╱   ╱   ╱   ╱   ╱   ╲   ╲   ╲   ╲   ╲
               ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
               ═══════════════════════════════════════════
`,
        // Frame 8: Tunnel rush
`


                         ╔═══════════════════╗
                       ╔═╝                   ╚═╗
                     ╔═╝    ╔═════════════╗    ╚═╗
                   ╔═╝    ╔═╝             ╚═╗    ╚═╗
                 ╔═╝    ╔═╝   ╔═════════╗   ╚═╗    ╚═╗
               ╔═╝    ╔═╝   ╔═╝         ╚═╗   ╚═╗    ╚═╗
             ╔═╝    ╔═╝   ╔═╝   ╔═════╗   ╚═╗   ╚═╗    ╚═╗
             ║     ║     ║     ║     ║     ║     ║     ║
             ║     ║     ║     ║ ▓▓▓ ║     ║     ║     ║
             ║     ║     ║     ║     ║     ║     ║     ║
             ╚═╗    ╚═╗   ╚═╗   ╚═════╝   ╔═╝   ╔═╝    ╔═╝
               ╚═╗    ╚═╗   ╚═╗         ╔═╝   ╔═╝    ╔═╝
                 ╚═╗    ╚═╗   ╚═════════╝   ╔═╝    ╔═╝
                   ╚═╗    ╚═╗             ╔═╝    ╔═╝
                     ╚═╗    ╚═════════════╝    ╔═╝
                       ╚═╗                   ╔═╝
                         ╚═══════════════════╝

`,
        // Frame 9: Almost through - light burst
`


                                  ░░░
                              ░░░░░░░░░░░
                          ░░░░░░░░░░░░░░░░░░░
                      ░░░░░░░░░▒▒▒▒▒▒▒▒▒░░░░░░░░░
                  ░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░
              ░░░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░░
           ░░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓███▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░
         ░░░░░░░▒▒▒▒▒▒▒▓▓▓▓▓▓▓█████████▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░
        ░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓████████████████▓▓▓▓▓▒▒▒▒▒░░░░░░
         ░░░░░░░▒▒▒▒▒▒▓▓▓▓▓▓█████████▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░
           ░░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓███▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░
              ░░░░░░░░░▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒░░░░░░░░░
                  ░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░
                      ░░░░░░░░░▒▒▒▒▒▒▒▒▒░░░░░░░░░
                          ░░░░░░░░░░░░░░░░░░░
                              ░░░░░░░░░░░
                                  ░░░

`,
        // Frame 10: Bright flash
`




                    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓




`,
    
    ];

    /**
     * Collect client-side visitor data
     */
    /**
     * Detect device type from user agent
     */
    function detectDeviceType(ua) {
        if (/tablet|ipad|playbook|silk/i.test(ua)) {
            return 'tablet';
        }
        if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    /**
     * Detect operating system and version from user agent
     */
    function detectOS(ua) {
        let os = 'Unknown';
        let version = '';

        if (/iphone|ipad|ipod/i.test(ua)) {
            os = 'iOS';
            const match = ua.match(/OS (\d+[._]\d+[._]?\d*)/i);
            if (match) version = match[1].replace(/_/g, '.');
        } else if (/android/i.test(ua)) {
            os = 'Android';
            const match = ua.match(/Android (\d+\.?\d*\.?\d*)/i);
            if (match) version = match[1];
        } else if (/windows phone/i.test(ua)) {
            os = 'Windows Phone';
            const match = ua.match(/Windows Phone (\d+\.?\d*)/i);
            if (match) version = match[1];
        } else if (/windows nt/i.test(ua)) {
            os = 'Windows';
            const match = ua.match(/Windows NT (\d+\.?\d*)/i);
            if (match) {
                const ntVersion = match[1];
                const versionMap = {
                    '10.0': '10/11',
                    '6.3': '8.1',
                    '6.2': '8',
                    '6.1': '7',
                    '6.0': 'Vista',
                    '5.1': 'XP'
                };
                version = versionMap[ntVersion] || ntVersion;
            }
        } else if (/mac os x/i.test(ua)) {
            os = 'macOS';
            const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/i);
            if (match) version = match[1].replace(/_/g, '.');
        } else if (/cros/i.test(ua)) {
            os = 'Chrome OS';
            const match = ua.match(/CrOS \w+ (\d+\.?\d*\.?\d*)/i);
            if (match) version = match[1];
        } else if (/linux/i.test(ua)) {
            os = 'Linux';
        }

        return { os, version };
    }

    /**
     * Detect browser, version and engine from user agent
     */
    function detectBrowser(ua) {
        let browser = 'Unknown';
        let version = '';
        let engine = 'Unknown';

        // Detect engine first
        if (/applewebkit/i.test(ua)) {
            engine = 'WebKit';
            if (/chrome|chromium/i.test(ua)) {
                engine = 'Blink'; // Chrome uses Blink (fork of WebKit)
            }
        } else if (/gecko/i.test(ua) && !/like gecko/i.test(ua)) {
            engine = 'Gecko';
        } else if (/trident/i.test(ua)) {
            engine = 'Trident';
        } else if (/edgehtml/i.test(ua)) {
            engine = 'EdgeHTML';
        }

        // Detect browser and version
        if (/edg\//i.test(ua)) {
            browser = 'Edge';
            const match = ua.match(/Edg\/(\d+\.?\d*\.?\d*)/i);
            if (match) version = match[1];
            engine = 'Blink';
        } else if (/opr|opera/i.test(ua)) {
            browser = 'Opera';
            const match = ua.match(/(?:OPR|Opera)\/(\d+\.?\d*)/i);
            if (match) version = match[1];
            engine = 'Blink';
        } else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
            browser = 'Chrome';
            const match = ua.match(/(?:Chrome|CriOS)\/(\d+\.?\d*\.?\d*)/i);
            if (match) version = match[1];
            engine = 'Blink';
        } else if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) {
            browser = 'Safari';
            const match = ua.match(/Version\/(\d+\.?\d*\.?\d*)/i);
            if (match) version = match[1];
            engine = 'WebKit';
        } else if (/firefox|fxios/i.test(ua)) {
            browser = 'Firefox';
            const match = ua.match(/(?:Firefox|FxiOS)\/(\d+\.?\d*)/i);
            if (match) version = match[1];
            engine = 'Gecko';
        } else if (/msie|trident/i.test(ua)) {
            browser = 'Internet Explorer';
            const match = ua.match(/(?:MSIE |rv:)(\d+\.?\d*)/i);
            if (match) version = match[1];
            engine = 'Trident';
        }

        return { browser, version, engine };
    }

    /**
     * Format client datetime for display
     */
    function getClientDateTime() {
        const now = new Date();
        return {
            iso: now.toISOString(),
            formatted: now.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            offset: now.getTimezoneOffset()
        };
    }

    function collectVisitorData(userName, loginType = null) {
        const ua = navigator.userAgent;
        const osInfo = detectOS(ua);
        const browserInfo = detectBrowser(ua);
        const clientTime = getClientDateTime();

        return {
            name: userName || null,
            loginType: loginType,
            userAgent: ua,
            deviceType: detectDeviceType(ua),
            os: osInfo.os,
            osVersion: osInfo.version,
            browser: browserInfo.browser,
            browserVersion: browserInfo.version,
            browserEngine: browserInfo.engine,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            timezone: clientTime.timezone,
            timezoneOffset: clientTime.offset,
            clientTimestamp: clientTime.iso,
            clientTimeFormatted: clientTime.formatted,
            referrer: document.referrer || null
        };
    }

    /**
     * Store visitor data via API
     */
    async function storeVisitorData(data) {
        // Also store in localStorage as backup
        const visits = JSON.parse(localStorage.getItem('visits') || '[]');
        visits.push(data);
        localStorage.setItem('visits', JSON.stringify(visits));

        try {
            const response = await fetch(`/api/visit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            console.log('Visit logged:', result);
            return result;
        } catch (error) {
            console.warn('API unavailable, visit stored locally:', error);
            return { success: true, local: true };
        }
    }

    /**
     * Check if user is recognized via API
     */
    async function checkUserRecognized(name) {
        try {
            const response = await fetch(`/api/user/check/${encodeURIComponent(name)}`);
            const result = await response.json();

            if (result.recognized) {
                return {
                    name: result.name,
                    hasPassword: result.hasPassword
                };
            }
            return null;
        } catch (error) {
            console.warn('API unavailable, skipping user check:', error);
            return null;
        }
    }

    /**
     * Login user via API
     */
    async function loginUser(name, password) {
        try {
            const response = await fetch(`/api/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });
            const result = await response.json();

            if (result.success) {
                // Store token in session
                sessionStorage.setItem('authToken', result.token);
                sessionStorage.setItem('user', JSON.stringify(result.user));
                return { success: true, user: result.user };
            }
            return { success: false, error: result.error };
        } catch (error) {
            console.warn('API unavailable:', error);
            return { success: false, error: 'API unavailable' };
        }
    }

    /**
     * Register new user via API
     */
    async function registerUser(name, password) {
        try {
            const response = await fetch(`/api/user/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password: password || null })
            });
            const result = await response.json();

            if (result.success) {
                return { success: true, userId: result.userId };
            }
            return { success: false, error: result.error };
        } catch (error) {
            console.warn('API unavailable:', error);
            return { success: false, error: 'API unavailable' };
        }
    }

    /**
     * Creates a hidden span to measure text width
     */
    function createMeasureSpan() {
        measureSpan = document.createElement('span');
        measureSpan.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre;
            font-family: 'Courier New', Courier, monospace;
            font-size: 1.1rem;
        `;
        document.body.appendChild(measureSpan);
    }

    /**
     * Updates the custom cursor position based on input text
     */
    function updateCursorPosition(input, cursor) {
        const text = input.value;
        measureSpan.textContent = text || '';
        const textWidth = measureSpan.offsetWidth;
        const paddingLeft = 20;
        cursor.style.left = (paddingLeft + textWidth) + 'px';
    }

    /**
     * Types out text character by character
     */
    function typeWriter(text, element, callback) {
        let index = 0;

        function type() {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(type, CONFIG.typingSpeed);
            } else if (callback) {
                callback();
            }
        }

        type();
    }

    /**
     * Shows the input section with a fade-in effect
     */
    function showInputSection() {
        textCursor.style.display = 'none';
        inputSection.classList.remove('hidden');
        inputSection.classList.add('fade-in');
        inputCursor.classList.add('active');
        updateCursorPosition(userInput, inputCursor);
        userInput.focus();
    }

    /**
     * Show password prompt for recognized users
     */
    function showPasswordPrompt(userName, hasPassword) {
        // Hide the input section
        inputSection.classList.add('hidden');
        inputSection.classList.remove('fade-in');

        // Clear the typed text and style for welcome message
        const terminalText = document.querySelector('.terminal-text');
        terminalText.classList.add('welcome-message');
        typedTextEl.textContent = '';
        textCursor.style.display = 'inline-block';

        // Hide password section elements initially
        passwordPrompt.style.display = 'none';
        passwordButtons.style.display = 'none';
        passwordInputWrapper.classList.remove('active');

        // Store whether user has password for button handler
        sessionStorage.setItem('userHasPassword', hasPassword ? 'true' : 'false');

        // Update login button - now submits password directly
        if (hasPassword) {
            yesPasswordBtn.textContent = 'Login';
            yesPasswordBtn.style.display = 'block';
        } else {
            yesPasswordBtn.style.display = 'none';
        }

        // Type out the welcome message
        const welcomeMessage = `Welcome back, ${userName}!`;
        typeWriter(welcomeMessage, typedTextEl, () => {
            // After typing, hide cursor and show password section
            textCursor.style.display = 'none';

            // Show password section
            passwordSection.classList.add('centered');
            passwordSection.classList.remove('hidden');
            passwordSection.classList.add('fade-in');

            // Show password input immediately if user has password
            if (hasPassword) {
                passwordInputWrapper.classList.add('active');
                passwordCursor.classList.add('active');
                updateCursorPosition(passwordInput, passwordCursor);
                passwordInput.focus();
            }

            // Show buttons
            passwordButtons.style.display = 'flex';
        });
    }

    /**
     * Show password input field
     */
    function showPasswordInput() {
        passwordButtons.style.display = 'none';
        passwordInputWrapper.classList.add('active');
        passwordCursor.classList.add('active');
        updateCursorPosition(passwordInput, passwordCursor);
        passwordInput.focus();
    }

    /**
     * Go back to password options
     */
    function showPasswordOptions() {
        passwordInputWrapper.classList.remove('active');
        passwordButtons.style.display = 'flex';
        passwordInput.value = '';
        passwordInput.placeholder = 'Enter password...';
    }

    /**
     * Continue as guest (limited access)
     */
    function continueAsGuest() {
        sessionStorage.setItem('accessLevel', 'guest');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
        proceedToAnimation();
    }

    /**
     * Show registration prompt for new users
     */
    function showRegisterPrompt(userName) {
        inputSection.classList.add('hidden');
        inputSection.classList.remove('fade-in');

        registerPrompt.textContent = `Welcome, ${userName}! Would you like to create an account?`;
        registerButtons.style.display = 'flex';
        registerInputWrapper.classList.remove('active');

        registerSection.classList.remove('hidden');
        registerSection.classList.add('fade-in');
    }

    /**
     * Show password input for new registration
     */
    function showRegisterPasswordInput() {
        registerButtons.style.display = 'none';
        registerInputWrapper.classList.add('active');
        newPasswordCursor.classList.add('active');
        updateCursorPosition(newPasswordInput, newPasswordCursor);
        newPasswordInput.focus();
    }

    /**
     * Go back to registration options
     */
    function showRegisterOptions() {
        registerInputWrapper.classList.remove('active');
        registerButtons.style.display = 'flex';
        newPasswordInput.value = '';
    }

    /**
     * Complete registration
     */
    async function completeRegistration() {
        const userName = sessionStorage.getItem('userName');
        const password = newPasswordInput.value;

        completeRegisterBtn.disabled = true;
        completeRegisterBtn.textContent = 'Creating...';

        const result = await registerUser(userName, password);

        if (result.success) {
            // If password was set, log them in
            if (password) {
                const loginResult = await loginUser(userName, password);
                if (loginResult.success) {
                    sessionStorage.setItem('accessLevel', 'member');
                }
            } else {
                sessionStorage.setItem('accessLevel', 'member');
            }
            proceedToAnimation();
        } else {
            completeRegisterBtn.disabled = false;
            completeRegisterBtn.textContent = 'Complete';
            newPasswordInput.placeholder = result.error || 'Error, try again...';
        }
    }

    /**
     * Skip registration, continue as guest
     */
    function skipRegistration() {
        sessionStorage.setItem('accessLevel', 'guest');
        proceedToAnimation();
    }

    /**
     * Play door animation
     */
    function playDoorAnimation(callback) {
        doorAnimation.classList.add('active');
        let frame = 0;

        function animate() {
            if (frame < ANIMATION_FRAMES.length) {
                doorAscii.textContent = ANIMATION_FRAMES[frame];
                frame++;
                // Vary speed for dramatic effect
                const speed = frame < 3 ? 400 : frame > 9 ? 600 : CONFIG.doorAnimationSpeed;
                setTimeout(animate, speed);
            } else if (callback) {
                callback();
            }
        }

        animate();
    }

    /**
     * Handles the enter action
     */
    async function handleEnter() {
        const userName = userInput.value.trim();

        // Disable button to prevent double-clicks
        enterBtn.disabled = true;
        enterBtn.textContent = 'Loading...';

        // Store user name in session
        if (userName) {
            sessionStorage.setItem('userName', userName);
        }

        // Check if user is recognized
        const recognizedUser = userName ? await checkUserRecognized(userName) : null;

        if (recognizedUser) {
            // Store recognized user info
            sessionStorage.setItem('recognizedUser', JSON.stringify(recognizedUser));
            showPasswordPrompt(recognizedUser.name, recognizedUser.hasPassword);
        } else {
            // New user or no name - proceed as guest
            sessionStorage.setItem('accessLevel', 'guest');
            proceedToAnimation();
        }
    }

    /**
     * Handle password submission
     */
    async function handlePasswordSubmit() {
        const password = passwordInput.value;
        const userName = sessionStorage.getItem('userName');

        // Disable button
        yesPasswordBtn.disabled = true;
        yesPasswordBtn.textContent = 'Verifying...';

        const result = await loginUser(userName, password);

        if (result.success) {
            sessionStorage.setItem('accessLevel', 'member');
            proceedToAnimation();
        } else {
            // Show error and re-enable
            yesPasswordBtn.disabled = false;
            yesPasswordBtn.textContent = 'Login';
            passwordInput.value = '';
            passwordInput.placeholder = result.error || 'Invalid password, try again...';
            passwordInput.focus();
            updateCursorPosition(passwordInput, passwordCursor);
        }
    }

    /**
     * Proceed to door animation and then redirect
     */
    async function proceedToAnimation() {
        // Log the session with login type
        const userName = sessionStorage.getItem('userName');
        const accessLevel = sessionStorage.getItem('accessLevel') || 'guest';
        const user = sessionStorage.getItem('user');
        const authToken = sessionStorage.getItem('authToken');

        // Determine login type (guest, member, or admin)
        // Only check user data if they actually logged in (have auth token)
        let loginType = 'guest';
        if (accessLevel === 'member' && authToken && user) {
            const userData = JSON.parse(user);
            loginType = userData.isAdmin ? 'admin' : 'member';
        }

        // Log the complete session with login type
        const sessionData = collectVisitorData(userName, loginType);
        await storeVisitorData(sessionData);

        // Hide all sections
        inputSection.classList.add('hidden');
        passwordSection.classList.add('hidden');
        registerSection.classList.add('hidden');
        document.querySelector('.terminal-text').style.display = 'none';

        // Play door animation then redirect
        playDoorAnimation(() => {
            window.location.href = CONFIG.redirectUrl;
        });
    }

    /**
     * Setup cursor behavior for an input
     */
    function setupInputCursor(input, cursor) {
        let typingTimeout;

        input.addEventListener('input', () => {
            updateCursorPosition(input, cursor);
            cursor.classList.add('typing');
            cursor.classList.remove('active');
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                cursor.classList.remove('typing');
                cursor.classList.add('active');
            }, 100);
        });

        input.addEventListener('focus', () => {
            cursor.classList.add('active');
            updateCursorPosition(input, cursor);
        });

        input.addEventListener('blur', () => {
            cursor.classList.remove('active');
            cursor.classList.remove('typing');
        });
    }

    /**
     * Initialize the splash page
     */
    function init() {
        createMeasureSpan();

        // Start typing after initial delay
        setTimeout(() => {
            typeWriter(WELCOME_TEXT, typedTextEl, () => {
                setTimeout(showInputSection, CONFIG.showInputDelay);
            });
        }, CONFIG.startDelay);

        // Setup cursor behaviors
        setupInputCursor(userInput, inputCursor);
        setupInputCursor(passwordInput, passwordCursor);
        setupInputCursor(newPasswordInput, newPasswordCursor);

        // Event listeners - Name input
        enterBtn.addEventListener('click', handleEnter);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleEnter();
        });

        // Event listeners - Password section
        yesPasswordBtn.addEventListener('click', handlePasswordSubmit);
        guestBtn.addEventListener('click', continueAsGuest);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handlePasswordSubmit();
        });

        // Event listeners - Registration section
        createAccountBtn.addEventListener('click', showRegisterPasswordInput);
        skipRegisterBtn.addEventListener('click', skipRegistration);
        backRegisterBtn.addEventListener('click', showRegisterOptions);
        completeRegisterBtn.addEventListener('click', completeRegistration);
        newPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') completeRegistration();
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
