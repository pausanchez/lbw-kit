// test/live-010.test.mjs · v0.10 "live & numbers": the "Live" chip on cards from live rows, the late-data upgrade as a visible
// moment (what changed flashes and ticks, what didn't stays still, focus and the live region as in v0.9.5), totals that tick,
// and meters on rows with a count. Motion is gated: jsdom has no matchMedia (= no motion), and the tests stub it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

function chat(cfg, { motion = null, hidden = false } = {}) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026';
  if (motion != null) c.w.matchMedia = (q) => ({ matches: motion === 'reduce' && /reduce/.test(q), media: q });
  if (hidden) Object.defineProperty(c.d, 'visibilityState', { get: () => 'hidden', configurable: true });
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); c.put = (k, v) => c.w.LBW.data.put(k, v);
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const errs = (c) => c.result.errors || [];
const base = (widgets) => ({ prefix: 'p', langs: ['es', 'en'], defaultLang: 'es', links: [], widgets });

const TOURS = () => base({
  tour: { type: 'cards', kicker: 'Excursión', source: { data: 'tours', wait: 30, upgrade: 800, map: { title: '{nombre}', rows: [['Precio', '{precio} €'], ['Hora', '{hora}']] } },
    reply: ['Reservar', 'Quiero reservar'], items: { kayak: { title: 'Kayak', rows: [['Precio', '45 €'], ['Hora', '10:00']] } } },
  quieto: { type: 'cards', live: false, source: { data: 'tours', map: { title: '{nombre}' } }, items: { kayak: { title: 'Kayak' } } }
});

// ── the "Live" chip ─────────────────────────────────────────────────────────────────────────────
test('live: a card drawn from the data says "En directo" beside its title; the saved copy and live:false don\'t', async () => {
  const c = chat(TOURS()); assert.deepEqual(errs(c), []);
  c.put('tours', [{ id: 'kayak', nombre: 'Kayak al amanecer', precio: '45', hora: '07:30' }]);
  const m = draw(c, '[[p:tour id=kayak]]'), w = m.widgets()[0], chip = w.querySelector('.lbw-head > .kit-live');
  assert.equal(chip.textContent, 'En directo'); assert.equal(w.getAttribute('data-lbw-live'), '1');
  assert.ok(!chip.classList.contains('is-pulse'), 'no motion in jsdom (no matchMedia): no pulse');
  await wait(450); assert.deepEqual(c.said(), ['Excursión: Kayak al amanecer'], 'the chip is not part of the title the region says');
  assert.equal(draw(c, '[[p:tour id=kayak|lang=en]]').querySelector('.kit-live').textContent, 'Live');
  assert.equal(draw(c, '[[p:quieto id=kayak]]').querySelector('.kit-live'), null, 'live: false');
  const c2 = chat(TOURS()), m2 = draw(c2, '[[p:tour id=kayak]]'); await wait(200);
  assert.equal(m2.querySelector('.lbw-title').textContent, 'Kayak'); assert.equal(m2.querySelector('.kit-live'), null, 'the saved copy is not live');
});

test('live: the words in the kit\'s six languages; the pulse only with motion, two times (under 5 s)', () => {
  const c = chat(TOURS()), L = c.w.LBW.kit.L;
  for (const l of ['en', 'es', 'it', 'de', 'fr', 'ca']) { assert.ok(L[l].live, l); assert.ok(L[l].full, l); }
  const css = read('kit/kit.css'), rule = css.slice(css.indexOf('.kit-live.is-pulse:not(.lbw-played)::after {'), css.indexOf('}', css.indexOf('.kit-live.is-pulse:not(.lbw-played)::after {')));
  assert.match(rule, /animation: kit-pulse 1\.6s [^;]* 2;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.kit-live\.is-pulse::after \{ animation: none; \}/);
  const m = chat(TOURS(), { motion: 'ok' }); m.put('tours', [{ id: 'kayak', nombre: 'K', precio: '1', hora: '1' }]);
  assert.ok(draw(m, '[[p:tour id=kayak]]').querySelector('.kit-live').classList.contains('is-pulse'));
  const r = chat(TOURS(), { motion: 'reduce' }); r.put('tours', [{ id: 'kayak', nombre: 'K', precio: '1', hora: '1' }]);
  assert.ok(!draw(r, '[[p:tour id=kayak]]').querySelector('.kit-live').classList.contains('is-pulse'));
});

