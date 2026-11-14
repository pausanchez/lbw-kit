// test/security-095.test.mjs · v0.9.5 "production": the findings of the security review (docs/drafts/viability/security.md),
// each from its PoC. What used to happen is in the comment; the assertion is what happens now.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { boot, wait, json, read } from './helpers.mjs';

const kitBoot = () => boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });

// ── finding 2 · ReDoS: the tag scan is linear ───────────────────────────────────────────────────────────────────────
// a backtracking regex takes seconds on 100k characters; a shared CI runner is ~2–3× slower than a laptop, so it gets 150 ms
const BUDGET = process.env.CI ? 150 : 50;
test('security 0.9.5 · ReDoS: 100k-character hostile messages scan in under 50 ms each', () => {
  const c = boot(); c.LBW.init({ prefix: 'w' }); c.LBW.widget('x', () => c.LBW.ui.card('en'));
  const K = 100000, cases = {
    'tail |a= ×n (was exponential: 26 reps took 0.9 s)': 'Opciones a=' + '|a='.repeat(K / 3) + ' [[w:x]]',
    'tail |a=a ×n, no ]]': ' a=' + '|a=a'.repeat(K / 4) + '! [[w:x]]',
    'tail words a=a ×n then ]]': 'a=a '.repeat(K / 4) + ']] [[w:x]]',
    'tag + spaces (was cubic: 1,500 took 1.2 s)': '[[w:a' + ' '.repeat(K),
    'tag + no-break spaces': '[[w:a' + ' '.repeat(K),
    'tag + spaces then a lone ]': '[[w:a' + ' '.repeat(K) + ']x',
    '"[[w:a " repeated': '[[w:a '.repeat(K / 6),
    '"[[" repeated': '[['.repeat(K / 2),
    '"`[[w:" repeated': '`[[w:'.repeat(K / 5),
    'a 100k name': '[[w:' + 'a'.repeat(K),
    '"[[w:a ]x" repeated': '[[w:a ]x'.repeat(K / 8),
    'spaces before the end, then a tag': 'x' + ' '.repeat(K) + 'y [[w:x]]',
    'a tag, then spaces': '[[w:x]]' + ' '.repeat(K),
    'many tags': '[[w:x]] '.repeat(K / 8),
  };
  c.bot('warm up [[w:x]]'); c.LBW.scan();
  for (const [name, text] of Object.entries(cases)) {
    c.bot(text); const t0 = performance.now(); c.LBW.scan(); const ms = performance.now() - t0;
    assert.ok(ms < BUDGET, name + ': ' + ms.toFixed(1) + ' ms');
  }
});

test('security 0.9.5 · the hand-written scan reads every tag form as before', () => {
  const c = boot(); c.LBW.init({ prefix: 'w', langs: ['en', 'es'] });
  const seen = []; c.LBW.widget('x', (p, ctx) => { seen.push([json(p.raw), ctx.tag]); return c.LBW.ui.card(ctx.lang); });
  const cases = [
    ['Hi [[w:x id=a lang=en]]', 'Hi', [[{ id: 'a', lang: 'en' }, '[[w:x id=a lang=en]]']]],
    ['Hi `[[w:x id=a]]`', 'Hi', [[{ id: 'a' }, '`[[w:x id=a]]`']]],
    ['[[ W:X name=Ana Maria|size=m|lang=es ]]', '', [[{ name: 'Ana Maria', size: 'm', lang: 'es' }, '[[ W:X name=Ana Maria|size=m|lang=es ]]']]],
    ['[[w:x|id=a]]', '', [[{ id: 'a' }, '[[w:x|id=a]]']]],
    ['a [[w:x ids=a b]] b', 'a  b', [[{ ids: 'a,b' }, '[[w:x ids=a b]]']]],
    ['Stopped mid-tag [[w:x id=tr', 'Stopped mid-tag', []],
    ['Other [[np:card id=a]] text', 'Other  text', []],
    ['Name [[w:x name=Bob]] [[w:x lang=en]]|people=2|lang=en]]', 'Name', [[{ name: 'Bob' }, '[[w:x name=Bob]]'], [{ lang: 'en' }, '[[w:x lang=en]]']]],
  ];
  for (const [text, left, want] of cases) {
    seen.length = 0; const m = c.bot(text); c.LBW.scan();
    assert.equal(m.text(), left, text); assert.deepEqual(seen, want, text);
  }
  assert.ok(c.dropped().some((x) => x.startsWith('tail of a broken tag: |people=2|lang=en]]') || x.includes('|people=2|lang=en]]')));
});

