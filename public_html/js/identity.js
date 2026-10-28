/* Canonical identity for UI copy, translations and browser metadata.
 * index.html keeps matching static text/SEO for first paint and crawlers.
 */
(() => {
    'use strict';
    const identity = Object.freeze({
        displayName: 'Meow Bebyboi',
        fullName: 'Nguyễn Lâm Hùng',
        githubUsername: 'EmBeHocCode',
        signatureYear: '2026',
        website: 'https://bio.mieowparadise.io.vn/'
    });
    const { displayName, fullName } = identity;
    const copy = {
        vi: {
            about: `Mình là <strong>${fullName}</strong>, thường sử dụng biệt danh <strong>${displayName}</strong> trên môi trường trực tuyến. Hiện mình đang theo học Công nghệ thông tin, định hướng E-Commerce và phát triển các sản phẩm web có giá trị thực tế.`,
            bio: 'Năm 3 IT | TP.HCM, Việt Nam<br><br>Mình theo hướng E-Commerce, thích xây web product, mini tools và dùng AI để tăng tốc triển khai, với tư duy chiến lược và planning ở phía con người.',
            title: `${displayName} | E-Commerce Student & AI-Assisted Builder`,
            description: `${displayName} — Nguyễn Lâm Hùng, sinh viên Công nghệ thông tin định hướng E-Commerce, xây web product và công cụ hữu ích với tư duy sản phẩm và AI-assisted workflow.`
        },
        en: {
            about: `I'm <strong>${fullName}</strong>, known online as <strong>${displayName}</strong>. I'm studying Information Technology with a focus on E-Commerce and building web products with practical value.`,
            bio: '3rd-year IT student | Ho Chi Minh City, Vietnam<br><br>I focus on E-Commerce, build web products and mini tools, and use AI to accelerate execution while keeping strategy and planning human-led.',
            title: `${displayName} | E-Commerce Student & AI-Assisted Builder`,
            description: `${displayName} — Nguyễn Lâm Hùng, an Information Technology student focused on E-Commerce, useful web products, product thinking and AI-assisted workflows.`
        }
    };
    window.MeowIdentity = identity;

    document.querySelectorAll('[data-identity]').forEach(element => {
        const value = identity[element.dataset.identity];
        if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll('[data-identity-copy]').forEach(element => {
        const key = element.dataset.identityCopy;
        for (const lang of ['vi', 'en']) element.setAttribute(`data-${lang}`, copy[lang][key]);
    });

    function updateMetadata(lang) {
        const locale = copy[lang] ? lang : 'vi';
        const content = copy[locale];
        document.documentElement.lang = locale;
        document.title = content.title;
        const values = {
            'meta[name="description"]': content.description,
            'meta[name="author"]': fullName,
            'meta[property="og:title"]': content.title,
            'meta[property="og:description"]': content.description,
            'meta[property="og:site_name"]': displayName,
            'meta[property="og:locale"]': locale === 'vi' ? 'vi_VN' : 'en_US',
            'meta[property="og:locale:alternate"]': locale === 'vi' ? 'en_US' : 'vi_VN',
            'meta[name="twitter:title"]': content.title,
            'meta[name="twitter:description"]': content.description
        };
        for (const [selector, value] of Object.entries(values)) {
            document.querySelector(selector)?.setAttribute('content', value);
        }
    }
    const onLanguage = event => updateMetadata(event.detail.lang);
    document.addEventListener('bio:languagechange', onLanguage);
    // The main language initializer follows this script and applies body translations.
    let language = 'vi';
    try { language = localStorage.getItem('lang') || 'vi'; } catch { /* Static VI remains usable. */ }
    updateMetadata(language);
})();