test('live: a flow tag\'s params are live only with "live": true (an agent may write them from memory)', () => {
  const card = (live) => ({ type: 'cards', params: { plazas: { type: 'int', min: 0, max: 50, required: true } }, ...(live ? { live: true } : {}), item: { title: 'Hoy', rows: [['Plazas', '{plazas}']] } });
  const c = chat(base({ a: card(true), b: card(false) })); assert.deepEqual(errs(c), []);
  assert.equal(draw(c, '[[p:a plazas=4]]').querySelector('.kit-live').textContent, 'En directo');
  assert.equal(draw(c, '[[p:b plazas=4]]').querySelector('.kit-live'), null);
});

// ── the late-data upgrade as a visible moment ─────────────────────────────────────────────────────
test('upgrade: only what changed flashes (held, no movement, without motion); focus stays; "Actualizado" is said once', async () => {
  const c = chat(TOURS()), m = draw(c, '[[p:tour id=kayak]]'); await wait(400);
  const b = m.querySelector('.lbw-reply'); b.focus();
  c.put('tours', [{ id: 'kayak', nombre: 'Kayak', precio: '39', hora: '10:00' }]); await wait(1000);
  const w = m.widgets()[0], dd = [...w.querySelectorAll('.lbw-rows dd')];
  assert.equal(w.getAttribute('data-lbw-upgraded'), '1'); assert.equal(w.getAttribute('data-lbw-changed'), '1');
  assert.deepEqual(dd.map((x) => x.textContent), ['39 €', '10:00']);
  assert.ok(dd[0].querySelector('.kit-flash.is-still'), 'the price flashes, held (no motion)');
  assert.ok(!dd[1].querySelector('.kit-flash') && !w.querySelector('.lbw-title').classList.contains('kit-flash'), 'the rest stays still');
  assert.ok(w.querySelector('.kit-live'), 'and now it is live');
  assert.equal(c.said().filter((x) => /^Actualizado/.test(x)).length, 1);
  assert.ok(w.contains(c.d.activeElement) && c.d.activeElement.getAttribute('data-say') === 'Quiero reservar', 'focus on the twin');
  await wait(1400); assert.ok(!dd[0].querySelector('.kit-flash'), 'the flash is gone'); assert.equal(dd[0].textContent, '39 €');
  assert.equal(w.querySelectorAll('[aria-live]').length, 0, 'no live region inside a card');
});

test('upgrade: with motion the changed price ticks to its value (the text ends real); a hidden tab gets no flash and no tick', async () => {
  const c = chat(TOURS(), { motion: 'ok' }), m = draw(c, '[[p:tour id=kayak]]'); await wait(400);
  c.put('tours', [{ id: 'kayak', nombre: 'Kayak', precio: '1.245', hora: '10:00' }]);
  const seen = new Set(); const t0 = Date.now();
  while (Date.now() - t0 < 1100) { const d = m.querySelector('.lbw-rows dd'); if (d) seen.add(d.textContent); await wait(16); }
  const dd = m.querySelector('.lbw-rows dd');
  assert.equal(dd.textContent, '1.245 €'); assert.ok(dd.querySelector('.kit-flash') && !dd.querySelector('.is-still'));
  const mid = [...seen].filter((x) => x !== '45 €' && x !== '1.245 €');
  assert.ok(mid.length >= 2, 'intermediate values: ' + [...seen].join(' | '));
  assert.ok(mid.every((x) => /^(\d{1,3}|\d\.\d{3}) €$/.test(x)), 'written as the target writes it: ' + mid.join(' | '));
  const h = chat(TOURS(), { motion: 'ok', hidden: true }), hm = draw(h, '[[p:tour id=kayak]]'); await wait(400);
  h.put('tours', [{ id: 'kayak', nombre: 'Kayak', precio: '50', hora: '10:00' }]); await wait(950);
  const hd = hm.querySelector('.lbw-rows dd'); assert.equal(hd.textContent, '50 €'); assert.ok(!hd.querySelector('.kit-flash'));
});

