const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { createReadStream, existsSync, mkdirSync, readFileSync, statSync } = require('node:fs');
const { extname, join, resolve, sep } = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');

const root = resolve(__dirname, '../../_site');
const results = resolve(__dirname, '../../test-results');
const mount = '/bio.mieowparadise/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.lrc': 'text/plain; charset=utf-8' };
mkdirSync(results, { recursive: true });
const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith(mount)) { res.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(path.slice(mount.length)) || 'index.html');
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size;
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416).end(); return; }
    const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
});

(async () => {
    let browser;
    try {
        await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
        const url = process.argv[2] || `http://127.0.0.1:${server.address().port}${mount}`;
        const screenshotPrefix = process.argv[2] ? 'online-pages' : 'pages';
        const libraryContext = vm.createContext({ window: {} });
        vm.runInContext(readFileSync(join(root, 'js/music-library.js'), 'utf8'), libraryContext);
        let tracks = 0;
        for (const playlist of libraryContext.window.MEOW_MUSIC_LIBRARY.playlists) {
            for (const track of playlist.tracks) {
                const file = typeof track === 'string' ? track : track.file;
                assert.ok(existsSync(join(root, 'assets/music', playlist.folder, file)), `Missing track: ${file}`);
                tracks++;
            }
        }
        const covers = JSON.parse(readFileSync(join(root, 'assets/cover-png/catalog.json'))).images;
        assert.equal(covers.length, 15);
        for (const cover of covers) assert.ok(existsSync(join(root, 'assets/cover-png', cover.file)));
        const rangeResponse = await fetch(new URL('assets/music/Chill-music/02-khongbuong.mp3', url), { headers: { Range: 'bytes=0-1023' } });
        assert.equal(rangeResponse.status, 206);
        assert.equal((await rangeResponse.arrayBuffer()).byteLength, 1024);
        console.log(JSON.stringify({ tracks, covers: covers.length, audioRange: 'passed' }));

        browser = await chromium.launch({ channel: 'msedge', headless: true });
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
            const context = await browser.newContext({ viewport });
            await context.addInitScript(() => localStorage.setItem('bio_music_startup_playlist', 'chill'));
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            const errors = [], localErrors = [], externalFailures = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('response', response => {
                if (response.url().startsWith(url) && response.status() >= 400) localErrors.push({ status: response.status(), path: new URL(response.url()).pathname });
            });
            page.on('requestfailed', request => { if (!request.url().startsWith(url)) externalFailures.push(new URL(request.url()).hostname); });
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            console.log(`viewport=${viewport.width} page-loaded`);
            if (await page.locator('#bio-intro-skip').isVisible()) await page.locator('#bio-intro-skip').click();
            await page.waitForFunction(() => !document.getElementById('bio-load-intro') || getComputedStyle(document.getElementById('bio-load-intro')).visibility === 'hidden' || getComputedStyle(document.getElementById('bio-load-intro')).display === 'none', { timeout: 20000 });
            await page.evaluate(() => { document.getElementById('bg-music').muted = true; });
            await page.locator('#music-toggle-btn').click();
            // The existing music panel floats continuously; keyboard interaction
            // avoids Playwright waiting for a deliberately moving button to stop.
            await page.locator('#music-playlist-select-trigger').press('Home');
            await page.locator('#music-playlist-select-trigger').press('ArrowDown');
            await page.locator('#music-playlist-select-trigger').press('Enter');
            assert.equal(await page.locator('#music-playlist-select').inputValue(), 'chill');
            await page.waitForFunction(() => {
                const audio = document.getElementById('bg-music');
                return audio.readyState >= 1 && audio.duration > 0;
            });
            const before = await page.locator('#bg-music').evaluate(audio => audio.currentTime);
            if (await page.locator('#bg-music').evaluate(audio => audio.paused)) await page.locator('#music-play-pause').press('Enter');
            await page.waitForFunction(time => { const audio = document.getElementById('bg-music'); return !audio.paused && audio.currentTime > time + 0.25; }, before);
            await page.waitForFunction(() => { const image = document.getElementById('music-cover-image'); return image.complete && image.naturalWidth > 0 && image.src.includes('?v='); });
            const oldTrack = await page.locator('#bg-music').evaluate(audio => audio.currentSrc);
            await page.locator('#music-next').press('Enter');
            await page.waitForFunction(old => document.getElementById('bg-music').src !== old, oldTrack);
            const lyrics = await page.evaluate(async () => {
                const audio = document.getElementById('bg-music');
                const response = await fetch(audio.src.replace(/\.mp3(?=\?|$)/, '.lrc'));
                return { status: response.status, lines: window.MeowLrc.parse(await response.text()).length };
            });
            assert.equal(lyrics.status, 200);
            assert.ok(lyrics.lines > 0);
            await page.locator('#music-close').press('Enter');
            await page.waitForFunction(() => getComputedStyle(document.getElementById('music-content')).opacity === '0' && getComputedStyle(document.getElementById('music-backdrop')).opacity === '0');
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            assert.equal(overflow, false, 'Unexpected horizontal page overflow');
            await page.screenshot({ path: join(results, `${screenshotPrefix}-${viewport.width}.png`) });
            await page.locator('#music-toggle-btn').click();
            await page.waitForFunction(() => getComputedStyle(document.getElementById('music-content')).opacity === '1');
            await page.screenshot({ path: join(results, `${screenshotPrefix}-music-${viewport.width}.png`) });
            await page.locator('#bg-music').evaluate(audio => audio.pause());
            assert.deepEqual(errors, [], 'JavaScript runtime errors');
            assert.deepEqual(localErrors, [], 'Static asset HTTP errors');
            console.log(JSON.stringify({ viewport, audioPlayback: 'passed', nextTrack: 'passed', lyrics, localErrors, errors, externalFailures: [...new Set(externalFailures)] }));
            await context.close();
        }
    } finally {
        if (browser) await browser.close();
        server.closeAllConnections();
        await new Promise(done => server.close(done));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
