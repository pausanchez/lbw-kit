// scripts/build.mjs · builds dist/ from runtime/ and kit/. Two ways to ship the same code:
//   hosted   dist/lbw-kit.min.js + dist/lbw-kit.min.css, loaded by URL at a pinned version (never "latest")
//   inline   dist/inline/custom_js.html, the same code inside <script>…</script>, to paste into Custom JS when a
//            client's page blocks outside hosts
// dist/manifest.json records, per file: bytes, gzip bytes, SHA-256 (hex) and the SRI value (sha384).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { transform } from 'esbuild';

const root = new URL('..', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json'));
const v = pkg.version;
const banner = (what) => `/*! ${what} v${v} */`;

// v0.8.1.9 · no raw U+00A0 in shipped JS: Landbot's upload turns one into a plain space (docs/13); \xA0 works in strings and regexes
const nbsp = (code) => code.replace(/\u00a0/g, '\\xA0');
async function js(path) { return nbsp((await transform(read(path), { loader: 'js', minify: true, target: 'es2017', legalComments: 'none' })).code.trim()); }
async function css(path) { return (await transform(read(path), { loader: 'css', minify: true, legalComments: 'none' })).code.trim(); }

const lbw = await js('runtime/lbw.js'), kit = await js('kit/kit.js'), setup = await js('kit/setup.js'), check = await js('kit/setup-check.js');
const lbwCss = await css('runtime/lbw.css'), kitCss = await css('kit/kit.css');

const out = {
  'lbw.min.js': `${banner('lbw.js')}\n${lbw}\n`,
  'kit.min.js': `${banner('lbw kit + setup (needs lbw.js)')}\n${kit}\n${setup}\n`,
  'lbw-kit.min.js': `${banner('lbw.js + kit + setup')}\n${lbw}\n${kit}\n${setup}\n`,
  // the same with the config checker: for mocks and for trying a config in a page, never for a live bot
  'lbw-kit.dev.min.js': `${banner('lbw.js + kit + setup + the config checker (not for live bots)')}\n${lbw}\n${kit}\n${setup}\n${check}\n`,
  // the library with its CSS inside: the script adds a <style> before every other, so a theme still wins. One host to allow
  // in a client's CSP (script-src) instead of two, and no widget can draw without its styles
  'lbw-kit.all.min.js': `${banner('lbw.js + kit + setup, with lbw.css + kit.css inside')}\n(function(d){if(d.querySelector('style[data-lbw]'))return;var s=d.createElement('style'),h=d.head||d.documentElement;s.setAttribute('data-lbw','');s.textContent=${JSON.stringify(lbwCss + kitCss)};h.insertBefore(s,h.firstChild)})(document);\n${lbw}\n${kit}\n${setup}\n`,
  'lbw.min.css': `${banner('lbw.css')}\n${lbwCss}\n`,
  'kit.min.css': `${banner('lbw kit.css (needs lbw.css)')}\n${kitCss}\n`,
  'lbw-kit.min.css': `${banner('lbw.css + kit.css')}\n${lbwCss}\n${kitCss}\n`,
  'host-modal.min.js': `${banner('lbw kit host-modal (for the host page)')}\n${await js('kit/host-modal.js')}\n`,
  'fallback.min.js': `${await js('runtime/fallback.js')}\n`,
};
// the inline target: what goes into Custom JS when nothing may load from outside
out['inline/custom_js.html'] = `<script>${out['lbw-kit.min.js'].trim()}</script>\n`;

// inside <script>…</script> a literal "</script" would end the block early
for (const [name, text] of Object.entries(out)) {
  if (!name.endsWith('.js') && !name.endsWith('.html')) continue;
  const body = name.endsWith('.html') ? text.replace(/^<script>/, '').replace(/<\/script>\n$/, '') : text;
  if (/<\/script/i.test(body)) { console.error(`${name}: contains "</script", it would break an inline <script>`); process.exit(1); }
}

const dist = new URL('dist/', root);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(new URL('inline/', dist), { recursive: true });

const files = {};
for (const [name, text] of Object.entries(out)) {
  const buf = Buffer.from(text, 'utf8');
  fs.writeFileSync(new URL(name, dist), buf);
  files[name] = {
    bytes: buf.length,
    gzip: zlib.gzipSync(buf, { level: 9 }).length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    integrity: 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64'),
  };
}

const manifest = { name: pkg.name, version: v, files };
// with "repository": "owner/name" in package.json, the pinned URLs and the Custom JS line are written out too
const repo = typeof pkg.repository === 'string' ? pkg.repository.replace(/^github:/, '') : null;
if (repo) {
  const base = `https://cdn.jsdelivr.net/gh/${repo}@v${v}/dist/`;
  manifest.hosted = {
    js: base + 'lbw-kit.min.js',
    css: base + 'lbw-kit.min.css',
    custom_js: `<script src="${base}lbw-kit.min.js"></script><script>${out['fallback.min.js'].trim()}</script>`,
    custom_css: `@import url("${base}lbw-kit.min.css");`,
  };
}
fs.writeFileSync(new URL('manifest.json', dist), JSON.stringify(manifest, null, 2) + '\n');

const kb = (n) => (n / 1024).toFixed(1).padStart(6) + ' KB';
console.log(`lbw-kit v${v} → dist/`);
for (const [name, f] of Object.entries(files)) console.log(`  ${name.padEnd(24)} ${kb(f.bytes)}  gzip ${kb(f.gzip)}`);
