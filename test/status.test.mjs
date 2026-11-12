// test/status.test.mjs · v0.8.1.4: one status pattern, badges, icons and the danger style (ideas from ChatKit, Chat SDK
// and Persona, rebuilt on lbw: closed lists, text only, SVG built without markup strings).
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, read } from './helpers.mjs';

const pin = (c) => { c.w.__lbwToday = '10/11/2026'; c.w.__lbwNow = '10:30'; return c; };   // a Tuesday morning
function setup(widgets, extra = {}) {
  const c = pin(boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }));
  const cfg = Object.assign({ prefix: 't', langs: ['en', 'es'], defaultLang: 'en', timeZone: 'Europe/Madrid', links: ['https://shop.example/', 'tel:'], widgets }, extra);
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg))));
  c.check = (w, x) => json(c.w.LBW.kit.setup.check(Object.assign({ prefix: 't', langs: ['en', 'es'], defaultLang: 'en', links: ['https://shop.example/', 'tel:'], widgets: w }, x || {})));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };

const CARDS = {
  plan: { type: 'cards', items: {
    basic: { title: 'Basic plan', badge: 'Popular', status: { text: 'Available this week', tone: 'ok' } },
    pro: { title: 'Pro plan', badge: { text: 'Sold out', tone: 'danger' } } },
    status: { param: 'estado', items: { sent: { text: { en: 'Request received', es: 'Solicitud recibida' }, tone: 'ok' }, late: { text: 'Waiting for the drawings', tone: 'warn' } } },
    links: [{ reply: ['Call me', 'Please call me'], icon: 'phone', primary: true }, { reply: ['Not now', 'Not now, thanks'], danger: true }, { tel: '+34 600 000 000', label: 'Call', icon: 'phone' }] }
};

test('status: a card shows its own status line and badge', () => {
  const c = setup(CARDS); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const w = draw(c, '[[t:plan id=basic]]').widgets()[0];
  const st = w.querySelector('.kit-statusbar');
  assert.ok(w.querySelector('.lbw-head').compareDocumentPosition(st) & 4, 'the status line comes under the title');
  assert.ok(st.classList.contains('is-ok')); assert.equal(st.textContent, 'Available this week');
  assert.ok(st.querySelector('svg path'), 'the tone has an icon, not colour alone');
  const b = w.querySelector('.lbw-head > .kit-tag'); assert.equal(b.textContent, 'Popular'); assert.ok(b.classList.contains('is-neutral'));
  const pro = draw(c, '[[t:plan id=pro]]').widgets()[0].querySelector('.kit-tag');
  assert.ok(pro.classList.contains('is-danger')); assert.equal(pro.textContent, 'Sold out');
  c.close();
});

test('status: the tag names a status from a closed list (a flow field); unset or unknown falls back to the item\'s own', () => {
  const c = setup(CARDS);
  const one = (tag) => { const w = draw(c, tag).widgets()[0]; const s = w && w.querySelector('.kit-statusbar'); return s ? [s.className.replace(/kit-statusbar /, ''), s.textContent] : null; };
  assert.deepEqual(one('[[t:plan id=basic estado=late]]'), ['is-warn', 'Waiting for the drawings']);
  assert.deepEqual(one('[[t:plan id=pro estado=sent lang=es]]'), ['is-ok', 'Solicitud recibida']);
  assert.deepEqual(one('[[t:plan id=basic estado=@{estado}]]'), ['is-ok', 'Available this week'], 'an unset Landbot field');
  assert.deepEqual(one('[[t:plan id=basic estado=<b>x]]'), ['is-ok', 'Available this week'], 'an attack value');
  assert.equal(one('[[t:plan id=pro estado=nope]]'), null, 'no status of its own, nothing drawn');
  c.close();
});

test('actions: an icon goes inside the button; the label, the sentence and the fields are unchanged; danger is a style', () => {
  const c = setup(CARDS), w = draw(c, '[[t:plan id=basic]]').widgets()[0];
  const [call, no] = [...w.querySelectorAll('button.lbw-pill')], tel = w.querySelector('a.lbw-pill');
  assert.equal(call.textContent, 'Call me'); assert.equal(call.getAttribute('data-say'), 'Please call me');
  assert.ok(call.classList.contains('has-ico') && call.querySelector('.kit-ico[aria-hidden="true"] svg'));
  assert.ok(no.classList.contains('is-danger') && !no.classList.contains('is-primary'));
  assert.equal(tel.getAttribute('href'), 'tel:+34600000000'); assert.ok(tel.querySelector('.kit-ico'));
  c.close();
});