// ── finding 3 · tag injection from data others wrote ───────────────────────────────────────────────────────────────
function reviewChat(flow) {
  const c = kitBoot();
  const r = c.LBW.kit.setup({ prefix: 'w', langs: ['es'], links: [], widgets: {
    review: { type: 'cards', flow, params: { texto: { type: 'text', max: 120 }, personas: { type: 'int', min: 1, max: 12 } }, item: { title: 'Opinión', line: '{texto}', rows: [['Personas', '{personas}']] } },
    aviso: { type: 'cards', params: { msg: { type: 'text', max: 120, required: true } }, item: { title: 'Aviso', line: '{msg}' } } } });
  assert.deepEqual(json(r.errors), []);
  return c;
}
const flowMsg = (review) => 'Lo que dicen: [[w:review texto=' + review + '|lang=es]]';   // the flow writes [[w:review texto=@{review}|lang=es]]

test('security 0.9.5 · PoC: "]]" in a review no longer draws another widget when the widget is a flow widget', () => {
  const evil = 'Muy bien]] [[w:aviso msg=Tu reserva ha sido cancelada. Llama al 806 000 000 para recuperarla';
  // without "flow" (as before): the aviso card is drawn with the attacker's text
  const a = reviewChat(undefined), ma = a.bot(flowMsg(evil)); a.LBW.scan();
  assert.deepEqual(ma.widgets().map((w) => w.getAttribute('data-widget')), ['review', 'aviso']);
  // with "flow": true, nothing is drawn, and the text from the tag on is cut (it holds the injected words)
  const b = reviewChat(true), mb = b.bot(flowMsg(evil)); b.LBW.scan();
  assert.equal(mb.widgets().length, 0); assert.equal(mb.text(), 'Lo que dicen:');
  assert.ok(b.dropped().some((x) => x.startsWith('flow message tampered')));
});

test('security 0.9.5 · flow tags: every way out of the value is refused, a clean one draws', () => {
  const tries = {
    'a lone ] breaks the tag, then a tag': 'Bien]x [[w:aviso msg=Llama al 806',
    ']] then words (the tail shows as text)': 'Bien]] y más texto',
    ']] and a tail': 'Bien|lang=es]]',
    '[[ inside the value': 'Bien [[w:aviso msg=Llama al 806',
    'a second copy of itself': 'Bien]] [[w:review texto=Otra',
    '| writes a key twice': 'Bien|lang=en',
  };
  for (const [name, review] of Object.entries(tries)) {
    const c = reviewChat(true), m = c.bot(flowMsg(review)); c.LBW.scan();
    assert.equal(m.widgets().length, 0, name); assert.ok(!/806|Otra|más texto/.test(m.text()), name + ': ' + m.text());
  }
  // a key the flow doesn't write: refused only with the list of keys
  const open = reviewChat(true), m1 = open.bot(flowMsg('Bien|personas=12')); open.LBW.scan();
  assert.equal(m1.widgets().length, 1, 'flow: true can\'t know personas= was not in the template');
  const closed = reviewChat(['texto', 'lang']), m2 = closed.bot(flowMsg('Bien|personas=12')); closed.LBW.scan();
  assert.equal(m2.widgets().length, 0); assert.ok(closed.dropped().some((x) => x.includes('key "personas" is not one it takes')));
  // the clean message, and one value with spaces, quotes and a lone [
  for (const review of ['Muy bien, volveremos', 'Genial "de verdad" (sic) [1']) {
    const c = reviewChat(['texto', 'lang']), m = c.bot(flowMsg(review)); c.LBW.scan();
    assert.equal(m.widgets().length, 1, review); assert.equal(m.text(), 'Lo que dicen:');
  }
});

