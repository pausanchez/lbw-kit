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
  assert.match(js, new RegExp(`^<script src="https://cdn\\.jsdelivr\\.net/gh/[^"]+@v${pkg.version.replace(/\./g, '\\.')}/dist/lbw-kit\\.min\\.js" integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"></script><script>LBW\\.kit\\.setup\\(\\{`));
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

test('bot-code: a config with a problem writes nothing', () => {
  const out = tmp(), bad = path.join(out, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ prefix: 't', widgets: { a: { type: 'cards', items: { x: {} } } } }));
  const r = run(bad, '--out', path.join(out, 'build'));
  assert.equal(r.status, 1); assert.match(r.stderr, /card "x" has no "title"/);
  assert.equal(fs.existsSync(path.join(out, 'build')), false);
});
