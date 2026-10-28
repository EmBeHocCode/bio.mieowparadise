// Scroll Animations Observer
let currentLanyardData = null; // Khai báo ở đầu file để tránh lỗi ReferenceError
let isBubbleManuallyHidden = false; // Trạng thái ẩn thủ công của bong bóng status
let refreshThemeManagerState = null;

const runWhenIdle = (callback, timeout = 1200) => {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(callback, { timeout });
        return;
    }
    window.setTimeout(callback, Math.min(timeout, 800));
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarseOrSmallScreen = () => window.matchMedia('(max-width: 899px), (hover: none), (pointer: coarse)').matches;
const isMobilePerformanceMode = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const isSaveDataMode = () => Boolean(navigator.connection && navigator.connection.saveData);
const isEditableTarget = (target) => {
    return Boolean(target && target.closest && target.closest('input, textarea, select, [contenteditable="true"]'));
};
const isInteractiveTarget = (target) => {
    return Boolean(target && target.closest && target.closest(
        'a, button, input, textarea, select, label, audio, [contenteditable="true"], .control-btn, .btn, .link-btn, .theme-manager-panel, .music-content'
    ));
};

function shouldPlayPageLoadIntro() {
    if (document.documentElement.dataset.quickReload === '1') return false;
    const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
    const navigation = navEntries && navEntries[0];
    if (navigation && navigation.type) {
        return navigation.type === 'navigate' || navigation.type === 'reload';
    }

    if (performance.navigation) {
        return performance.navigation.type === 0 || performance.navigation.type === 1;
    }

    return true;
}

function initPageLoadIntro() {
    const intro = document.getElementById('bio-load-intro');
    const video = document.getElementById('bio-intro-video');
    const skip = document.getElementById('bio-intro-skip');
    if (!intro) return;
    if (!shouldPlayPageLoadIntro() || !video || !skip) {
        intro.remove();
        return;
    }

    const events = new AbortController();
    const on = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: events.signal });
    const background = [...document.body.children].filter(element => element !== intro && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName));
    const previousInert = new Map(background.map(element => [element, element.inert]));
    let finished = false, exitTimer = 0, watchdog = 0;
    let lastVideoTime = 0, lastProgress = performance.now();
    background.forEach(element => { element.inert = true; });
    document.body.classList.add('bio-intro-active');
    intro.dataset.state = 'loading';

    const remove = () => {
        clearTimeout(exitTimer); clearInterval(watchdog); events.abort();
        const restoreFocus = intro.contains(document.activeElement);
        video.pause(); video.removeAttribute('src'); video.load();
        document.body.classList.remove('bio-intro-active');
        previousInert.forEach((inert, element) => { element.inert = inert; });
        intro.remove();
        if (restoreFocus) {
            const main = document.querySelector('main.content-wrapper');
            if (main) {
                main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true });
                main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
            }
        }
    };
    const finish = reason => {
        if (finished) return;
        finished = true; intro.dataset.state = 'leaving'; intro.dataset.exitReason = reason;
        clearInterval(watchdog); video.pause();
        intro.classList.add('is-exit');
        exitTimer = setTimeout(remove, prefersReducedMotion() ? 0 : 280);
    };
    on(skip, 'click', () => finish('skip'));
    on(document, 'keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); finish('skip');
        }
    }, { capture: true });
    on(video, 'playing', () => {
        if (!finished) { intro.dataset.state = 'playing'; lastProgress = performance.now(); }
    });
    on(video, 'ended', () => finish('ended'));
    on(video, 'error', () => finish('unavailable'));
    on(intro, 'transitionend', event => {
        if (finished && event.target === intro && event.propertyName === 'opacity') remove();
    });
    on(window, 'pagehide', remove, { once: true });

    // A healthy video always plays to its ended event. Only stalled playback times out.
    watchdog = setInterval(() => {
        const now = performance.now();
        if (document.hidden) { lastProgress = now; return; }
        if (video.currentTime > lastVideoTime) {
            lastVideoTime = video.currentTime; lastProgress = now;
        } else if (now - lastProgress >= 12000) finish('unavailable');
    }, 1000);
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.src = video.dataset.src;
    video.play().catch(() => finish('unavailable'));
}

function clearTextSelection() {
    const selection = window.getSelection && window.getSelection();
    if (selection && selection.rangeCount) {
        selection.removeAllRanges();
    }
}

function initSourceProtection() {
    const blockEvent = (event) => {
        if (isEditableTarget(event.target)) return false;
        event.preventDefault();
        event.stopPropagation();
        clearTextSelection();
        return true;
    };

    document.addEventListener('contextmenu', blockEvent, { capture: true });

    document.addEventListener('keydown', (event) => {
        const key = String(event.key || '').toLowerCase();
        const code = event.keyCode || event.which;
        const ctrlOrMeta = event.ctrlKey || event.metaKey;
        const blocked =
            code === 123 ||
            (ctrlOrMeta && key === 'u') ||
            (ctrlOrMeta && key === 's') ||
            (ctrlOrMeta && key === 'p') ||
            (ctrlOrMeta && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) ||
            (ctrlOrMeta && event.altKey && key === 'i') ||
            (ctrlOrMeta && code === 85) ||
            (ctrlOrMeta && code === 83) ||
            (ctrlOrMeta && code === 80) ||
            (ctrlOrMeta && event.shiftKey && [73, 74, 67, 75].includes(code));

        if (blocked) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }, { capture: true });

    let devtoolsLikelyOpen = false;
    window.setInterval(() => {
        const widthGap = Math.abs(window.outerWidth - window.innerWidth);
        const heightGap = Math.abs(window.outerHeight - window.innerHeight);
        const nextState = widthGap > 180 || heightGap > 180;
        if (nextState && !devtoolsLikelyOpen) {
            clearTextSelection();
            console.clear();
        }
        devtoolsLikelyOpen = nextState;
    }, 900);
}

const observerOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in-view');

            // Trigger skill bars when they scroll into view
            if (entry.target.classList.contains('skill-box')) {
                animateSkillBars(entry.target);
            }
        }
    });
}, observerOptions);

// Attach observer to all elements with fade-up class and all sections
document.querySelectorAll('.fade-up, .section').forEach((el) => {
    observer.observe(el);
});

// Function to animate skill bars 
function animateSkillBars(container) {
    const bars = container.querySelectorAll('.skill-fill');
    bars.forEach(bar => {
        const progress = bar.dataset.progress;
        if (progress) {
            setTimeout(() => {
                bar.style.width = progress + '%';
            }, 200);
        }
    });
}

// Active Nav Link updating while scrolling
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');
                if (href && href.includes('#' + id)) {
                    link.classList.add('active');
                }
            });
        }
    });
}, { threshold: 0.4, rootMargin: "0px" });

sections.forEach(section => {
    navObserver.observe(section);
});

// Custom Smooth Scroll Function (Fallback for browsers/OS with smooth-scroll disabled)
function smoothScrollTo(targetSelector, duration = 500) {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    const offset = 60;
    const bodyRect = document.body.getBoundingClientRect().top;
    const elementRect = target.getBoundingClientRect().top;
    const targetPosition = elementRect - bodyRect - offset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    // Easing function (easeInOutQuad)
    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

// Smooth scrolling for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        e.preventDefault();
        expandSectionById(targetId.slice(1));
        window.requestAnimationFrame(() => smoothScrollTo(targetId));

        // Update URL gracefully
        history.pushState(null, null, targetId);
    });
});

// Theme Toggle Logic
const root = document.documentElement;
const body = document.body;
const themeManagerToggle = document.getElementById('theme-manager-toggle');

const THEME_ACCENT_STORAGE_KEY = 'theme_accent';
const DEFAULT_ACCENT_THEME = {
    primary: '#ff0066',
};

function normalizeHexColor(value) {
    const normalized = String(value || '').trim().replace(/^#?([0-9a-f]{6})$/iu, '#$1');
    return /^#[0-9a-f]{6}$/iu.test(normalized) ? normalized.toLowerCase() : null;
}

function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex) || DEFAULT_ACCENT_THEME.primary;
    return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16),
    };
}

function applyAccentTheme(hex) {
    const normalized = normalizeHexColor(hex) || DEFAULT_ACCENT_THEME.primary;
    const { r, g, b } = hexToRgb(normalized);
    root.style.setProperty('--primary-color', normalized);
    root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    root.style.removeProperty('--accent-text-color');
    return normalized;
}

