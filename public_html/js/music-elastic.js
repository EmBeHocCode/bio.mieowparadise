/* Horizontal native-DOM adaptation of React Bits ElasticSlider (David Haz).
 * Upstream and license: assets/vendor/react-bits/. No React runtime required.
 */
(() => {
    const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const instances = new Map();
    const maxStretch = 47;
    const bounce = 0.35;

    function enhance(input) {
        if (instances.has(input)) return;
        const root = document.createElement('span');
        root.className = 'music-elastic';
        const track = document.createElement('span');
        track.className = 'music-elastic-track';
        track.setAttribute('aria-hidden', 'true');
        const fill = document.createElement('span');
        fill.className = 'music-elastic-fill';
        track.append(fill);
        input.before(root);
        root.append(track, input);
        const events = new AbortController();
        const listen = (target, name, fn) => target.addEventListener(name, fn, { signal: events.signal });
        const fraction = () => (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min) || 1);
        const m = { p: fraction(), target: fraction(), vp: 0, s: 0, vs: 0, a: 0, va: 0, goal: 0, side: 1, held: false, drag: null, raf: 0, last: 0, hover: false, focus: false };
        function paint() {
            const length = Math.max(1, root.clientWidth);
            const along = 1 + m.s / length;
            const across = 1 - .22 * clamp(m.s / maxStretch, -1, 1);
            const thick = 6 + 6 * m.a;
            track.style.height = `${thick}px`;
            track.style.marginTop = `${-thick / 2}px`;
            track.style.opacity = .7 + .3 * m.a;
            track.style.transformOrigin = m.side > 0 ? '0% 50%' : '100% 50%';
            track.style.transform = `scale(${along}, ${across})`;
            fill.style.clipPath = `inset(0 ${(1 - clamp(m.p, 0, 1)) * 100}% 0 0 round 999px)`;
        }
        function frame(now) {
            m.raf = 0;
            const elapsed = clamp((now - m.last) / 1000, 0, .05);
            m.last = now;
            if (reduced.matches) {
                m.p = m.target; m.vp = m.s = m.vs = m.va = 0; m.a = m.goal;
            } else {
                const steps = Math.max(1, Math.ceil(elapsed * 240));
                const dt = elapsed / steps;
                const fillOmega = 2 * Math.PI / (m.drag !== null ? .09 : .3);
                const stretchOmega = 2 * Math.PI / .42;
                const activeOmega = 2 * Math.PI / .32;
                for (let i = 0; i < steps; i++) {
                    m.vp += (-(fillOmega ** 2) * (m.p - m.target) - 2 * (m.drag !== null ? 1 : .86) * fillOmega * m.vp) * dt;
                    m.p += m.vp * dt;
                    if (!m.held) {
                        m.vs += (-(stretchOmega ** 2) * m.s - 2 * (1 - .9 * bounce) * stretchOmega * m.vs) * dt;
                        m.s += m.vs * dt;
                    }
                    m.va += (-(activeOmega ** 2) * (m.a - m.goal) - 2 * .9 * activeOmega * m.va) * dt;
                    m.a += m.va * dt;
                }
            }
            const settled = Math.abs(m.p - m.target) < .0004 && Math.abs(m.vp) < .002 &&
                (m.held || (Math.abs(m.s) < .05 && Math.abs(m.vs) < .5)) && Math.abs(m.a - m.goal) < .002 && Math.abs(m.va) < .005;
            if (settled) {
                m.p = m.target; m.vp = m.va = 0; m.a = m.goal;
                if (!m.held) m.s = m.vs = 0;
            }
            paint();
            if (!settled) m.raf = requestAnimationFrame(frame);
        }
        function kick() {
            if (m.raf || document.hidden) return;
            m.last = performance.now();
            m.raf = requestAnimationFrame(frame);
        }
        function sync() { m.target = fraction(); kick(); }
        function goal() { m.goal = m.hover || m.focus || m.drag !== null ? 1 : 0; kick(); }
        function follow(event) {
            const rect = root.getBoundingClientRect();
            const position = event.clientX - rect.left;
            const f = position / Math.max(1, rect.width);
            const over = f < 0 ? -position : f > 1 ? position - rect.width : 0;
            m.held = over > 0;
            if (over > 0) {
                m.side = f < 0 ? -1 : 1;
                m.s = reduced.matches ? 0 : 2 * (1 / (1 + Math.exp(-over / maxStretch)) - .5) * maxStretch;
                m.vs = 0;
            }
            const lo = Number(input.min), hi = Number(input.max);
            input.value = lo + clamp(f, 0, 1) * (hi - lo);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            sync();
        }
        function release(event) {
            if (m.drag === null || (event && event.pointerId !== m.drag)) return;
            const id = m.drag;
            m.drag = null; m.held = false;
            if (root.hasPointerCapture(id)) root.releasePointerCapture(id);
            input.dispatchEvent(new Event('change', { bubbles: true }));
            goal();
        }
        // Own pointer gestures on the wrapper: native mobile ranges otherwise
        // also update from their thumb geometry and fight the elastic value.
        listen(root, 'pointerdown', event => {
            if (event.button !== 0 || input.disabled || m.drag !== null) return;
            event.preventDefault();
            input.focus({ preventScroll: true });
            m.drag = event.pointerId;
            root.setPointerCapture(event.pointerId);
            follow(event); goal();
        });
        listen(root, 'pointermove', event => { if (event.pointerId === m.drag) follow(event); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => listen(root, name, release));
        listen(root, 'click', event => event.preventDefault());
        listen(root, 'pointerenter', () => { m.hover = true; goal(); });
        listen(root, 'pointerleave', () => { m.hover = false; goal(); });
        listen(input, 'focus', () => { m.focus = input.matches(':focus-visible'); goal(); });
        listen(input, 'blur', () => { m.focus = false; release(); goal(); });
        listen(input, 'input', sync);
        listen(input, 'change', sync);
        // The player calls sync after programmatic time/value changes.
        listen(input, 'elastic:sync', sync);
        listen(document, 'visibilitychange', () => {
            if (document.hidden) {
                release(); cancelAnimationFrame(m.raf); m.raf = 0;
            } else { sync(); }
        });
        listen(reduced, 'change', () => { m.s = m.vs = 0; kick(); });
        const resize = new ResizeObserver(paint);
        resize.observe(root);
        paint();
        instances.set(input, () => {
            release(); events.abort(); resize.disconnect(); cancelAnimationFrame(m.raf);
            root.replaceWith(input);
        });
    }
    function init() { document.querySelectorAll('.music-player input[type="range"]').forEach(enhance); }
    document.addEventListener('DOMContentLoaded', init, { once: true });
    window.addEventListener('pagehide', () => { instances.forEach(dispose => dispose()); instances.clear(); });
    window.addEventListener('pageshow', init);
})();
