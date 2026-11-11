// test/live.test.mjs · a carousel whose slides come from a CSV or a JSON read in the browser (lbw-kit 0.7.6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

const CSV = read('kit/example-live/catalog.csv');
const CFG = () => JSON.parse(read('kit/example-live/config.json'));
function chat(cfg, answer) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '11/11/2026'; c.w.__lbwNow = '10:30';
  c.calls = [];
  c.w.fetch = (url) => { c.calls.push(url); return answer(url); };
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); return c;
}
const ok = (text) => () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
const down = () => Promise.reject(new Error('blocked'));
const errors = (cfg) => [...boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }).LBW.kit.setup.check(cfg)].join('\n');
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const names = (m) => [...m.querySelectorAll('.lbw-name')].map((x) => x.textContent);

test('live: the example config is valid', () => {
  assert.equal(errors(CFG()), '');
});

test('live: a skeleton first, then the rows of the file; bad rows are skipped', async () => {
  const c = chat(CFG(), ok(CSV)), m = draw(c, 'Here [[lv:rides lang=en]]');
  assert.equal(m.widgets().length, 1); assert.ok(m.widgets()[0].classList.contains('is-loading'));
  await wait(30);
  const w = m.widgets()[0];
  assert.ok(!w.classList.contains('is-loading'));
  assert.deepEqual(names(m), ['Ridge Trail', 'River Paddle', 'Dawn Walk', 'Sea Loop']);          // expired, bad id, repeat, no name: out
  const slides = [...w.querySelectorAll('.kit-slide')];
  assert.match(slides[0].textContent, /24 €/); assert.match(slides[0].textContent, /per person/);
  assert.equal(slides[2].querySelector('.kit-price'), null);                                       // an empty cell: no "  €"
  assert.equal(slides[0].querySelector('a').getAttribute('href'), 'https://rides.example/trail-a/');
  assert.equal(slides[3].querySelector('a'), null);                                               // a link outside "links"
  assert.equal(c.calls.length, 1);                                                                // prefetch + widget: one fetch
});

test('live: a column per language, falling back cell by cell; the filter still works', async () => {
  const c = chat(CFG(), ok(CSV)), m = draw(c, 'Aquí [[lv:rides kind=trail lang=es]]');
  await wait(30);
  assert.deepEqual(names(m), ['Sendero de la Cresta', 'Dawn Walk']);
  assert.match(m.widgets()[0].textContent, /A pie/); assert.match(m.widgets()[0].textContent, /por persona/); assert.match(m.widgets()[0].textContent, /Detalles/);
});

