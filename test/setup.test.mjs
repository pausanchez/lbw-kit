// test/setup.test.mjs · the declarative layer. The proof is equivalence: kit/example/config.json must draw, click and
// send exactly what the hand-written kit/example/widgets.js does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { boot, wait, read, json } from './helpers.mjs';

const CONFIG = JSON.parse(read('kit/example/config.json'));
const pin = (c) => { c.w.__lbwToday = '10/11/2026'; c.w.__lbwNow = '10:30'; return c; };   // a Tuesday morning: "open now"
const byHand = () => pin(boot({ kit: true, scripts: ['kit/example/widgets.js'] }));
function byJson(config = CONFIG) {
  const c = pin(boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }));
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(config))));
  return c;
}
const html = (m) => m.widgets().map((w) => w.outerHTML).join('\n');

// each step: [text of a bot message, clicks to make in its widgets (button texts, in order)]
const JOURNEY = [
  ['[[np:service id=extension]]', []],
  ['[[np:service id=loft]] [[np:chips q=plan,area,contact]]', []],
  ['[[np:faq id=planning]]', []],
  ['[[np:area]]', []],
  ['[[np:projects kind=loft]]', []],
  ['[[np:projects]]', []],
  ['[[np:contact]]', []],
  ['[[np:room size=14 finish=render]]', ['+', 'Timber cladding', 'Send my estimate']],
  ['[[np:plan kind=loft]]', ['Full drawings', 'A tree within 10 m', 'A shared wall', 'Send my summary']],
  ['[[np:contact]]', []],
  ['[[np:contact]]', []],
  ['[[np:service id=castle]] [[np:room size=999 finish=gold]]', []],
];
async function run(c) {
  const out = [];
  for (const [text, clicks] of JOURNEY) {
    const m = c.bot('Text ' + text); c.LBW.scan();
    for (const label of clicks) {
      const b = [...m.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
      assert.ok(b, `no button "${label}" in ${text}`);
      b.click(); await wait(/^Send/.test(label) ? 1300 : 5);   // a send waits for the quiet chat, and the next one for the 1.2 s lock
    }
    out.push({ text, html: html(m), left: m.text() });
  }
  await wait(2000);   // the queued sends go out once the chat has been quiet for quietMs (1.5 s)
  return out;
}

test('setup: the example config is valid and registers every widget', () => {
  const c = byJson();
  assert.deepEqual(c.result.errors, []);
  assert.equal(c.result.ok, true);
  assert.deepEqual([...c.result.widgets].sort(), Object.keys(CONFIG.widgets).sort());
});

test('setup: the JSON draws, clicks and sends exactly what the hand-written example does', async () => {
  const a = byHand(), b = byJson();
  const [ha, hb] = await Promise.all([run(a), run(b)]);
  for (let i = 0; i < ha.length; i++) {
    assert.equal(hb[i].left, ha[i].left, 'text left in ' + ha[i].text);
    assert.equal(hb[i].html, ha[i].html, 'widgets of ' + ha[i].text);
  }
  assert.ok(ha.filter((x) => x.html).length >= 10, 'the journey drew widgets');
  assert.deepEqual(b.sent, a.sent);
  assert.equal(a.sent.filter((x) => x[0] === 'landbot-msg-send').length, 2, 'the calc and the form both sent');
  assert.deepEqual([...b.dropped()].sort(), [...a.dropped()].sort());
});

test('setup: a broken widget is skipped, the others still draw, and its tag never shows', () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG)); cfg.widgets.faq.type = 'faqs';
  const c = byJson(cfg);
  assert.equal(c.result.ok, false);
  assert.ok(!c.result.widgets.includes('faq') && c.result.widgets.includes('service'));
  const m = c.bot('Text [[np:faq id=planning]] [[np:service id=loft]]'); c.LBW.scan();
  assert.equal(m.text(), 'Text');
  assert.deepEqual(m.widgets().map((w) => w.getAttribute('data-widget')), ['service']);
});

// ── a small calc to bend: n (a number), k (a pick), a rate table ──
const calc = (over = {}) => ({ prefix: 't', links: ['https://shop.example/', 'tel:'], widgets: { c: Object.assign({ type: 'calc', cta: 'Send',
  state: { n: { min: 1, max: 100, default: 50 }, k: { values: ['a', 'b'], default: 'b' } },
  controls: [{ stepper: 'n', label: 'N' }, { pick: 'k', title: 'K', items: [['a', 'A'], ['b', 'B']] }],
  tables: { rate: { a: 100, b: 250 } }, compute: { x: 'n * rate[k]' },
  result: { rows: [['x', '{x}']] }, send: { text: 'x={x} k={k:label}', fields: { f: '{n}' } } }, over) } });
