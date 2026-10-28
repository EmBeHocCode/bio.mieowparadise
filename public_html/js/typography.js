/* One-shot section sweeps + visibility-controlled CSS loops. No animation RAF. */
(() => {
    'use strict';
    let dispose = null;
    function mount() {
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        const loops = [...document.querySelectorAll('[data-shiny-loop]')];
        const visibleLoops = new Set();
        document.body.classList.add('typography-ready');
        const updateLoops = () => {
            loops.forEach(element => element.classList.toggle('is-shiny-visible',
                visibleLoops.has(element) && !document.hidden && !motion.matches));
        };
        const loopObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) visibleLoops.add(entry.target);
                else visibleLoops.delete(entry.target);
            });
            updateLoops();
        }, { threshold: 0.15 });
        loops.forEach(element => loopObserver.observe(element));

        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.querySelectorAll('[data-shiny-once]').forEach(element => {
                    element.classList.add('is-shiny-revealed');
                    element.dataset.shinyPlayed = 'true';
                });
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.2, rootMargin: '0px 0px -5% 0px' });
        document.querySelectorAll('.section-header').forEach(header => {
            if (header.querySelector('[data-shiny-once]:not(.is-shiny-revealed)')) revealObserver.observe(header);
        });
        document.addEventListener('visibilitychange', updateLoops);
        motion.addEventListener('change', updateLoops);
        return () => {
            loopObserver.disconnect();
            revealObserver.disconnect();
            document.removeEventListener('visibilitychange', updateLoops);
            motion.removeEventListener('change', updateLoops);
            loops.forEach(element => element.classList.remove('is-shiny-visible'));
            document.body.classList.remove('typography-ready');
        };
    }
    function start() { if (!dispose) dispose = mount(); }
    window.addEventListener('pagehide', () => { dispose?.(); dispose = null; });
    window.addEventListener('pageshow', start);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