let currentAccentTheme = applyAccentTheme(localStorage.getItem(THEME_ACCENT_STORAGE_KEY) || DEFAULT_ACCENT_THEME.primary);
body.classList.remove('theme-rainbow');
body.classList.remove('light-theme');
body.style.removeProperty('--rainbow-duration');
localStorage.removeItem('theme');
localStorage.removeItem('theme_rainbow_enabled');
localStorage.removeItem('theme_rainbow_speed');

// Language Toggle Logic
const langToggle = document.getElementById('lang-toggle');
const langText = langToggle.querySelector('.lang-text');
const translatableElements = document.querySelectorAll('[data-vi]');
const translatableTitles = document.querySelectorAll('[data-vi-title]');

let currentLang = localStorage.getItem('lang') || 'vi';

const translations = {
    vi: {
        connecting: "Đang kết nối...",
        pleaseWait: "Vui lòng đợi",
        offline: "Ngoại tuyến",
        idle: "Hiện không hoạt động",
        zzz: "Zzz...",
        online: "Online",
        players: "Trực tuyến",
        version: "Phiên bản",
        maintenance: "Máy chủ đang bảo trì",
        error: "Lỗi",
        noData: "Không thể lấy dữ liệu"
    },
    en: {
        connecting: "Connecting...",
        pleaseWait: "Please wait",
        offline: "Offline",
        idle: "Currently inactive",
        zzz: "Zzz...",
        online: "Online",
        players: "Players",
        version: "Version",
        maintenance: "Server under maintenance",
        error: "Error",
        noData: "Unable to fetch data"
    }
};

const STATIC_VIEW_STORAGE_KEY = 'bio_bei_static_views';
const STATIC_VIEW_SESSION_KEY = 'bio_bei_static_viewed';
const STATIC_VIEW_BASE = 0;
const MUSIC_STARTUP_PLAYLIST_KEY = 'bio_music_startup_playlist';

function updateLanguage(lang) {
    translatableElements.forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            el.innerHTML = text;
        }
    });
    translatableTitles.forEach(el => {
        const title = el.getAttribute(`data-${lang}-title`);
        if (title) {
            el.setAttribute('title', title);
        }
    });
    langText.innerText = lang.toUpperCase();
    localStorage.setItem('lang', lang);
    currentLang = lang;
    document.documentElement.lang = lang;
    document.dispatchEvent(new CustomEvent('bio:languagechange', { detail: { lang } }));

    // Re-init components that use static text
    initMCPing();
    if (currentLanyardData) {
        updateDiscordUI(currentLanyardData);
    }
    if (typeof refreshThemeManagerState === 'function') {
        refreshThemeManagerState();
    }
    if (typeof updateSectionToggleLabels === 'function') {
        updateSectionToggleLabels();
    }
}

// Initial language set
if (currentLang === 'en') {
    updateLanguage('en');
}

langToggle.addEventListener('click', () => {
    const nextLang = currentLang === 'vi' ? 'en' : 'vi';
    updateLanguage(nextLang);
});

// Recover the content for any browser restoring the former hidden-UI state.
body.classList.remove('ui-hidden');

// Copy IP to Clipboard with Toast Notification
let toastTimeout;
let toastRestoreTimeout;

function showToast(message, duration = 2600) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    if (!toast.dataset.defaultText) {
        toast.dataset.defaultText = toast.innerHTML;
    }

    const defaultText = toast.dataset.defaultText;
    if (message) {
        toast.innerHTML = message;
    }

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    clearTimeout(toastRestoreTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        if (message) {
            toastRestoreTimeout = setTimeout(() => {
                toast.innerHTML = defaultText;
            }, 360);
        }
    }, duration);
}

window.copyIP = function(ip, element) {
    navigator.clipboard.writeText(ip).then(() => {
        // Change icon temporarily
        const icon = element.querySelector('i');
        const originalClass = icon.className;
        icon.className = 'fas fa-check text-primary';

        setTimeout(() => {
            icon.className = originalClass;
        }, 2000);

        showToast();
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
};

function initThemeManager() {
    const panel = document.getElementById('theme-manager-panel');
    const closeBtn = document.getElementById('theme-manager-close');
    const colorPicker = document.getElementById('theme-accent-picker');
    const hexInput = document.getElementById('theme-accent-hex');
    const previewChip = document.getElementById('theme-accent-preview');
    const applyBtn = document.getElementById('theme-apply-btn');
    const saveBtn = document.getElementById('theme-save-btn');
    const resetBtn = document.getElementById('theme-reset-btn');
    const presetButtons = Array.from(document.querySelectorAll('.theme-preset-btn'));
    const tokenPrimary = document.getElementById('theme-token-primary');
    const tokenBorder = document.getElementById('theme-token-border');
    const tokenGlow = document.getElementById('theme-token-glow');
    const tokenActive = document.getElementById('theme-token-active');
    const tokenText = document.getElementById('theme-token-text');

    if (!themeManagerToggle || !panel || !colorPicker || !hexInput || !previewChip) return;

    const tokenMap = {
        primary: tokenPrimary,
        border: tokenBorder,
        glow: tokenGlow,
        active: tokenActive,
        text: tokenText,
    };

    const syncTokenPreview = () => {
        const { r, g, b } = hexToRgb(currentAccentTheme);
        if (tokenMap.primary) tokenMap.primary.textContent = currentAccentTheme.toUpperCase();
        if (tokenMap.border) tokenMap.border.textContent = `rgba(${r}, ${g}, ${b}, 0.48)`;
        if (tokenMap.glow) tokenMap.glow.textContent = `rgba(${r}, ${g}, ${b}, 0.34)`;
        if (tokenMap.active) tokenMap.active.textContent = `rgba(${r}, ${g}, ${b}, 0.12)`;
        if (tokenMap.text) tokenMap.text.textContent = currentAccentTheme.toUpperCase();
    };

    const syncPresetState = (hex) => {
        presetButtons.forEach((button) => {
            button.classList.toggle('active', normalizeHexColor(button.dataset.color) === hex);
        });
    };

    const syncControls = (hex) => {
        colorPicker.value = hex;
        hexInput.value = hex.toUpperCase();
        previewChip.style.background = hex;
        hexInput.classList.remove('invalid');
        syncPresetState(hex);
        syncTokenPreview();
    };

    const previewTheme = (value) => {
        const normalized = normalizeHexColor(value);
        if (!normalized) {
            hexInput.classList.add('invalid');
            return;
        }

        currentAccentTheme = applyAccentTheme(normalized);
        syncControls(currentAccentTheme);
    };

    const openPanel = () => {
        panel.classList.add('active');
        panel.inert = false;
        panel.setAttribute('aria-hidden', 'false');
        themeManagerToggle.classList.add('active');
        themeManagerToggle.setAttribute('aria-expanded', 'true');
        document.dispatchEvent(new CustomEvent('bio:panelopen', { detail: 'theme' }));
        syncControls(currentAccentTheme);
        closeBtn?.focus({ preventScroll: true });
    };

    const closePanel = () => {
        if (panel.contains(document.activeElement)) document.getElementById('dock-settings-toggle')?.focus({ preventScroll: true });
        panel.classList.remove('active');
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
        themeManagerToggle.classList.remove('active');
        themeManagerToggle.setAttribute('aria-expanded', 'false');
    };
    document.addEventListener('bio:panelopen', event => { if (event.detail !== 'theme') closePanel(); });

    themeManagerToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.classList.contains('active')) {
            closePanel();
        } else {
            openPanel();
        }
    });

    closeBtn?.addEventListener('click', closePanel);

    panel.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
        if (!panel.classList.contains('active')) return;
        if (panel.contains(e.target) || themeManagerToggle.contains(e.target)) return;
        closePanel();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('active')) {
            closePanel();
        }
    });

    colorPicker.addEventListener('input', (e) => {
        previewTheme(e.target.value);
    });

    hexInput.addEventListener('input', (e) => {
        const cleaned = String(e.target.value || '').replace(/[^#0-9a-f]/giu, '').toUpperCase();
        e.target.value = cleaned.startsWith('#') ? cleaned : `#${cleaned.replace(/^#+/u, '')}`;

        if (e.target.value.length === 7) {
            previewTheme(e.target.value);
        }
    });

    hexInput.addEventListener('blur', () => {
        syncControls(currentAccentTheme);
    });

    presetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            previewTheme(button.dataset.color);
        });
    });

    applyBtn?.addEventListener('click', () => {
        syncControls(currentAccentTheme);
        closePanel();
        showToast(currentLang === 'vi' ? 'Đã áp dụng theme cho phiên hiện tại!' : 'Theme applied for this session!');
    });

    saveBtn?.addEventListener('click', () => {
        localStorage.setItem(THEME_ACCENT_STORAGE_KEY, currentAccentTheme);
        syncControls(currentAccentTheme);
        closePanel();
        showToast(currentLang === 'vi' ? 'Đã lưu theme giao diện!' : 'Theme settings saved!');
    });

    resetBtn?.addEventListener('click', () => {
        currentAccentTheme = applyAccentTheme(DEFAULT_ACCENT_THEME.primary);
        localStorage.removeItem(THEME_ACCENT_STORAGE_KEY);
        localStorage.removeItem('theme_rainbow_enabled');
        localStorage.removeItem('theme_rainbow_speed');
        syncControls(currentAccentTheme);
        showToast(currentLang === 'vi' ? 'Đã khôi phục theme mặc định!' : 'Default theme restored!');
    });

    refreshThemeManagerState = () => syncControls(currentAccentTheme);
    syncControls(currentAccentTheme);
}

