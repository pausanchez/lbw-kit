// test/cards-pass-010.test.mjs · v0.10 "cards & pass": the confirm pass, photo-led cards and carousels (one frame, the price on
// the photo, one primary per carousel), compare v2 (photos, best column, ✓/✕ with words, units) and the card hierarchy.
// Every v0.9.5 accessibility behaviour stays: headings, list semantics, column headers, focus, the live region.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

function chat(cfg) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026'; c.w.__lbwNow = '10:30';
  c.check = json(c.w.LBW.kit.setup.check(JSON.parse(JSON.stringify(cfg))));
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg))));
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const PH = (n) => ({ src: 'https://img.example/' + n + '.jpg', alt: 'Room ' + n });
const BASE = { prefix: 't', langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', links: ['https://img.example/', 'https://site.example/', 'tel:'],
  actions: { call: { tel: '600 000 000', label: 'Llamar', icon: 'phone' } } };
const cfgOf = (widgets) => Object.assign({}, BASE, { widgets });

// ── 1 · the pass ──────────────────────────────────────────────────────────────────────────────
const SLOTS = { type: 'slots', title: 'Elige', cta: 'Pedir', ics: { title: 'Spa', where: 'Planta baja' },
  weekly: { ahead: 3, week: { 1: [['10:00', '11:00']], 2: [['10:00', '11:00']], 3: [['10:00', '11:00']], 4: [['10:00', '11:00']], 5: [['10:00', '11:00']], 6: [['10:00', '11:00']], 0: [['10:00', '11:00']] } },
  say: { text: 'Mi cita: {day:date}, {from:time}', fields: {} } };
const PASS = { type: 'confirm', style: 'pass', form: 'cita', status: 'Cita pedida', title: 'Masaje', params: { ref: { type: 'text', max: 16 } }, code: '{ref}',
  rows: [['Hora', '{from:time}–{to:time}'], ['Dónde', 'Spa, planta baja']], steps: ['Te llamamos'], note: 'Demo.', actions: ['call'] };
function booked(c, n = 3) { c.w.LBW.kit.last.cita = { state: { day: c.w.LBW.day.today() + n, from: 600, to: 660 }, text: 'Mi cita' }; }

test('pass: a ticket with the status, the title as a heading, the date big, the time, a countdown and the code', () => {
  const c = chat(cfgOf({ cita: SLOTS, ok: PASS })); assert.deepEqual(c.check, []); booked(c, 3);
  const w = draw(c, '[[t:ok ref=FS-4K2P]]').widgets()[0];
  assert.ok(w.classList.contains('kit-pass') && w.classList.contains('kit-confirm'));
  const t = w.querySelector('.kit-pass-top .lbw-title'); assert.equal(t.textContent, 'Masaje'); assert.equal(t.getAttribute('role'), 'heading'); assert.equal(t.getAttribute('aria-level'), '3');
  assert.equal(w.querySelector('.kit-pass-st').textContent, 'Cita pedida');
  assert.equal(w.querySelector('.kit-pass-in').textContent, 'En 3 días');
  assert.equal(w.querySelector('.kit-pass-d').textContent, '16');   // 13/11/2026 + 3
  assert.equal(w.querySelector('.kit-pass-wd').textContent, 'lunes'); assert.equal(w.querySelector('.kit-pass-m').textContent, 'noviembre');
  assert.equal(w.querySelector('.kit-pass-t').textContent, '10:00–11:00');
  assert.equal(w.querySelector('.kit-pass-code strong').textContent, 'FS-4K2P');
  assert.equal(w.querySelector('.kit-pass-code span').textContent, 'Código de reserva');
  // the row that repeats the time is left out; the rest stay, as a dl
  assert.deepEqual([...w.querySelectorAll('.kit-pass-stub dt')].map((x) => x.textContent), ['Dónde']);
  assert.equal(w.querySelectorAll('.kit-pass-stub ol.kit-facts.is-steps li').length, 1);
  assert.ok(w.querySelector('.kit-pass-i .kit-ico svg'), 'the check is drawn (no class needed)');
  assert.equal(w.querySelector('.kit-pass-i').getAttribute('aria-hidden'), null); assert.equal(w.querySelector('.kit-pass-i .kit-ico').getAttribute('aria-hidden'), 'true');
});

