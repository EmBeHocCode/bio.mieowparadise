/* Identity-only vanilla adaptation of React Bits ShinyText by David Haz (2026).
 * Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/ShinyText
 * License: assets/vendor/react-bits/LICENSE.md (MIT + Commons Clause).
 * Preset: #726d6d / #f7f7f7, width 19, softness .8, angle 131,
 * 1.3s sweep + .8s rest, left, smooth, yoyo, followPointer, pauseOnHover.
 */
(() => {
    'use strict';
    let dispose;
    function mount(root) {
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const forced = matchMedia('(forced-colors: active)');
        const base = [114, 109, 109], shine = [247, 247, 247];
        const extent = 11.5, entry = 100 + extent, exit = -extent;
        // Match upstream gamma-correct color interpolation and soft band falloff.
        const stops = [];
        for (const side of [-1, 1]) for (let i = 0; i <= 5; i++) {
            const f = i / 5, amount = f * f * (3 - 2 * f);
            const rgb = base.map((channel, c) => Math.round(255 * Math.pow(
                Math.pow(channel / 255, 2.2) * (1 - amount) + Math.pow(shine[c] / 255, 2.2) * amount, 1 / 2.2)));
            stops.push({ offset: side * (1.9 + 7.6 * (1 - f)), color: `rgb(${rgb.join(',')})` });
        }
        stops.sort((a, b) => a.offset - b.offset);
        let raf = 0, timer = 0, alive = true, visible = false, inside = false;
        let pos = entry, target = 50, velocity = 0, previous = 0;
        let phase = 'sweep', from = entry, to = exit, elapsed = 0, duration = 1300, rest = 800;
        const blocked = () => !alive || !visible || document.hidden || reduced.matches || forced.matches;
        function paint() {
            root.style.setProperty('--identity-shine-position', pos.toFixed(2));
            root.style.backgroundImage = `linear-gradient(131deg, #726d6d 0%, ${stops.map(stop =>
                `${stop.color} ${(pos + stop.offset).toFixed(2)}%`).join(', ')}, #726d6d 100%)`;
        }
        function stop() { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; previous = 0; }
        function wake() {
            if (blocked() || raf) return;
            clearTimeout(timer); timer = 0; previous = 0;
            raf = requestAnimationFrame(tick);
        }
        function sweep(destination) {
            from = pos; to = destination; elapsed = 0;
            duration = 1300 * Math.max(.15, Math.abs(to - from) / (entry - exit));
            phase = 'sweep';
        }
        function tick(now) {
            raf = 0;
            if (blocked()) return;
            const dt = previous ? Math.min(50, now - previous) : 0; previous = now;
            if (inside) {
                // Follow Pointer takes priority over the paused autonomous sweep.
                const seconds = dt / 1000;
                velocity += ((target - pos) * 220 - velocity * 2 * Math.sqrt(220)) * seconds;
                pos += velocity * seconds; phase = 'follow'; paint();
                if (Math.abs(target - pos) > .01 || Math.abs(velocity) > .01) raf = requestAnimationFrame(tick);
                return;
            }
            if (phase === 'follow') { velocity = 0; sweep(target < 50 ? exit : entry); }
            if (phase === 'wait') {
                // A timeout replaces the frame loop during the .8s rest.
                timer = window.setTimeout(() => { timer = 0; sweep(to === exit ? entry : exit); wake(); }, rest);
                return;
            }
            elapsed += dt;
            const progress = Math.min(1, elapsed / duration);
            pos = from + (to - from) * (.5 - Math.cos(Math.PI * progress) / 2); paint();
            if (progress === 1) phase = 'wait';
            raf = requestAnimationFrame(tick);
        }
        function locate(event) {
            const rect = root.getBoundingClientRect(), radians = 131 * Math.PI / 180;
            const dx = Math.sin(radians), dy = -Math.cos(radians);
            const length = Math.abs(rect.width * dx) + Math.abs(rect.height * dy) || 1;
            target = 50 + ((event.clientX - rect.left - rect.width / 2) * dx +
                (event.clientY - rect.top - rect.height / 2) * dy) / length * 100;
        }
        function enter(event) { if (event.pointerType === 'touch') return; inside = true; locate(event); wake(); }
        function move(event) { if (!inside || event.pointerType === 'touch') return; locate(event); wake(); }
        function leave() { inside = false; wake(); }
        function sync() {
            stop();
            if (reduced.matches || forced.matches) {
                inside = false; velocity = 0; root.style.removeProperty('background-image');
            } else { paint(); wake(); }
        }
        const observer = new IntersectionObserver(entries => {
            visible = entries.some(item => item.isIntersecting); sync();
        });
        observer.observe(root);
        root.addEventListener('pointerenter', enter); root.addEventListener('pointermove', move);
        root.addEventListener('pointerleave', leave); root.addEventListener('pointercancel', leave);
        document.addEventListener('visibilitychange', sync);
        reduced.addEventListener('change', sync); forced.addEventListener('change', sync);
        return () => {
            alive = false; stop(); observer.disconnect();
            root.removeEventListener('pointerenter', enter); root.removeEventListener('pointermove', move);
            root.removeEventListener('pointerleave', leave); root.removeEventListener('pointercancel', leave);
            document.removeEventListener('visibilitychange', sync);
            reduced.removeEventListener('change', sync); forced.removeEventListener('change', sync);
            root.style.removeProperty('background-image');
            root.style.removeProperty('--identity-shine-position');
        };
    }
    function start() {
        const root = document.querySelector('.shiny-text--identity');
        if (root && !dispose) dispose = mount(root);
    }
    window.addEventListener('pagehide', () => { dispose?.(); dispose = null; });
    window.addEventListener('pageshow', start);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
