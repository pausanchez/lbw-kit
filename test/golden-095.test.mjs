// test/golden-095.test.mjs · v0.9.5 changed how setup() makes widgets and when the carousel counts its slides, to cut main-thread
// time. Nothing a widget draws may change. The fixtures were written by v0.9.4.2 (before the change): for six configs (the four
// kit examples, the gallery and the Hotel Faro de Salitre showcase, all fictional), every widget is drawn for many tags (good
// values, edges, attacks, every language, with and without LBW.data), and the HTML of each message, the text left in it,
// window.__lbwDropped, setup()'s answer and LBW.kit.describe() are kept. This test draws the same tags with the code of today
// and compares them byte for byte. The configs are inside the fixtures, so editing an example doesn't move the goalposts.
//
// To write the fixtures again from some other copy of the library (a checkout of the old version):
//   GOLDEN_WRITE=1 GOLDEN_ROOT=/path/to/that/copy node --test test/golden-095.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { JSDOM, VirtualConsole } from 'jsdom';

const HERE = new URL('..', import.meta.url), DIR = new URL('test/fixtures/golden-095/', HERE);
const WRITE = !!process.env.GOLDEN_WRITE, ROOT = process.env.GOLDEN_ROOT ? new URL('file://' + process.env.GOLDEN_ROOT.replace(/\/?$/, '/')) : HERE;
const src = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

// the configs the fixtures are written from (only when writing)
const SOURCES = {
  example: 'kit/example/config.json', lead: 'kit/example-lead/config.json', live: 'kit/example-live/config.json', status: 'kit/example-status/config.json',
  gallery: 'gallery/config.json', showcase: '/Users/pausanchez/reto/showcase/faro-de-salitre/src/config.json',
};
const CASES = { example: 'kit/example/cases.json', status: 'kit/example-status/cases.json', showcase: '/Users/pausanchez/reto/showcase/faro-de-salitre/src/cases.json' };
const readAny = (p) => fs.readFileSync(p.startsWith('/') ? p : new URL(p, HERE), 'utf8');

function boot({ checker = false, fetchMap = {} } = {}) {
  // a page's own errors are shown; after close() the observer wakes on an empty document and throws, which says nothing
  const vc = new VirtualConsole(); let closed = false; vc.on('jsdomError', (e) => { if (!closed) console.error(e); });
  const dom = new JSDOM('<!doctype html><html><body><div data-lb-part="window"><div id="chat"></div></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://chat.example/', virtualConsole: vc });
  const w = dom.window;
  let seed = 42; w.Math.random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };   // the review card's ids
  w.__lbwToday = '10/11/2026'; w.__lbwNow = '10:30';
  w.Landbot = { exec: () => {} };
  w.fetch = (url) => Object.prototype.hasOwnProperty.call(fetchMap, url)
    ? Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(fetchMap[url]), json: () => Promise.resolve(JSON.parse(fetchMap[url])) })
    : Promise.reject(new Error('offline (golden test)'));
  ['runtime/lbw.js', 'kit/kit.js', 'kit/setup.js'].concat(checker ? ['kit/setup-check.js'] : []).forEach((p) => w.eval(src(p)));
  const chat = w.document.getElementById('chat');
  const bot = (text) => {
    const m = w.document.createElement('div'), t = w.document.createElement('div');
    m.setAttribute('data-lb-part', 'message'); m.setAttribute('data-lb-author', 'bot'); t.setAttribute('data-lb-part', 'message-text');
    t.textContent = text; m.appendChild(t); chat.appendChild(m); return m;
  };
  return { w, chat, bot, dropped: () => (w.__lbwDropped || []).map(String), close: () => { closed = true; w.close(); } };
}
const shot = (m) => ({ html: [...m.querySelectorAll('.lbw')].map((x) => x.outerHTML).join('\n'), left: m.querySelector('[data-lb-part="message-text"]').textContent });