test('pass: "Add to calendar" is the one primary (the .ics), before the other actions, which lose their fill', () => {
  const cfg = cfgOf({ cita: SLOTS, ok: Object.assign({}, PASS, { actions: [{ use: 'call', primary: true }] }) });
  const c = chat(cfg); booked(c, 0);
  const w = draw(c, '[[t:ok]]').widgets()[0], bs = [...w.querySelectorAll('.lbw-actions .lbw-pill')];
  assert.equal(bs[0].textContent, 'Añadir al calendario'); assert.ok(bs[0].classList.contains('lbw-ics') && bs[0].classList.contains('is-primary'));
  assert.equal(w.querySelectorAll('.lbw-pill.is-primary').length, 1);
  assert.equal(w.querySelector('.kit-pass-in').textContent, 'Hoy');
  assert.equal(w.querySelector('.kit-pass-code'), null, 'no ref in the tag: no code (never invented)');
});

test('pass: tomorrow, other languages, no countdown in the past, "ics": false, and a code that is not plain is dropped', () => {
  const c = chat(cfgOf({ cita: SLOTS, ok: Object.assign({}, PASS, { ics: false }) })); booked(c, 1);
  let w = draw(c, '[[t:ok lang=en ref=AB12]]').widgets()[0];
  assert.equal(w.querySelector('.kit-pass-in').textContent, 'Tomorrow'); assert.equal(w.querySelector('.kit-pass-code span').textContent, 'Booking code');
  assert.equal(w.querySelector('.lbw-ics'), null);
  const c2 = chat(cfgOf({ cita: SLOTS, ok: PASS })); booked(c2, -2);
  w = draw(c2, '[[t:ok ref=@@@]]').widgets()[0];
  assert.equal(w.querySelector('.kit-pass-in'), null);
  assert.equal(w.querySelector('.kit-pass-code'), null);
  const K = c.w.LBW.kit, L = K.L || {}; ['en', 'es', 'it', 'de', 'fr', 'ca'].forEach((l) => { if (L[l]) ['addCal', 'inDays', 'code', 'best'].forEach((k) => assert.ok(L[l][k], l + '.' + k)); });
});

test('pass: a form booking (no day) draws the ticket without a date; the default style stays the card, now with the code as a row', () => {
  const form = { type: 'form', cta: 'Enviar', summary: 'Plan: {a:label}', steps: [{ key: 'a', title: 'Qué', items: [['x', 'Equis']] }] };
  const c = chat(cfgOf({ f: form, ok: { type: 'confirm', style: 'pass', form: 'f', title: 'Recibido', status: 'Enviado' },
    card: { type: 'confirm', form: 'f', title: 'Recibido', status: 'Enviado', params: { ref: { type: 'text' } }, code: '{ref}' } }));
  c.w.LBW.kit.last.f = { state: { a: 'x' }, text: 'Plan: Equis' };
  const w = draw(c, '[[t:ok]]').widgets()[0];
  assert.ok(w.classList.contains('is-short') && !w.querySelector('.kit-pass-when') && !w.querySelector('.lbw-ics'));
  const k = draw(c, '[[t:card ref=Q-1]]').widgets()[0];
  assert.ok(!k.classList.contains('kit-pass')); assert.ok(k.querySelector('.kit-statusbar'));
  assert.deepEqual([...k.querySelectorAll('dt')].map((x) => x.textContent), ['Código de reserva']);
});

test('pass: the checker knows style, code, ics and countdown', () => {
  const c = chat(cfgOf({ cita: SLOTS, ok: Object.assign({}, PASS, { style: 'ticket', countdown: 'yes', code: '{nope}', ics: { title: 'x', when: 1 } }) }));
  const e = c.check.join('\n');
  assert.match(e, /"style" is "pass"/); assert.match(e, /"countdown" is true or false/); assert.match(e, /\{nope\}/); assert.match(e, /ics: unknown key "when"/);
});

test('pass: the check animates only when seen and motion is allowed; it is drawn without the class', async () => {
  const css = read('kit/kit.css');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{[^}]*\.kit-pass-i\.is-drawing/);
  const sec = css.slice(css.indexOf('/* v0.10 · cards & pass'));
  // motion is transform/opacity only
  [...sec.matchAll(/@keyframes [\w-]+ \{([^@]*?)\}\s*\}/g)].forEach((m) => assert.doesNotMatch(m[1].replace(/transform|opacity/g, ''), /[a-z-]+\s*:/, m[0]));
  const c = chat(cfgOf({ cita: SLOTS, ok: PASS })); booked(c);
  let cb = null; c.w.IntersectionObserver = function (f) { cb = f; this.observe = () => {}; this.disconnect = () => { cb = null; }; };
  c.w.matchMedia = () => ({ matches: false });
  const i = draw(c, '[[t:ok]]').querySelector('.kit-pass-i');
  assert.ok(cb); assert.ok(!i.classList.contains('is-drawing'));
  Object.defineProperty(c.d, 'visibilityState', { value: 'hidden', configurable: true });
  cb([{ isIntersecting: true }]); assert.ok(!i.classList.contains('is-drawing'), 'not in a hidden tab');
  Object.defineProperty(c.d, 'visibilityState', { value: 'visible', configurable: true });
  cb([{ isIntersecting: true }]); assert.ok(i.classList.contains('is-drawing'));
  await wait(950); assert.ok(!i.classList.contains('is-drawing'), 'back to the drawn default');
  const c2 = chat(cfgOf({ cita: SLOTS, ok: PASS })); booked(c2); let made = 0;
  c2.w.IntersectionObserver = function () { made++; this.observe = () => {}; }; c2.w.matchMedia = () => ({ matches: true });
  draw(c2, '[[t:ok]]'); assert.equal(made, 0, 'reduced motion: no observer at all');
});

