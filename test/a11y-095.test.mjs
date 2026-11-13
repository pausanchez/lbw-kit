// test/a11y-095.test.mjs · v0.9.5 "production": the accessibility blockers and moderate issues of the design-a11y review.
// Announcements (one polite live region per chat), focus that never falls to <body>, named and one-of-several groups,
// a focusable not-ready CTA, headings, compare headers, carousel markup, the lightbox's lang and alts, and the CSS fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

const GALLERY = JSON.parse(read('gallery/config.json'));
function chat(cfg = GALLERY) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026';
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); c.put = (k, v) => c.w.LBW.data.put(k, v);
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  c.live = () => c.d.querySelectorAll('.lbw-live');
  return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const k = (m, key) => m.querySelector(`[data-k="${key}"]`);
const btn = (m, label) => [...m.querySelectorAll('button')].find((b) => b.textContent.trim() === label || b.getAttribute('aria-label') === label);

// ── S1 · announcements ─────────────────────────────────────────────────────────────────────────
test('S1: a new widget in the newest message is announced by its title, in one polite region per chat, with its lang', async () => {
  const c = chat();
  c.bot('Old [[gx:tarifas id=verano]]'); c.bot('Mira [[gx:vs ids=urbana,ebike]]');   // a chat loading with its history: one pass
  c.LBW.scan(); await wait(450);
  assert.equal(c.live().length, 1);
  const r = c.live()[0];
  assert.equal(r.getAttribute('aria-live'), 'polite'); assert.equal(r.getAttribute('role'), null);   // no role=status: say() reads that as "a reply is arriving"
  assert.ok(!r.closest('.lbw') && !r.closest('[data-lb-part="window"]'), 'outside every widget and the chat tree');
  assert.equal(r.getAttribute('lang'), 'es');
  assert.deepEqual(c.said(), ['Comparar: Dos bicis frente a frente']);   // the table above (not the newest) says nothing
  await wait(60); assert.equal(r.textContent, 'Comparar: Dos bicis frente a frente');
});

test('S1: lines arriving together are said together (at most 3), rate-limited, and a key replaces the waiting line', async () => {
  const c = chat(), A = c.w.LBW.announce;
  A('Noches: 2', 'es', 'step'); A('Noches: 3', 'es', 'step'); A('Noches: 4', 'es', 'step'); A('Total 60 €', 'es', 'total');
  await wait(450); assert.deepEqual(c.said(), ['Noches: 4. Total 60 €']);
  A('Uno', 'es'); await wait(450); assert.equal(c.said().length, 1, 'one batch a second');
  await wait(700); assert.deepEqual(c.said().slice(1), ['Uno']);
  assert.equal(A('   '), false);
});

test('S1: a skeleton that becomes a card is announced; the late-data upgrade says "Actualizado"', async () => {
  const cfg = {
    prefix: 'p', langs: ['es', 'en'], defaultLang: 'es', links: [],
    widgets: { tour: { type: 'cards', kicker: 'Excursión', source: { data: 'tours', wait: 30, upgrade: 600, map: { title: '{nombre}' } },
      reply: ['Reservar', 'Quiero reservar'], items: { kayak: { title: 'Kayak (copia)' } } } }
  };
  const c = chat(cfg), m = draw(c, '[[p:tour id=kayak]]');
  assert.ok(m.widgets()[0].classList.contains('is-loading'));
  await wait(500);
  assert.deepEqual(c.said(), ['Excursión: Kayak (copia)'], 'the skeleton became the saved copy');
  m.querySelector('.lbw-title').focus();   // the visitor is on the card (by keyboard), not using it
  const b = m.querySelector('.lbw-reply'); b.focus(); assert.equal(c.d.activeElement, b);
  c.put('tours', [{ id: 'kayak', nombre: 'Kayak al amanecer' }]); await wait(1200);
  const w = m.widgets()[0];
  assert.equal(w.getAttribute('data-lbw-upgraded'), '1');
  assert.ok(c.said().includes('Actualizado: Excursión: Kayak al amanecer'));
  // S2 · focus survives the transplant: the twin of the focused button in the new card
  assert.ok(w.contains(c.d.activeElement) && c.d.activeElement.getAttribute('data-say') === 'Quiero reservar');
});

