// scripts/bot-code.mjs · a bot's Custom JS and Custom CSS, written from its config. It checks the config first.
//   node scripts/bot-code.mjs src/config.json --out build [--widgets src/widgets.js] [--theme src/theme.css] [--skin build/chat-skin.css] [--all | --inline]
// Writes into --out:
//   custom_js.html    the library's load line (pinned version, integrity) + LBW.kit.setup(config) + your own widgets + the fallback
//   custom_css.css    the library's @import + the guard (v0.9.5: bot text hidden until the runtime is ready, 4 s at most) + the theme + the chat skin
//   mock-widgets.js   the same setup call and widgets as one script, for tools/build-mock.py (after kit/kit.js, kit/setup.js and kit/setup-check.js)
// --inline puts the library's code in both files instead of loading it by URL (for a page that blocks outside hosts).
// --all loads the bundle that carries its own CSS: custom_css then has no @import of the library, and a client with a
// Content-Security-Policy allows one host in script-src only (measured: script without its CSS draws unstyled widgets).
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { read, checkConfig } from './lib.mjs';

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--inline') opt.inline = true;
  else if (args[i] === '--all') opt.all = true;
  else if (args[i] === '--css-only') opt.cssOnly = true;
  else if (args[i] === '--lib') { opt.lib = args[++i]; if (!opt.lib || /^--/.test(opt.lib)) { console.error('--lib takes a version (0.7.5) or "keep"'); process.exit(1); } }
  else if (/^--(out|widgets|theme|skin)$/.test(args[i])) opt[args[i].slice(2)] = args[++i];
  else files.push(args[i]);
}
if (files.length !== 1 || !opt.out) { console.error('usage: node scripts/bot-code.mjs <config.json> --out <dir> [--widgets own.js] [--theme theme.css] [--skin chat-skin.css] [--all | --inline] [--lib 0.8.1 | --lib 0.8.1.1 | --lib keep] [--css-only]  (--lib: load that released version instead of the newest, or keep the one in <dir>/custom_js.html; --css-only: write custom_css.css and leave custom_js.html as it is; --all: one file with its CSS, for a bot on a client\'s page; --inline: no outside host)'); process.exit(2); }