// Live Discord Presence (Lanyard API)
const DISCORD_ID = '895837109036929035';
const BASE_BADGE_URL = "https://raw.githubusercontent.com/Debuggingss/discord-badges/master/pngs_named/";

function getBadges(flags) {
    if (!flags) return "";
    const badgeList = [];
    const FLAGS = {
        STAFF: [1 << 0, "staff.png", "Discord Staff"],
        PARTNER: [1 << 1, "partner.png", "Partnered Server Owner"],
        HYPESQUAD: [1 << 2, "hypesquad_events.png", "HypeSquad Events"],
        BUG_HUNTER_LEVEL_1: [1 << 3, "bughunter_1.png", "Discord Bug Hunter"],
        HOUSE_BRAVERY: [1 << 6, "bravery.png", "HypeSquad Bravery"],
        HOUSE_BRILLIANCE: [1 << 7, "brilliance.png", "HypeSquad Brilliance"],
        HOUSE_BALANCE: [1 << 8, "balance.png", "HypeSquad Balance"],
        EARLY_SUPPORTER: [1 << 9, "early_supporter.png", "Early Supporter"],
        BUG_HUNTER_LEVEL_2: [1 << 14, "bughunter_2.png", "Discord Bug Hunter Level 2"],
        ACTIVE_DEVELOPER: [1 << 22, "developer.png", "Active Developer"]
    };

    for (const key in FLAGS) {
        if ((flags & FLAGS[key][0]) === FLAGS[key][0]) {
            badgeList.push(`<img class="badge" src="${BASE_BADGE_URL}${FLAGS[key][1]}" alt="${FLAGS[key][2]}" title="${FLAGS[key][2]}" onerror="this.style.display='none'">`);
        }
    }
    return badgeList.join("");
}

function updateDiscordUI(data) {
    if (!data) return;
    currentLanyardData = data; // Lưu trữ dữ liệu mới nhất
    const user = data.discord_user;

    // Name & Discriminator
    document.getElementById('lanyard-username').innerText = user.global_name || user.username;
    const disc = user.discriminator;
    document.getElementById('lanyard-discriminator').innerText = (disc && disc !== "0") ? `#${disc}` : "";

    // Badges
    let badgesHTML = getBadges(user.public_flags);
    const isAnimated = user.avatar && user.avatar.startsWith('a_');
    if (isAnimated && !badgesHTML.includes('nitro.png')) {
        badgesHTML += `<img class="badge" src="${BASE_BADGE_URL}nitro.png" alt="Nitro" title="Nitro" onerror="this.style.display='none'">`;
    }
    if (badgesHTML === "") {
        badgesHTML = `<i class="fab fa-discord" title="Discord User" style="color: #5865F2; font-size: 1.1rem;"></i>`;
    }
    document.getElementById('lanyard-badges').innerHTML = badgesHTML;

    // Avatar
    const avatarExt = isAnimated ? 'gif' : 'webp';
    const avatarUrl = user.avatar ?
        `https://cdn.discordapp.com/avatars/${DISCORD_ID}/${user.avatar}.${avatarExt}?size=160` :
        `https://ui-avatars.com/api/?name=${user.username}&background=0D1117&color=10B981`;
    document.getElementById('lanyard-avatar').src = avatarUrl;

    // Decoration
    const decor = document.getElementById('lanyard-decoration');
    if (user.avatar_decoration_data) {
        decor.src = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png`;
        decor.style.display = 'block';
    } else {
        decor.style.display = 'none';
    }

    // Status
    document.getElementById('lanyard-status').className = `discord-status-dot ${data.discord_status}`;

    // Activity
    const acts = data.activities || [];
    const activityEl = document.getElementById('lanyard-activity');
    const detailsEl = document.getElementById('lanyard-details');
    const icon = document.getElementById('lanyard-act-icon');
    const bubble = document.getElementById('lanyard-status-bubble');

    const gameAct = acts.find(a => a.type === 0);
    const customAct = acts.find(a => a.type === 4);

    // Update Status Bubble
    if (customAct && customAct.state && data.discord_status !== 'offline') {
        const emojiStr = customAct.emoji ? (customAct.emoji.id ? `<img src="https://cdn.discordapp.com/emojis/${customAct.emoji.id}.${customAct.emoji.animated ? 'gif' : 'png'}" style="width:16px; height:16px; vertical-align:middle; margin-right:4px;">` : customAct.emoji.name + ' ') : '';
        bubble.innerHTML = emojiStr + customAct.state;
        if (!isBubbleManuallyHidden) {
            bubble.classList.add('show');
        } else {
            bubble.classList.remove('show');
        }
    } else {
        bubble.classList.remove('show');
    }

    let mainAct = gameAct || acts[0];

    if (mainAct) {
        if (mainAct.type === 4 && !gameAct) {
            activityEl.innerHTML = `${mainAct.emoji && mainAct.emoji.name ? mainAct.emoji.name + ' ' : ''}${mainAct.state || 'Custom Status'}`;
            detailsEl.innerText = "";
        } else {
            activityEl.innerText = mainAct.name;
            detailsEl.innerText = mainAct.details || mainAct.state || "";
        }

        if (mainAct.assets && mainAct.assets.large_image) {
            let imgId = mainAct.assets.large_image;
            icon.src = imgId.startsWith("mp:external") ?
                imgId.replace(/mp:external\/.*\/https\//, "https://") :
                `https://cdn.discordapp.com/app-assets/${mainAct.application_id}/${imgId}.png`;
            icon.style.display = 'block';
        } else {
            icon.style.display = 'none';
        }
    } else {
        const t = translations[currentLang];
        activityEl.innerText = data.discord_status === 'offline' ? t.offline : t.idle;
        detailsEl.innerText = data.discord_status === 'offline' ? "" : t.zzz;
        icon.style.display = 'none';
    }
}

function connectLanyard() {
    const ws = new WebSocket('wss://api.lanyard.rest/socket');

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.op === 1) {
            ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
            setInterval(() => ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
        }
        if (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE') {
            updateDiscordUI(msg.d);
        }
    };

    ws.onclose = () => {
        setTimeout(connectLanyard, 5000);
    };

    ws.onerror = (err) => {
        console.error('Lanyard WS Error:', err);
    };
}

// Live MC Server Ping (mcapi.us)
async function initMCPing() {
    const pingElements = document.querySelectorAll('.mc-ping');
    const t = translations[currentLang];

    for (const el of pingElements) {
        const isOnline = el.dataset.online === 'true';
        const players = el.dataset.players || '0';
        const max = el.dataset.max || '0';
        const version = el.dataset.version || 'Static';
        const offlineVi = el.dataset.offlineVi || 'Bản tĩnh không dùng ping realtime';
        const offlineEn = el.dataset.offlineEn || 'Static build without realtime ping';
        const offlineLabel = currentLang === 'vi' ? offlineVi : offlineEn;

        if (isOnline) {
            el.innerHTML = `<span style="color:var(--primary-color);">● ${t.online}</span> <span style="margin: 0 4px;">|</span> ${t.players}: ${players}/${max} <span style="margin: 0 4px;">|</span> ${t.version}: ${version}`;
        } else {
            el.innerHTML = `<span style="color:#f59e0b;">● ${t.offline}</span> <span style="margin: 0 4px;">|</span> ${offlineLabel}`;
        }
    }
}