// ── 2 · photo-led cards and carousels ─────────────────────────────────────────────────────────────
test('card with a photo: full-bleed first, badge and price on it, the title still the heading before the price in reading order', () => {
  const c = chat(cfgOf({ room: { type: 'cards', kicker: 'Habitación', reply: ['Calcular', 'Quiero calcular'],
    items: { faro: { title: 'Del Faro', badge: { text: 'Solo una', tone: 'info' }, img: PH('faro'), price: { now: '219 €', unit: '/noche', list: '249 €' }, rows: [['Personas', '2'], ['Precio', '189 € · 6 libres']] },
             plain: { title: 'Sin foto', badge: 'Nuevo', price: { now: '99 €' } } } } }));
  assert.deepEqual(c.check, []);
  const w = draw(c, '[[t:room id=faro]]').widgets()[0], box = w.querySelector('.lbw-box');
  assert.ok(w.classList.contains('has-media')); assert.ok(box.firstElementChild.classList.contains('kit-media'));
  assert.equal(box.querySelector('.kit-media img').getAttribute('alt'), 'Room faro');
  assert.equal(box.querySelector('.kit-media .kit-tag.kit-on-photo').textContent, 'Solo una');
  assert.equal(w.querySelector('.lbw-head .kit-tag'), null, 'the badge is not twice');
  const pr = box.querySelector('.kit-price'); assert.ok(pr.classList.contains('is-over')); assert.equal(pr.textContent, '219 €/noche249 €');
  assert.ok(w.querySelector('.lbw-title').compareDocumentPosition(pr) & 4, 'the name is read before the price');
  // "189 € · 6 libres": two spans, the same text
  const dd = [...w.querySelectorAll('dd')][1]; assert.equal(dd.textContent, '189 € · 6 libres'); assert.equal(dd.querySelector('.kit-v').textContent, '189 €');
  const p = draw(c, '[[t:room id=plain]]').widgets()[0];
  assert.ok(!p.classList.contains('has-media')); assert.equal(p.querySelector('.lbw-head .kit-tag').textContent, 'Nuevo');
  assert.ok(!p.querySelector('.kit-price').classList.contains('is-over'));
});

test('carousel: photos make the slides the cards (is-media, "style": "box" keeps the box); slide replies are quiet; one primary', () => {
  const slide = (id, img) => Object.assign({ id, name: 'Room ' + id, price: { now: '1' + id.length + '0 €', unit: '/noche' }, reply: ['Elegir', 'Quiero ' + id] }, img ? { img: PH(id) } : {});
  const c = chat(cfgOf({ r: { type: 'carousel', title: 'Rooms', reply: ['Ver todas', 'Todas'], items: [slide('mar', 1), slide('jardin', 1)] },
    b: { type: 'carousel', title: 'Rooms', style: 'box', items: [slide('mar', 1), slide('jardin', 1)] },
    n: { type: 'carousel', title: 'Rooms', items: [slide('mar'), slide('jardin')] } }));
  assert.deepEqual(c.check, []);
  const w = draw(c, '[[t:r]]').widgets()[0];
  assert.ok(w.classList.contains('is-media'));
  assert.equal(w.querySelectorAll('.kit-slide .lbw-reply.is-primary').length, 0);
  assert.equal(w.querySelectorAll('.lbw-reply.is-primary').length, 1); assert.equal(w.querySelector('.lbw-reply.is-primary').textContent, 'Ver todas');
  assert.ok(w.querySelector('.kit-slide').classList.contains('has-over')); assert.ok(w.querySelector('.kit-slide .kit-price.is-over'));
  // v0.9.5 semantics kept
  const st = w.querySelector('.lbw-strip'); assert.equal(st.getAttribute('role'), 'list'); assert.equal(st.getAttribute('aria-label'), 'Rooms');
  assert.ok([...st.children].every((s) => s.getAttribute('role') === 'listitem')); assert.equal(w.querySelector('.lbw-name').getAttribute('aria-level'), '4');
  assert.ok(!draw(c, '[[t:b]]').widgets()[0].classList.contains('is-media'));
  const n = draw(c, '[[t:n]]').widgets()[0]; assert.ok(!n.classList.contains('is-media')); assert.equal(n.querySelector('.kit-price.is-over'), null);
  assert.match(chat(cfgOf({ r: { type: 'carousel', style: 'cards', items: [slide('mar')] } })).check.join('\n'), /"style" is "media"/);
});