let config;
try { config = JSON.parse(fs.readFileSync(files[0], 'utf8')); } catch (e) { console.error(`${files[0]}: not valid JSON (${e.message})`); process.exit(1); }
const errors = checkConfig(config);
if (errors.length) { errors.forEach((e) => console.error('✖ ' + e)); process.exit(1); }
if (/"(csv|json)":\s*"http:\/\/(localhost|127\.0\.0\.1)/.test(JSON.stringify(config))) console.error('⚠ a source on localhost: fine for trying a map in the mock. Do NOT upload this build: a published bot would draw the saved copy for ever.');

const pkg = JSON.parse(read('package.json')), manifest = JSON.parse(read('dist/manifest.json'));
if (manifest.version !== pkg.version) { console.error(`dist/ is v${manifest.version} and package.json is v${pkg.version}: run npm run build`); process.exit(1); }
const repo = typeof pkg.repository === 'string' ? pkg.repository.replace(/^github:/, '') : null;
if (!opt.inline && !repo) { console.error('package.json has no "repository": use --inline'); process.exit(1); }
// --lib X.Y.Z pins the library a bot loads (a rebuild for a CSS change must not move a live bot to the newest version);
// --lib keep reads the version from the custom_js.html already in --out. The integrity comes from that tag in this repo.
let libVersion = pkg.version, libManifest = manifest, libFallback = null, libGuard = undefined, oldJs = '';
// --css-only must write the CSS that goes with the custom_js.html already there: its library version and its way of
// loading (by URL, one file with its CSS, or inline). So it keeps both.
if (opt.cssOnly) {
  let old = ''; try { old = fs.readFileSync(path.join(opt.out, 'custom_js.html'), 'utf8'); } catch (e) {}
  if (!old) { console.error('--css-only: no ' + path.join(opt.out, 'custom_js.html') + ' to go with (build once without --css-only)'); process.exit(1); }
  oldJs = old;
  const byUrl = /@v\d+(?:\.\d+){2,3}\/dist\/lbw-kit(\.all)?\.min\.js/.exec(old);
  if (byUrl) { opt.inline = false; opt.all = !!byUrl[1]; opt.lib = opt.lib || 'keep'; }
  else { opt.inline = true; opt.all = false; if (opt.lib) { console.error('--css-only: the custom_js.html there is inline (no library URL): --lib has nothing to pin'); process.exit(1); }
    console.error('⚠ --css-only on an inline build: the CSS is written from the CURRENT library (v' + pkg.version + '); the inline JS there may be older.'); }
}
if (opt.lib && opt.inline) { console.error('--lib and --inline don\'t go together: an inline build carries the current library\'s code'); process.exit(1); }
if (opt.lib && !opt.inline) {
  let v = opt.lib;
  if (v === 'keep') { let old = ''; try { old = fs.readFileSync(path.join(opt.out, 'custom_js.html'), 'utf8'); } catch (e) {} const m = /@v(\d+(?:\.\d+){2,3})\/dist\//.exec(old); if (!m) { console.error('--lib keep: no library version found in ' + path.join(opt.out, 'custom_js.html')); process.exit(1); } v = m[1]; if (/lbw-kit\.all\.min\.js/.test(old)) opt.all = true; }
  v = String(v).replace(/^v/, '');
  if (!/^\d+(?:\.\d+){2,3}$/.test(v)) { console.error('--lib takes a released version, as 0.7.5'); process.exit(1); }
  if (v !== pkg.version) {
    const show = (f) => { try { return execFileSync('git', ['show', `v${v}:${f}`], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };
    const m = show('dist/manifest.json'); if (!m) { console.error(`--lib ${v}: no tag v${v} with a dist/manifest.json in this repo`); process.exit(1); }
    libManifest = JSON.parse(m); libFallback = show('dist/fallback.min.js'); libGuard = show('dist/guard.min.css'); libVersion = v;
    if (opt.all && !libManifest.files['lbw-kit.all.min.js']) { console.error(`v${v} has no lbw-kit.all.min.js (it came with v0.7.4): drop --all`); process.exit(1); }
    console.error(`⚠ the config was checked by v${pkg.version} but the bot will run v${v}: a type or option added since then won't work there.`);
  }
}
const base = `https://cdn.jsdelivr.net/gh/${repo}@v${libVersion}/dist/`;
const file = (p) => (p ? fs.readFileSync(p, 'utf8').trim() : '');
// v0.8.1: pills, kickers and prices are drawn in the accent AS TEXT. A light brand colour needs --lbw-accent-text.
{ const css = file(opt.theme), tok = (n) => { const m = new RegExp('--lbw-' + n + '\\s*:\\s*(#[0-9a-fA-F]{6})\\b').exec(css); return m ? m[1] : null; };
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4))); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
  const ratio = (a, b) => { const l = [lum(a), lum(b)].sort((x, y) => y - x); return (l[0] + .05) / (l[1] + .05); };
  const acc = tok('accent'), txt = tok('accent-text'), card = tok('card') || '#FFFFFF', shown = txt || acc;
  if (shown && ratio(shown, card) < 4.5) { console.error(`✖ ${opt.theme}: ${txt ? '--lbw-accent-text' : '--lbw-accent'} ${shown} on ${card} is ${ratio(shown, card).toFixed(2)}:1. Buttons, kickers and prices are drawn in it as text: ${txt ? 'darken --lbw-accent-text' : 'add --lbw-accent-text, a darker shade'} (4.5:1 at least). --lbw-accent stays for fills.`); process.exit(1); } }

// the demo's own script and CSS are minified like the library: they are re-sent on every change
const min = async (text, loader) => (text ? (await transform(text, { loader, minify: true, legalComments: 'none' })).code.trim() : '');
// v0.8.1.9 · a literal U+00A0 doesn't survive the upload (docs/13: it came back a plain space, and once even a \u00a0 escape did):
// write it as the \xA0 escape, which Landbot keeps (docs/13: \xXX escapes are kept), in values, keys, regexes and your own widgets
// v0.9.0 · `this` at the top level of the Custom JS is the v4 widget: hand it to the runtime so messages go through
// Widget.sendMessage (custom_data in the same message) instead of the legacy bridge. Guarded: a pinned older library has no LBW.landbot
// v0.9.5 · every "<" of the config is written \x3C (a string escape Landbot keeps): "</script" or "<!--<script" in a text can't
// end the block early or put the HTML parser in its double-escaped state
// v0.9.5 · guarded: with the library blocked, an unguarded `LBW.…` threw "LBW is not defined" on every page view
const setup = `if(window.LBW&&LBW.kit){LBW.landbot&&LBW.landbot(this);LBW.kit.setup(${JSON.stringify(config).replace(/\u00a0/g, '\\xA0').replace(/</g, '\\x3C')});}`, own = (await min(file(opt.widgets), 'js')).replace(/\u00a0/g, '\\xA0');
const scripts = [setup, own].filter(Boolean);
// inside <script>…</script> a literal "</script" would end the block early
for (const s of scripts) if (/<\/script|<!--|<script/i.test(s)) { console.error('the widgets contain "</script", "<script" or "<!--": write the "<" as "\\x3C"'); process.exit(1); }

const tag = (s) => `<script>${s}</script>`;
const load = opt.inline ? read('dist/inline/custom_js.html').trim()
  : `<script src="${base}${opt.all ? 'lbw-kit.all.min.js' : 'lbw-kit.min.js'}" integrity="${libManifest.files[opt.all ? 'lbw-kit.all.min.js' : 'lbw-kit.min.js'].integrity}" crossorigin="anonymous"></script>`;
// v0.9.5 · the fallback goes into an inline build too: a config script that doesn't parse leaves the runtime loaded but never
// ready, and only the fallback removes the tags then
const js = load + scripts.map(tag).join('') + tag((libFallback || read('dist/fallback.min.js')).trim()) + '\n';
// @import must come before any other rule: the fonts that the theme or the skin import go to the top, with the library's
const imports = opt.inline || opt.all ? [] : [`@import url("${base}lbw-kit.min.css");`];
// the guard only goes with a library that ends it (0.9.5 or later sets lbw-ready): with an older one every bot message would
// wait the guard's 4 s. A pinned older tag has no dist/guard.min.css; an inline --css-only build is checked in its JS
const guard = libGuard !== undefined ? (libGuard || '').trim()
  : opt.cssOnly && opt.inline && !/lbw-ready/.test(oldJs) ? '' : read('dist/guard.min.css').trim();
const mine = [file(opt.theme), file(opt.skin)].filter(Boolean).join('\n').replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, (m) => { imports.push(m.trim()); return ''; });
const cssOut = imports.concat([guard].filter(Boolean), opt.inline ? [read('dist/lbw-kit.min.css').trim()] : [], [await min(mine, 'css')].filter(Boolean)).join('\n') + '\n';

fs.mkdirSync(opt.out, { recursive: true });
const out = opt.cssOnly ? { 'custom_css.css': cssOut } : { 'custom_js.html': js, 'custom_css.css': cssOut, 'mock-widgets.js': scripts.join('\n') + '\n' };
for (const [name, text] of Object.entries(out)) fs.writeFileSync(path.join(opt.out, name), text);
console.log(`lbw-kit v${libVersion}${opt.cssOnly ? ' · CSS only: custom_js.html left as it is' : ''} · ${opt.inline ? 'inline' : opt.all ? 'by URL, CSS inside the script' : 'by URL'} · ${Object.keys(config.widgets).length} widgets, prefix "${config.prefix}"`);
for (const [name, text] of Object.entries(out)) console.log(`  ${path.join(opt.out, name).padEnd(34)} ${(Buffer.byteLength(text) / 1024).toFixed(1).padStart(6)} KB`);
