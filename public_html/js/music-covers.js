/* Folder-driven covers; unique per track until the available image bag is used. */
(() => {
    const extensions = /\.(png|jpe?g|webp|gif|avif)$/i;
    const folder = new URL('./assets/cover-png/', document.baseURI);
    const placeholder = new URL('./assets/music/cover-placeholder.svg', document.baseURI).href;
    const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    window.createMusicCoverController = (image) => {
        if (!image) return null;
        const assignments = new Map();
        const failed = new Set();
        let files = [], bag = [], last = null, current = null;
        let signature = '', lastFetch = 0, request = null, disposed = false;

        function pick(key) {
            if (assignments.has(key)) return assignments.get(key);
            if (!files.length) return null;
            if (!bag.length) {
                bag = shuffle(files);
                // Do not repeat the last cover immediately across bag boundaries.
                if (bag.length > 1 && bag[bag.length - 1].file === last) {
                    [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
                }
            }
            const cover = bag.pop();
            assignments.set(key, cover);
            last = cover.file;
            return cover;
        }

        function paint() {
            if (!current || disposed) return;
            const cover = pick(current.id);
            const source = cover ? cover.src : placeholder;
            image.alt = `Ảnh bìa: ${current.title}`;
            if (image.src !== source) image.src = source;
        }

        async function readCatalog(response) {
            if (!response.ok) throw new Error('Cover catalog unavailable');
            if ((response.headers.get('Content-Type') || '').includes('application/json')) {
                const data = await response.json();
                return Array.isArray(data.images) ? data.images : [];
            }
            // Python's local preview exposes a directory listing instead of PHP.
            // Only same-folder image links are accepted; remote/parent links fail.
            const page = new DOMParser().parseFromString(await response.text(), 'text/html');
            return [...page.querySelectorAll('a[href]')].flatMap(link => {
                try {
                    const url = new URL(link.getAttribute('href'), folder);
                    if (url.origin !== folder.origin || !url.pathname.startsWith(folder.pathname)) return [];
                    const name = decodeURIComponent(url.pathname.slice(folder.pathname.length));
                    return [{ file: name, version: String(lastFetch) }];
                } catch { return []; }
            });
        }

        async function refresh(force = false) {
            if (disposed || request || (!force && Date.now() - lastFetch < 30000)) return;
            lastFetch = Date.now();
            const controller = new AbortController();
            request = controller;
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(folder.href, { cache: 'no-store', signal: controller.signal });
                const entries = await readCatalog(response);
                if (disposed || controller.signal.aborted) return;
                const unique = new Map();
                entries.forEach(entry => {
                    const name = entry && entry.file;
                    if (typeof name !== 'string' || name.startsWith('.') || /[\\/]/.test(name) || !extensions.test(name)) return;
                    const src = new URL(encodeURIComponent(name), folder);
                    src.searchParams.set('v', String(entry.version || '1'));
                    if (!failed.has(src.href)) unique.set(name, { file: name, src: src.href });
                });
                const next = [...unique.values()].sort((a, b) => a.file.localeCompare(b.file));
                // Local listing timestamps are cache versions, not catalog changes.
                const nextSignature = next.map(file => file.file).join('\n');
                if (nextSignature !== signature) {
                    signature = nextSignature;
                    files = next;
                    const byName = new Map(next.map(file => [file.file, file]));
                    assignments.forEach((file, key) => {
                        if (byName.has(file.file)) assignments.set(key, byName.get(file.file));
                        else assignments.delete(key);
                    });
                    const assignedNames = new Set([...assignments.values()].map(file => file.file));
                    bag = shuffle(files.filter(file => !assignedNames.has(file.file)));
                    // If extra pictures arrive after a shortage, retire duplicate
                    // assignments as spare images become available. Keep unique ones.
                    let spares = bag.length;
                    const seen = new Set();
                    assignments.forEach((file, key) => {
                        if (seen.has(file.file) && spares > 0) { assignments.delete(key); spares--; }
                        else seen.add(file.file);
                    });
                } else {
                    // Keep track assignments while refreshing changed image contents.
                    const byName = new Map(next.map(file => [file.file, file]));
                    files = next;
                    bag = bag.map(file => byName.get(file.file)).filter(Boolean);
                    assignments.forEach((file, key) => assignments.set(key, byName.get(file.file)));
                }
                paint();
            } catch {
                // Keep the current artwork if the host is temporarily unavailable.
            } finally {
                clearTimeout(timeout);
                if (request === controller) request = null;
            }
        }

        function onError() {
            if (disposed || image.src === placeholder) return;
            const source = image.src;
            failed.add(source);
            files = files.filter(file => file.src !== source);
            bag = bag.filter(file => file.src !== source);
            assignments.forEach((file, key) => { if (file.src === source) assignments.delete(key); });
            paint();
        }
        const onPageHide = () => request?.abort();
        const onPageShow = event => { if (event.persisted) refresh(true); };
        image.addEventListener('error', onError);
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('pageshow', onPageShow);
        refresh(true);
        return {
            clearTrack(title = '') {
                current = null;
                image.alt = title;
                image.src = placeholder;
            },
            setTrack(id, title) {
                current = { id, title };
                if (files.length || signature) paint();
                else image.alt = `Ảnh bìa: ${title}`;
                refresh();
            },
            dispose() {
                disposed = true; request?.abort();
                image.removeEventListener('error', onError);
                window.removeEventListener('pagehide', onPageHide);
                window.removeEventListener('pageshow', onPageShow);
            }
        };
    };
})();
