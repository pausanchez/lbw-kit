// scripts/bot-code.mjs · a bot's Custom JS and Custom CSS, written from its config. It checks the config first.
//   node scripts/bot-code.mjs src/config.json --out build [--widgets src/widgets.js] [--theme src/theme.css] [--skin build/chat-skin.css] [--inline]
// Writes into --out:
//   custom_js.html    the library's load line (pinned version, integrity) + LBW.kit.setup(config) + your own widgets + the fallback
//   custom_css.css    the library's @import + the theme + the chat skin
//   mock-widgets.js   the same setup call and widgets as one script, for tools/build-mock.py (after kit/kit.js and kit/setup.js)
// --inline puts the library's code in both files instead of loading it by URL (for a page that blocks outside hosts).
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import { read, checkConfig } from './lib.mjs';

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--inline') opt.inline = true;
  else if (/^--(out|widgets|theme|skin)$/.test(args[i])) opt[args[i].slice(2)] = args[++i];
  else files.push(args[i]);
}
if (files.length !== 1 || !opt.out) { console.error('usage: node scripts/bot-code.mjs <config.json> --out <dir> [--widgets own.js] [--theme theme.css] [--skin chat-skin.css] [--inline]'); process.exit(2); }

let config;
try { config = JSON.parse(fs.readFileSync(files[0], 'utf8')); } catch (e) { console.error(`${files[0]}: not valid JSON (${e.message})`); process.exit(1); }
const errors = checkConfig(config);
if (errors.length) { errors.forEach((e) => console.error('✖ ' + e)); process.exit(1); }

const pkg = JSON.parse(read('package.json')), manifest = JSON.parse(read('dist/manifest.json'));
if (manifest.version !== pkg.version) { console.error(`dist/ is v${manifest.version} and package.json is v${pkg.version}: run npm run build`); process.exit(1); }
const repo = typeof pkg.repository === 'string' ? pkg.repository.replace(/^github:/, '') : null;
if (!opt.inline && !repo) { console.error('package.json has no "repository": use --inline'); process.exit(1); }
const base = `https://cdn.jsdelivr.net/gh/${repo}@v${pkg.version}/dist/`;
const file = (p) => (p ? fs.readFileSync(p, 'utf8').trim() : '');

// the demo's own script and CSS are minified like the library: they are re-sent on every change
const min = async (text, loader) => (text ? (await transform(text, { loader, minify: true, legalComments: 'none' })).code.trim() : '');
const setup = `LBW.kit.setup(${JSON.stringify(config)});`, own = await min(file(opt.widgets), 'js');
const scripts = [setup, own].filter(Boolean);
// inside <script>…</script> a literal "</script" would end the block early
for (const s of scripts) if (/<\/script/i.test(s)) { console.error('the config or the widgets contain "</script": write it as "<\\/script"'); process.exit(1); }

const tag = (s) => `<script>${s}</script>`;
const load = opt.inline ? read('dist/inline/custom_js.html').trim()
  : `<script src="${base}lbw-kit.min.js" integrity="${manifest.files['lbw-kit.min.js'].integrity}" crossorigin="anonymous"></script>`;
const js = load + scripts.map(tag).join('') + (opt.inline ? '' : tag(read('dist/fallback.min.js').trim())) + '\n';
// @import must come before any other rule: the fonts that the theme or the skin import go to the top, with the library's
const imports = opt.inline ? [] : [`@import url("${base}lbw-kit.min.css");`];
const mine = [file(opt.theme), file(opt.skin)].filter(Boolean).join('\n').replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, (m) => { imports.push(m.trim()); return ''; });
const cssOut = imports.concat(opt.inline ? [read('dist/lbw-kit.min.css').trim()] : [], [await min(mine, 'css')].filter(Boolean)).join('\n') + '\n';

fs.mkdirSync(opt.out, { recursive: true });
const out = { 'custom_js.html': js, 'custom_css.css': cssOut, 'mock-widgets.js': scripts.join('\n') + '\n' };
for (const [name, text] of Object.entries(out)) fs.writeFileSync(path.join(opt.out, name), text);
console.log(`lbw-kit v${pkg.version} · ${opt.inline ? 'inline' : 'by URL'} · ${Object.keys(config.widgets).length} widgets, prefix "${config.prefix}"`);
for (const [name, text] of Object.entries(out)) console.log(`  ${path.join(opt.out, name).padEnd(34)} ${(Buffer.byteLength(text) / 1024).toFixed(1).padStart(6)} KB`);
