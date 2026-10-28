/* Local UTF-8 LRC lyrics only. No recognition service or background polling. */
(() => {
    function parseLrc(source) {
        const rows = String(source).replace(/^\uFEFF/, '').split(/\r?\n/);
        let offset = 0;
        const cues = [];
        for (const row of rows) {
            const adjustment = row.match(/^\s*\[offset:([+-]?\d+)\]\s*$/i);
            if (adjustment) { offset = Number(adjustment[1]) / 1000; continue; }
            const prefix = row.match(/^\s*((?:\[\d+:\d{2}(?:\.\d{1,3})?\])+)(.*)$/);
            if (!prefix) continue;
            // Enhanced LRC word tags are shown as ordinary line lyrics.
            const text = prefix[2].replace(/<\d+:\d{2}(?:\.\d{1,3})?>/g, '').trim();
            for (const stamp of prefix[1].matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
                const seconds = Number(stamp[2]);
                const start = Number(stamp[1]) * 60 + seconds + Number(`0.${stamp[3] || '0'}`);
                if (seconds < 60 && Number.isFinite(start)) cues.push({ start, text });
            }
        }
        // Positive LRC offset advances lyrics. Blank cues explicitly end a vocal passage.
        cues.forEach(cue => { cue.start = Math.max(0, cue.start - offset); });
        cues.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const cue of cues) {
            const last = merged[merged.length - 1];
            if (last?.start === cue.start) {
                if (cue.text && !last.text.split(' / ').includes(cue.text)) last.text = [last.text, cue.text].filter(Boolean).join(' / ');
            } else merged.push({ ...cue });
        }
        return merged;
    }
    window.MeowLrc = Object.freeze({ parse: parseLrc });
    const copy = {
        vi: {
            idle: 'Chọn một bài hát để xem lời.', loading: 'Đang tải lời bài hát…',
            unavailable: 'Chưa tải được lời bài hát.', missing: 'Chưa có file lời bài hát cho bài này.',
            empty: 'File LRC chưa có lời kèm thời gian hợp lệ.',
            missingNote: 'Nhạc vẫn phát bình thường. Lời sẽ hiển thị khi được bổ sung.',
            retry: 'Tải lại', instrumental: '♪ Nhạc dạo'
        },
        en: {
            idle: 'Choose a track to see its lyrics.', loading: 'Loading lyrics…',
            unavailable: 'Lyrics could not be loaded.', missing: 'No lyrics file for this track yet.',
            empty: 'This LRC file has no valid timed lyrics.',
            missingNote: 'Music keeps playing. Lyrics will appear once they are added.',
            retry: 'Reload', instrumental: '♪ Instrumental'
        }
    };
    window.createMusicLyricsController = ({ audio, element }) => {
        if (!audio || !element) return null;
        element.musicLyricsController?.dispose();
        const status = element.querySelector('.music-lyrics-status');
        const badge = element.querySelector('.music-lyrics-badge');
        const note = element.querySelector('.music-lyrics-note');
        const retry = element.querySelector('.music-lyrics-retry');
        const windowEl = element.querySelector('.music-lyrics-window');
        const previous = element.querySelector('[data-lyric-line="previous"]');
        const current = element.querySelector('[data-lyric-line="current"]');
        const next = element.querySelector('[data-lyric-line="next"]');
        const events = new AbortController();
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        let track = null, lines = [], state = 'idle';
        let open = false, disposed = false, version = 0, pending = null;
        let renderedCue = null, outgoing = null;
        const animations = new Set();
        const text = () => copy[document.documentElement.lang.startsWith('en') ? 'en' : 'vi'];
        const stop = () => { pending?.abort(); pending = null; };

        function stopTransitions() {
            animations.forEach(animation => {
                animation.onfinish = animation.oncancel = null;
                animation.cancel();
            });
            animations.clear();
            outgoing?.remove(); outgoing = null;
        }

        function transition(node, frames, duration, complete = () => {}) {
            const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)' });
            animations.add(animation);
            animation.onfinish = () => {
                animations.delete(animation); complete();
                animation.onfinish = animation.oncancel = null;
                animation.cancel();
            };
            animation.oncancel = () => { animations.delete(animation); complete(); };
        }

        function put(node, value, animate = false, force = false) {
            if (node.textContent === value && !force) return;
            const motion = animate && !reduced.matches && open && !document.hidden;
            if (motion && node === current && node.textContent && value) {
                const ghost = node.cloneNode(true);
                ghost.removeAttribute('data-lyric-line');
                ghost.setAttribute('aria-hidden', 'true');
                ghost.classList.add('music-lyric-outgoing');
                ghost.style.top = `${node.offsetTop}px`;
                outgoing = ghost; windowEl.append(ghost);
                transition(ghost, [
                    { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
                    { opacity: 0, transform: 'translateY(-10px)', filter: 'blur(2px)' }
                ], 220, () => { ghost.remove(); if (outgoing === ghost) outgoing = null; });
            }
            node.textContent = value;
            if (motion && value) {
                const opacity = node === current ? 1 : .65;
                transition(node, [
                    { opacity: 0, transform: `translateY(${node === current ? 10 : 6}px)`, filter: 'blur(2px)' },
                    { opacity, transform: 'translateY(0)', filter: 'blur(0)' }
                ], 320);
            }
        }

        function sync() {
            if (!open || !lines.length) return;
            const time = audio.currentTime || 0;
            let low = 0, high = lines.length;
            while (low < high) {
                const middle = (low + high) >> 1;
                if (lines[middle].start <= time) low = middle + 1;
                else high = middle;
            }
            const index = low - 1;
            const active = index >= 0 && Boolean(lines[index].text) && !audio.ended &&
                (!Number.isFinite(audio.duration) || time < audio.duration);
            const cue = `${index}:${active}:${text().instrumental}`;
            const changed = cue !== renderedCue;
            if (changed) { stopTransitions(); renderedCue = cue; }
            put(previous, index >= 0 ? lines[active ? index - 1 : index]?.text || '' : '', changed);
            put(current, active ? lines[index].text : text().instrumental, changed, changed);
            current.classList.toggle('is-instrumental', !active);
            put(next, lines[index + 1]?.text || '', changed);
            element.dataset.lineIndex = active ? String(index) : '-1';
        }

        function render() {
            const words = text();
            element.dataset.state = state;
            const hasLines = lines.some(line => line.text);
            windowEl.hidden = !hasLines;
            status.hidden = hasLines;
            put(status, words[state] || words.unavailable);
            put(badge, state === 'loading' ? '…' : '');
            badge.hidden = state !== 'loading';
            put(note, state === 'missing' ? words.missingNote : '');
            note.hidden = !note.textContent;
            retry.hidden = state !== 'unavailable';
            put(retry, words.retry);
            sync();
        }

        async function refresh() {
            if (!open || disposed || !track || pending || document.hidden) return;
            const currentVersion = version;
            const controller = new AbortController();
            pending = controller;
            const isCurrent = () => currentVersion === version && !disposed && pending === controller;
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                state = 'loading';
                render();
                const response = await fetch(track, { cache: 'no-cache', signal: controller.signal });
                if (response.status === 404 || response.status === 410) {
                    if (isCurrent()) { lines = []; state = 'missing'; }
                    return;
                }
                if (!response.ok) throw new Error('Lyrics unavailable');
                const content = await response.text();
                if (!isCurrent()) return;
                lines = parseLrc(content);
                state = lines.some(line => line.text) ? 'ready' : 'empty';
            } catch (error) {
                if (!isCurrent() || !open) return;
                state = 'unavailable';
            } finally {
                clearTimeout(timeout);
                if (isCurrent()) {
                    pending = null;
                    render();
                }
            }
        }

        const controller = {
            setTrack(value) {
                stop();
                stopTransitions(); renderedCue = null;
                version++;
                lines = [];
                track = null;
                try {
                    if (value?.url) {
                        const url = new URL(value.url, document.baseURI);
                        const folder = new URL('./assets/music/', document.baseURI);
                        if (url.origin === folder.origin && url.pathname.startsWith(folder.pathname) && /\.mp3$/i.test(url.pathname)) {
                            url.pathname = url.pathname.replace(/\.mp3$/i, '.lrc');
                            url.search = ''; url.hash = '';
                            track = url.href;
                        }
                    }
                } catch { /* Malformed local URL leaves the lyrics panel idle. */ }
                state = track ? 'loading' : 'idle';
                element.dataset.lineIndex = '-1';
                put(previous, ''); put(current, ''); put(next, '');
                render();
                if (open) refresh();
            },
            setOpen(value) {
                open = value;
                if (!open) { stop(); stopTransitions(); }
                else { render(); if (track && state !== 'ready') refresh(); }
            },
            dispose() {
                disposed = true;
                version++;
                stop();
                stopTransitions();
                events.abort();
            }
        };
        ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'ratechange', 'ended'].forEach(name =>
            audio.addEventListener(name, sync, { signal: events.signal }));
        retry.addEventListener('click', refresh, { signal: events.signal });
        document.addEventListener('bio:languagechange', render, { signal: events.signal });
        reduced.addEventListener('change', stopTransitions, { signal: events.signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { stop(); stopTransitions(); }
            else if (open) { sync(); if (state === 'loading' || state === 'unavailable') refresh(); }
        }, { signal: events.signal });
        window.addEventListener('pagehide', () => { stop(); stopTransitions(); }, { signal: events.signal });
        window.addEventListener('pageshow', event => {
            if (event.persisted && open) { sync(); if (state === 'loading') refresh(); }
        }, { signal: events.signal });
        element.musicLyricsController = controller;
        render();
        return controller;
    };
})();