test('contact: "open now" is the shared status line, with the same words', () => {
  const c = setup({ contact: { type: 'contact', title: 'Talk to us', hours: { week: { 1: [[540, 1080]], 2: [[540, 1080]], 3: [[540, 1080]], 4: [[540, 1080]], 5: [[540, 1080]] } } } });
  const s = draw(c, '[[t:contact]]').widgets()[0].querySelector('.kit-status');
  assert.ok(s.classList.contains('kit-statusbar') && s.classList.contains('is-ok') && s.classList.contains('is-open'));
  assert.equal(s.textContent, 'Open now · until 18:00'); assert.equal(c.w.document.querySelector('.kit-dot'), null);
  c.w.__lbwNow = '19:00'; const z = draw(c, '[[t:contact]]').widgets()[0].querySelector('.kit-status');
  assert.ok(z.classList.contains('is-info') && !z.classList.contains('is-open')); assert.match(z.textContent, /^Closed now/);
  c.close();
});

test('consent and slides: an SVG icon, a slide status in a tone', () => {
  const c = setup({
    ok: { type: 'consent', icon: 'shield', title: 'Can we call you?', yes: ['Yes', 'Yes, call me'], no: ['No', 'No, thanks'] },
    list: { type: 'carousel', items: [{ id: 'a', name: 'A', status: { text: 'Last 2', tone: 'warn' } }, { id: 'b', name: 'B', status: { text: 'In stock', ok: true } }] } });
  const i = draw(c, '[[t:ok]]').widgets()[0].querySelector('.kit-consent-i');
  assert.equal(i.textContent, ''); assert.ok(i.querySelector('svg path'));
  const st = [...draw(c, '[[t:list]]').widgets()[0].querySelectorAll('.kit-stock')].map((x) => x.className);
  assert.deepEqual(st, ['kit-stock is-warn has-ico', 'kit-stock is-ok has-ico']);
  c.close();
});

test('icons: built as SVG nodes, never from markup; an unknown name draws nothing', () => {
  const c = boot({ kit: true }), h = c.w.LBW.kit.h;
  assert.ok(h.icons.length >= 15);
  for (const n of h.icons) { const i = h.icon(n); assert.ok(i.querySelector('svg').getAttribute('viewBox') === '0 0 24 24' && i.querySelectorAll('path').length, n); }
  assert.equal(h.icon('<img src=x onerror=1>'), null); assert.equal(h.icon('constructor'), null);
  assert.equal(h.badge('', 'ok'), null); assert.ok(h.badge('x', 'nope').classList.contains('is-neutral'));
  c.close();
});

test('check: icons, tones, badges and a tag-named status say what is wrong', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'cards', items: { x: { title: 'X', badge: { text: 'B', tone: 'red' }, status: 'Open' } }, status: { param: 'id', items: { 'Bad key': { text: 'T' } } },
      links: [{ reply: ['A', 'B'], icon: 'rocket', danger: 'yes' }, { reply: ['C', 'D'], danger: true, primary: true }] },
    b: { type: 'carousel', items: [{ id: 'a', name: 'A', status: { text: 'S', tone: 'loud' } }] } }).join('\n');
  for (const m of [/badge\.tone "red" is not a tone/, /x\.status is \{ "text"/, /status\.param must differ/, /status\.items key "Bad key"/, /icon "rocket" is not one of the kit's icons/, /"danger" is true or false/, /"danger" and "primary" together/, /status\.tone "loud" is not a tone/])
    assert.match(e, m);
  assert.deepEqual(c.check(CARDS), []);
  c.close();
});

test('check: the checker\'s icon and tone lists are the kit\'s (it runs without kit.js on the command line)', () => {
  const c = setup({}), K = c.w.LBW.kit;
  assert.deepEqual([...K.setup._.icons], [...K.h.icons]); assert.deepEqual([...K.setup._.tones], [...K.h.tones]);
  c.close();
});

test('dev mode: every maker has its option list (season had none, and threw in a mock with ?kitdev=1)', () => {
  const c = boot(); c.w.__kitDev = true; c.w.eval(read('kit/kit.js')); const K = c.w.LBW.kit;
  assert.equal(K.dev, true);
  assert.doesNotThrow(() => K.season('s', { ranges: [['1/3/2026', '31/10/2026']] }));
  assert.doesNotThrow(() => K.compare('v', { items: { a: { name: 'A' }, b: { name: 'B' } }, rows: [], same: 'fold' }));
  assert.equal((c.w.__kitWarnings || []).filter((x) => /unknown option "same"/.test(x)).length, 0);
  c.close();
});

test('dev mode: a confirm title over budget still warns (a comment had swallowed the check)', () => {
  const c = boot(); c.w.__kitDev = true; c.w.eval(read('kit/kit.js')); const K = c.w.LBW.kit;
  c.w.LBW.init({ prefix: 'p', langs: ['en'], defaultLang: 'en' }); K.last.f = { state: {}, text: 'x' };
  K.confirm('done', { form: 'f', title: 'A title that is much longer than forty characters, by far', status: 'Sent' });
  c.bot('[[p:done]]'); c.LBW.scan();
  assert.ok((c.w.__kitWarnings || []).some((x) => /confirm\('done'\): title over 40/.test(x)), JSON.stringify(c.w.__kitWarnings));
  c.close();
});