test('upgrade: other rows altogether flash nothing (the chip and the line say it); a table keeps its unfolded state', async () => {
  const rows = (n, p) => Array.from({ length: n }, (_, i) => ({ hora: `1${i}:00`, plazas: String(p + i) }));
  const c = chat(base({ hoy: { type: 'table', fold: 3, source: { data: 'salidas', wait: 30, upgrade: 800, map: { hora: '{hora}', plazas: '{plazas}' } },
    item: { title: 'Hoy', cols: [['hora', 'Hora'], ['plazas', 'Plazas', 'end']], rows: [['10:00', '—'], ['11:00', '—'], ['12:00', '—'], ['13:00', '—'], ['14:00', '—']] } } }));
  assert.deepEqual(errs(c), []);
  const m = draw(c, '[[p:hoy]]'); await wait(300);
  m.querySelector('.kit-tbl-more').click(); assert.ok(m.querySelector('.kit-tbl.is-open'));
  c.put('salidas', rows(5, 3)); await wait(1000);
  const w = m.widgets()[0];
  assert.ok(w.querySelector('.kit-tbl.is-open'), 'still unfolded'); assert.equal(w.querySelector('.kit-tbl-more').getAttribute('aria-expanded'), 'true');
  assert.equal(w.getAttribute('data-lbw-changed'), '5'); assert.equal(w.querySelectorAll('.kit-flash').length, 5, 'the five counts changed, the hours didn\'t');
  const c2 = chat(base({ hoy: { type: 'table', source: { data: 'salidas', wait: 30, upgrade: 800, map: { hora: '{hora}', plazas: '{plazas}' } },
    item: { title: 'Hoy', cols: [['hora', 'Hora'], ['plazas', 'Plazas', 'end']], rows: [['10:00', '—'], ['11:00', '—']] } } }));
  const m2 = draw(c2, '[[p:hoy]]'); await wait(300);
  c2.put('salidas', [{ hora: '18:00', plazas: '1' }, { hora: '19:00', plazas: '2' }, { hora: '20:00', plazas: '3' }, { hora: '21:00', plazas: '4' }]); await wait(1000);
  assert.equal(m2.querySelectorAll('.kit-flash').length, 0, 'every row new: no flashing');
});

test('upgrade: the carousel\'s live slides keep the strip and get the chip; drawn from the data at once, it has it too', async () => {
  const cfg = base({ bicis: { type: 'carousel', title: 'Bicis', source: { data: 'bicis', wait: 30, upgrade: 800, map: { name: '{n}', price: { now: '{p} €' } } },
    items: [{ id: 'a', name: 'Urbana', price: { now: '20 €' } }, { id: 'b', name: 'Gravel', price: { now: '30 €' } }] } });
  const c = chat(cfg); assert.deepEqual(errs(c), []);
  const m = draw(c, '[[p:bicis]]'); await wait(300);
  assert.equal(m.querySelector('.kit-live'), null);
  m.querySelector('.lbw-strip').focus();
  c.put('bicis', [{ id: 'a', n: 'Urbana', p: '18' }, { id: 'b', n: 'Gravel', p: '30' }]); await wait(1000);
  const w = m.widgets()[0];
  assert.ok(w.querySelector('.kit-live')); assert.equal(w.getAttribute('data-lbw-changed'), '1');
  const prices = [...w.querySelectorAll('.kit-price strong')]; assert.ok(prices[0].querySelector('.kit-flash')); assert.ok(!prices[1].querySelector('.kit-flash'));
  assert.equal(c.d.activeElement, w.querySelector('.lbw-strip'), 'focus stays on the strip');
  const live = chat(cfg); live.put('bicis', [{ id: 'a', n: 'Urbana', p: '18' }]);
  const lm = draw(live, '[[p:bicis]]'); await wait(200); assert.ok(lm.querySelector('.kit-live'), 'drawn from the data');
});