test('S1: "updated" and "photo n of m" exist in the kit\'s six languages', () => {
  const c = chat(), L = c.w.LBW.kit.L;
  for (const l of ['en', 'es', 'it', 'de', 'fr', 'ca']) { assert.ok(L[l].updated, l); assert.match(L[l].photoOf, /\{n\}.*\{max\}/, l); assert.ok(L[l].day, l); }
});

// ── S2 · focus after a choice ─────────────────────────────────────────────────────────────────────
test('S2: a pressed reply keeps focus (aria-disabled, not disabled); the others are disabled', async () => {
  const c = chat(), m = draw(c, '[[gx:permiso]]'), [yes, no] = m.querySelectorAll('.kit-consent-b button');
  yes.focus(); yes.click(); await wait(10);
  assert.equal(yes.disabled, false); assert.equal(yes.getAttribute('aria-disabled'), 'true'); assert.equal(no.disabled, true);
  assert.equal(c.d.activeElement, yes);
  yes.click(); no.click(); await wait(1600); assert.equal(c.sent.filter((x) => x[0] === 'landbot-msg-send').length, 1, 'sent once');
});

test('S2: the table\'s "Elegir": focus stays on the chosen row\'s button, never on <body>', async () => {
  const c = chat(), m = draw(c, '[[gx:tarifas id=verano]]'), b = m.querySelectorAll('.kit-tbl-b')[1];
  b.focus(); b.click(); await wait(10);
  assert.equal(c.d.activeElement, b); assert.match(b.getAttribute('aria-label'), /^Elegido: /);
});

test('S2: a form that folds after it sends puts focus on its "Ver" toggle', async () => {
  const c = chat(), m = draw(c, '[[gx:plan]]');
  k(m, 'suave').click(); k(m, 'solo').click(); k(m, 'casco').click();
  const cta = m.querySelector('.lbw-cta'); cta.focus(); cta.click(); await wait(10);
  assert.ok(m.widgets()[0].classList.contains('is-collapsed'));
  assert.equal(c.d.activeElement, m.querySelector('.kit-sent-toggle'));
});

test('S2: rescue falls back to the card\'s title (focusable by script) when nothing in the group can hold focus', async () => {
  const c = chat(), m = draw(c, '[[gx:tarifas id=verano]]'), w = m.widgets()[0], g = w.querySelector('.lbw-once'), b = w.querySelector('.kit-tbl-b');
  b.focus(); b.disabled = true; c.w.LBW.ui.rescue(w, g);
  assert.ok(c.d.activeElement.classList.contains('lbw-title')); assert.equal(c.d.activeElement.getAttribute('tabindex'), '-1');
});

// ── S3 · calc and stepper ─────────────────────────────────────────────────────────────────────────
test('S3: a stepper change is announced with the total that follows; at its end focus moves to the other button', async () => {
  const c = chat(), m = draw(c, '[[gx:alquiler dias=2 bici=urbana]]'); await wait(1100);
  const [minus, plus] = m.querySelectorAll('.lbw-step-b');
  plus.focus(); plus.click(); await wait(450);
  const s = c.said().pop(); assert.match(s, /^Días: 3\. Total.*45/);
  minus.focus(); minus.click(); minus.click(); await wait(10);
  assert.equal(minus.disabled, true); assert.equal(c.d.activeElement, plus, 'not dropped to <body>');
  k(m, 'ebike').click(); await wait(1100);
  assert.match(c.said().pop(), /Total 35/);
});

test('S3: a review\'s total is announced when a select changes it', async () => {
  const c = chat(), m = draw(c, '[[gx:presu]]'); await wait(1100);
  const sel = m.querySelector('select'); sel.value = 'si'; sel.dispatchEvent(new c.w.Event('change')); await wait(450);
  assert.equal(c.said().pop(), 'Total 75 €');
});