// ── the tags (written once, into the fixture) ─────────────────────────────────────────────────────────────────────
const ATTACK = ['<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', 'javascript:alert(1)', '__proto__', 'constructor', '9'.repeat(40), '-1', '', 'ñandú 🦊'];
function numEdges(d) {
  const out = [], min = d.min, max = d.max;
  if (min != null) out.push(min, min - 1); if (max != null) out.push(max, max + 1);
  if (d['default'] != null) out.push(d['default']);
  out.push('1.5', '1,5', 'abc', '1e3', '0', '-0', '007');
  return [...new Set(out.map(String))];
}
function paramGood(d) {
  const t = d.type;
  if (t === 'one') return (d.values || [])[0];
  if (t === 'list') return (d.values || []).slice(0, 2).join(',');
  if (t === 'int' || t === 'num') return String(d.min != null ? Math.min((d.min || 0) + 2, d.max != null ? d.max : 1e9) : 3);
  if (t === 'money') return '34,99';
  if (t === 'day') return '21/11/2026';
  if (t === 'time') return '10:30';
  return 'hola mundo';
}
function paramEdges(d) {
  const t = d.type;
  if (t === 'one') return [...(d.values || []), 'nope', ...ATTACK.slice(0, 4)];
  if (t === 'list') return [(d.values || []).join(','), (d.values || [])[0] + ',nope', 'nope', ATTACK[0]];
  if (t === 'int' || t === 'num') return numEdges(d);
  if (t === 'money') return ['0', '34', '34.99', '34,9', '€34', '34 €', '3400', '1.000', '100001', '-5', 'abc', ...(d.cents ? ['3499', '34.99'] : [])];
  if (t === 'day') return ['today', '10/11/2026', '9/11/2026', '2026-11-21', '31/02/2026', '1/1/2030', 'mañana', ''];
  if (t === 'time') return ['10:30', '9', '24:00', '25:00', '10h30', 'x'];
  return ['hola mundo', 'a'.repeat(200), ATTACK[0], ATTACK[1], 'línea\u0007control'];
}
function tagsFor(cfg, desc) {
  const P = cfg.prefix || 'p', langs = Array.isArray(cfg.langs) && cfg.langs.length ? cfg.langs : ['en'], out = [];
  const T = (name, attrs, lang) => '[[' + P + ':' + name + (attrs ? ' ' + attrs : '') + (lang ? (attrs.includes('|') ? '|' : ' ') + 'lang=' + lang : '') + ']]';
  const add = (name, attrs, all) => { out.push(T(name, attrs, null)); if (all) [...langs, 'xx'].forEach((l) => out.push(T(name, attrs, l))); };
  desc.cases.forEach((c) => { out.push(c[1]); langs.forEach((l) => out.push(c[1].replace(/\]\]$/, ' lang=' + l + ']]'))); });
  Object.keys(cfg.widgets).forEach((name) => {
    const w = cfg.widgets[name] || {};
    add(name, '', true);
    ATTACK.forEach((a) => out.push(T(name, 'id=' + a + ' ids=' + a + ' q=' + a, null)));
    out.push('[[' + P + ':' + name + ' id=', T(name, 'lang=es lang=en', null), T(name, '__proto__=1 constructor=x toString=y', null));
    const keyed = (o) => (o && typeof o === 'object' ? (Array.isArray(o) ? o.map((x) => x && x.id).filter(Boolean) : Object.keys(o)) : []);
    const ids = keyed(w.items);
    if (ids.length) {
      const prm = w.param || (w.type === 'compare' ? 'ids' : 'id');
      ids.forEach((id) => add(name, prm + '=' + id, false));
      add(name, prm + '=' + ids.slice(0, 2).join(','), true); add(name, prm + '=' + ids.slice(0, 3).join(','), false);
      add(name, prm + '=' + ids.join(','), false); add(name, prm + '=' + ids[0] + ',' + ids[0], false); add(name, prm + '=' + ids[0] + ',nope', false);
      if (w.type === 'carousel' || w.type === 'people') { add(name, 'ids=' + ids.slice(-2).join(','), true); add(name, 'who=' + ids.slice(0, 2).join(','), false); add(name, 'ids=nope', false); add(name, 'ids=', false); }
    }
    if (w.filter) { const prm = w.filter.param || w.filter.by; [...(w.filter.values || []), 'nope'].forEach((v) => add(name, prm + '=' + v, v === (w.filter.values || [])[0])); if (!w.filter.values && ids.length) add(name, prm + '=' + ids[0], false); }
    if (w.status && w.status.items) { const prm = w.status.param || 'estado'; [...Object.keys(w.status.items), 'nope'].forEach((s) => add(name, (ids[0] ? (w.param || 'id') + '=' + ids[0] + ' ' : '') + prm + '=' + s, false)); }
    const defs = w.params && typeof w.params === 'object' ? w.params : null;
    if (defs) {
      const keys = Object.keys(defs), good = {}; keys.forEach((k) => (good[k] = paramGood(defs[k])));
      const line = (o) => keys.filter((k) => o[k] != null).map((k) => (defs[k].param || k) + '=' + o[k]).join('|');
      const extra = ids.length ? (w.param || 'id') + '=' + ids[0] + '|' : '';
      add(name, extra + line(good), true);
      keys.forEach((k) => { paramEdges(defs[k]).forEach((v) => add(name, extra + line({ ...good, [k]: v }), false)); add(name, extra + line({ ...good, [k]: null }), false); });
      add(name, extra + keys.map((k) => (defs[k].param || k) + '=' + ATTACK[0]).join('|'), false);
    }
    const st = w.state && typeof w.state === 'object' ? w.state : null;
    if (st) {
      const keys = Object.keys(st), good = {}; keys.forEach((k) => { const d = st[k] || {}; good[k] = d.values ? d.values[0] : d['default'] != null ? d['default'] : d.min; });
      const line = (o) => keys.filter((k) => o[k] != null).map((k) => ((st[k] || {}).param || k) + '=' + o[k]).join(' ');
      add(name, line(good), true);
      keys.forEach((k) => { const d = st[k] || {}; (d.values ? [...d.values, 'nope', ATTACK[0]] : numEdges(d)).forEach((v) => add(name, line({ ...good, [k]: v }), false)); add(name, line({ ...good, [k]: null }), false); });
    }
  });
  const names = Object.keys(cfg.widgets);   // two and three widgets in one message, and chips after them
  for (let i = 0; i + 1 < names.length; i += 2) out.push('Texto antes. ' + T(names[i], '', null) + ' y ' + T(names[i + 1], '', null) + ' después.');
  return [...new Set(out)];
}
function dataFor(cfg) {   // rows for every LBW.data source, from the columns its map names, plus rows meant to be skipped
  const out = {};
  Object.keys(cfg.widgets).forEach((name) => {
    const w = cfg.widgets[name] || {}, s = w.source; if (!s || typeof s.data !== 'string' || !s.map) return;
    const cols = new Set(); JSON.stringify(s.map).replace(/\{([A-Za-z0-9_.]+)(\|text)?\}/g, (m, c) => cols.add(c));
    const saved = Array.isArray(w.items) ? w.items.map((x) => x && x.id) : w.items && typeof w.items === 'object' ? Object.keys(w.items) : [];
    const ids = [...saved.filter(Boolean).slice(0, 4), 'nuevo-1'];
    const row = (id, k) => { const r = { [s.id || 'id']: id }; [...cols].forEach((c, j) => (r[c] = String(10 + k * 7 + j))); return r; };
    const rows = ids.map(row);
    rows.push(row('BAD ID!', 9), row(ids[0], 8), { ...row('vacio', 7), [[...cols][0]]: '' }, { ...row('ataque', 6), [[...cols].slice(-1)[0]]: ATTACK[0] + ' <b>negrita</b><script>x</script>' });
    let data = rows; if (s.path) { data = {}; let at = data; const ks = s.path.split('.'); ks.forEach((k, i) => { at[k] = i === ks.length - 1 ? rows : {}; at = at[k]; }); }
    out[s.data] = data;
  });
  return out;
}