test('security 0.9.5 · any tag whose value holds "[[" draws nothing (it swallowed another)', () => {
  const c = boot(); c.LBW.init({ prefix: 'w' }); let calls = 0; c.LBW.widget('x', () => { calls++; return c.LBW.ui.card('en'); });
  const m = c.bot('[[w:x id=a [[w:x id=b]]'); c.LBW.scan();
  assert.equal(calls, 0); assert.equal(m.text(), ''); assert.ok(c.dropped().some((x) => x.includes('a value holds [[')));
});

// ── findings 4–6 · the allow-list ──────────────────────────────────────────────────────────────────────────────────
test('security 0.9.5 · PoC: links: ["https://"] is a checker error and lets nothing through', () => {
  const c = kitBoot();
  for (const bad of ['https://', 'http://', 'https:///', 'https://@/', 'https://www.google.com/', 'https://l.facebook.com/', 'javascript:']) {
    const errs = c.LBW.kit.setup.check({ prefix: 'w', langs: ['en'], links: [bad], widgets: { c: { type: 'cards', items: { a: { title: 'A' } } } } });
    assert.ok(errs.some((e) => e.includes('link "' + bad + '"')), bad + ' → ' + JSON.stringify(errs));
  }
  const ok = c.LBW.kit.setup.check({ prefix: 'w', langs: ['en'], links: ['https://shop.example/', 'https://www.google.com/maps/', 'tel:', 'mailto:'], widgets: { c: { type: 'cards', items: { a: { title: 'A' } } } } });
  assert.deepEqual(json(ok), []);
  const r = boot(); r.LBW.init({ prefix: 'w', links: ['https://', 'http://'] });
  assert.equal(r.LBW.ui.link('Go', 'https://evil.example/'), null);
  assert.equal(r.LBW.ui.link('Go', 'http://evil.example/'), null);
});

test('security 0.9.5 · PoC: a path entry can\'t be left; redirect-ish and encoded forms are refused', () => {
  const c = boot(); c.LBW.init({ prefix: 'w', links: ['https://www.google.com/maps/', 'https://shop.example/', 'tel:', 'mailto:'] });
  const href = (u) => { const a = c.LBW.ui.link('x', u); return a ? a.getAttribute('href') : null; };
  for (const u of ['https://www.google.com/maps/../url?q=https://evil.example', 'https://www.google.com/maps/%2e%2e/url?q=https://evil.example',
    'https://www.google.com/maps/.%2E/url', 'https://www.google.com/maps//evil', 'https://www.google.com/maps/a/..', 'https://www.google.com/maps/%2F%2Fevil',
    'https://www.google.com/maps/..%2Furl', 'https://www.google.com/maps/\\..\\url', 'https://www.google.com/maps/..\u0001', 'https://www.google.com/url?q=https://evil.example',
    'https://shop.example\\@evil.com/', 'https://shop.example.evil.com/', 'https://shop.example@evil.com/', 'https://shop.example/' + 'a'.repeat(2100)])
    assert.equal(href(u), null, u);
  for (const u of ['https://www.google.com/maps/place/Faro?q=a/../b', 'https://www.google.com/maps/', 'https://shop.example/a//b.jpg', 'https://shop.example/x/../y'])
    assert.equal(href(u), u, u);   // origin entries guard the origin; ?q= is not the path
  // mailto: one plain address
  for (const u of ['mailto:attacker%40evil.com,info@shop.example', 'mailto:x%0Abcc:y@shop.example', 'mailto:a@shop.example?cc=b@evil.example', 'mailto:a;b@shop.example', 'mailto:a,b@shop.example'])
    assert.equal(href(u), null, u);
  for (const u of ['mailto:info@shop.example', 'mailto:ana.m+demo@mail.shop.example']) assert.equal(href(u), u, u);
  // the checker's mail actions read the same way
  const k = kitBoot(), errs = k.LBW.kit.setup.check({ prefix: 'w', langs: ['en'], links: ['mailto:'], actions: { m: { label: 'Mail', mail: 'a%40evil.com,b@shop.example' } }, widgets: { c: { type: 'cards', items: { a: { title: 'A' } } } } });
  assert.ok(errs.some((e) => e.includes('"mail" is one plain address')));
});