// ── numbers that move ────────────────────────────────────────────────────────────────────────────
const PRESU = () => base({ presu: { type: 'review', kicker: 'Presupuesto', title: 'Revísalo', cta: 'Confirmar',
  state: { ruedas: { values: ['no', 'si'], default: 'no' } }, tables: { extra: { no: 0, si: 103000 } }, compute: { total: '4500 + extra[ruedas]' },
  money: { cur: '€', after: true, cents: false, th: '.' }, lines: [{ label: 'Ruedas', select: 'ruedas', items: [['no', 'No'], ['si', 'Sí']] }],
  total: { label: 'Total', value: '{total:money}' }, send: { text: 'Confirmo {total:money}', fields: { gx: '{total}' } } } });
test('ticks: a review total counts to its new value in ≤ 400 ms; the region says only the final value', async () => {
  const c = chat(PRESU(), { motion: 'ok' }); assert.deepEqual(errs(c), []);
  const m = draw(c, '[[p:presu]]'); await wait(1100);
  const tot = m.querySelector('.kit-rtotal strong'), sel = m.querySelector('select'), seen = [];
  sel.value = 'si'; sel.dispatchEvent(new c.w.Event('change'));
  const t0 = Date.now(); let last = 0; while (Date.now() - t0 < 700) { seen.push(tot.textContent); if (tot.textContent !== '1.075 €') last = Date.now() - t0; await wait(10); }
  assert.equal(tot.textContent, '1.075 €');
  assert.ok(seen.some((x) => x !== '45 €' && x !== '1.075 €'), 'it moved: ' + [...new Set(seen)].join(' | '));
  assert.ok(last <= 480, 'done within ~400 ms (' + last + ' ms)');
  assert.ok(!tot.classList.contains('is-ticking'));
  assert.deepEqual(c.said().filter((x) => /^Total/.test(x)), ['Total 1.075 €'], 'one line, the final value');
  const r = chat(PRESU(), { motion: 'reduce' }), rm = draw(r, '[[p:presu]]'); await wait(1100);
  const rs = rm.querySelector('select'), rt = rm.querySelector('.kit-rtotal strong'); rs.value = 'si'; rs.dispatchEvent(new r.w.Event('change'));
  assert.equal(rt.textContent, '1.075 €', 'reduced motion: at once'); assert.ok(!rt.classList.contains('is-ticking'));
});

test('ticks: tick() reads the text\'s own separators, moves one number only, and always ends on the real text', async () => {
  const c = chat(TOURS(), { motion: 'ok' }), h = c.w.LBW.kit.h, n = c.d.createElement('strong'); c.d.body.appendChild(n);
  const run = async (from, to) => { n.textContent = to; const moved = h.tick(n, from, to), seen = new Set(); for (let i = 0; i < 40; i++) { seen.add(n.textContent); await wait(16); } return [moved, [...seen], n.textContent]; };
  let [mv, seen, end] = await run('1.234,50 €', '2.000,00 €'); assert.ok(mv); assert.equal(end, '2.000,00 €');
  assert.ok(seen.every((x) => /^\d\.\d{3},\d{2} €$/.test(x)), seen.join(' | '));
  [mv, seen, end] = await run('S/ 247.00', 'S/ 99.50'); assert.ok(mv); assert.equal(end, 'S/ 99.50'); assert.ok(seen.every((x) => /^S\/ \d+\.\d{2}$/.test(x)), seen.join(' | '));
  assert.equal(h.tick(n, '2 noches · 300 €', '3 noches · 450 €'), false, 'two numbers changed: no tick');
  assert.equal(h.tick(n, 'Gratis', '30 €'), false); assert.equal(h.tick(n, '30 €', '30 $'), false);
  const hid = chat(TOURS(), { motion: 'ok', hidden: true }), hn = hid.d.createElement('b'); hn.textContent = '9'; assert.equal(hid.w.LBW.kit.h.tick(hn, '1', '9'), false);
});

// ── meters ──────────────────────────────────────────────────────────────────────────────────────
const DISPO = () => base({ dispo: { type: 'cards', live: true,
  params: { doble: { type: 'int', min: 0, max: 99, required: true }, suite: { type: 'int', min: 0, max: 99, required: true }, ind: { type: 'int', min: 0, max: 99, required: true } },
  item: { title: 'Habitaciones hoy', rows: [
    ['Doble', '{doble}', 'doble', 'Completa', { of: 12 }], ['Suite', '{suite}', 'suite', { es: 'Completa', en: 'Full' }, { of: 4, low: 1 }],
    ['Individual', '{ind}', 'ind', null, { of: 6 }], ['Desayuno', 'Incluido'], ['Parking', '0', { of: 10 }]] } } });
