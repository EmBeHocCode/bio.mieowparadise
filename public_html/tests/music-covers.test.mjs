import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/music-covers.js', import.meta.url), 'utf8');
const base = 'https://embehoccode.github.io/bio.mieowparadise/';
const coverFolder = base + 'assets/cover-png/';
const response = (images, ok = true) => ({ ok, headers: { get: () => 'application/json' }, json: async () => ({ images }) });

async function create(fetcher) {
    const requests = [];
    const window = { addEventListener() {}, removeEventListener() {} };
    const image = { src: coverFolder + 'avt1.png', alt: '', addEventListener() {}, removeEventListener() {} };
    vm.runInNewContext(source, {
        window, document: { baseURI: base }, URL, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { requests.push(url); return fetcher(url, options); },
    });
    const controller = window.createMusicCoverController(image);
    await new Promise(resolve => setImmediate(resolve));
    return { image, controller, requests };
}

test('static cover catalog works under a GitHub project subpath without PHP', async () => {
    const { image, controller, requests } = await create(() => response([{ file: 'cover a.png', version: 'hash1' }]));
    controller.setTrack('one', 'One');
    assert.deepEqual(requests, [coverFolder + 'catalog.json']);
    assert.equal(image.src, coverFolder + 'cover%20a.png?v=hash1');
    controller.dispose();
});

test('missing static catalog falls back to the existing PHP folder contract', async () => {
    const { image, controller, requests } = await create(url => url.endsWith('catalog.json') ? response([], false) : response([{ file: 'old.png', version: '2' }]));
    controller.setTrack('one', 'One');
    assert.deepEqual(requests, [coverFolder + 'catalog.json', coverFolder]);
    assert.equal(image.src, coverFolder + 'old.png?v=2');
    controller.dispose();
});

test('catalog cannot select external, parent, hidden or executable paths', async () => {
    const { image, controller } = await create(() => response([
        { file: '../outside.png' }, { file: 'https://example.com/a.png' },
        { file: '.hidden.png' }, { file: 'index.php' }, { file: 'valid.png', version: '1' },
    ]));
    controller.setTrack('one', 'One');
    assert.equal(image.src, coverFolder + 'valid.png?v=1');
    controller.dispose();
});

test('covers stay stable per track and do not repeat before the available bag is exhausted', async () => {
    const { image, controller } = await create(() => response([{ file: 'a.png' }, { file: 'b.png' }]));
    controller.setTrack('one', 'One');
    const first = image.src;
    controller.setTrack('two', 'Two');
    assert.notEqual(image.src, first);
    controller.setTrack('one', 'One');
    assert.equal(image.src, first);
    controller.dispose();
});

test('empty catalogs preserve initial artwork; clearing a track uses the placeholder', async () => {
    const { image, controller } = await create(() => response([]));
    controller.setTrack('one', 'One');
    assert.equal(image.src, coverFolder + 'avt1.png');
    controller.clearTrack();
    assert.equal(image.src, base + 'assets/music/cover-placeholder.svg');
    controller.dispose();
});