const errors = (cfg) => { const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); return [...c.LBW.kit.setup.check(cfg)]; };
async function drawn(cfg, tag) { const c = byJson(cfg), m = c.bot(tag); c.LBW.scan(); await wait(20); return { c, m, dd: [...m.querySelectorAll('.kit-out dd')].map((x) => x.textContent) }; }

test('expressions: precedence, left-to-right, unary minus, functions', async () => {
  const want = { a: 10 - 4 - 3, b: 100 / 10 / 5, c: 2 + 3 * 4, d: (2 + 3) * 4, e: -2 * -3, f: 2 - -3, g: Math.round(7 / 2), h: Math.max(1, 9, 4) - Math.min(3, 2), i: Math.abs(-4) + Math.floor(2.9) + Math.ceil(2.1), j: 4 * 100 };
  const src = { a: '10 - 4 - 3', b: '100 / 10 / 5', c: '2 + 3 * 4', d: '(2 + 3) * 4', e: '-2 * -3', f: '2 - -3', g: 'round(7 / 2)', h: 'max(1, 9, 4) - min(3, 2)', i: 'abs(-4) + floor(2.9) + ceil(2.1)', j: 'n * rate[k]' };
  const { c, dd } = await drawn(calc({ compute: src, result: { rows: Object.keys(src).map((k) => [k, `{${k}}`]) }, send: { text: '{a}' } }), '[[t:c n=4 k=a]]');
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual(dd, Object.values(want).map(String));
});

test('expressions: what can\'t be computed is an error in check(), not a NaN on the page', () => {
  const e = (compute, more) => errors(calc(Object.assign({ compute }, more))).join('\n');
  assert.match(e({ x: 'nn * 2' }), /compute\.x: "nn" is not in state or compute/);
  assert.match(e({ x: 'y + 1', y: '2' }), /"y" is computed on a later line/);
  assert.match(e({ x: 'rate * 2' }), /"rate" is a table: write rate\[key\]/);
  assert.match(e({ x: 'k * 2' }), /"k" is a pick, not a number/);
  assert.match(e({ x: 'n * price[k]' }), /"price" is not in "tables"/);
  assert.match(e({ x: 'n * rate[k]' }, { tables: { rate: { a: 100 } } }), /tables\.rate has no "b"/);
  assert.match(e({ x: 'round(n, 2)' }), /round\(\) takes one value/);
  assert.match(e({ x: 'round' }), /"round" is not in state or compute/);
  for (const bad of ['alert(1)', 'n ; 2', 'n * (2', '+2', '2 3', '1.5.2', 'n ** 2', 'n % 2', 'a.b', 'max(1,)', 'n = 2']) assert.match(e({ x: bad }), /compute\.x: /, bad);
});

test('calc: a result that is not a number is never shown or sent', async () => {
  const { c, m, dd } = await drawn(calc({ compute: { x: 'n / (n - n)' } }), '[[t:c n=4]]');
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual(dd, []);
  assert.doesNotMatch(m.textContent, /NaN|Infinity|undefined/);
  assert.equal(m.querySelector('.lbw-cta').getAttribute('aria-disabled'), 'true');   // v0.9.5: not ready is aria-disabled (focusable, says what is missing)
});

test('calc: the stepper shows what the result uses', async () => {
  // steps of 5 from 1 (1, 6, … 96), capped at 100
  const cfg = calc({ compute: { x: 'n * 10' }, controls: [{ stepper: 'n', label: 'N', step: 5 }, { pick: 'k', title: 'K', items: [['a', 'A'], ['b', 'B']] }] });
  for (const [tag, n] of [['[[t:c]]', 51], ['[[t:c n=4.6]]', 6], ['[[t:c n=63]]', 61], ['[[t:c n=999]]', 100]]) {
    const { m, dd } = await drawn(cfg, tag);
    assert.equal(m.querySelector('.lbw-step-n').textContent, String(n), tag);
    assert.deepEqual(dd, [String(n * 10)], tag);
  }
});