test('meters: a row keyed by a number param draws a meter by state; 0 is muted "Completa"; a fixed "0" says the kit\'s word', () => {
  const c = chat(DISPO()); assert.deepEqual(errs(c), []);
  const m = draw(c, '[[p:dispo doble=9|suite=0|ind=0]]'), rs = [...m.querySelectorAll('.lbw-rows > div')];
  assert.deepEqual(rs.map((r) => [r.querySelector('dt').textContent, r.querySelector('dd').firstChild.textContent, r.className]),
    [['Doble', '9', 'kit-m-ok'], ['Suite', 'Completa', 'kit-m-full'], ['Desayuno', 'Incluido', ''], ['Parking', 'Completo', 'kit-m-full']], 'Individual at 0 with null: left out');
  const bar = rs[0].querySelector('.kit-meter');
  assert.equal(bar.getAttribute('role'), 'meter'); assert.equal(bar.getAttribute('aria-valuenow'), '9'); assert.equal(bar.getAttribute('aria-valuemax'), '12');
  assert.equal(bar.getAttribute('aria-valuetext'), '9 de 12'); assert.equal(bar.getAttribute('aria-label'), 'Doble');
  assert.equal(bar.querySelector('i').style.getPropertyValue('--kit-fill'), '0.75');
  assert.ok(rs[1].querySelector('.kit-meter.is-full'));
  const low = draw(c, '[[p:dispo doble=2|suite=1|ind=6]]'); const cls = [...low.querySelectorAll('.lbw-rows > div')].map((r) => r.className);
  assert.deepEqual(cls.slice(0, 3), ['kit-m-low', 'kit-m-low', 'kit-m-ok'], '2 of 12 is low (20 %), 1 of 4 is low (low: 1)');
  assert.equal(draw(c, '[[p:dispo doble=2|suite=0|ind=6|lang=en]]').querySelectorAll('.lbw-rows dd')[1].firstChild.textContent, 'Full');
  const css = read('kit/kit.css');
  assert.match(css, /\.kit-meter > i \{[^}]*transform: scaleX\(var\(--kit-fill, 0\)\)/, 'the fill is a transform');
  assert.match(css, /\.lbw-rows > \.kit-m-full > dt, \.lbw-rows > \.kit-m-full > dd, \.kit-tbl tr\.kit-m-full > th, \.kit-tbl tr\.kit-m-full > td \{ color: var\(--lbw-muted\)/);
});

test('meters: a table\'s "meter" column (capacity a number or a column); a full row is muted and offers no pick', () => {
  const c = chat(base({ hoy: { type: 'table', item: { title: 'Hoy', meter: { col: 'plazas', of: 'aforo', full: 'Completa' },
    cols: [['hora', 'Hora'], ['plazas', 'Plazas', 'end'], ['aforo', 'Aforo', 'end']], rows: [['10:00', '6', '8'], ['12:30', '2', '8'], ['17:00', '0', '8']] },
    pick: { say: 'Quiero la de las {hora}', fields: { gx_hora: '{hora}' }, label: 'Elegir' } } }));
  assert.deepEqual(errs(c), []);
  const m = draw(c, '[[p:hoy]]'), trs = [...m.querySelectorAll('tbody tr')];
  assert.deepEqual(trs.map((t) => t.className), ['kit-m-ok', 'kit-m-low', 'kit-m-full']);
  assert.equal(trs[2].querySelectorAll('td')[0].firstChild.textContent, 'Completa');
  assert.equal(trs[2].querySelector('.kit-tbl-b'), null, 'no pick on a full row'); assert.ok(trs[0].querySelector('.kit-tbl-b'));
  assert.equal(trs[1].querySelector('[role="meter"]').getAttribute('aria-label'), '12:30');
  const same = chat(base({ t: { type: 'table', item: { title: 'T', meter: { col: 'p', of: 10 }, cols: [['h', 'H'], ['r', 'R'], ['p', 'P', 'end']], rows: [['1', 'x', '5'], ['2', 'y', '5'], ['3', 'z', '5']] } } }));
  assert.equal(draw(same, '[[p:t]]').querySelectorAll('[role="meter"]').length, 3, 'a meter column never folds into the "same" line');
});

test('meters and live: setup-check explains every mistake', () => {
  const bad = (w) => { const c = chat(base({ x: w })); return errs(c).join('\n'); };
  const T = (meter) => ({ type: 'table', item: { title: 'T', meter, cols: [['h', 'H'], ['p', 'P']], rows: [['1', '2']] } });
  assert.match(bad(T({ col: 'q', of: 3 })), /x: item\.meter\.col "q" is not one of the columns \(h, p\)/);
  assert.match(bad(T({ col: 'h', of: 3 })), /meter\.col: the first column names the row/);
  assert.match(bad(T({ col: 'p', of: 'nada' })), /meter\.of "nada" is not a column, nor a number over 0/);
  assert.match(bad(T({ col: 'p', of: 0 })), /meter\.of is the capacity: a number over 0/);
  assert.match(bad(T({ col: 'p', of: 5, low: 5 })), /meter\.low \(5\) must be under "of" \(5\)/);
  assert.match(bad(T({ col: 'p', of: 5, max: 5 })), /meter: unknown key "max"/);
  assert.match(bad(T('plazas')), /meter is \{ "col": "plazas", "of": 12 \}/);
  assert.match(bad({ type: 'cards', live: 'yes', items: { a: { title: 'A' } } }), /"live" is true or false/);
  assert.match(bad({ type: 'cards', live: true, items: { a: { title: 'A' } } }), /"live": true needs "params" \(a flow tag's values\) or a "source"/);
  assert.match(bad({ type: 'cards', items: { a: { title: 'A', rows: [['P', '3', { de: 9 }]] } } }), /rows\[0\]\[2\]: unknown key "de"[\s\S]*rows\[0\]\[2\]\.of is missing/);
  assert.match(bad({ type: 'contact', title: 'C', rows: [['P', '3', { of: 9 }]] }), /rows\[0\]: a meter row \(\[label, value, \{ "of": … \}\]\) is drawn on cards only/);
  assert.match(bad({ type: 'cards', params: { n: { type: 'int' } }, item: { title: 'A', rows: [['P', '{n}', 'n', 'Llena', { of: -1 }]] } }), /rows\[0\]\[4\]\.of is the capacity/);
  assert.match(bad({ type: 'cards', params: { n: { type: 'int' } }, item: { title: 'A', rows: [['P', '{n}', 'n', 3, { of: 4 }]] } }), /rows\[0\]\[3\] must be text: what the row says while n is 0 \("Completa"\), or null to leave the row out/);
  assert.equal(bad({ type: 'cards', source: { data: 'd', map: { title: '{t}', rows: [['Plazas', '{p}', { of: '{aforo}' }]] } }, items: { a: { title: 'A' } } }), '', 'a data row may carry a meter');
});

// ── v0.9.5 accessibility, kept ──────────────────────────────────────────────────────────────────────
test('a11y kept: one region, no aria-live in cards, the chip outside the heading, focus never on <body> after an upgrade', async () => {
  const c = chat(TOURS(), { motion: 'ok' }), m = draw(c, '[[p:tour id=kayak]]'); await wait(400);
  m.querySelector('.lbw-title').setAttribute('tabindex', '-1'); m.querySelector('.lbw-title').focus();
  c.put('tours', [{ id: 'kayak', nombre: 'Kayak 2', precio: '50', hora: '11:00' }]); await wait(1000);
  const w = m.widgets()[0];
  assert.notEqual(c.d.activeElement, c.d.body); assert.ok(w.contains(c.d.activeElement));
  assert.equal(c.d.querySelectorAll('.lbw-live').length, 1); assert.equal(w.querySelectorAll('[aria-live]').length, 0);
  assert.ok(!w.querySelector('[role="heading"]').contains(w.querySelector('.kit-live')));
  assert.equal(c.said().filter((x) => /Actualizado/.test(x)).length, 1);
});