async function initViewCounter() {
    const viewCountEl = document.getElementById('view-count');
    if (!viewCountEl) return;

    try {
        const hasCountedThisSession = sessionStorage.getItem(STATIC_VIEW_SESSION_KEY) === '1';
        const storedValue = Number(localStorage.getItem(STATIC_VIEW_STORAGE_KEY) || STATIC_VIEW_BASE);
        const safeCount = Number.isFinite(storedValue) ? storedValue : STATIC_VIEW_BASE;
        const nextCount = hasCountedThisSession ? safeCount : safeCount + 1;

        if (!hasCountedThisSession) {
            localStorage.setItem(STATIC_VIEW_STORAGE_KEY, String(nextCount));
            sessionStorage.setItem(STATIC_VIEW_SESSION_KEY, '1');
        }

        viewCountEl.textContent = nextCount.toLocaleString();
    } catch (err) {
        console.warn('Static view counter fallback activated:', err.message);
        viewCountEl.textContent = STATIC_VIEW_BASE.toLocaleString();
    }
}

// Background Music Player Logic
function initMusicPlayer() {
    const audio = document.getElementById('bg-music');
    const toggleBtn = document.getElementById('music-toggle-btn');
    const panel = document.getElementById('music-content');
    const playPauseBtn = document.getElementById('music-play-pause');
    const prevBtn = document.getElementById('music-prev');
    const nextBtn = document.getElementById('music-next');
    const shuffleBtn = document.getElementById('music-shuffle');
    const loopBtn = document.getElementById('music-loop');
    const volumeSlider = document.getElementById('music-volume');
    const speedSlider = document.getElementById('music-speed');
    const progressSlider = document.getElementById('music-progress');
    const titleEl = document.getElementById('music-title');
    const subtitleEl = document.getElementById('music-subtitle');
    const currentTimeEl = document.getElementById('music-current-time');
    const durationEl = document.getElementById('music-duration');
    const volumeValueEl = document.getElementById('music-volume-value');
    const speedValueEl = document.getElementById('music-speed-value');
    const trackCountEl = document.getElementById('music-track-count');
    const trackListEl = document.getElementById('music-track-list');
    const musicCover = document.getElementById('music-cover');
    const playlistSelect = document.getElementById('music-playlist-select');
    const startupSelect = document.getElementById('music-startup-select');
    const backdrop = document.getElementById('music-backdrop');

    if (!audio || !toggleBtn) return;
    const coverController = window.createMusicCoverController?.(document.getElementById('music-cover-image'));
    const lyricsController = window.createMusicLyricsController?.({ audio, element: document.getElementById('music-lyrics') });

    let playlist = [];
    let library = [];
    let activePlaylist = null;
    let startupPlaylist = 'random';
    let currentTrackIndex = -1;
    let isPlaying = false;
    let loopMode = 'off';
    // Every new page session starts shuffled, regardless of the last session.
    let shuffleMode = true;
    let playbackHistory = [];
    let audioContext = null;
    let sourceNode = null;
    let gainNode = null;
    let gainValue = volumeSlider ? parseFloat(volumeSlider.value || '1') : 1;
    let isSeeking = false;
    let hasBoundAutoplayUnlock = false;
    let isMutedAutoplay = false;
    let mediaVersion = 0;

    const humanizeTrackTitle = (filename) => {
        let decoded = filename;
        try { decoded = decodeURIComponent(filename); } catch { /* Literal percent in a filename. */ }
        return decoded
            .replace(/\.[^.]+$/, '')
            .replace(/^\d+\s*[-_.]?\s*/u, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const truncateText = (value, maxLength = 42) => {
        const text = String(value || '').trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
    };

    const getTrackSubtitle = (track, index) => {
        return `${index + 1}/${playlist.length} • ${truncateText(track.file, 38)}`;
    };

    const formatTime = (seconds) => {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00.00';
        // Count whole centiseconds so minute boundaries and LRC timestamps agree.
        const ticks = Math.floor(seconds * 100 + 1e-6);
        const mins = Math.floor(ticks / 6000);
        const secs = Math.floor(ticks / 100) % 60;
        const fraction = ticks % 100;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`;
    };

    const ensureAudioGraph = async() => {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
            sourceNode = audioContext.createMediaElementSource(audio);
            gainNode = audioContext.createGain();
            sourceNode.connect(gainNode);
            gainNode.connect(audioContext.destination);
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        if (gainNode) {
            gainNode.gain.value = gainValue;
        } else {
            audio.volume = Math.min(gainValue, 1);
        }
    };

    const showAutoplayPrompt = (textKey = 'start') => {
        if (!subtitleEl) return;
        if (textKey === 'sound') {
            subtitleEl.textContent = currentLang === 'vi'
                ? 'Nhấn bất kỳ chỗ nào để bật âm thanh'
                : 'Tap anywhere to enable sound';
            return;
        }
        subtitleEl.textContent = currentLang === 'vi'
            ? 'Nhấn bất kỳ chỗ nào để bật nhạc'
            : 'Tap anywhere to start audio';
    };

    const restoreTrackSubtitle = () => {
        if (!subtitleEl || currentTrackIndex < 0 || !playlist[currentTrackIndex]) return;
        subtitleEl.textContent = getTrackSubtitle(playlist[currentTrackIndex], currentTrackIndex);
        subtitleEl.title = playlist[currentTrackIndex].file;
    };

    const enableAudiblePlayback = async() => {
        if (!playlist.length || currentTrackIndex < 0) return;
        const version = mediaVersion;
        audio.defaultMuted = false;
        audio.muted = false;
        audio.removeAttribute('muted');
        isMutedAutoplay = false;

        if (gainValue > 1) {
            try {
                await ensureAudioGraph();
            } catch (error) {
                console.log('Audio graph not ready yet, fallback to normal volume.', error);
            }
        }

        if (audio.paused) {
            await audio.play();
        }
        if (version !== mediaVersion) return;

        isPlaying = !audio.paused;
        restoreTrackSubtitle();
        updatePlayState();
    };

    const isMusicRange = target => target instanceof Element && target.matches('.music-player input[type="range"]');
    const isMusicShortcut = (event) => {
        if (event.code !== 'Space' && event.key !== ' ') return false;
        if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
        const target = event.target;
        if (isMusicRange(target)) return true;
        return !(target instanceof Element && target.closest('input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], [role="slider"], [role="combobox"], audio[controls], video[controls]'));
    };
    [progressSlider, volumeSlider, speedSlider].filter(Boolean).forEach(input => {
        // Keep the range focused for arrow-key edits; Space switches to playback.
        input.addEventListener('keydown', event => {
            if (event.code !== 'Space' && event.key !== ' ') input.removeAttribute('data-space-shortcut');
        });
        input.addEventListener('blur', () => input.removeAttribute('data-space-shortcut'));
    });

    const bindAutoplayUnlock = () => {
        if (hasBoundAutoplayUnlock) return;
        hasBoundAutoplayUnlock = true;
        const unlockAutoplay = async(event) => {
            window.removeEventListener('pointerdown', unlockAutoplay, true);
            window.removeEventListener('touchstart', unlockAutoplay, true);
            window.removeEventListener('click', unlockAutoplay, true);
            window.removeEventListener('keydown', unlockAutoplay, true);
            hasBoundAutoplayUnlock = false;
            // Let the shortcut toggle once, without racing the autoplay unlock.
            if (event.type === 'keydown' && isMusicShortcut(event)) return;
            try {
                if (isMutedAutoplay) {
                    await enableAudiblePlayback();
                    return;
                }
                await playCurrent();
            } catch (error) {
                if (error.name !== 'AbortError') bindAutoplayUnlock();
            }
        };
        window.addEventListener('pointerdown', unlockAutoplay, { once: true, capture: true });
        window.addEventListener('touchstart', unlockAutoplay, { once: true, capture: true });
        window.addEventListener('click', unlockAutoplay, { once: true, capture: true });
        window.addEventListener('keydown', unlockAutoplay, { once: true, capture: true });
    };

    const getRandomIndex = (excludeIndex = -1) => {
        if (!playlist.length) return -1;
        if (playlist.length === 1) return 0;

        let randomIndex = Math.floor(Math.random() * playlist.length);
        while (randomIndex === excludeIndex) {
            randomIndex = Math.floor(Math.random() * playlist.length);
        }

        return randomIndex;
    };

    const updateShuffleUI = () => {
        if (!shuffleBtn) return;
        shuffleBtn.classList.toggle('active', shuffleMode);
        shuffleBtn.setAttribute('aria-pressed', String(shuffleMode));
        shuffleBtn.title = shuffleMode ? 'Phát ngẫu nhiên: Bật' : 'Phát ngẫu nhiên: Tắt';
        shuffleBtn.setAttribute('aria-label', shuffleBtn.title);
    };

    const updateLoopUI = () => {
        if (!loopBtn) return;
        loopBtn.classList.remove('active');
        loopBtn.title = 'Chế độ lặp';
        const icon = loopBtn.querySelector('i');

        if (loopMode === 'one') {
            loopBtn.classList.add('active');
            if (icon) icon.className = 'fas fa-repeat-1';
            loopBtn.title = 'Lặp một bài';
        } else if (loopMode === 'all') {
            loopBtn.classList.add('active');
            if (icon) icon.className = 'fas fa-repeat';
            loopBtn.title = 'Lặp toàn playlist';
        } else if (icon) {
            icon.className = 'fas fa-repeat';
            loopBtn.title = 'Không lặp';
        }
        loopBtn.setAttribute('aria-label', loopBtn.title);
        loopBtn.setAttribute('aria-pressed', String(loopMode !== 'off'));
    };

    const updatePlayState = () => {
        if (!playPauseBtn || !toggleBtn) return;
        const icon = playPauseBtn.querySelector('i');
        const btnIcon = toggleBtn.querySelector('i');
        playPauseBtn.setAttribute('aria-label', isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc');
        playPauseBtn.title = isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc';

        if (isPlaying) {
            if (icon) icon.className = 'fas fa-pause';
            toggleBtn.classList.add('playing');
            if (musicCover) musicCover.classList.add('playing');
            if (btnIcon) btnIcon.className = 'fas fa-compact-disc fa-spin';
        } else {
            if (icon) icon.className = 'fas fa-play';
            toggleBtn.classList.remove('playing');
            if (musicCover) musicCover.classList.remove('playing');
            if (btnIcon) btnIcon.className = 'fas fa-music';
        }
    };

    const renderTrackList = () => {
        if (!trackListEl) return;
        trackListEl.innerHTML = '';
        [playPauseBtn, prevBtn, nextBtn, progressSlider].forEach(control => {
            if (control) control.disabled = !playlist.length;
        });
        if (!playlist.length) {
            const empty = document.createElement('p');
            empty.className = 'music-empty';
            empty.textContent = currentLang === 'vi' ? 'Playlist này chưa có bài hát.' : 'This playlist has no tracks yet.';
            trackListEl.append(empty);
        }

        playlist.forEach((track, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `music-track-item${index === currentTrackIndex ? ' active' : ''}`;
            item.title = `${track.title} (${track.file})`;
            if (index === currentTrackIndex) item.setAttribute('aria-current', 'true');
            const number = document.createElement('span');
            number.className = 'music-track-index';
            number.textContent = String(index + 1).padStart(2, '0');
            const meta = document.createElement('span');
            meta.className = 'music-track-meta';
            const name = document.createElement('span');
            name.className = 'music-track-name';
            name.textContent = name.title = track.title;
            const file = document.createElement('span');
            file.className = 'music-track-file';
            file.textContent = file.title = track.file;
            meta.append(name, file);
            item.append(number, meta);
            item.addEventListener('click', () => {
                if (shuffleMode && currentTrackIndex >= 0 && currentTrackIndex !== index) {
                    playbackHistory.push(currentTrackIndex);
                }
                loadTrack(index, true);
            });
            trackListEl.appendChild(item);
        });

        if (trackCountEl) {
            trackCountEl.textContent = `${playlist.length} track${playlist.length === 1 ? '' : 's'}`;
        }
    };

    const syncProgress = () => {
        if (!progressSlider || isSeeking) return;
        const duration = audio.duration || 0;
        const current = audio.currentTime || 0;
        progressSlider.value = duration ? (current / duration) * 100 : 0;
        progressSlider.dispatchEvent(new Event('elastic:sync'));
        progressSlider.setAttribute('aria-valuetext', `${formatTime(current)} / ${formatTime(duration)}`);
        if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
        if (durationEl) durationEl.textContent = formatTime(duration);
    };

    const loadTrack = (index, autoPlay = false, shouldLoadMedia = true) => {
        if (!playlist.length) return;
        mediaVersion++;
        isSeeking = false;
        currentTrackIndex = (index + playlist.length) % playlist.length;
        const track = playlist[currentTrackIndex];
        coverController?.setTrack(track.id, track.title);
        lyricsController?.setTrack(track);

        if (shouldLoadMedia) {
            audio.src = track.url;
            audio.load();
        } else {
            audio.removeAttribute('src');
            audio.load();
        }

        if (titleEl) {
            titleEl.textContent = track.title;
            titleEl.title = track.title;
        }
        if (subtitleEl) {
            subtitleEl.textContent = getTrackSubtitle(track, currentTrackIndex);
            subtitleEl.title = track.file;
        }
        if (currentTimeEl) currentTimeEl.textContent = '00:00.00';
        if (durationEl) durationEl.textContent = '00:00.00';
        if (progressSlider) {
            progressSlider.value = 0;
            progressSlider.dispatchEvent(new Event('elastic:sync'));
        }

        renderTrackList();

        if (autoPlay) {
            playCurrent();
        } else {
            isPlaying = false;
            updatePlayState();
        }
    };

    const tryMutedAutoplay = async(error, version) => {
        if (version !== mediaVersion || !playlist.length) return;
        console.log('Audible autoplay prevented by browser, trying muted autoplay...', error);
        try {
            audio.defaultMuted = true;
            audio.muted = true;
            audio.setAttribute('muted', '');
            await audio.play();
            if (version !== mediaVersion) return;
            isMutedAutoplay = true;
            isPlaying = true;
            showAutoplayPrompt('sound');
            updatePlayState();
            bindAutoplayUnlock();
        } catch (mutedError) {
            if (version !== mediaVersion || mutedError.name === 'AbortError') return;
            console.log('Autoplay prevented by browser, waiting for interaction...', mutedError);
            isMutedAutoplay = false;
            isPlaying = false;
            updatePlayState();
            showAutoplayPrompt('start');
            bindAutoplayUnlock();
        }
    };

    const playCurrent = async({ allowMutedFallback = false } = {}) => {
        if (!playlist.length || currentTrackIndex < 0) return;
        let version = mediaVersion;
        try {
            if (!audio.currentSrc && currentTrackIndex >= 0) {
                loadTrack(currentTrackIndex, false, true);
                version = mediaVersion;
            }
            audio.defaultMuted = false;
            audio.muted = false;
            audio.removeAttribute('muted');
            isMutedAutoplay = false;
            if (gainNode) {
                gainNode.gain.value = gainValue;
            } else {
                audio.volume = Math.min(gainValue, 1);
            }
            if (gainValue > 1) {
                try {
                    await ensureAudioGraph();
                } catch (error) {
                    console.log('Audio graph not ready yet, fallback to normal volume.', error);
                }
            }
            await audio.play();
            if (version !== mediaVersion) return;
            isPlaying = !audio.paused;
            restoreTrackSubtitle();
            updatePlayState();
        } catch (error) {
            if (version !== mediaVersion || error.name === 'AbortError') return;
            if (allowMutedFallback) {
                await tryMutedAutoplay(error, version);
                return;
            }
            console.log('Autoplay prevented by browser, waiting for interaction...', error);
            isPlaying = false;
            updatePlayState();
            showAutoplayPrompt('start');
            bindAutoplayUnlock();
        }
    };

    const pauseCurrent = () => {
        audio.pause();
        isPlaying = false;
        updatePlayState();
    };

    const playNext = (autoPlay = true) => {
        if (!playlist.length) return;
        if (shuffleMode) {
            if (currentTrackIndex >= 0) {
                playbackHistory.push(currentTrackIndex);
            }
            loadTrack(getRandomIndex(currentTrackIndex), autoPlay);
            return;
        }
        loadTrack(currentTrackIndex + 1, autoPlay);
    };

    const playPrev = () => {
        if (!playlist.length) return;
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            syncProgress();
            return;
        }
        if (shuffleMode && playbackHistory.length) {
            loadTrack(playbackHistory.pop(), true);
            return;
        }
        if (shuffleMode) {
            loadTrack(getRandomIndex(currentTrackIndex), true);
            return;
        }
        loadTrack(currentTrackIndex - 1, true);
    };

    const renderPlaylistSelectors = () => {
        playlistSelect?.replaceChildren();
        startupSelect?.replaceChildren();
        if (startupSelect) {
            const random = document.createElement('option');
            random.value = 'random';
            random.textContent = currentLang === 'vi' ? 'Ngẫu nhiên playlist có bài' : 'Random non-empty playlist';
            startupSelect.append(random);
        }
        library.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = `${entry.name} · ${entry.tracks.length}`;
            playlistSelect?.append(option);
            const startupOption = option.cloneNode(true);
            startupOption.disabled = !entry.tracks.length;
            startupSelect?.append(startupOption);
        });
        if (playlistSelect && activePlaylist) playlistSelect.value = activePlaylist.id;
        if (startupSelect) startupSelect.value = startupPlaylist;
    };

    const selectPlaylist = (id, autoPlay = true) => {
        const entry = library.find(item => item.id === id);
        if (!entry) return;
        // Only this function changes playlists. Next/ended/shuffle never call it.
        mediaVersion++;
        pauseCurrent();
        activePlaylist = entry;
        playlist = entry.tracks;
        currentTrackIndex = -1;
        playbackHistory = [];
        isSeeking = false;
        if (playlistSelect) playlistSelect.value = entry.id;
        panel.dataset.playlist = entry.id;
        if (!playlist.length) {
            audio.removeAttribute('src');
            audio.load();
            if (titleEl) titleEl.textContent = titleEl.title = entry.name;
            if (subtitleEl) subtitleEl.textContent = currentLang === 'vi' ? 'Playlist này chưa có bài hát.' : 'This playlist has no tracks yet.';
            coverController?.clearTrack(entry.name);
            lyricsController?.setTrack(null);
            syncProgress();
            renderTrackList();
            return;
        }
        loadTrack(shuffleMode ? getRandomIndex() : 0, autoPlay);
    };

    const bootstrapPlaylist = () => {
        const config = window.MEOW_MUSIC_LIBRARY || {};
        const ids = new Set();
        library = (Array.isArray(config.playlists) ? config.playlists : []).flatMap(entry => {
            if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9_-]+$/i.test(entry.id) || ids.has(entry.id) || typeof entry.folder !== 'string' || !entry.folder || /[\\/]/.test(entry.folder) || entry.folder === '..') return [];
            ids.add(entry.id);
            const tracks = (Array.isArray(entry.tracks) ? entry.tracks : []).flatMap(item => {
                const file = typeof item === 'string' ? item : item?.file;
                if (typeof file !== 'string' || !file || /[\\/]/.test(file)) return [];
                const title = typeof item?.title === 'string' ? item.title.trim() : '';
                return [{
                    id: `${entry.id}:${file}`,
                    file,
                    title: title || humanizeTrackTitle(file),
                    url: `./assets/music/${encodeURIComponent(entry.folder)}/${encodeURIComponent(file)}`
                }];
            });
            return [{ id: entry.id, name: entry.name || entry.id, tracks }];
        });
        const available = library.filter(entry => entry.tracks.length);
        const canAutoplay = id => id === 'random' || available.some(entry => entry.id === id);
        const saved = localStorage.getItem(MUSIC_STARTUP_PLAYLIST_KEY);
        startupPlaylist = canAutoplay(saved) ? saved : canAutoplay(config.startupPlaylist) ? config.startupPlaylist : 'random';
        renderPlaylistSelectors();
        const initial = available.find(entry => entry.id === startupPlaylist) || available[Math.floor(Math.random() * available.length)];
        if (initial) {
            selectPlaylist(initial.id, false);
            playCurrent({ allowMutedFallback: true });
        } else if (library.length) selectPlaylist(library[0].id, false);
        else renderTrackList();
    };

    playlistSelect?.addEventListener('change', () => selectPlaylist(playlistSelect.value));
    startupSelect?.addEventListener('change', () => {
        startupPlaylist = startupSelect.value;
        localStorage.setItem(MUSIC_STARTUP_PLAYLIST_KEY, startupPlaylist);
        showToast(currentLang === 'vi' ? 'Đã lưu lựa chọn tự phát cho lần mở web sau.' : 'Startup playlist saved for your next visit.');
    });
    document.addEventListener('bio:languagechange', () => {
        renderPlaylistSelectors();
        renderTrackList();
        if (activePlaylist && !playlist.length && subtitleEl) subtitleEl.textContent = currentLang === 'vi' ? 'Playlist này chưa có bài hát.' : 'This playlist has no tracks yet.';
    });

    // Fog separates the player from the page while retaining the dock controls.
    const backgroundElements = [...document.querySelectorAll('.app-container, .floating-view-badge, .back-to-top-btn')];
    const previousInert = new Map();
    const setPanelOpen = (open) => {
        const wasOpen = panel.classList.contains('active');
        panel.classList.toggle('active', open);
        panel.inert = !open;
        lyricsController?.setOpen(open);
        backdrop?.classList.toggle('active', open);
        document.body.classList.toggle('music-is-open', open);
        if (wasOpen !== open) {
            backgroundElements.forEach(element => {
                if (open) { previousInert.set(element, element.inert); element.inert = true; }
                else element.inert = previousInert.get(element) || false;
            });
            if (!open) previousInert.clear();
        }
        toggleBtn.setAttribute('aria-expanded', String(open));
        if (open) {
            document.dispatchEvent(new CustomEvent('bio:panelopen', { detail: 'music' }));
            document.getElementById('music-close')?.focus({ preventScroll: true });
        }
        if (!open && panel.contains(document.activeElement)) toggleBtn.focus({ preventScroll: true });
    };
    document.addEventListener('bio:panelopen', event => { if (event.detail !== 'music') setPanelOpen(false); });
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setPanelOpen(!panel.classList.contains('active'));
    });
    document.getElementById('music-close')?.addEventListener('click', () => setPanelOpen(false));
    backdrop?.addEventListener('click', () => setPanelOpen(false));

    // Close with the dock, close button, backdrop or Escape.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('active')) {
            setPanelOpen(false);
        }
        if (isMusicShortcut(e) && playlist.length && currentTrackIndex >= 0) {
            e.preventDefault();
            if (isMusicRange(e.target)) e.target.setAttribute('data-space-shortcut', 'true');
            if (e.repeat) return;
            if (audio.paused) playCurrent();
            else pauseCurrent();
        }
    });

    // Play/Pause Button inside panel
    playPauseBtn.addEventListener('click', () => {
        if (!audio.paused) {
            pauseCurrent();
        } else {
            playCurrent();
        }
    });

    prevBtn?.addEventListener('click', playPrev);
    nextBtn?.addEventListener('click', () => playNext(true));

    shuffleBtn?.addEventListener('click', () => {
        shuffleMode = !shuffleMode;
        playbackHistory = [];
        updateShuffleUI();
    });

    loopBtn?.addEventListener('click', () => {
        if (loopMode === 'off') {
            loopMode = 'one';
        } else if (loopMode === 'one') {
            loopMode = 'all';
        } else {
            loopMode = 'off';
        }
        updateLoopUI();
    });

    // Volume Control up to 200%
    volumeSlider.addEventListener('input', (e) => {
        gainValue = parseFloat(e.target.value);
        if (volumeValueEl) volumeValueEl.textContent = `${Math.round(gainValue * 100)}%`;
        if (gainNode) {
            gainNode.gain.value = gainValue;
            return;
        }
        audio.volume = Math.min(gainValue, 1);
        if (gainValue > 1) {
            ensureAudioGraph().catch(() => {
                bindAutoplayUnlock();
            });
        }
    });

    speedSlider?.addEventListener('input', (e) => {
        const speed = parseFloat(e.target.value);
        audio.defaultPlaybackRate = speed;
        audio.playbackRate = speed;
        if (speedValueEl) speedValueEl.textContent = `${speed.toFixed(2)}x`;
    });

    progressSlider?.addEventListener('input', () => {
        isSeeking = true;
        const previewTime = (audio.duration || 0) * (parseFloat(progressSlider.value) / 100);
        if (currentTimeEl) currentTimeEl.textContent = formatTime(previewTime);
        progressSlider.setAttribute('aria-valuetext', `${formatTime(previewTime)} / ${formatTime(audio.duration || 0)}`);
    });

    progressSlider?.addEventListener('change', () => {
        const duration = audio.duration || 0;
        audio.currentTime = duration * (parseFloat(progressSlider.value) / 100);
        isSeeking = false;
        syncProgress();
    });

    audio.addEventListener('timeupdate', syncProgress);
    audio.addEventListener('seeked', syncProgress);
    audio.addEventListener('loadedmetadata', syncProgress);
    audio.addEventListener('play', () => {
        isPlaying = !audio.paused;
        updatePlayState();
    });
    audio.addEventListener('pause', () => {
        isPlaying = !audio.paused;
        updatePlayState();
    });
    audio.addEventListener('ended', () => {
        if (!playlist.length) return;
        if (loopMode === 'one') {
            audio.currentTime = 0;
            playCurrent();
            return;
        }

        if (shuffleMode) {
            playNext(true);
            return;
        }

        const isLastTrack = currentTrackIndex === playlist.length - 1;
        if (isLastTrack && loopMode !== 'all') {
            pauseCurrent();
            audio.currentTime = 0;
            syncProgress();
            return;
        }

        playNext(true);
    });

    audio.addEventListener('error', () => {
        if (!playlist.length) return;
        const missingText = currentLang === 'vi'
            ? 'Không mở được file nhạc hiện tại'
            : 'Unable to load the current audio file';
        if (subtitleEl) subtitleEl.textContent = missingText;
        isPlaying = false;
        updatePlayState();
    });

    if (volumeValueEl) volumeValueEl.textContent = `${Math.round(gainValue * 100)}%`;
    if (speedValueEl) speedValueEl.textContent = `${audio.playbackRate.toFixed(2)}x`;
    updateShuffleUI();
    updateLoopUI();
    bootstrapPlaylist();
}

function initFocusBubble() {
    const bubbleEl = document.getElementById('focus-status-bubble');
    if (!bubbleEl) return;

    let weatherTemp = '--°C';
    let weatherLabelVi = 'Đang tải';
    let weatherLabelEn = 'Loading';
    let locationVi = 'TP.HCM • Việt Nam';
    let locationEn = 'HCMC • Vietnam';
    let regionVi = 'Đồng Nai • Việt Nam';
    let regionEn = 'Dong Nai • Vietnam';
    let currentIndex = 0;
    let geoLat = 10.8231;
    let geoLon = 106.6297;

    const weatherMapVi = {
        0: 'Trời quang',
        1: 'Ít mây',
        2: 'Có mây',
        3: 'Nhiều mây',
        45: 'Sương mù',
        48: 'Sương mù',
        51: 'Mưa nhẹ',
        53: 'Mưa vừa',
        55: 'Mưa đậm',
        61: 'Mưa nhẹ',
        63: 'Mưa vừa',
        65: 'Mưa to',
        80: 'Mưa rào',
        81: 'Mưa rào',
        82: 'Mưa lớn',
        95: 'Giông',
    };

    const weatherMapEn = {
        0: 'Clear',
        1: 'Mostly clear',
        2: 'Partly cloudy',
        3: 'Cloudy',
        45: 'Foggy',
        48: 'Foggy',
        51: 'Light rain',
        53: 'Rain',
        55: 'Heavy rain',
        61: 'Light rain',
        63: 'Rain',
        65: 'Heavy rain',
        80: 'Showers',
        81: 'Showers',
        82: 'Heavy showers',
        95: 'Thunder',
    };

    const normalizeLocationText = (value) => {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const toCompareKey = (value) => {
        return normalizeLocationText(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };

    const updateWeatherByCoords = (latitude, longitude) => {
        return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`)
            .then((response) => {
                if (!response.ok) throw new Error('weather_unavailable');
                return response.json();
            })
            .then((data) => {
                const temp = data?.current?.temperature_2m;
                const code = data?.current?.weather_code;

                if (typeof temp === 'number') {
                    weatherTemp = `${Math.round(temp)}°C`;
                }

                if (typeof code === 'number') {
                    weatherLabelVi = weatherMapVi[code] || 'Thời tiết';
                    weatherLabelEn = weatherMapEn[code] || 'Weather';
                }
            })
            .catch(() => {
                weatherLabelVi = 'Thời tiết';
                weatherLabelEn = 'Weather';
            });
    };

    const updateLocationByCoords = (latitude, longitude) => {
        return fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=vi`)
            .then((response) => {
                if (!response.ok) throw new Error('reverse_unavailable');
                return response.json();
            })
            .then((data) => {
                const address = data?.address || {};
                const city =
                    address.city ||
                    address.town ||
                    address.village ||
                    address.municipality ||
                    address.county ||
                    address.state_district;
                const state = address.state || address.region || city;
                const country = address.country || 'Việt Nam';

                const cityVi = normalizeLocationText(city || state || 'Việt Nam');
                const stateVi = normalizeLocationText(state || cityVi);
                const countryVi = normalizeLocationText(country);

                locationVi = `${cityVi} • ${countryVi}`;
                regionVi = `${stateVi} • ${countryVi}`;

                const cityEn = cityVi;
                const stateEn = stateVi;
                const countryEn = countryVi === 'Việt Nam' ? 'Vietnam' : countryVi;

                locationEn = `${cityEn} • ${countryEn}`;
                regionEn = `${stateEn} • ${countryEn}`;
            })
            .catch(() => {
                locationVi = 'TP.HCM • Việt Nam';
                locationEn = 'HCMC • Vietnam';
                regionVi = 'Đồng Nai • Việt Nam';
                regionEn = 'Dong Nai • Vietnam';
            });
    };

    const renderBubble = () => {
        const now = new Date();
        const localTime = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        const localDate = now.toLocaleDateString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        const weekdayViRaw = now.toLocaleDateString('vi-VN', {
            weekday: 'long',
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        const weekdayEnRaw = now.toLocaleDateString('en-US', {
            weekday: 'long',
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        const weekdayVi = weekdayViRaw.charAt(0).toUpperCase() + weekdayViRaw.slice(1);
        const weekdayEn = weekdayEnRaw.charAt(0).toUpperCase() + weekdayEnRaw.slice(1);

        const locationSlides = currentLang === 'vi'
            ? [
                `<span class="focus-bubble-line"><i class="fas fa-location-dot"></i> ${locationVi}</span>`,
                toCompareKey(locationVi) !== toCompareKey(regionVi)
                    ? `<span class="focus-bubble-line"><i class="fas fa-map-pin"></i> ${regionVi}</span>`
                    : null,
            ]
            : [
                `<span class="focus-bubble-line"><i class="fas fa-location-dot"></i> ${locationEn}</span>`,
                toCompareKey(locationEn) !== toCompareKey(regionEn)
                    ? `<span class="focus-bubble-line"><i class="fas fa-map-pin"></i> ${regionEn}</span>`
                    : null,
            ];

        const slides = [
            ...locationSlides.filter(Boolean),
            currentLang === 'vi'
                ? `<span class="focus-bubble-line"><i class="fas fa-cloud-sun"></i> ${weatherTemp} • ${weatherLabelVi}</span>`
                : `<span class="focus-bubble-line"><i class="fas fa-cloud-sun"></i> ${weatherTemp} • ${weatherLabelEn}</span>`,
            `<span class="focus-bubble-line"><i class="fas fa-clock"></i> ${localTime} • VN</span>`,
            `<span class="focus-bubble-line"><i class="fas fa-calendar-days"></i> ${localDate}</span>`,
            currentLang === 'vi'
                ? `<span class="focus-bubble-line"><i class="fas fa-sun"></i> ${weekdayVi} • Have a nice day :)</span>`
                : `<span class="focus-bubble-line"><i class="fas fa-sun"></i> ${weekdayEn} • Have a nice day :)</span>`,
        ];

        bubbleEl.innerHTML = slides[currentIndex % slides.length];
    };

    renderBubble();
    setInterval(() => {
        currentIndex += 1;
        renderBubble();
    }, 3200);

    setInterval(renderBubble, 30000);

    const hydrateByCoords = (latitude, longitude) => {
        geoLat = latitude;
        geoLon = longitude;

        Promise.all([
            updateLocationByCoords(latitude, longitude),
            updateWeatherByCoords(latitude, longitude),
        ]).finally(renderBubble);
    };

    runWhenIdle(() => {
        hydrateByCoords(geoLat, geoLon);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    hydrateByCoords(latitude, longitude);
                },
                () => {
                    renderBubble();
                }, {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 900000,
                }
            );
        }
    }, 1800);
}

function getSectionToggleText(isExpanded) {
    if (currentLang === 'en') {
        return isExpanded ? 'Collapse section' : 'Show details';
    }
    return isExpanded ? 'Thu gọn mục' : 'Xem chi tiết';
}

function updateSectionToggleLabels() {
    document.querySelectorAll('.section-toggle-btn').forEach((button) => {
        const sectionId = button.dataset.sectionTarget;
        const section = sectionId ? document.getElementById(sectionId) : button.closest('.collapsible-section');
        const isExpanded = Boolean(section && !section.classList.contains('is-collapsed'));
        const label = getSectionToggleText(isExpanded);
        button.title = label;
        button.setAttribute('aria-label', label);
    });
}

function revealExpandedSectionContent(section) {
    section.querySelectorAll('.fade-up').forEach((el) => {
        el.classList.add('in-view');
    });
    section.querySelectorAll('.skill-box').forEach(animateSkillBars);
}

function markSectionReady(section) {
    section.classList.remove('is-lazy-pending');
    section.classList.add('is-lazy-ready');
}

function syncSectionBodyHeight(section, forceOpen = false) {
    const body = section.querySelector(':scope > .section-collapse-body');
    if (!body) return;
    const isOpen = forceOpen || !section.classList.contains('is-collapsed');
    body.style.maxHeight = isOpen ? 'none' : '0px';
}

function expandSectionById(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section || !section.classList.contains('collapsible-section')) return;
    markSectionReady(section);
    if (!section.classList.contains('is-collapsed')) {
        syncSectionBodyHeight(section, true);
        return;
    }
    section.classList.remove('is-collapsed');
    const toggle = section.querySelector(':scope > .section-header .section-toggle-btn');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    revealExpandedSectionContent(section);
    syncSectionBodyHeight(section, true);
    updateSectionToggleLabels();
}

function initCollapsibleSections() {
    document.querySelectorAll('.collapsible-section').forEach((section) => {
        const header = section.querySelector(':scope > .section-header');
        if (!header || header.querySelector('.section-toggle-btn')) return;

        header.classList.add('section-header-collapsible');

        const headingCopy = document.createElement('div');
        headingCopy.className = 'section-heading-copy';
        while (header.firstChild) {
            headingCopy.appendChild(header.firstChild);
        }
        header.appendChild(headingCopy);

        
        const bodyWrap = document.createElement('div');
        bodyWrap.className = 'section-collapse-body';
        while (header.nextSibling) {
            bodyWrap.appendChild(header.nextSibling);
        }
        section.appendChild(bodyWrap);
        syncSectionBodyHeight(section);
        bodyWrap.addEventListener('transitionend', (event) => {
            if (event.target === bodyWrap && event.propertyName === 'max-height') {
                syncSectionBodyHeight(section);
            }
        });

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'section-toggle-btn';
        toggleBtn.dataset.sectionTarget = section.id;
        toggleBtn.setAttribute('aria-controls', section.id);
        toggleBtn.setAttribute('aria-expanded', String(!section.classList.contains('is-collapsed')));
        toggleBtn.innerHTML = '<i class="fas fa-chevron-down" aria-hidden="true"></i>';

        toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const isOpening = section.classList.contains('is-collapsed');
            const body = section.querySelector(':scope > .section-collapse-body');

            if (isOpening) {
                markSectionReady(section);
            }

            if (body) {
                body.style.maxHeight = body.getBoundingClientRect().height + 'px';
                void body.offsetHeight;
            }

            section.classList.toggle('is-collapsed', !isOpening);
            toggleBtn.setAttribute('aria-expanded', String(isOpening));
            updateSectionToggleLabels();

            if (isOpening) {
                revealExpandedSectionContent(section);
            }
        
            window.requestAnimationFrame(() => {
                if (!body || prefersReducedMotion()) {
                    syncSectionBodyHeight(section, isOpening);
                    return;
                }
                body.style.maxHeight = isOpening ? body.scrollHeight + 'px' : '0px';
            });
        });

        header.appendChild(toggleBtn);
    });

    updateSectionToggleLabels();

    window.addEventListener('resize', () => {
        document.querySelectorAll('.collapsible-section').forEach((section) => syncSectionBodyHeight(section));
    }, { passive: true });

}


function initLazySections() {
    const lazySections = Array.from(document.querySelectorAll('.content-wrapper .section')).slice(2);
    if (!lazySections.length) return;

    lazySections.forEach((section) => {
        section.classList.add('is-lazy-pending');
    });

    const lazyObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.remove('is-lazy-pending');
            entry.target.classList.add('is-lazy-ready');
            obs.unobserve(entry.target);
        });
    }, { rootMargin: '240px 0px', threshold: 0.01 });

    lazySections.forEach((section) => lazyObserver.observe(section));
}

function initBackToTop() {
    const button = document.getElementById('back-to-top');
    if (!button) return;

    const syncVisibility = () => {
        button.classList.toggle('is-visible', window.scrollY > 520);
    };

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    window.addEventListener('scroll', syncVisibility, { passive: true });
    syncVisibility();
}


function initSecurityLabEmbed() {
    const frame = document.querySelector('.security-lab-iframe');
    const section = document.getElementById('security-lab');
    if (!frame || !section) return;

    let isFrameInViewport = false;

    const postPauseState = () => {
        const paused = section.classList.contains('is-collapsed') || !isFrameInViewport || document.hidden;
        frame.contentWindow?.postMessage({ type: 'securityLab:setPaused', paused }, '*');
    };

    const sync = () => {
        if (typeof syncSectionBodyHeight === 'function' && !section.classList.contains('is-collapsed')) {
            syncSectionBodyHeight(section, true);
        }
        postPauseState();
    };

    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            isFrameInViewport = entries.some((entry) => entry.isIntersecting);
            postPauseState();
        }, { rootMargin: '160px 0px', threshold: 0.01 }).observe(frame);
    } else {
        isFrameInViewport = true;
    }

    new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['class'] });
    frame.addEventListener('load', sync);
    document.addEventListener('visibilitychange', postPauseState);
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('scroll', postPauseState, { passive: true });
    sync();
}

// Initialize client-side features on load
document.addEventListener('DOMContentLoaded', () => {
    initPageLoadIntro();
    initCollapsibleSections();
    initSourceProtection();
    initThemeManager();
    initMCPing();
    if (document.getElementById('lanyard-username')) {
        connectLanyard();
    }
    initViewCounter();
    initMusicPlayer();
    initFocusBubble();
    initSecurityLabEmbed();

    // Toggle Status Bubble by clicking Avatar
    const avatarContainer = document.querySelector('.discord-avatar-container');
    const statusBubble = document.getElementById('lanyard-status-bubble');
    if (avatarContainer && statusBubble) {
        avatarContainer.addEventListener('click', () => {
            isBubbleManuallyHidden = !isBubbleManuallyHidden;
            if (isBubbleManuallyHidden) {
                statusBubble.classList.remove('show');
            } else {
                // Only show if there's actually a status to show
                if (currentLanyardData && currentLanyardData.activities) {
                    const customAct = currentLanyardData.activities.find(a => a.type === 4);
                    if (customAct && customAct.state && currentLanyardData.discord_status !== 'offline') {
                        statusBubble.classList.add('show');
                    }
                }
            }
        });
    }

    // Reload Pings Button Logic
    const reloadBtn = document.getElementById('reload-pings');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', async() => {
        if (reloadBtn.classList.contains('loading')) return;

            reloadBtn.classList.add('loading');
            await initMCPing();

            // Thêm hiệu ứng hoàn thành
            setTimeout(() => {
                reloadBtn.classList.remove('loading');
                showToast(currentLang === 'vi' ? 'Đã cập nhật trạng thái!' : 'Status updated!', 2000);
            }, 600);
        });
    }

});
