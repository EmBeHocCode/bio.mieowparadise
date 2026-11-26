import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildPages } from '../deploy/build-pages.mjs';

function fixture(t) {
    const temp = mkdtempSync(join(tmpdir(), 'meow-bio-pages-'));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    const root = join(temp, 'public_html');
    for (const dir of ['css', 'js', 'assets/cover-png', 'assets/music']) mkdirSync(join(root, dir), { recursive: true });
    for (const [file, data] of Object.entries({
        'index.html': '<html>Meow</html>', 'css/style.css': 'body{}', 'js/app.js': 'void 0;',
        'assets/cover-png/a.png': 'cover-a', 'assets/cover-png/b.gif': 'cover-b',
        'assets/cover-png/index.php': '<?php echo "server-only";',
        'assets/music/song.mp3': Buffer.from([0, 1, 2, 255]),
        'assets/music/song.lrc': '[00:01]Loi bai hat',
        'assets/archive.zip': 'archive', 'assets/old.gif.1': 'old',
        'assets/.env': 'TEST_ONLY_NOT_A_SECRET', 'assets/notes.md': 'notes',
    })) writeFileSync(join(root, file), data);
    return { root, output: join(temp, 'site') };
}

test('Pages includes only runtime files, with no PHP, archives, notes or environment files', t => {
    const options = fixture(t);
    const result = buildPages(options);
    assert.equal(result.covers, 2);
    assert.equal(existsSync(join(options.output, '.nojekyll')), true);
    for (const file of ['assets/cover-png/index.php', 'assets/archive.zip', 'assets/old.gif.1', 'assets/.env', 'assets/notes.md']) assert.equal(existsSync(join(options.output, file)), false);
    assert.deepEqual(readFileSync(join(options.output, 'assets/music/song.mp3')), readFileSync(join(options.root, 'assets/music/song.mp3')));
    assert.equal(readFileSync(join(options.output, 'assets/music/song.lrc'), 'utf8'), '[00:01]Loi bai hat');
});

test('cover catalog is deterministic, sorted and content-versioned', t => {
    const options = fixture(t);
    buildPages(options);
    const catalog = JSON.parse(readFileSync(join(options.output, 'assets/cover-png/catalog.json')));
    assert.deepEqual(catalog.images.map(image => image.file), ['a.png', 'b.gif']);
    assert.equal(catalog.images[0].version, createHash('sha256').update('cover-a').digest('hex').slice(0, 16));
});

test('build refuses existing output without modifying it', t => {
    const options = fixture(t);
    mkdirSync(options.output);
    writeFileSync(join(options.output, 'keep.txt'), 'keep');
    assert.throws(() => buildPages(options), /already exists/);
    assert.equal(readFileSync(join(options.output, 'keep.txt'), 'utf8'), 'keep');
});

test('build refuses output inside source without changing source', t => {
    const options = fixture(t);
    assert.throws(() => buildPages({ ...options, output: join(options.root, 'dist') }), /outside public_html/);
    assert.equal(existsSync(join(options.root, 'dist')), false);
});