test('form: a step that depends on another reads its own labels', async () => {
  const c = byJson({ prefix: 't', widgets: { p: { type: 'form', cta: 'Send', summary: 'P: {kind:label}, {size:label}', fields: { s: '{size}' }, steps: [
    { key: 'kind', title: 'Kind', items: [['ext', 'Extension'], ['loft', 'Loft']] },
    { key: 'size', title: 'Size', items: { by: 'kind', map: { ext: [['s', 'Small extension']], loft: [['s', 'Small loft']] }, else: [] } }] } } });
  assert.deepEqual(c.result.errors, []);
  const m = c.bot('[[t:p]]'); c.LBW.scan(); await wait(20);
  const click = (t) => [...m.querySelectorAll('button')].find((b) => b.textContent === t).click();
  click('Loft'); click('Small loft'); click('Send'); await wait(1800);
  assert.deepEqual(c.sent, [['landbot-custom-data', { s: 's' }], ['landbot-msg-send', { type: 'text', message: 'P: Loft, Small loft' }]]);
});

test('check: wrong shapes are sentences, never a throw', () => {
  const shapes = [null, 3, 'x', [], {}, { prefix: 't' }, { prefix: 't', widgets: [] }, { prefix: 't', links: 'https://a.example/', widgets: {} }, { prefix: 't', actions: [], replies: 'x', widgets: {} }];
  const widgets = [null, 3, [], {}, { type: 3 }, { type: 'constructor' }, { type: 'form', cta: 'x', summary: 'x', steps: {} }, { type: 'form', cta: 'x', summary: 'x', steps: [null] },
    { type: 'cards', items: 'x' }, { type: 'cards', item: 'x', links: 'https://a.example/' }, { type: 'calc', cta: 'x', state: [], controls: {}, result: 'abc', send: 3 },
    { type: 'calc', cta: 'x', state: { n: 3 }, controls: [null, {}, { stepper: 'zz', label: 'x' }, { pick: 'n' }], result: { rows: 'abc', total: 3 }, send: {}, notes: ['A note'] },
    { type: 'contact', title: 'x', hours: {}, summary: 'x', compact: 3, rows: {} }, { type: 'carousel', items: [null, {}], filter: 'kind' }, { type: 'chips', items: [] }];
  for (const s of shapes) assert.ok(errors(s).length > 0, JSON.stringify(s));
  for (const w of widgets) { const e = errors({ prefix: 't', widgets: { w } }); assert.ok(e.length > 0, JSON.stringify(w)); assert.ok(!e.some((x) => /could not be checked/.test(x)), JSON.stringify(w) + ' → ' + e.join(' | ')); }
  for (const name of ['constructor', '__proto__', 'toString', 'Card']) {
    const cfg = JSON.parse(`{"prefix":"t","widgets":{"${name}":{"type":"cards","items":{}}}}`), c = byJson(cfg);
    assert.equal(c.result.ok, name === 'constructor' || name === 'toString' ? c.result.widgets.includes(name) : false, name);
  }
});