test('live: the source down → the saved items; no saved items → the widget goes, the text stays', async () => {
  const c = chat(CFG(), down), m = draw(c, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.deepEqual(names(m), ['Ridge Trail']); assert.match(m.widgets()[0].textContent, /Saved copy/);
  const cfg = CFG(); delete cfg.widgets.rides.items;
  const c2 = chat(cfg, down), m2 = draw(c2, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.equal(m2.widgets().length, 0); assert.equal(m2.text(), 'Here');
});

test('live: a file with no rows counts as unreadable (the saved items); rows that are all bad draw nothing', async () => {
  const c = chat(CFG(), ok('id,name\n')), m = draw(c, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.deepEqual(names(m), ['Ridge Trail']);
  const c2 = chat(CFG(), ok('id,kind,name\nBad Id,trail,One\nok-1,trail,\n')), m2 = draw(c2, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.equal(m2.widgets().length, 0);
});

test('live: cells are text, never markup, and are cut', async () => {
  const c = chat(CFG(), ok('id,kind,name,sub\nx-1,trail,"<img src=x onerror=alert(1)>",' + 'a'.repeat(900) + '\n')), m = draw(c, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.equal(m.querySelector('.kit-slide img'), null);
  assert.deepEqual(names(m), ['<img src=x onerror=alert(1)>']);
  assert.ok(m.querySelector('.kit-sub').textContent.length <= 300);
});

test('live: a JSON source with a path', async () => {
  const cfg = CFG(), s = cfg.widgets.rides.source; delete s.csv; s.json = 'https://api.example/rides'; s.path = 'data.rides';
  const body = JSON.stringify({ data: { rides: [{ id: 'a-1', kind: 'water', name: 'Lake', price: 9, url: 'https://rides.example/a-1/' }, { id: 'a-2', kind: 'trail', name: { x: 1 } }, 'junk', null] } });
  const c = chat(cfg, ok(body)), m = draw(c, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.deepEqual(names(m), ['Lake']); assert.match(m.widgets()[0].textContent, /9 €/);
  const c2 = chat(cfg, ok('not json')), m2 = draw(c2, 'Here [[lv:rides lang=en]]');
  await wait(30);
  assert.deepEqual(names(m2), ['Ridge Trail']);                                                  // unreadable → the saved copy
});

test('live: check() names what is wrong in a source', () => {
  const bad = (f) => { const cfg = CFG(); f(cfg.widgets.rides); return errors(cfg); };
  assert.match(bad((w) => { w.source.csv = 'http://x.example/a.csv'; }), /https URL/);
  assert.match(bad((w) => { w.source.json = 'https://x.example/a.json'; }), /one of "csv" or "json"/);
  assert.match(bad((w) => { delete w.source.map; }), /source\.map is missing/);
  assert.match(bad((w) => { w.source.map.name = 'Fixed'; }), /must name a column/);
  assert.match(bad((w) => { w.source.map.title = '{name}'; }), /unknown key "title"/);
  assert.match(bad((w) => { delete w.filter.values; }), /filter\.values/);
  assert.match(bad((w) => { w.source.path = 'a.b'; }), /source\.path/);
  assert.match(bad((w) => { delete w.source; delete w.items; }), /missing "items"/);
});

// ── what the independent review of 0.7.6 found ──
const row = (id, kind, name, extra = '') => `${id},${kind},${name}${extra}\n`;
test('review: the rows are filtered before any cap, so a kind far down a long file is found', async () => {
  let csv = 'id,kind,name\n'; for (let i = 0; i < 1500; i++) csv += row('t-' + i, 'trail', 'Trail ' + i); csv += row('w-1', 'water', 'Far Lake');
  const c = chat(CFG(), ok(csv)), m = draw(c, 'Here [[lv:rides kind=water lang=en]]');
  await wait(60);
  assert.deepEqual(names(m), ['Far Lake']);
});

test('review: an answer that is not the list → the saved items, not an empty chat', async () => {
  for (const body of ['<!doctype html><html><body>Sign in</body></html>', 'kind,name\ntrail,No Id Column\n']) {
    const c = chat(CFG(), ok(body)), m = draw(c, 'Here [[lv:rides lang=en]]');
    await wait(30);
    assert.deepEqual(names(m), ['Ridge Trail'], body.slice(0, 20));
  }
  const cfg = CFG(), s = cfg.widgets.rides.source; delete s.csv; s.json = 'https://api.example/rides'; s.path = 'data.rides';
  for (const body of ['{"error":"no"}', '{"data":{"rides":"soon"}}', '{"data":null}']) {
    const c = chat(cfg, ok(body)), m = draw(c, 'Here [[lv:rides lang=en]]');
    await wait(30);
    assert.deepEqual(names(m), ['Ridge Trail'], body);
  }
});

test('review: a fetch that never settles gives way to the saved items', async () => {
  const cfg = CFG(); cfg.widgets.rides.source.prefetch = false;
  const c = chat(cfg, () => new Promise(() => {}));
  c.w.LBW.csv(cfg.widgets.rides.source.csv, { timeout: 20 }).then(null, () => {});   // the same cached call, with a short wait for the test
  const m = draw(c, 'Here [[lv:rides lang=en]]');
  await wait(80);
  assert.deepEqual(names(m), ['Ridge Trail']); assert.ok(!m.widgets()[0].classList.contains('is-loading'));
});

test('review: odd cells: a date that is not D/M/YYYY, ids and columns named like object keys, an id per language, a split emoji', async () => {
  const csv = 'id,id_es,kind,name,until,constructor\n' + 'constructor,x,trail,Named Constructor,,c\n' + 'bad-date,y,trail,Bad Date,next week,\n' + 'good-e,z,trail,' + 'é'.repeat(299) + '😀😀,31/12/2030,\n';
  const cfg = CFG(); cfg.widgets.rides.source.map.sub = '{tostring}{constructor}';
  const c = chat(cfg, ok(csv)), m = draw(c, 'Aquí [[lv:rides lang=es]]');
  await wait(30);
  const ns = names(m);
  assert.equal(ns[0], 'Named Constructor'); assert.equal(ns.length, 2);                           // the bad date is out, with a message
  assert.ok(c.dropped().some((x) => /bad-date.*until/.test(x)));
  assert.equal([...ns[1]].length, 300); assert.ok(!/[\ud800-\udbff]$/.test(ns[1]));              // cut by character, no lone half
  assert.equal(m.querySelectorAll('.kit-slide')[0].getAttribute('data-id'), 'constructor');       // the id is not read from id_es
  assert.ok(!/native code/.test(m.widgets()[0].textContent));
  const before = c.dropped().length; draw(c, 'Otra [[lv:rides lang=es]]'); await wait(30);
  assert.equal(c.dropped().length, before);                                                       // skipped rows are logged once per fetch
});

test('review: check() rejects the map shapes that broke at run time', () => {
  const bad = (f) => { const cfg = CFG(); f(cfg.widgets.rides); return errors(cfg); };
  assert.match(bad((w) => { delete w.source.map.kind; }), /source\.map\.kind is missing/);
  assert.match(bad((w) => { w.source.map.reply = ['Ask', '{name}']; }), /can't fill "reply"/);
  assert.match(bad((w) => { w.source.map.img = { src: '{photo}', srcset: '{photo}' }; }), /unknown key "srcset"/);
  assert.match(bad((w) => { w.source.map.sub = { x: '{sub}' }; }), /source\.map\.sub must be text/);
  assert.match(bad((w) => { w.source.map.status = '{s}'; }), /unknown key "status"/);
  assert.match(bad((w) => { w.source.map.until = 5; }), /source\.map\.until must be text/);
  assert.match(bad((w) => { w.source.max = 0.5; }), /whole number from 1 to 5000/);
  assert.match(bad((w) => { w.source.max = 1e9; }), /whole number from 1 to 5000/);
  assert.match(bad((w) => { w.source.maxAge = 60; }), /milliseconds/);
  assert.match(bad((w) => { w.source.map.name = '{Name}'; }), /lower-case/);
  assert.match(bad((w) => { w.source.id = 'ID'; }), /lower-case/);
  const noTz = CFG(); delete noTz.timeZone; assert.match(errors(noTz), /source\.map\.until needs "timeZone"/);
  const j = CFG(), s = j.widgets.rides.source; delete s.csv; s.json = 'https://api.example/r'; s.map.name = '{Name}'; assert.equal(errors(j), '');   // JSON keys keep their case
});
