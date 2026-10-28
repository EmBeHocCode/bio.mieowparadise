/* Original lightweight shard renderer inspired by the public Shatter Type demo.
 * No React Bits Pro implementation is bundled. Only the display name is affected.
 * The DOM text remains selectable/accessible; a temporary canvas paints fragments.
 */
(() => {
    'use strict';
    let dispose;
    function mount(root) {
        const canvas = document.createElement('canvas');
        canvas.className = 'identity-shards'; canvas.setAttribute('aria-hidden', 'true');
        root.append(canvas);
        const ctx = canvas.getContext('2d'), atlas = document.createElement('canvas');
        const ink = atlas.getContext('2d', { willReadFrequently: true });
        if (!ctx || !ink) { canvas.remove(); return () => {}; }
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const forced = matchMedia('(forced-colors: active)');
        const padding = 36, ratio = Math.min(devicePixelRatio || 1, 2);
        let width = 1, height = 1, font = 22, baseline = 0, shards = [], style;
        let raf = 0, timer = 0, alive = true, visible = false, seen = false;
        let hover = false, pointer = null, previous = 0, intro = -1, burst = null;
        let seed = 42;
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        const disabled = () => reduced.matches || forced.matches;
        const ready = () => alive && visible && !document.hidden && !disabled();
        const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
        const smooth = t => .5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2;
        function texture(mask = false) {
            ink.clearRect(0, 0, atlas.width, atlas.height);
            ink.setTransform(ratio, 0, 0, ratio, 0, 0);
            ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            ink.textBaseline = 'alphabetic'; ink.letterSpacing = style.letterSpacing;
            if (mask) ink.fillStyle = '#fff';
            else {
                const angle = 131 * Math.PI / 180, dx = Math.sin(angle), dy = -Math.cos(angle);
                const length = width * Math.abs(dx) + height * Math.abs(dy);
                const gradient = ink.createLinearGradient(width / 2 - dx * length / 2, height / 2 - dy * length / 2,
                    width / 2 + dx * length / 2, height / 2 + dy * length / 2);
                const position = Number(root.style.getPropertyValue('--identity-shine-position') || 111.5);
                const colors = ['#726d6d', '#888484', '#afadad', '#d4d3d3', '#ededed', '#f7f7f7'];
                gradient.addColorStop(0, colors[0]);
                for (let i = 0; i < 12; i++) {
                    const index = i < 6 ? i : 11 - i;
                    const offset = i < 6 ? -9.5 + i * 1.52 : 1.9 + (i - 6) * 1.52;
                    gradient.addColorStop(Math.max(0, Math.min(1, (position + offset) / 100)), colors[index]);
                }
                gradient.addColorStop(1, colors[0]); ink.fillStyle = gradient;
            }
            ink.fillText(root.firstChild.textContent, 0, baseline);
        }
        function rebuild() {
            stop(); root.classList.remove('is-shattering');
            style = getComputedStyle(root);
            const rect = root.getBoundingClientRect(); width = rect.width; height = rect.height;
            // Measure the browser's actual inline baseline rather than guessing
            // from rounded line boxes; switching renderers must not move the word.
            const marker = document.createElement('span');
            marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;pointer-events:none';
            marker.setAttribute('aria-hidden', 'true'); root.append(marker);
            baseline = marker.getBoundingClientRect().top - rect.top; marker.remove();
            font = parseFloat(style.fontSize); seed = 42; shards = [];
            canvas.width = Math.ceil((width + padding * 2) * ratio);
            canvas.height = Math.ceil((height + padding * 2) * ratio);
            canvas.style.cssText = `left:-${padding}px;top:-${padding}px;width:${width + padding * 2}px;height:${height + padding * 2}px`;
            atlas.width = Math.ceil(width * ratio); atlas.height = Math.ceil(height * ratio);
            texture(true);
            const pixels = ink.getImageData(0, 0, atlas.width, atlas.height).data;
            const cols = Math.ceil(width / Math.max(4, font * .18)), rows = Math.ceil(height / Math.max(4, font * .18));
            const points = Array.from({ length: rows + 1 }, (_, y) => Array.from({ length: cols + 1 }, (_, x) => [
                x * width / cols + (x && x < cols ? (random() - .5) * width / cols * .6 : 0),
                y * height / rows + (y && y < rows ? (random() - .5) * height / rows * .6 : 0)]));
            function add(vertices) {
                const cx = vertices.reduce((sum, p) => sum + p[0], 0) / 3;
                const cy = vertices.reduce((sum, p) => sum + p[1], 0) / 3;
                const left = Math.floor(Math.min(...vertices.map(p => p[0])) * ratio);
                const right = Math.ceil(Math.max(...vertices.map(p => p[0])) * ratio);
                const top = Math.floor(Math.min(...vertices.map(p => p[1])) * ratio);
                const bottom = Math.ceil(Math.max(...vertices.map(p => p[1])) * ratio);
                let covered = false;
                for (let y = top; y < bottom && !covered; y++) for (let x = left; x < right; x++) {
                    if (pixels[(y * atlas.width + x) * 4 + 3] > 20) { covered = true; break; }
                }
                if (covered) shards.push({ vertices, cx, cy, random: random(), spin: (random() - .5) * 3, crack: 0 });
            }
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                const a = points[y][x], b = points[y][x + 1], c = points[y + 1][x], d = points[y + 1][x + 1];
                if (random() > .5) { add([a, b, d]); add([a, d, c]); }
                else { add([a, b, c]); add([b, d, c]); }
            }
            intro = -1; burst = null; wake();
        }
        function clear() {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            root.classList.remove('is-shattering');
        }
        function stop() { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; previous = 0; }
        function wake() { if (ready() && !raf) { clearTimeout(timer); timer = 0; raf = requestAnimationFrame(frame); } }
        function autoplay() {
            if (!ready() || hover) return;
            timer = window.setTimeout(() => {
                timer = 0; if (!ready() || hover) return;
                const shard = shards[Math.floor(random() * shards.length)];
                if (shard) shatter(shard.cx, shard.cy);
            }, 4000);
        }
        function shatter(x, y) { if (!ready()) return; burst = { x, y, age: 0 }; wake(); }
        function frame(now) {
            raf = 0; if (!ready()) { clear(); return; }
            const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0; previous = now;
            if (!seen) { seen = true; intro = 0; }
            if (intro >= 0) { intro += dt; if (intro >= 1.6) intro = -1; }
            if (burst) { burst.age += dt; if (burst.age >= 1.4) burst = null; }
            let active = intro >= 0 || !!burst;
            const recovery = 1 - Math.exp(-dt / .18);
            for (const shard of shards) {
                const distance = pointer ? Math.hypot(shard.cx - pointer.x, shard.cy - pointer.y) : Infinity;
                const target = hover ? Math.pow(Math.max(0, 1 - distance / (font * .5)), 2) : 0;
                shard.crack += (target - shard.crack) * recovery;
                if (shard.crack > .002) active = true;
            }
            if (!active) { clear(); previous = 0; autoplay(); return; }
            texture(); root.classList.add('is-shattering');
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(ratio, 0, 0, ratio, padding * ratio, padding * ratio);
            const moving = [];
            for (const shard of shards) {
                let amount = shard.crack * .12, origin = pointer || { x: width / 2, y: height / 2 };
                if (intro >= 0) amount += (1 - ease(intro / 1.6)) * (1 + shard.random * .5);
                if (burst) {
                    const distance = Math.hypot(shard.cx - burst.x, shard.cy - burst.y);
                    const strength = Math.max(0, 1 - distance / (font * .75));
                    // Continuous out-and-back motion, without a frozen hang phase.
                    const envelope = burst.age < .3 ? smooth(burst.age / .3) : 1 - smooth((burst.age - .3) / 1.1);
                    amount += strength * envelope; origin = burst;
                }
                if (amount > .0001) moving.push({ shard, amount, origin });
            }
            const drawAtlas = () => ctx.drawImage(atlas, 0, 0, width * ratio, height * ratio, 0, 0, width, height);
            // Keep the rest of the word as one crisp image. Only local fragments
            // need clipping/transforms, avoiding hundreds of redundant draws.
            drawAtlas();
            ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath();
            for (const { shard } of moving) {
                shard.vertices.forEach((point, i) => i ? ctx.lineTo(...point) : ctx.moveTo(...point)); ctx.closePath();
            }
            ctx.fill(); ctx.restore();
            for (const { shard, amount, origin } of moving) {
                const dx = shard.cx - origin.x, dy = shard.cy - origin.y, length = Math.hypot(dx, dy) || 1;
                const lift = amount * font, scale = 1 + amount * .15;
                ctx.save(); ctx.translate(shard.cx + dx / length * lift, shard.cy + dy / length * lift);
                ctx.rotate(shard.spin * amount); ctx.scale(scale * Math.max(.25, Math.cos(amount * shard.spin)), scale);
                ctx.translate(-shard.cx, -shard.cy);
                ctx.beginPath(); shard.vertices.forEach((point, i) => i ? ctx.lineTo(...point) : ctx.moveTo(...point));
                ctx.closePath(); ctx.clip();
                ctx.globalAlpha = intro >= 0 ? Math.min(1, .35 + intro) : 1;
                drawAtlas(); ctx.restore();
            }
            raf = requestAnimationFrame(frame);
        }
        function locate(event) { const r = root.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
        function move(event) { if (event.pointerType === 'touch') return; hover = true; pointer = locate(event); wake(); }
        function leave() { hover = false; pointer = null; wake(); }
        function click(event) {
            if (window.getSelection()?.toString()) return;
            const p = event.detail ? locate(event) : { x: width / 2, y: height / 2 };
            shatter(p.x, p.y);
        }
        function key(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); shatter(width / 2, height / 2); } }
        function sync() { stop(); clear(); hover = false; pointer = null; wake(); }
        root.addEventListener('pointerenter', move); root.addEventListener('pointermove', move);
        root.addEventListener('pointerleave', leave); root.addEventListener('pointercancel', leave);
        root.addEventListener('click', click); root.addEventListener('keydown', key);
        document.addEventListener('visibilitychange', sync);
        reduced.addEventListener('change', sync); forced.addEventListener('change', sync);
        const observer = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); sync(); });
        observer.observe(root);
        const resize = new ResizeObserver(rebuild); resize.observe(root);
        document.fonts.ready.then(() => { if (alive) rebuild(); });
        return () => {
            alive = false; stop(); clear(); observer.disconnect(); resize.disconnect(); canvas.remove();
            root.removeEventListener('pointerenter', move); root.removeEventListener('pointermove', move);
            root.removeEventListener('pointerleave', leave); root.removeEventListener('pointercancel', leave);
            root.removeEventListener('click', click); root.removeEventListener('keydown', key);
            document.removeEventListener('visibilitychange', sync);
            reduced.removeEventListener('change', sync); forced.removeEventListener('change', sync);
        };
    }
    function start() { const root = document.querySelector('.shiny-text--identity'); if (root && !dispose) dispose = mount(root); }
    window.addEventListener('pagehide', () => { dispose?.(); dispose = null; });
    window.addEventListener('pageshow', start);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