test('check: actions, replies, links and texts', () => {
  const e = (w, top) => errors(Object.assign({ prefix: 't', links: ['https://shop.example/'], widgets: { w } }, top)).join('\n');
  const card = (more) => Object.assign({ type: 'cards', items: { a: { title: 'A' } } }, more);
  assert.match(e(card({ links: [{ wa: '34600000000', label: 'WA' }] })), /needs "https:\/\/wa\.me\/" in "links"/);
  assert.match(e(card({ links: [{ tel: '600 000 000', label: 'Call' }] })), /needs "tel:" in "links"/);
  assert.match(e(card({ links: [{ link: 'https://evil.example/', label: 'x' }] })), /is not under any entry of "links"/);
  assert.match(e(card({ links: [{ link: 'https://shop.example/x' }] })), /has no "label"/);
  assert.match(e(card({ links: [{ reply: 'hello' }] })), /"reply" is \[label, sentence\]/);
  assert.match(e(card({ links: [{ tel: '1', wa: '2', label: 'x' }] })), /needs one of tel, wa, link, reply/);
  assert.match(e(card({ links: ['ghost'] })), /action "ghost" is not in "actions"/);
  assert.match(e(card({ reply: ['Only label'] })), /is a name in "replies" or \[label, sentence\]/);
  assert.match(e(card({ reply: 'nope' })), /reply "nope" is not in "replies"/);
  assert.match(e(card({ items: { a: { title: 'A', link: ['Go', 'https://evil.example/'] } } })), /a\.link: .* is not under any entry/);
  assert.match(e(card({ param: 'itemId' })), /param "itemId" must be lower-case/);
  assert.match(e(card({ titel: 'x' })), /unknown option "titel"/);
  assert.match(e(card({}), { replies: { r: ['x'] }, actions: { a: { label: 'x' } } }), /actions\.a: an action needs one of[\s\S]*replies\.r is \[label, sentence\]/);
  assert.match(e({ type: 'contact', title: 'x', summary: { form: 'nope' } }), /summary\.form "nope" is not a form widget/);
  const c = (over) => errors(calc(over)).join('\n');
  assert.match(c({ send: { text: 'x={x:Label}' } }), /"\{x:Label\}" is not a placeholder/);
  assert.match(c({ send: { text: 'x={ x }' } }), /is not a placeholder/);
  assert.match(c({ send: { text: 'x={rate}' } }), /"\{rate\}" is not a value here/);
  assert.match(c({ send: { text: '{k:money}' } }), /"k" is not a number/);
  assert.match(c({ send: { text: '{n:label}' } }), /"n" is not a pick/);
  assert.match(c({ send: { text: 'ok', fields: { f: '{nope}' } } }), /send\.fields\.f: "\{nope\}"/);
  assert.match(c({ result: { note: '{nope}' } }), /result\.note: "\{nope\}"/);
  assert.match(c({ send: {} }), /send\.text is missing/);
  assert.match(c({ send: { text: 'a } b' } }), /a stray/);
  assert.match(c({ state: { roomSize: { min: 1, max: 2, default: 1 } }, controls: [], compute: {}, result: {}, send: { text: 'x' } }), /state\.roomSize "roomSize" must be lower-case/);
  assert.match(c({ state: { n: { min: 1, max: 5, default: 9 }, k: { values: ['a', 'b'], default: 'z' } } }), /state\.n\.default is outside[\s\S]*state\.k\.default is not one of its values/);
  assert.match(c({ controls: [{ stepper: 'n', label: 'N', min: 0, max: 20 }] }), /"min" and "max" go in state\.n/);
  assert.match(c({ controls: [{ stepper: 'n', label: 'N' }, { pick: 'k', title: 'K', items: [['a', 'A'], ['z', 'Z']] }] }), /has no entry for "b"[\s\S]*"z", which is not in state\.k\.values/);
  const f = (w) => e(Object.assign({ type: 'form', cta: 'x', steps: [{ key: 'kind', items: [['a', 'A']] }] }, w));
  assert.match(f({ summary: '{knd:label}' }), /summary: "\{knd\}" is not a value here/);
  assert.match(f({ summary: 'x', steps: [{ key: 'a', items: { by: 'zz', map: {} } }] }), /a\.items\.by "zz" is not an earlier step/);
  assert.match(f({ summary: 'x', preset: { param: 'Kind', step: 'kind' } }), /preset\.param "Kind" must be lower-case/);
});