// ── S4 · control borders ──────────────────────────────────────────────────────────────────────────
test('S4: --lbw-control (≥ 3:1 on white) is the edge of selects, slots, toggles, chips and steppers', () => {
  const css = read('runtime/lbw.css') + read('kit/kit.css');
  const m = /--lbw-control: rgba\(13,13,13,\.(\d+)\)/.exec(css); assert.ok(m);
  const a = +('0.' + m[1]), v = Math.round(255 * (1 - a) + 13 * a) / 255, lin = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  assert.ok(1.05 / (lin + 0.05) >= 3, 'contrast on white');
  assert.match(css, /--lbw-control: color-mix\(in srgb, var\(--lbw-ink\) \d+%, transparent\)/, 'follows the ink in a dark theme');
  for (const sel of ['.kit-sel {', '.kit-slot {', '.lbw-tog {', '.lbw-step-b {', '.kit-chips .lbw-once']) {
    const rule = css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
    assert.match(rule, /--lbw-control/, sel); assert.doesNotMatch(rule, /var\(--lbw-ring\)\)?;/, sel);
  }
});

// ── S5 · lightbox ─────────────────────────────────────────────────────────────────────────────────
test('S5: the lightbox has the widget\'s lang, a different alt per photo, and a live caption', () => {
  const c = chat(), K = c.w.LBW.kit, d = c.d;
  c.w.LBW.init({ links: ['https://img.example/'] });
  const opener = d.createElement('button'); d.body.appendChild(opener);
  const lb = K.h.lightbox({ title: 'Doble vista mar', lang: 'es', photos: [{ src: 'https://img.example/1.jpg' }, { src: 'https://img.example/2.jpg' }] }, 0, opener);
  assert.equal(lb.el.getAttribute('lang'), 'es');
  const cap = lb.el.querySelector('.kit-ovl-cap'); assert.equal(cap.getAttribute('aria-live'), 'polite');
  const alt1 = lb.el.querySelector('.kit-ovl-img img').alt;
  lb.el.querySelector('.is-next').click();
  const alt2 = lb.el.querySelector('.kit-ovl-img img').alt;
  assert.equal(alt1, 'Doble vista mar, foto 1 de 2'); assert.equal(alt2, 'Doble vista mar, foto 2 de 2');
  assert.match(cap.textContent, /2 \/ 2/);
  lb.close('x');
});

// ── M1 · named groups, one of several ─────────────────────────────────────────────────────────────
test('M1: a single choice is a named radiogroup with one Tab stop; arrows move and choose; a multi choice is a named group', async () => {
  const c = chat(), m = draw(c, '[[gx:plan]]');
  const [nivel, con, extra] = m.querySelectorAll('.lbw-chips');
  assert.equal(nivel.getAttribute('role'), 'radiogroup');
  assert.equal(c.d.getElementById(nivel.getAttribute('aria-labelledby')).textContent, 'Tu nivel');
  assert.equal(extra.getAttribute('role'), 'group'); assert.equal(c.d.getElementById(extra.getAttribute('aria-labelledby')).textContent, 'Extras (elige varios)');
  const r = [...con.children];
  assert.ok(r.every((b) => b.getAttribute('role') === 'radio' && !b.hasAttribute('aria-pressed')));
  assert.deepEqual(r.map((b) => b.tabIndex), [0, -1, -1]);
  r[0].focus(); r[0].dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(c.d.activeElement, r[1]); assert.equal(r[1].getAttribute('aria-checked'), 'true'); assert.deepEqual(r.map((b) => b.tabIndex), [-1, 0, -1]);
  r[1].dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'End', bubbles: true })); assert.equal(r[2].getAttribute('aria-checked'), 'true');
  assert.equal(r[0].getAttribute('aria-checked'), 'false');
});

test('M1: slots: the days and the times are named radiogroups; a busy time reads time first', () => {
  const c = chat(), m = draw(c, '[[gx:cita]]'), [days, times] = m.querySelectorAll('[role="radiogroup"]');
  assert.equal(days.getAttribute('aria-label'), 'Día'); assert.equal(times.getAttribute('aria-label'), 'Elige una hora');
  const busy = times.querySelector('.is-busy'); if (busy) assert.match(busy.getAttribute('aria-label'), /^\d+:\d\d–\d+:\d\d · Ocupado$/);
  assert.equal([...times.children].filter((b) => !b.disabled && b.tabIndex === 0).length, 1);
});