// ── finding 7 · kit/host-modal.js ──────────────────────────────────────────────────────────────────────────────────
function hostPage(html) {
  const dom = new JSDOM('<!doctype html><body>' + html + '</body>', { runScripts: 'outside-only', url: 'https://client.example/' });
  const w = dom.window; w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.eval(read('kit/host-modal.js')); return w;
}
test('security 0.9.5 · PoC: host-modal: the photo prefix ends in "/", and only the Livechat frame is heard', async () => {
  const w = hostPage('<div class="LandbotLivechat"><iframe></iframe></div><iframe src="https://ads.example/?ref=landbot"></iframe>');
  const hm = w.LBWHostModal({ photos: ['https://cdn.client.example'] });
  hm.open({ photos: ['https://cdn.client.example.evil.com/x.jpg'], title: 'x' });
  assert.equal(w.document.querySelector('dialog').open, false);   // was: shown
  for (const u of ['https://cdn.client.example/../x.jpg', 'https://cdn.client.example/%2e%2e/x.jpg', 'https://cdn.client.example//evil.com/x.jpg']) { hm.open({ photos: [u] }); assert.equal(w.document.querySelector('dialog').open, false, u); }
  const [chat, ad] = [...w.document.querySelectorAll('iframe')].map((f) => f.contentWindow);
  const post = (source, origin) => w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'lbw:modal', kind: 'gallery', photos: ['https://cdn.client.example/a.jpg'], title: 't' }, origin, source }));
  post(ad, 'https://ads.example'); assert.equal(w.document.querySelector('dialog').open, false, 'the ad frame');   // was: opened
  post(chat, 'https://evil.example'); assert.equal(w.document.querySelector('dialog').open, false, 'the chat frame, wrong origin');
  post(null, 'https://client.example'); assert.equal(w.document.querySelector('dialog').open, false, 'no source');
  post(chat, 'https://client.example'); assert.equal(w.document.querySelector('dialog').open, true, 'the Livechat frame');
  assert.deepEqual(json(w.__lbwHostModal).map((x) => x.ev + ':' + (x.from || '')), ['refused:api', 'refused:api', 'refused:api', 'refused:api', 'ignored:', 'ignored:', 'ignored:', 'open:chat']);
});

// ── finding 11 · prototype names, cls, <!--<script ────────────────────────────────────────────────────────────────
test('security 0.9.5 · prototype names are refused on purpose, not by accident', () => {
  const c = kitBoot(); c.LBW.kit.setup({ prefix: 'w', langs: ['en'], links: [], widgets: { c: { type: 'cards', items: { a: { title: 'A' } } } } });
  for (const t of ['[[w:constructor]]', '[[w:__proto__]]', '[[w:tostring]]', '[[w:c id=constructor]]', '[[w:c id=__proto__]]', '[[w:c id=prototype]]']) { const m = c.bot('x ' + t); c.LBW.scan(); assert.equal(m.widgets().length, 0, t); }
  assert.ok(c.dropped().includes('[[w:constructor]] (unknown widget)'));   // was: (error: def.render is not a function)
  // an id list that holds them still refuses them
  const r = boot(); r.LBW.init({ prefix: 'w' }); let got;
  r.LBW.widget('x', (p) => { got = json(p.list('ids', ['a', 'constructor', '__proto__'])); return null; });
  r.bot('[[w:x ids=a,constructor,__proto__,hasOwnProperty]]'); r.LBW.scan(); assert.deepEqual(got, ['a']);
  r.LBW.widget('__proto__', () => null); r.LBW.widget('constructor', () => null);
  assert.ok(r.dropped().includes('LBW.widget: refused "__proto__"'));

});