test('carousel: a quiet slide reply is still a reply: it sends its sentence and keeps focus', async () => {
  const c = chat(cfgOf({ r: { type: 'carousel', title: 'Rooms', items: [{ id: 'a', name: 'A', img: PH('a'), reply: ['Elegir', 'Quiero A'] }, { id: 'b', name: 'B', reply: ['Elegir', 'Quiero B'] }] } }));
  const m = draw(c, '[[t:r]]'), b = m.querySelector('.kit-slide-b');
  assert.ok(b.classList.contains('lbw-reply') && !b.classList.contains('is-primary')); assert.equal(b.getAttribute('data-say'), 'Quiero A');
  b.focus(); b.click(); await wait(50);
  assert.equal(c.d.activeElement, b); assert.ok(b.classList.contains('is-sent'));
});

// ── 3 · compare v2 ───────────────────────────────────────────────────────────────────────────────
const CMP = { type: 'compare', title: 'Frente a frente', best: 'b', rows: [['m2', 'Superficie', '', 'm²'], ['balcon', 'Balcón'], ['bano', 'Bañera'], ['precio', 'Desde', 'is-strong']],
  items: { a: { name: 'A', img: PH('a'), values: { m2: '24', balcon: true, bano: 'No', precio: '159 €' }, reply: ['Elegir', 'Quiero A'] },
           b: { name: 'B', img: PH('b'), values: { m2: '30 m²', balcon: false, bano: 'Sí', precio: '219 €' }, reply: ['Elegir', 'Quiero B'] },
           c: { name: 'C', values: { m2: '22', balcon: false, bano: 'No', precio: '129 €' } } } };

test('compare v2: photos head the columns, the best column is marked and its reply is the primary; units; ✓/✕ keep their words', () => {
  const c = chat(cfgOf({ vs: CMP })); assert.deepEqual(c.check, []);
  const w = draw(c, '[[t:vs ids=a,b,c]]').widgets()[0], g = w.querySelector('[role="table"]');
  assert.ok(g.classList.contains('has-best'));
  const hs = [...g.querySelectorAll('[role="columnheader"]')];
  assert.deepEqual(hs.map((h) => [h.textContent, h.getAttribute('aria-colindex')]), [['A', '2'], ['B, Mejor opción', '3'], ['C', '4']]);
  assert.ok(hs[0].querySelector('.kit-cmp-img img')); assert.equal(hs[0].querySelector('img').getAttribute('alt'), '', 'decorative: the name is beside it');
  assert.ok(hs[2].querySelector('.kit-cmp-img.is-blank'), 'a column with no photo keeps the names on one line');
  assert.ok(hs[1].classList.contains('is-best'));
  assert.deepEqual([...g.querySelectorAll('[role="row"]')].slice(1).map((r) => [...r.querySelectorAll('[role="cell"]')].map((x) => x.textContent)),
    [['24 m²', '30 m²', '22 m²'], ['Sí', 'No', 'No'], ['No', 'Sí', 'No'], ['159 €', '219 €', '129 €']]);
  const yn = g.querySelectorAll('[role="row"]')[2].querySelectorAll('.kit-yn');
  assert.deepEqual([...yn].map((x) => x.className), ['kit-yn is-yes', 'kit-yn is-no', 'kit-yn is-no']);
  assert.ok(yn[0].nextSibling.classList.contains('kit-sr'), 'the word stays for a screen reader');
  assert.equal(g.querySelectorAll('[role="row"]')[1].querySelector('.kit-cmp-label').textContent, 'Superficie');
  // the replies: inside the card, under their columns; the best one is the primary
  const acts = w.querySelector('.lbw-box .kit-cmp-acts'); assert.ok(acts);
  const bs = [...acts.querySelectorAll('.lbw-pill')]; assert.deepEqual(bs.map((b) => [b.getAttribute('data-say'), b.classList.contains('is-primary'), b.style.getPropertyValue('--kit-col')]), [['Quiero A', false, '1'], ['Quiero B', true, '2']]);
  // in English, the same words
  const e = draw(c, '[[t:vs ids=a,c lang=en]]').widgets()[0];
  assert.deepEqual([...e.querySelectorAll('.kit-yn + .kit-sr')].map((x) => x.textContent), ['Yes', 'No', 'No', 'No']);   // true/false say the tag's language; "No" is the English no too
  assert.ok(e.querySelectorAll('.kit-cmp-row')[3].classList.contains('is-same'), 'an equal ✕/✕ row is still drawn quieter');
});

