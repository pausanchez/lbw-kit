// test/tools.test.mjs · the command-line tools: what bot-code.mjs writes is what a bot runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { boot, pkg } from './helpers.mjs';

const cwd = new URL('..', import.meta.url);
const run = (...args) => spawnSync(process.execPath, ['scripts/bot-code.mjs', ...args], { cwd, encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-'));
const scriptsOf = (html) => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('bot-code: by URL it writes the pinned load line, the setup call and the fallback', () => {
  const out = tmp(), r = run('kit/example/config.json', '--out', out, '--theme', 'kit/example/theme.css');
  assert.equal(r.status, 0, r.stderr);
  const js = fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8'), css = fs.readFileSync(path.join(out, 'custom_css.css'), 'utf8');
  assert.match(js, new RegExp(`^<script src="https://cdn\\.jsdelivr\\.net/gh/[^"]+@v${pkg.version.replace(/\./g, '\\.')}/dist/lbw-kit\\.min\\.js" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"></script><script>LBW\\.landbot&&LBW\\.landbot\\(this\\);LBW\\.kit\\.setup\\(\\{`));
  assert.equal(scriptsOf(js).length, 3);
  assert.match(css, /^@import url\("https:\/\/cdn\.jsdelivr\.net\/[^"]+lbw-kit\.min\.css"\);\n/);
  assert.match(css, /--lbw-accent/);
  assert.ok(Buffer.byteLength(js) < 9000, 'the upload stays small');
});

test('bot-code: --inline gives code that runs with nothing loaded from outside', () => {
  const out = tmp(), own = path.join(out, 'own.js');
  fs.writeFileSync(own, "LBW.widget('hello', function (p, ctx) { var o = LBW.ui.card(ctx.lang); LBW.ui.head(o.box, '', 'Hello'); return o; });");
  const r = run('kit/example-lead/config.json', '--out', out, '--inline', '--widgets', own);
  assert.equal(r.status, 0, r.stderr);
  const c = boot({ lbw: false });
  for (const s of scriptsOf(fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8'))) c.w.eval(s);
  assert.equal(c.w.LBW.version, pkg.version);
  const m = c.bot('Text [[lg:trust]] [[lg:hello]]'); c.w.LBW.scan();
  assert.deepEqual(m.widgets().map((w) => w.getAttribute('data-widget')), ['trust', 'hello']);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'custom_css.css'), 'utf8'), /@import/);
});

test('bot-code: the setup script hands its top-level `this` (the v4 widget) to the runtime', async () => {
  const out = tmp(), r = run('kit/example-lead/config.json', '--out', out, '--inline');
  assert.equal(r.status, 0, r.stderr);
  const c = boot({ lbw: false }), got = [], widget = { sendMessage: (m) => { got.push(JSON.parse(JSON.stringify(m))); return Promise.resolve(); } };
  for (const s of scriptsOf(fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8'))) c.w.Function(s).call(widget);   // Landbot runs the Custom JS with `this` = the widget
  c.w.LBW.init({ quietMs: 10 }); c.w.LBW.say('Hi', { a: '1' });
  await new Promise((ok) => setTimeout(ok, 400));
  assert.deepEqual(got, [{ type: 'text', message: 'Hi', custom_data: { a: '1' } }]);
  assert.deepEqual(c.sent, [], 'the legacy bridge is not used');
});

test('bot-code: a config with a problem writes nothing', () => {
  const out = tmp(), bad = path.join(out, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ prefix: 't', widgets: { a: { type: 'cards', items: { x: {} } } } }));
  const r = run(bad, '--out', path.join(out, 'build'));
  assert.equal(r.status, 1); assert.match(r.stderr, /card "x" has no "title"/);
  assert.equal(fs.existsSync(path.join(out, 'build')), false);
});

test('mock-report: reads what a page drew, with dev mode on', () => {
  const out = tmp(), r = run('kit/example/config.json', '--out', out, '--inline');
  assert.equal(r.status, 0, r.stderr);
  const page = path.join(out, 'mock.html'), msg = (t) => `<div data-lb-part="message" data-lb-author="bot"><div data-lb-part="message-text">${t}</div></div>`;
  fs.writeFileSync(page, '<!doctype html><body>' + msg('A [[np:service id=loft]]') + msg('B [[np:service id=castle]] [[np:room size=12 finish=clad]]') + fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8') + '</body>');
  const rep = spawnSync(process.execPath, ['scripts/mock-report.mjs', page, '--today', '11/11/2026', '--now', '10:30'], { cwd, encoding: 'utf8' });
  assert.equal(rep.status, 0, rep.stderr + rep.stdout);
  const d = JSON.parse(rep.stdout);
  assert.deepEqual([d.devMode, d.library, d.widgets, d.setupErrors, d.rawTagsLeft], [true, pkg.version, { service: 1, room: 1 }, [], []]);
  assert.ok(d.dropped.some((x) => /unknown value id=castle/.test(x)));
});

test('build: the live bundle leaves the checker out, the dev bundle has it', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../dist/manifest.json', import.meta.url), 'utf8'));
  const live = fs.readFileSync(new URL('../dist/lbw-kit.min.js', import.meta.url), 'utf8'), dev = fs.readFileSync(new URL('../dist/lbw-kit.dev.min.js', import.meta.url), 'utf8');
  assert.ok(!/is not under any entry of/.test(live) && /is not under any entry of/.test(dev));
  assert.ok(m.files['lbw-kit.min.js'].bytes < 130000,   // a guard against a runaway, not a budget: size isn't a blocker (owner, 11 Nov 2026); 90.6 KB at 0.8.1.6, 100.8 KB at 0.8.1.12 (table, stack), 121.6 KB at 0.9.5 (accessibility: live region, focus, radiogroups)
    'live bundle ' + m.files['lbw-kit.min.js'].bytes + ' B');
  const a = boot({ lbw: false }), b = boot({ lbw: false }); a.w.eval(live); b.w.eval(dev);
  assert.equal(typeof a.LBW, 'undefined'); assert.equal(a.w.LBW.kit.setup.check, undefined); assert.equal(typeof b.w.LBW.kit.setup.check, 'function');
});

test('build: the all-in-one bundle adds its CSS once, before every other style', () => {
  const all = fs.readFileSync(new URL('../dist/lbw-kit.all.min.js', import.meta.url), 'utf8');
  const c = boot({ lbw: false }), d = c.w.document, theme = d.createElement('style');
  theme.textContent = ':root{--lbw-accent:#123456}'; d.head.appendChild(theme);
  c.w.eval(all); c.w.eval(all);
  const styles = [...d.head.querySelectorAll('style')];
  assert.equal(d.querySelectorAll('style[data-lbw]').length, 1);
  assert.equal(styles[0].hasAttribute('data-lbw'), true, 'the library comes first, so the theme after it wins');
  assert.match(styles[0].textContent, /\.lbw-box/); assert.match(styles[0].textContent, /\.kit-/);
  assert.equal(c.w.LBW.version, pkg.version);
  const out = tmp(), r = run('kit/example/config.json', '--out', out, '--all', '--theme', 'kit/example/theme.css');
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8'), /dist\/lbw-kit\.all\.min\.js" integrity="sha384-/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'custom_css.css'), 'utf8'), /lbw-kit\.min\.css/);
});

test('bot-code 0.8.1.9: a literal no-break space is written as \\xA0 (kept by the upload), in values and keys, and still reads as one', () => {
  const dir = tmp(), cfgPath = path.join(dir, 'c.json');
  const cfg = JSON.parse(fs.readFileSync('kit/example/config.json', 'utf8'));
  cfg.widgets.service.items.extension.line = 'Hasta 21 m² más';
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const out = tmp(), r = run(cfgPath, '--out', out); assert.equal(r.status, 0, r.stderr);
  const js = fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8');
  assert.ok(!js.includes(' '), 'no literal U+00A0 left');
  assert.match(js, /"Hasta 21\\xA0m² más"/);
  const setup = scriptsOf(js)[1].replace(/^LBW\.landbot&&LBW\.landbot\(this\);LBW\.kit\.setup\(/, '').replace(/\);?\s*$/, '');
  assert.equal(new Function('return ' + setup)().widgets.service.items.extension.line, 'Hasta 21 m² más');
});

test('build 0.8.1.9: no shipped JS file carries a raw U+00A0 (inline included)', () => {
  for (const f of ['lbw-kit.min.js', 'lbw-kit.all.min.js', 'lbw-kit.dev.min.js', 'lbw.min.js', 'kit.min.js', 'inline/custom_js.html'])
    assert.ok(!fs.readFileSync(path.join('dist', f), 'utf8').includes('\u00a0'), f);
});

test('build-mock --fonts: the skin\'s font import reaches the mock, and a theme font nothing imports is warned about', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mockfont-'));
  fs.writeFileSync(path.join(d, 'theme.css'), ':root { --lbw-font: "Brand Sans", Arial, sans-serif; }');
  fs.writeFileSync(path.join(d, 'skin.css'), '@import url("https://fonts.googleapis.com/css2?family=Brand+Sans:wght@400;600&display=swap");\n[data-lb-part=header]{color:red}');
  fs.writeFileSync(path.join(d, 'cases.json'), '[["a", "Hola"]]'); fs.writeFileSync(path.join(d, 'w.js'), '');
  const mock = (...extra) => spawnSync('python3', ['tools/build-mock.py', '--runtime', 'runtime/lbw.js', '--widgets', path.join(d, 'w.js'), '--css', 'runtime/lbw.css', '--css', path.join(d, 'theme.css'), ...extra, '--cases', path.join(d, 'cases.json'), '--out', path.join(d, 'm.html')], { cwd, encoding: 'utf8' });
  const bare = mock();
  assert.match(bare.stderr, /--lbw-font starts with "brand sans", which no @import loads/);
  const ok = mock('--fonts', path.join(d, 'skin.css')), html = fs.readFileSync(path.join(d, 'm.html'), 'utf8');
  assert.equal(ok.stderr, ''); assert.ok(html.includes('family=Brand+Sans')); assert.ok(!html.includes('[data-lb-part=header]{color:red}'));
  fs.rmSync(d, { recursive: true });
});
