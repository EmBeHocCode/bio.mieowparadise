import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensions = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico', '.cur', '.mp3', '.mp4', '.ogg', '.wav', '.lrc', '.woff', '.woff2', '.ttf', '.otf']);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

function listFiles(directory, recursive = true) {
    if (lstatSync(directory).isSymbolicLink()) throw new Error('Runtime directories must not be symbolic links.');
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (entry.isSymbolicLink() || entry.name.startsWith('.') || /(?:\.1|-old|_old)$/i.test(entry.name) || entry.name.startsWith('chrome-')) return [];
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return recursive ? listFiles(path) : [];
        const vendorNotice = path.split(sep).includes('vendor') && /^(?:LICENSE|NOTICE|README)\.md$/i.test(entry.name);
        return entry.isFile() && (extensions.has(extname(entry.name).toLowerCase()) || vendorNotice) ? [path] : [];
    });
}

export function buildPages({ root = defaultRoot, output = resolve(defaultRoot, '..', '_site') } = {}) {
    root = realpathSync(root);
    output = resolve(output);
    if (output === root || output.startsWith(root + sep)) throw new Error('Pages output must be outside public_html.');
    if (existsSync(output)) throw new Error('Pages output already exists; choose a new empty output path.');

    const index = join(root, 'index.html');
    if (!lstatSync(index).isFile() || lstatSync(index).isSymbolicLink()) throw new Error('A regular index.html is required.');
    const files = [index, ...listFiles(join(root, 'css'), false), ...listFiles(join(root, 'js'), false), ...listFiles(join(root, 'assets'))].sort();
    const bytes = files.reduce((sum, path) => sum + statSync(path).size, 0);
    if (bytes >= 1_000_000_000) throw new Error('Pages artifact exceeds the 1 GB site-size budget.');

    const coverFolder = join(root, 'assets', 'cover-png');
    const images = listFiles(coverFolder, false).filter(path => imageExtensions.has(extname(path).toLowerCase())).map(path => ({
        file: relative(coverFolder, path),
        version: createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16),
    })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    if (!images.length) throw new Error('No cover images found.');

    mkdirSync(output, { recursive: true });
    for (const path of files) {
        const target = join(output, relative(root, path));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(path, target);
    }
    writeFileSync(join(output, 'assets', 'cover-png', 'catalog.json'), JSON.stringify({ images }, null, 2) + '\n');
    writeFileSync(join(output, '.nojekyll'), '');
    return { output, files: files.length + 2, bytes, covers: images.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length > 1) throw new Error('Usage: node public_html/deploy/build-pages.mjs [output-directory]');
    console.log(JSON.stringify(buildPages(args[0] ? { output: args[0] } : {})));
}