test('compare v2: a "best" that is not compared changes nothing; the checker knows best, units and booleans', () => {
  const c = chat(cfgOf({ vs: CMP }));
  const w = draw(c, '[[t:vs ids=a,c]]').widgets()[0];
  assert.ok(!w.querySelector('.has-best')); assert.equal(w.querySelector('.lbw-reply.is-primary').getAttribute('data-say'), 'Quiero A');
  const bad = chat(cfgOf({ vs: Object.assign({}, CMP, { best: 'zz', rows: CMP.rows.concat([['x', 'X', '', 2]]) }) })).check.join('\n');
  assert.match(bad, /best "zz" is not one of the items/); assert.match(bad, /\[key, label, class, unit\]/);
  const lab = chat(cfgOf({ vs: Object.assign({}, CMP, { best: { id: 'a', label: 'Top', x: 1 } }) }));
  assert.match(lab.check.join('\n'), /best: unknown key "x"/);
});

test('compare v2: CSS: labels keep their case (units), a wide card gives labels a column, ✓/✕ coloured by tokens', () => {
  const css = read('kit/kit.css'), sec = css.slice(css.indexOf('/* v0.10 · cards & pass'));
  assert.match(sec, /\.kit-cmp-label \{ text-transform: none/);
  assert.match(sec, /@container lbw \(min-width: 460px\) \{\s*\.kit-cmp-row, \.kit-cmp-foot \{ display: grid/);
  assert.match(sec, /\.kit-yn\.is-yes \{ color: var\(--kit-ok-c\)/);
  assert.doesNotMatch(sec.replace(/rgba\([^)]*\)|#0000|#000\)|#fff\b|#FFF\b/g, ''), /#[0-9a-f]{3,6}\b/i, 'colours come from tokens');
});

// ── 4 · the card hierarchy ───────────────────────────────────────────────────────────────────────
test('cards: price under the title, rows as label/value lines, shadow from the tokens; the checker knows img and price', () => {
  const c = chat(cfgOf({ k: { type: 'cards', items: { a: { title: 'A', price: { now: '45 €', unit: 'desde' }, rows: [['Plazo', '2 días']] } } },
    bad: { type: 'cards', items: { a: { title: 'A', img: { src: 'https://evil.example/x.jpg' }, price: { now: 1 } } } } }));
  assert.ok(c.check.some((e) => /a\.img\.src is not under any entry of "links"/.test(e)));
  assert.ok(c.check.some((e) => /a\.price is \{ "now"/.test(e)));
  const w = draw(c, '[[t:k id=a]]').widgets()[0];
  assert.ok(w.querySelector('.lbw-head').compareDocumentPosition(w.querySelector('.kit-price')) & 4);
  const css = read('kit/kit.css');
  assert.match(css, /--kit-shadow-1: var\(--lbw-shadow-1,/); assert.match(css, /\.lbw\.kit-card:not\(\.kit-season\) \.kit-lines > div, \.kit-pass-stub \.kit-lines > div \{ display: flex; justify-content: space-between/);
});

test('photos in cards and compare come from "photos" sets as in a carousel', () => {
  const cfg = cfgOf({ k: { type: 'cards', items: { a: { title: 'A', img: 'cdn:a.jpg' } } }, vs: Object.assign({}, CMP, { items: Object.assign({}, CMP.items, { a: Object.assign({}, CMP.items.a, { img: 'cdn:x.jpg' }) }) }) });
  cfg.photos = { cdn: { base: 'https://img.example/p/', sizes: [['s/', 400], ['m/', 800]], ratio: [4, 3] } };
  const c = chat(cfg); assert.deepEqual(c.check, []);
  const im = draw(c, '[[t:k id=a]]').querySelector('.kit-media img');
  assert.equal(im.getAttribute('src'), 'https://img.example/p/s/a.jpg'); assert.match(im.getAttribute('srcset'), /m\/a\.jpg 800w/); assert.equal(im.getAttribute('alt'), 'A');
  assert.equal(draw(c, '[[t:vs ids=a,b]]').querySelector('.kit-cmp-img img').getAttribute('src'), 'https://img.example/p/s/x.jpg');
});