// ── drawing them ──────────────────────────────────────────────────────────────────────────────────────────────────
// a frame, then a task: what the kit leaves for after the layout (the carousel's count) has run
const settle = (c) => new Promise((r) => c.w.requestAnimationFrame(() => setTimeout(r, 0)));
const CHUNK = 40;   // tags per window: a long chat makes every scan slower, and the windows wait side by side
async function drawChunk(fx, tags, withData) {
  const c = boot({ fetchMap: fx.fetchMap });
  if (withData) Object.keys(fx.data).forEach((k) => c.w.LBW.data.put(k, JSON.parse(JSON.stringify(fx.data[k]))));
  c.w.__cfg = JSON.parse(JSON.stringify(fx.config));
  const result = plain(c.w.eval('LBW.kit.setup(window.__cfg)'));
  const describe = plain(c.w.LBW.kit.describe(fx.config.prefix));
  const now = [], ms = [];
  for (const text of tags) { const m = c.bot('Hola. ' + text); c.w.LBW.scan(); ms.push(m); now.push(shot(m)); }
  const droppedNow = c.dropped();
  await wait(1700);   // skeletons that wait for data (1.5 s by default) fall back to their saved copy
  await settle(c); await settle(c);
  let late = ms.map(shot);
  if (!withData) {   // late data: the saved copies are upgraded
    Object.keys(fx.data).forEach((k) => c.w.LBW.data.put(k, JSON.parse(JSON.stringify(fx.data[k]))));
    await wait(60); await settle(c); await settle(c); late = ms.map(shot);
  }
  const dropped = c.dropped();
  c.close();   // its timers (a reveal, a 20 s data wait, the frame loop) would otherwise keep running beside the next windows
  return { result, describe, now, late, droppedNow, dropped };
}
async function draw(fx, { withData }) {
  const parts = []; for (let i = 0; i < fx.tags.length; i += CHUNK) parts.push(fx.tags.slice(i, i + CHUNK));
  const rs = await Promise.all(parts.map((t) => drawChunk(fx, t, withData)));
  const cat = (k) => rs.flatMap((r) => r[k]);
  return { result: rs[0].result, describe: rs[0].describe, results: rs.map((r) => JSON.stringify([r.result, r.describe])),
    now: cat('now'), late: cat('late'), droppedNow: cat('droppedNow'), dropped: cat('dropped') };
}
async function checked(fx) {   // setup() with the checker (the dev bundle): only its answer
  const c = boot({ checker: true }); c.w.__cfg = JSON.parse(JSON.stringify(fx.config));
  const r = plain(c.w.eval('LBW.kit.setup(window.__cfg)')); await wait(10); c.close(); return r;
}