// ── M2 · the not-ready CTA ────────────────────────────────────────────────────────────────────────
test('M2: the not-ready CTA is focusable (aria-disabled); pressing it says what is missing and goes to that group', async () => {
  const c = chat(), m = draw(c, '[[gx:plan]]'); await wait(1100);
  const cta = m.querySelector('.lbw-cta');
  assert.equal(cta.disabled, false); assert.equal(cta.getAttribute('aria-disabled'), 'true'); assert.equal(cta.textContent, '¿Qué nivel tienes?');
  cta.focus(); assert.equal(c.d.activeElement, cta);
  cta.click(); await wait(450);
  assert.equal(c.said().pop(), '¿Qué nivel tienes?'); assert.equal(c.d.activeElement.getAttribute('data-k'), 'suave');
  assert.equal(c.sent.length, 0, 'nothing sent');
  k(m, 'suave').click(); assert.equal(cta.textContent, '¿Con quién vas?');
});

// ── M5–M7 · compare headers, headings, carousel markup ───────────────────────────────────────────
test('M5: compare: the item names are column headers and every cell says its column', () => {
  const c = chat(), m = draw(c, '[[gx:vs ids=urbana,ebike]]'), g = m.querySelector('[role="table"]');
  assert.equal(g.getAttribute('aria-label'), 'Dos bicis frente a frente');
  const hs = [...g.querySelectorAll('[role="columnheader"]')]; assert.deepEqual(hs.map((h) => [h.textContent, h.getAttribute('aria-colindex')]), [['Urbana', '2'], ['Eléctrica', '3']]);
  const row = g.querySelectorAll('[role="row"]')[1]; assert.equal(row.querySelector('[role="rowheader"]').getAttribute('aria-colindex'), '1');
  assert.deepEqual([...row.querySelectorAll('[role="cell"]')].map((x) => x.getAttribute('aria-colindex')), ['2', '3']);
});

test('M6/M7: card titles are level-3 headings, slide names level 4; slides are div listitems in a named list', () => {
  const c = chat(), m = draw(c, '[[gx:bicis]]'), w = m.widgets()[0];
  const t = w.querySelector('.lbw-title'); assert.equal(t.getAttribute('role'), 'heading'); assert.equal(t.getAttribute('aria-level'), '3');
  const st = w.querySelector('.lbw-strip'); assert.equal(st.getAttribute('role'), 'list'); assert.equal(st.getAttribute('aria-label'), 'Para este fin de semana');
  assert.ok([...st.children].every((s) => s.tagName === 'DIV' && s.getAttribute('role') === 'listitem'));
  assert.equal(w.querySelector('.lbw-name').getAttribute('aria-level'), '4');
  const e = draw(c, '[[gx:permiso]]').querySelector('.kit-consent-t'); assert.equal(e.getAttribute('role'), 'heading');
  c.w.LBW.ui.head(c.d.createElement('div'), '', '');   // an empty title is no heading (axe: empty-heading)
});

// ── layout and text spacing (the CSS that fixes them) ────────────────────────────────────────────
test('layout: NPS at a 320 px phone, 44 px table buttons, a review never wider than its card, no ellipsis on badges and slide buttons', () => {
  const css = read('kit/kit.css'), base = read('runtime/lbw.css');
  assert.match(css, /@container lbw \(max-width: 319px\) \{ \.kit-rate\.is-scale\.is-long \{ grid-template-columns: repeat\(4/);
  assert.match(css, /\.kit-tbl \.lbw-pill\.kit-tbl-b \{ min-height: 44px/);
  assert.match(css, /\.kit-rlines \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.kit-rline \{ display: flex; flex-wrap: wrap/);
  const tag = css.slice(css.indexOf('.kit-tag {'), css.indexOf('}', css.indexOf('.kit-tag {')));
  assert.doesNotMatch(tag, /ellipsis|nowrap/);
  const pill = base.slice(base.indexOf('.lbw-slide .lbw-pill {'), base.indexOf('}', base.indexOf('.lbw-slide .lbw-pill {')));
  assert.doesNotMatch(pill, /ellipsis|nowrap/);
  const c = chat(), n = draw(c, '[[gx:nps]]'); assert.ok(n.querySelector('.kit-rate.is-scale.is-long'));
});
