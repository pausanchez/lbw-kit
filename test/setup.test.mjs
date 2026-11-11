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
  const c = pin(boot({ kit: true, scripts: ['kit/setup.js'] }));
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
const errors = (cfg) => { const c = boot({ kit: true, scripts: ['kit/setup.js'] }); return [...c.LBW.kit.setup.check(cfg)]; };
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
  assert.equal(m.querySelector('.lbw-cta').disabled, true);
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