test('security 0.9.5 · a param can\'t write a class name', () => {
  const c = kitBoot();
  c.LBW.kit.setup({ prefix: 'w', langs: ['es'], links: [], widgets: { z: { type: 'cards', cls: 'kit-{zona}', params: { zona: { type: 'text', max: 40 } }, item: { title: 'Zona {zona}' } } } });
  const m = c.bot('[[w:z zona=x kit-ovl|lang=es]]'); c.LBW.scan();
  const w = m.widgets()[0]; assert.ok(w); assert.equal(w.querySelector('.lbw-title').textContent, 'Zona x kit-ovl');
  assert.ok(!w.classList.contains('kit-ovl') && !w.classList.contains('kit-x'));
});

test('security 0.9.5 · npm run bot: "<!--<script" or "</script" in a config can\'t break the block', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-'));
  const dir = tmp(), cfgPath = path.join(dir, 'c.json'), cfg = JSON.parse(read('kit/example/config.json'));
  cfg.widgets.service.items.extension.line = 'a <!--<script> b </script> c';
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const out = tmp(), r = spawnSync(process.execPath, ['scripts/bot-code.mjs', cfgPath, '--out', out], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const js = fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8');
  assert.ok(!/<!--|<script>[^<]*<script/i.test(js.replace(/<script[^>]*>|<\/script>/g, (m) => m.replace('<', '«'))), 'no "<" of the config is left');
  const blocks = [...js.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const setup = blocks[1].replace(/^if\(window\.LBW&&LBW\.kit\)\{/, '').replace(/^LBW\.landbot&&LBW\.landbot\(this\);LBW\.kit\.setup\(/, '').replace(/\);?\}?\s*$/, '');   // v0.9.5: the setup line is guarded
  assert.equal(new Function('return ' + setup)().widgets.service.items.extension.line, 'a <!--<script> b </script> c');
});

// ── finding 9 · the last-resort typing path ────────────────────────────────────────────────────────────────────────
test('security 0.9.5 · PoC: the last resort types only into Landbot\'s own text box', async () => {
  const c = boot({ landbot: false }); c.LBW.init({ prefix: 'w', quietMs: 0 });
  const inp = c.d.createElement('input'); inp.id = 'newsletter'; c.d.body.insertBefore(inp, c.d.body.firstChild);
  let enter = 0; inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter++; });
  c.LBW.say('Quiero el plan premium'); await wait(400);
  assert.equal(inp.value, ''); assert.equal(enter, 0);   // was: typed, and one Enter
  assert.ok(c.dropped().some((x) => x.startsWith('no way to send')));
  const box = c.d.createElement('div'); box.setAttribute('data-lb-part', 'input-field'); const lb = c.d.createElement('input'); box.appendChild(lb); c.d.body.appendChild(box);
  await wait(1000); c.LBW.say('Hola'); await wait(600); assert.equal(lb.value, 'Hola');
});

// ── finding 2, the inline fallback: the same kind of message must not freeze the tab when the library didn't load ──
test('security 0.9.5 · the fallback cleans 100k-character hostile messages in under 50 ms', async () => {
  const c = boot({ lbw: false }); c.w.LBW_FALLBACK_MS = 1; c.w.eval(read('runtime/fallback.js')); await wait(20);
  for (const text of ['[[a'.repeat(33000) + ']x', '[['.repeat(50000) + ']x', 'a' + ' '.repeat(100000) + 'b [[np:x]]', '[[np:x]] ok' + ' '.repeat(100000)]) {
    const t0 = performance.now(); const m = c.bot(text); await wait(0); const ms = performance.now() - t0;   // the observer runs before the timer
    assert.ok(ms < BUDGET, ms.toFixed(1) + ' ms'); assert.ok(!m.text().includes('[[np:x]]'));
  }
});
