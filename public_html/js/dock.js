/* React Bits Dock: native-DOM adaptation of cosine falloff + implicit spring.
 * Copyright David Haz. Upstream reference/license in assets/vendor/react-bits/.
 */
(() => {
    let dispose = () => {};
    function init() {
        dispose();
        const dock = document.getElementById('site-dock');
        const settings = document.getElementById('dock-settings-panel');
        const toggle = document.getElementById('dock-settings-toggle');
        if (!dock || !settings || !toggle) return;
        const buttons = [...dock.querySelectorAll('.dock-item')];
        const motion = buttons.map(() => ({ size: 34, velocity: 0 }));
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const hover = matchMedia('(hover: hover) and (pointer: fine)');
        const abort = new AbortController();
        const on = (target, name, callback) => target.addEventListener(name, callback, { signal: abort.signal });
        const home = document.getElementById('dock-home-reload');
        if (home) on(home, 'click', () => window.location.reload());
        let pointer = null, focused = -1, raf = 0, last = 0;
        function frame(now) {
            raf = 0;
            const dt = Math.min(1 / 30, Math.max(.001, (now - last) / 1000));
            last = now;
            const rest = buttons.map((_, index) => (index - (buttons.length - 1) / 2) * 46);
            let focus = focused >= 0 ? rest[focused] : null;
            if (pointer !== null) {
                // Map the current, expanded hit area back to the rest slots.
                // A physical pointer coordinate is not a rest-slot coordinate:
                // using it directly lets the adjacent icon win after expansion.
                const bounds = buttons.map(button => button.getBoundingClientRect());
                const hit = bounds.findIndex(box => pointer >= box.left - 5 && pointer <= box.right + 5);
                if (hit >= 0) {
                    const box = bounds[hit];
                    const local = Math.max(-.49, Math.min(.49, (pointer - box.left - box.width / 2) / box.width));
                    focus = rest[hit] + local * 46;
                } else {
                    const centers = bounds.map(box => box.left + box.width / 2);
                    const right = centers.findIndex(x => x >= pointer);
                    if (right <= 0) focus = right === 0 ? rest[0] - 23 : rest[rest.length - 1] + 23;
                    else {
                        const fraction = (pointer - centers[right - 1]) / (centers[right] - centers[right - 1]);
                        focus = rest[right - 1] + fraction * 46;
                    }
                }
            }
            let targets = rest.map(x => {
                const reach = focus === null ? 1 : Math.abs(focus - x) / 180;
                return 34 + (!reduced.matches && reach < 1 ? 38 * Math.cos(reach * Math.PI / 2) ** 2 : 0);
            });
            // Keep the base target sizes usable; constrain only magnification.
            const room = Math.max(0, innerWidth - 24 - (34 * buttons.length + 12 * (buttons.length - 1) + 22));
            const extra = targets.reduce((sum, size) => sum + size - 34, 0);
            const fit = extra ? Math.min(1, room / extra) : 1;
            targets = targets.map(size => 34 + (size - 34) * fit);
            const steps = Math.max(1, Math.ceil(dt * 240));
            const h = dt / steps;
            let moving = false;
            motion.forEach((state, index) => {
                const target = targets[index];
                if (reduced.matches) { state.size = target; state.velocity = 0; }
                else for (let n = 0; n < steps; n++) {
                    // Fast, critically damped response without overshoot.
                    state.velocity = (state.velocity + h * 6400 * (target - state.size)) / (1 + h * 160 + h * h * 6400);
                    state.size += state.velocity * h;
                }
                if (Math.abs(state.velocity) < .01 && Math.abs(target - state.size) < .01) {
                    state.size = target; state.velocity = 0;
                } else moving = true;
                buttons[index].style.width = `${state.size.toFixed(2)}px`;
                buttons[index].style.height = `${state.size.toFixed(2)}px`;
                buttons[index].querySelector('.dock-icon').style.transform = `scale(${(state.size / 34).toFixed(4)})`;
            });
            if (moving && !document.hidden) raf = requestAnimationFrame(frame);
        }
        function wake() {
            if (raf || document.hidden) return;
            last = performance.now(); raf = requestAnimationFrame(frame);
        }
        function setSettings(open, restore = false) {
            settings.classList.toggle('active', open);
            settings.inert = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open) {
                document.dispatchEvent(new CustomEvent('bio:panelopen', { detail: 'settings' }));
                document.getElementById('dock-settings-close')?.focus({ preventScroll: true });
            }
            if (!open && restore) toggle.focus({ preventScroll: true });
        }
        on(toggle, 'click', () => setSettings(!settings.classList.contains('active')));
        on(document.getElementById('dock-settings-close'), 'click', () => setSettings(false, true));
        on(document, 'bio:panelopen', event => { if (event.detail !== 'settings') setSettings(false); });
        on(document, 'click', event => {
            if (!settings.contains(event.target) && !toggle.contains(event.target)) setSettings(false);
        });
        on(document, 'keydown', event => {
            if (event.key === 'Escape' && settings.classList.contains('active')) setSettings(false, true);
        });
        on(dock, 'pointermove', event => { if (event.pointerType === 'mouse' && hover.matches) { pointer = event.clientX; wake(); } });
        on(dock, 'pointerleave', () => { pointer = null; wake(); });
        on(dock, 'focusin', event => { focused = event.target.matches(':focus-visible') ? buttons.findIndex(button => button.contains(event.target)) : -1; wake(); });
        on(dock, 'focusout', event => { if (!dock.contains(event.relatedTarget)) { focused = -1; wake(); } });
        on(dock, 'keydown', event => {
            const index = buttons.findIndex(button => button === document.activeElement);
            const next = { ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 };
            if (index < 0 || !(event.key in next)) return;
            event.preventDefault(); buttons[next[event.key]].focus({ preventScroll: true });
        });
        on(reduced, 'change', wake);
        on(window, 'resize', wake);
        on(document, 'visibilitychange', () => {
            if (document.hidden) { cancelAnimationFrame(raf); raf = 0; pointer = null; }
            else wake();
        });
        dispose = () => {
            abort.abort(); cancelAnimationFrame(raf); setSettings(false);
            buttons.forEach(button => { button.style.width = ''; button.style.height = ''; button.querySelector('.dock-icon').style.transform = ''; });
        };
        wake();
    }
    init();
    window.addEventListener('pagehide', () => dispose());
    window.addEventListener('pageshow', init);
})();
