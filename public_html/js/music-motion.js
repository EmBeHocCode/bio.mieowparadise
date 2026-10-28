/* Tilted Card spring/pointer motion adapted for an interactive native-DOM form.
 * React Bits / David Haz; attribution and license: assets/vendor/react-bits/.
 */
(() => {
    let dispose = () => {};
    function init() {
        dispose();
        const panel = document.getElementById('music-content');
        if (!panel) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const mouse = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
        const events = new AbortController();
        const on = (node, type, fn) => node.addEventListener(type, fn, { signal: events.signal });
        const state = { x: 0, y: 0, lift: 1, vx: 0, vy: 0, vlift: 0 };
        const target = { x: 0, y: 0, lift: 1 };
        let open = false, entering = false, held = false, raf = 0, last = 0;
        const clamp = value => Math.min(1, Math.max(-1, value));
        const enabled = () => open && !entering && !held && mouse.matches && !reduced.matches && !document.hidden;
        function paint() {
            panel.style.setProperty('--music-tilt-x', `${state.x.toFixed(3)}deg`);
            panel.style.setProperty('--music-tilt-y', `${state.y.toFixed(3)}deg`);
            panel.style.setProperty('--music-lift', state.lift.toFixed(5));
        }
        function frame(now) {
            raf = 0;
            if (!enabled()) return;
            const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
            last = now;
            const steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
            let busy = false;
            for (const key of ['x', 'y', 'lift']) {
                const velocity = `v${key}`;
                for (let i = 0; i < steps; i++) {
                    state[velocity] += (36 * 36 * (target[key] - state[key]) - 72 * state[velocity]) * h;
                    state[key] += state[velocity] * h;
                }
                if (Math.abs(state[key] - target[key]) < .0001 && Math.abs(state[velocity]) < .001) {
                    state[key] = target[key]; state[velocity] = 0;
                } else busy = true;
            }
            paint();
            if (busy) raf = requestAnimationFrame(frame);
        }
        function wake() {
            if (raf || !enabled()) return;
            last = performance.now(); raf = requestAnimationFrame(frame);
        }
        function reset() {
            cancelAnimationFrame(raf); raf = 0;
            Object.assign(target, { x: 0, y: 0, lift: 1 });
            Object.assign(state, { x: 0, y: 0, lift: 1, vx: 0, vy: 0, vlift: 0 });
            paint();
        }
        function rest() { Object.assign(target, { x: 0, y: 0, lift: 1 }); wake(); }
        function follow(event) {
            if (event.pointerType !== 'mouse' || !enabled()) return;
            // Use the untransformed layout box so tilt cannot move its own input center.
            const width = Math.max(1, panel.offsetWidth), height = Math.max(1, panel.offsetHeight);
            const nx = clamp((event.clientX - panel.offsetLeft) / (width / 2));
            const ny = clamp((event.clientY - panel.offsetTop - height / 2) / (height / 2));
            target.x = -ny * 3.2; target.y = nx * 4.2; target.lift = 1.004;
            wake();
        }
        function syncOpen() {
            const next = panel.classList.contains('active');
            if (next === open) return;
            open = next; held = false; reset();
            entering = open && !reduced.matches && getComputedStyle(panel).animationName !== 'none';
        }
        const observer = new MutationObserver(syncOpen);
        observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
        on(panel, 'animationend', event => {
            if (event.target === panel && event.animationName.startsWith('music-controller-enter')) entering = false;
        });
        on(panel, 'pointerenter', follow);
        on(panel, 'pointermove', follow);
        on(panel, 'pointerleave', rest);
        on(panel, 'pointerdown', () => {
            // Freeze the surface while clicking or dragging; never move a control under a held pointer.
            held = true; cancelAnimationFrame(raf); raf = 0;
            Object.assign(target, { x: state.x, y: state.y, lift: state.lift });
            state.vx = state.vy = state.vlift = 0;
        });
        on(window, 'pointerup', event => {
            if (!held) return;
            held = false;
            if (panel.contains(document.elementFromPoint(event.clientX, event.clientY))) follow(event);
            else rest();
        });
        on(window, 'pointercancel', () => { held = false; rest(); });
        on(window, 'blur', () => { held = false; reset(); });
        on(panel, 'focusin', event => { if (event.target.matches(':focus-visible')) rest(); });
        on(panel, 'scroll', rest);
        on(window, 'resize', reset);
        on(document, 'visibilitychange', () => { held = false; reset(); });
        on(reduced, 'change', () => { entering = false; reset(); });
        on(mouse, 'change', reset);
        syncOpen();
        dispose = () => {
            observer.disconnect(); events.abort(); reset();
            ['--music-tilt-x', '--music-tilt-y', '--music-lift'].forEach(key => panel.style.removeProperty(key));
        };
    }
    init();
    window.addEventListener('pagehide', () => dispose());
    window.addEventListener('pageshow', init);
})();
