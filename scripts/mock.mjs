// scripts/mock.mjs · one command from a bot's JSON config to a mock page (v0.9.5).
//   npm run mock -- <config.json> --cases cases.json --out mock.html [--widgets own.js]… [--theme theme.css]… [--skin chat-skin.css] [--dark]
// It wraps the two tools that already do the work, unchanged:
//   1. scripts/bot-code.mjs checks the config and writes mock-widgets.js (LBW.kit.setup(config) + your own widgets), in a temp folder;
//   2. tools/build-mock.py draws the page: lbw.js, kit.js, setup.js, setup-check.js, mock-widgets.js; lbw.css, kit.css, your CSS.
// --widgets and --theme can be given more than once: the files are joined in the order given (a custom widget's CSS is a
//   second --theme, after the brand's; on the live bot it goes in theme.css the same way).
// --skin is the chat skin (chat-skin.py's CSS): only its @import lines are used, so the mock measures in the brand's font.
// --dark draws the mock chat dark (page and bubbles). When the theme has no dark card, it also adds a reference dark token set
//   (docs/05 "Dark values"), to preview the kit on a dark chat before the brand's own dark theme exists.
// Then: npm run mock:report -- <mock.html>, and open it with ?kitdev=1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HERE = process.env.INIT_CWD || process.cwd();   // npm run starts in the package root; the paths are the caller's
const at = (p) => path.resolve(HERE, p), lib = (p) => path.join(ROOT, p);
const show = (p) => { const r = path.relative(HERE, p); return r && !r.startsWith('..') ? r : p; };
const USAGE = 'usage: npm run mock -- <config.json> --cases cases.json --out mock.html [--widgets own.js]… [--theme theme.css]… [--skin chat-skin.css] [--dark]';

const args = process.argv.slice(2), opt = { widgets: [], theme: [] }, files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dark') opt.dark = true;
  else if (/^--(widgets|theme)$/.test(a)) { const v = args[++i]; if (!v || /^--/.test(v)) { console.error(a + ' takes a file'); process.exit(2); } opt[a.slice(2)].push(at(v)); }
  else if (/^--(cases|out|skin)$/.test(a)) { const v = args[++i]; if (!v || /^--/.test(v)) { console.error(a + ' takes a file'); process.exit(2); } opt[a.slice(2)] = at(v); }
  else if (/^--/.test(a)) { console.error('unknown option ' + a + '\n' + USAGE); process.exit(2); }
  else files.push(at(a));
}
if (files.length !== 1 || !opt.cases || !opt.out) { console.error(USAGE); process.exit(2); }
for (const f of [files[0], opt.cases, opt.skin, ...opt.widgets, ...opt.theme]) if (f && !fs.existsSync(f)) { console.error('no such file: ' + f); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-mock-'));
const join = (list, name, sep) => { if (list.length < 2) return list[0]; const p = path.join(tmp, name); fs.writeFileSync(p, list.map((f) => fs.readFileSync(f, 'utf8')).join(sep)); return p; };
const run = (cmd, argv) => { const r = spawnSync(cmd, argv, { cwd: ROOT, encoding: 'utf8' }); if (r.error) { console.error(cmd + ': ' + r.error.message); } return r; };
let code = 0;
try {
  const widgets = join(opt.widgets, 'widgets.js', '\n;\n'), theme = join(opt.theme, 'theme.css', '\n');
  // 1 · the config, checked, and the setup call + own widgets as one script
  const build = path.join(tmp, 'build');
  const b = run(process.execPath, [lib('scripts/bot-code.mjs'), files[0], '--out', build, ...(widgets ? ['--widgets', widgets] : []), ...(theme ? ['--theme', theme] : [])]);
  process.stderr.write(b.stderr || '');
  if (b.status !== 0) { console.error('✖ the config did not build: nothing written'); code = b.status || 1; throw null; }
  const libLine = 'mock · ' + (b.stdout || '').split('\n')[0].replace(/ · (?:inline|by URL[^·]*)/, ' (this checkout\'s runtime/ and kit/) ');

  // 2 · --dark: the mock's own chat in dark (build-mock.py draws a light one), and a reference token set when the theme has none
  const css = [lib('runtime/lbw.css'), lib('kit/kit.css'), ...(theme ? [theme] : [])];
  if (opt.dark) {
    const themeText = theme ? fs.readFileSync(theme, 'utf8') : '';
    const card = /#([0-9a-fA-F]{6})/.exec((themeText.match(/--lbw-card\s*:\s*#[0-9a-fA-F]{6}\b/g) || []).pop() || '');   // the last one wins, as in CSS
    const lum = card ? [0, 2, 4].map((i) => parseInt(card[1].substr(i, 2), 16)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0) / 255 : 1;
    let dark = '/* scripts/mock.mjs --dark: the mock chat (selectors stronger than build-mock.py\'s own) */\n'
      + 'html body { background: #0F1113; color: #E8EAED; }\n'
      + '.row .bubble { background: #1B1E22; border-color: #2B3036; color: #E8EAED; }\n'
      + '.row[data-lb-author=user] .bubble { background: #E8EAED; color: #0F1113; }\n';
    if (lum > 0.35) {
      console.error('⚠ --dark: the theme has no dark --lbw-card, so the reference dark tokens were added (docs/05 "Dark values"). A brand\'s dark theme sets its own.');
      dark += '/* reference dark tokens (docs/05 "Dark values"); the theme\'s accent is kept for fills, lightened as text */\n'
        + ':root { --lbw-card: #16191D; --lbw-ink: #E8EAED; --lbw-muted: #A9B0B8; --lbw-soft: #1F2328; --lbw-line: rgba(232,234,237,.12);\n'
        + '  --lbw-ring: rgba(232,234,237,.22); --lbw-tint: #252B33; --lbw-pill-bg: #1F2328; --lbw-hair: rgba(232,234,237,.10); --kit-hero-to: #0B0D10;\n'
        + '  --lbw-accent-text: color-mix(in srgb, var(--lbw-accent) 45%, #FFFFFF); }\n';
    }
    const p = path.join(tmp, 'dark.css'); fs.writeFileSync(p, dark); css.push(p);
  }

  // 3 · the page
  const m = run('python3', [lib('tools/build-mock.py'), '--runtime', lib('runtime/host-v4.js'), '--widgets', lib('runtime/lbw.js'),
    ...['kit/kit.js', 'kit/setup.js', 'kit/setup-check.js'].flatMap((f) => ['--widgets', lib(f)]), '--widgets', path.join(build, 'mock-widgets.js'),
    ...css.flatMap((f) => ['--css', f]), ...(opt.skin ? ['--fonts', opt.skin] : []), '--cases', opt.cases, '--out', opt.out]);
  process.stderr.write(m.stderr || '');
  if (m.status !== 0) { console.error('✖ build-mock.py failed'); code = m.status || 1; throw null; }
  const n = (/(\d+) cases/.exec(m.stdout || '') || [])[1];
  console.log(`${libLine}${opt.dark ? ' · dark' : ''}\n  ${show(opt.out)}  ${n} cases, ${(fs.statSync(opt.out).size / 1024).toFixed(1)} KB\n`
    + `  next: npm run mock:report -- ${show(opt.out)}   ·   open it with ?kitdev=1 (&today=D/M/YYYY&now=HH:MM to pin the clock)`);
} catch (e) { if (e) { console.error(e.stack || String(e)); code = 1; } }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
process.exit(code);