export { draw, boot, checked };
function same(a, b, what) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) assert.fail(what + ' differs\n got  ' + x.slice(0, 1500) + '\n want ' + y.slice(0, 1500)); }
const file = (k) => new URL(k + '.json.gz', DIR);
const load = (k) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file(k))).toString('utf8'));

if (WRITE) {
  test('golden 0.9.5: write the fixtures from ' + ROOT.pathname, async () => {
    fs.mkdirSync(DIR, { recursive: true });
    for (const k of Object.keys(SOURCES)) {
      const t0 = performance.now(), config = JSON.parse(readAny(SOURCES[k]));
      const c0 = boot(); c0.w.__cfg = JSON.parse(JSON.stringify(config)); c0.w.eval('LBW.kit.setup(window.__cfg)');
      const desc = plain(c0.w.LBW.kit.describe(config.prefix)); c0.close();
      const tags = tagsFor(config, desc);
      if (CASES[k]) JSON.parse(readAny(CASES[k])).forEach((x) => tags.push(x[1]));
      const fetchMap = {}; Object.values(config.widgets).forEach((w) => { if (w && w.source && w.source.csv && k === 'live') fetchMap[w.source.csv] = readAny('kit/example-live/catalog.csv'); });
      const fx = { config, tags, data: dataFor(config), fetchMap };
      fx.withData = await draw(fx, { withData: true });
      fx.noData = await draw(fx, { withData: false });
      fx.checked = await checked(fx);
      fs.writeFileSync(file(k), zlib.gzipSync(JSON.stringify(fx), { level: 9 }));
      console.log(k, Math.round(performance.now() - t0) + ' ms', tags.length, 'tags', fx.withData.now.filter((x) => x.html).length, 'drawn');
    }
  });
} else if (!process.env.GOLDEN_SKIP) {
  for (const k of Object.keys(SOURCES)) {
    test('golden 0.9.5: ' + k + ' draws byte for byte what v0.9.4.2 drew', async () => {
      const fx = load(k);
      for (const mode of ['withData', 'noData']) {
        const got = await draw(fx, { withData: mode === 'withData' }), want = fx[mode];
        // compared as JSON: assert.deepEqual's diff of two long values that differ can take minutes
        same(got.result, want.result, mode + ': setup() answer');
        same(got.describe, want.describe, mode + ': describe()');
        same(got.results, want.results, mode + ': setup() and describe() in every window');
        for (const phase of ['now', 'late']) {
          for (let i = 0; i < fx.tags.length; i++) {
            if (got[phase][i].html !== want[phase][i].html || got[phase][i].left !== want[phase][i].left) assert.fail(mode + '/' + phase + ': ' + fx.tags[i] + '\n--- got\n' + got[phase][i].html.slice(0, 3000) + '\n--- want\n' + want[phase][i].html.slice(0, 3000));
          }
        }
        for (const f of ['droppedNow', 'dropped']) {
          const a = got[f], b = want[f], i = a.findIndex((x, j) => x !== b[j]);
          if (a.length !== b.length || i >= 0) assert.fail(mode + ': __lbwDropped (' + f + ') differs at ' + i + ' of ' + a.length + '/' + b.length + '\n got  ' + a[i] + '\n want ' + b[i]);
        }
      }
      same(await checked(fx), fx.checked, 'setup() with the checker');
    });
  }
}