test('check-config: the command line gives the same verdict', () => {
  const run = (file) => spawnSync(process.execPath, ['scripts/check-config.mjs', file], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  const good = run('kit/example/config.json'); assert.equal(good.status, 0, good.stderr); assert.match(good.stdout, /8 widgets/);
  assert.equal(run('package.json').status, 1);
});

test('check: an unknown key inside an item is an error, with the place it belongs', () => {
  const e = (w) => errors({ prefix: 't', links: ['https://shop.example/', 'https://wa.me/'], actions: { wa: { wa: '34600000000', label: 'WA' } }, widgets: { w } }).join('\n');
  assert.match(e({ type: 'cards', items: { a: { title: 'A', links: ['wa'] } } }), /a: unknown key "links" \(buttons go on the widget; an item has one "link": \[label, url\]\)/);
  assert.match(e({ type: 'cards', items: { a: { title: 'A', titel: 'x' } } }), /a: unknown key "titel"\. Known: kicker, title/);
  assert.match(e({ type: 'stats', item: { title: 'A', stats: [['1', 'a'], ['2', 'b']], source: 's', sorce: 'x' } }), /item: unknown key "sorce"/);
  assert.match(e({ type: 'people', items: { a: { name: 'A', role: 'R', phone: '1' } } }), /a: unknown key "phone"/);
  assert.match(e({ type: 'carousel', filter: { by: 'kind' }, items: [{ name: 'A', kind: 'x', prize: '1 €' }] }), /items\[0\]: unknown key "prize"/);
  assert.doesNotMatch(e({ type: 'carousel', filter: { by: 'kind' }, items: [{ name: 'A', kind: 'x' }] }), /unknown key/);
});

test('the bundle a bot loads has no checker: setup() still draws, and skips a widget that fails', () => {
  const c = pin(boot({ kit: true, scripts: ['kit/setup.js'] }));
  assert.equal(c.LBW.kit.setup.check, undefined);
  const cfg = JSON.parse(JSON.stringify(CONFIG)); cfg.widgets.broken = { type: 'calc', cta: 'x', state: {}, controls: [], result: {}, send: { text: 'x' }, compute: { t: 'n * (' } };
  const r = json(c.LBW.kit.setup(cfg));
  assert.ok(!r.widgets.includes('broken') && r.widgets.includes('service') && r.widgets.length === 8, r.widgets.join(','));
  assert.equal(r.ok, false); assert.match(r.errors.join(' '), /broken: /);
  const m = c.bot('Text [[np:service id=loft]] [[np:broken]]'); c.LBW.scan();
  assert.equal(m.text(), 'Text'); assert.deepEqual(m.widgets().map((w) => w.getAttribute('data-widget')), ['service']);
});

// ── compare (0.7.4) ──
const CMP = () => ({ prefix: 't', links: ['https://shop.example/'], widgets: { vs: { type: 'compare', kicker: 'Side by side', title: 'Compare', titles: { 2: 'Two ways to go', 3: 'Three ways to go' },
  rows: [['dep', 'Departs'], ['swim', 'Swimming'], ['price', 'From', 'is-strong']], note: 'Read today.',
  items: { a: { name: 'Classic', values: { dep: '10:00', swim: '1 h', price: '34,99 €' }, reply: ['Price · Classic', 'How much is the classic?'], link: ['Its page ↗', 'https://shop.example/a/'] },
           b: { name: 'Fast', values: { dep: '10:30', price: '34,99 €' }, reply: ['Price · Fast', 'How much is the fast one?'] },
           c: { name: 'Premium', values: { swim: '1 h', price: '54,99 €' } } } } } });

test('compare: two or three items side by side, empty rows left out, one reply per item', () => {
  const c = byJson(CMP()); assert.deepEqual(c.result.errors, []);
  const read = (m) => ({ title: m.querySelector('.lbw-title').textContent, cols: m.querySelector('.kit-cmp').className, rows: [...m.querySelectorAll('.kit-cmp-row')].map((r) => [(r.querySelector('.kit-cmp-label') || {}).textContent || '', ...[...r.querySelectorAll('.kit-cmp-cell')].map((x) => x.textContent)].join(' | ')),
    buttons: [...m.querySelectorAll('.lbw-actions button, .lbw-actions a')].map((b) => b.textContent), primary: m.querySelectorAll('.lbw-reply.is-primary').length });
  const three = c.bot('[[t:vs ids=a,b,c]]'); c.LBW.scan();
  assert.deepEqual(read(three), { title: 'Three ways to go', cols: 'kit-cmp is-3', rows: [' | Classic | Fast | Premium', 'Departs | 10:00 | 10:30 | —', 'Swimming | 1 h | — | 1 h', 'From | 34,99 € | 34,99 € | 54,99 €'],
    buttons: ['Price · Classic', 'Price · Fast', 'Its page ↗'], primary: 1 });
  const two = c.bot('[[t:vs ids=c,zzz,b]]'); c.LBW.scan();
  assert.equal(read(two).title, 'Two ways to go'); assert.equal(read(two).rows[0], ' | Premium | Fast');
  for (const tag of ['[[t:vs ids=a]]', '[[t:vs ids=zzz,yyy]]', '[[t:vs]]']) { const m = c.bot('Text ' + tag); c.LBW.scan(); assert.equal(m.widgets().length, 0, tag); assert.equal(m.text(), 'Text'); }
  assert.ok(three.querySelector('.kit-cmp-row.is-strong'));
});

test('check: a compare table says what is wrong', () => {
  const e = (patch) => { const cfg = CMP(); patch(cfg.widgets.vs); return errors(cfg).join('\n'); };
  assert.match(e((w) => { w.items.a.values.wify = 'yes'; }), /a\.values\.wify is not one of the rows \(dep, swim, price\)/);
  assert.match(e((w) => { delete w.items.b; delete w.items.c; }), /"items" must hold at least two items by id/);
  assert.match(e((w) => { w.items.a.values.price = 3499; }), /a\.values\.price must be text/);
  assert.match(e((w) => { w.items.a.price = '1'; delete w.items.b.name; w.max = 5; w.rows.push(['x']); }), /a: unknown key "price"[\s\S]*"b" has no "name"[\s\S]*"max" is 2 or 3/);
  assert.match(e((w) => { w.rows.push(['wifi', 'Wi-Fi']); }), /row "wifi" has no value in any item/);
  assert.match(e((w) => { w.titles = { 4: 'Four' }; w.items.a.link = ['x', 'https://evil.example/']; }), /a\.link: .* is not under[\s\S]*"titles" is \{ "2": text, "3": text \}/);
});

// ── a calc for an item the tag names (0.7.4) ──
const PRICE = () => ({ prefix: 't', links: ['https://tours.example/'], widgets: { price: { type: 'calc', kicker: 'Price for your group', title: '{tour:label}', cta: 'Send my group',
  state: { tour: { values: ['boat', 'bays'], required: true, labels: { boat: 'Boat & swim', bays: 'The bays' } }, adults: { min: 0, max: 20, default: 2, int: true }, kids: { min: 0, max: 20, default: 0, int: true } },
  controls: [{ stepper: 'adults', label: 'Adults' }, { stepper: 'kids', label: 'Children' }],
  tables: { fare: { boat: 3499, bays: 5999 } }, compute: { a: 'adults * fare[tour]', k: 'round(kids * fare[tour] * 0.7)', total: 'a + k' }, money: { cur: '€', after: true },
  result: { rows: [['Adults × {adults}', '{a:money}'], ['Children × {kids}', '{k:money}', 'kids']], total: ['Estimate', '{total:money}'] },
  send: { text: 'My group for {tour:label}: {adults} adults, {kids} children, {total:money}', fields: { t_tour: '{tour}' } },
  links: [{ link: 'https://tours.example/{tour}/', label: 'Book {tour:label} ↗' }] } } });

test('calc: an item named in the tag sets the price, the title and the link; no tag value, no widget', async () => {
  const c = byJson(PRICE()); assert.deepEqual(c.result.errors, []);
  const m = c.bot('[[t:price tour=bays adults=2 kids=1]]'); c.LBW.scan(); await wait(20);
  assert.equal(m.querySelector('.lbw-title').textContent, 'The bays');
  assert.deepEqual([...m.querySelectorAll('.kit-out dt')].map((x) => x.textContent), ['Adults × 2', 'Children × 1']);
  assert.equal(m.querySelector('.kit-total strong').textContent.replace(/\s/g, ' '), '161.97 €');
  const a = m.querySelector('.lbw-actions a'); assert.equal(a.textContent, 'Book The bays ↗'); assert.equal(a.getAttribute('href'), 'https://tours.example/bays/');
  const none = c.bot('[[t:price tour=boat]]'); c.LBW.scan(); await wait(20);
  assert.deepEqual([...none.querySelectorAll('.kit-out dt')].map((x) => x.textContent), ['Adults × 2'], 'the children row is left out at 0');
  for (const tag of ['[[t:price adults=2]]', '[[t:price tour=castle adults=2]]']) { const x = c.bot('Text ' + tag); c.LBW.scan(); assert.equal(x.widgets().length, 0, tag); assert.equal(x.text(), 'Text'); }
});

test('check: required values, labels, row keys and templated links in a calc', () => {
  const e = (patch) => { const cfg = PRICE(); patch(cfg.widgets.price); return errors(cfg).join('\n'); };
  assert.match(e((w) => { delete w.state.tour.required; }), /state\.tour has no "default" \(a list of values may say "required": true/);
  assert.match(e((w) => { delete w.state.tour.labels.bays; w.state.tour.labels.sea = 'Sea'; }), /labels\.sea is not one of its values[\s\S]*labels has no label for "bays"/);
  assert.match(e((w) => { delete w.state.tour.labels; }), /title: "\{tour:label\}" asks for a label/);
  assert.match(e((w) => { w.result.rows[1][2] = 'tour'; }), /result\.rows\[1\]\[2\] "tour" is not a number/);
  assert.match(e((w) => { w.links[0].link = 'https://evil.example/{tour}/'; }), /is not under any entry of "links"/);
  assert.match(e((w) => { w.links[0].link = 'https://tours.example/{tuor}/'; }), /links\[0\]\.link: "\{tuor\}" is not a value here/);
  assert.match(e((w) => { w.state.adults.required = true; }), /state\.adults\.required is true, on a list of values/);
  const card = errors({ prefix: 't', links: ['https://tours.example/'], widgets: { a: { type: 'cards', links: [{ link: 'https://tours.example/{id}/', label: 'x' }], items: { x: { title: 'X' } } } } }).join('\n');
  assert.match(card, /a link can only hold a \{placeholder\} in a calc's "links"/);
});
