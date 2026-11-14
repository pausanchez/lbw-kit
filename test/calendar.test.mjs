// test/calendar.test.mjs · v0.10: "type": "calendar". A month grid of availability and prices (from the config, the tag's
// params or a data message), one day or a stay with min/max nights, the kit's own summary, keyboard, sending, late data,
// attacks on the tag's preset, and the checker's sentences. "Today" is pinned to Saturday 14 November 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, wait } from './helpers.mjs';

const BASE = { prefix: 't', langs: ['es', 'en', 'it', 'de', 'fr', 'ca'], defaultLang: 'es', timeZone: 'Europe/Madrid', quietMs: 10, links: [] };
const MONEY = { cur: '€', after: true, dec: ',', th: '.', cents: false };
const W = {
  noches: { type: 'calendar', kicker: 'Cabaña', title: 'Elige tus noches', cta: 'Reservar estas noches', nights: { min: 2, max: 7 }, horizon: 120,
    money: MONEY, priceFrom: true,
    rates: [{ from: '14/11/2026', to: '31/12/2026', price: 189 }, { from: '20/11/2026', to: '22/11/2026', price: 219 }],
    days: [{ date: '21/11/2026', state: 'few', left: 2 }, { date: '26/11/2026', state: 'full' }],
    closed: { weekdays: [1] },
    send: { text: 'Quiero reservar del {from:dmy} al {to:dmy}: {nights} noches, {total:money}', fields: { llegada: '{from:dmy}', salida: '{to:dmy}', noches: '{nights}', importe: '{total:money}' } } },
  mesa: { type: 'calendar', mode: 'single', title: 'Elige un día', cta: 'Pedir mesa', months: 1, notice: 1, closed: { weekdays: [1, 2], dates: ['24/12'] },
    send: { text: 'Quiero mesa el {day:date} ({day:dmy})', fields: { dia: '{day:dmy}' } } }
};
function setup(widgets = W, extra = {}) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '14/11/2026';
  c.result = json(c.w.LBW.kit.setup({ ...BASE, ...extra, widgets }));
  c.check = (w, x = {}) => json(c.w.LBW.kit.setup.check({ ...BASE, ...x, widgets: w }));
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  return c;
}
const draw = (c, tag) => { const m = c.bot('Mira: ' + tag); c.LBW.scan(); return m; };
const day = (m, d, mo = 11, y = 2026) => m.querySelector(`[data-day="${Math.floor(Date.UTC(y, mo - 1, d) / 864e5)}"]`);
const key = (c, el, k) => el.dispatchEvent(new c.w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const cta = (m) => m.querySelector('.lbw-cta');

test('calendar: the config is valid; a real grid per month, Monday first, with names that say the date, price and what is left', async () => {
  const c = setup(); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors)); assert.deepEqual(c.check(W), []);
  const m = draw(c, '[[t:noches]]'), w = m.widgets()[0];
  assert.ok(w.classList.contains('kit-cal') && w.classList.contains('is-two'));
  const grids = w.querySelectorAll('table[role="grid"]');
  assert.equal(grids.length, 2, 'two months drawn; CSS shows the second where the card is wide');
  const cap = w.ownerDocument.getElementById(grids[0].getAttribute('aria-labelledby'));
  assert.equal(cap.textContent, 'Noviembre de 2026');
  assert.deepEqual([...grids[0].querySelectorAll('th')].map((t) => t.getAttribute('aria-label')), ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
  assert.equal(grids[0].querySelectorAll('th')[0].textContent, 'L');
  assert.equal(day(m, 21).getAttribute('aria-label'), 'sábado, 21 de noviembre, 219\u00a0€, quedan 2');
  assert.equal(day(m, 21).querySelector('.kit-cal-p').textContent, '219');
  assert.ok(day(m, 21).classList.contains('is-few'));
  assert.equal(day(m, 26).getAttribute('aria-label'), 'jueves, 26 de noviembre, completo');
  assert.equal(day(m, 26).getAttribute('aria-disabled'), 'true'); assert.equal(day(m, 26).querySelector('.kit-cal-p').textContent, '');
  assert.equal(day(m, 16).getAttribute('aria-label'), 'lunes, 16 de noviembre, cerrado');
  assert.ok(day(m, 13).classList.contains('is-off') && day(m, 13).getAttribute('aria-disabled') === 'true', 'a past day');
  assert.ok(day(m, 14).classList.contains('is-today'));
  // one Tab stop: the first day that can be picked (today), and the cells are buttons inside gridcells
  assert.deepEqual([...w.querySelectorAll('.kit-cal-d[tabindex="0"]')], [day(m, 14)]);
  assert.equal(day(m, 14).parentNode.getAttribute('role'), 'gridcell');
  assert.deepEqual([...w.querySelectorAll('.kit-cal-nav')].map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-disabled')]), [['Mes anterior', 'true'], ['Mes siguiente', 'false']]);
  await wait(20); assert.equal(cta(m).getAttribute('aria-disabled'), 'true');
  // the key says what the dot and the line-through mean (a dot is never colour alone: the names say it too)
  assert.deepEqual([...w.querySelectorAll('.kit-cal-k')].map((k) => k.textContent), ['Precio por noche (€)', 'quedan pocas', 'completo']);
  c.close();
});

test('calendar: two taps make a stay; the kit sums the nights\' own prices and says it in the live region', async () => {
  const c = setup(), m = draw(c, '[[t:noches]]');
  await wait(20);
  assert.equal(cta(m).textContent, 'Elige la llegada');
  day(m, 20).click();
  assert.equal(m.querySelector('.kit-cal-sum').textContent, 'Llegada el vie, 20 nov · Ahora elige la salida');
  assert.equal(day(m, 20).getAttribute('aria-pressed'), 'true'); assert.match(day(m, 20).getAttribute('aria-label'), /, llegada$/);
  assert.equal(cta(m).textContent, 'Ahora elige la salida');
  day(m, 23).click();   // a Monday (closed) can be the day they leave: the nights are 20, 21 and 22
  const sum = m.querySelector('.kit-cal-sum').textContent;
  assert.equal(sum, 'Del 20 al 23 nov · 3 noches · desde 657 €');
  assert.equal(cta(m).getAttribute('aria-disabled'), null); assert.equal(cta(m).textContent, 'Reservar estas noches');
  assert.deepEqual([20, 21, 22, 23].map((d) => day(m, d).parentNode.getAttribute('aria-selected')), ['true', 'true', 'true', 'true']);
  assert.equal(day(m, 24).parentNode.getAttribute('aria-selected'), 'false');
  assert.match(day(m, 23).getAttribute('aria-label'), /cerrado, salida$/);
  await wait(450); assert.ok(c.said().some((s) => s.includes('3 noches · desde 657')), c.said().join(' | '));
  c.close();
});

test('calendar: min and max nights, a closed or full night in between, and a closed day say why and choose nothing', async () => {
  const c = setup(), m = draw(c, '[[t:noches]]'), sum = () => m.querySelector('.kit-cal-sum').textContent, st = () => [...m.querySelectorAll('[aria-pressed="true"]')].map((b) => b.querySelector('.kit-cal-n').textContent);
  day(m, 24).click(); day(m, 25).click();   // one night, two at least
  assert.deepEqual(st(), ['24']); await wait(450); assert.ok(c.said().some((s) => s.includes('Mínimo 2 noches')), c.said().join(' | '));
  day(m, 27).click();   // 24 → 27 crosses the full 26th: the stay starts again at 27
  assert.deepEqual(st(), ['27']); await wait(1100); assert.ok(c.said().some((s) => s.includes('Hay noches sin disponibilidad entre medias')));
  day(m, 29).click(); day(m, 2, 12).click();   // 29 → 2 Dec crosses Monday 30 (closed): the stay starts at 2 Dec
  assert.deepEqual(st(), ['2']);
  day(m, 3, 12).click(); day(m, 12, 12).click();   // 2 → 12 Dec is 10 nights: at most 7
  await wait(1100); assert.ok(c.said().some((s) => s.includes('Máximo 7 noches')), c.said().join(' | '));
  assert.deepEqual(st(), ['2'], 'too short (3 Dec) and too long (12 Dec) keep the check-in');
  // a closed day says why and changes nothing
  const before = st(); day(m, 16).click(); assert.deepEqual(st(), before);
  await wait(1100); assert.ok(c.said().some((s) => s.includes('lunes, 16 de noviembre, cerrado')), c.said().join(' | '));
  assert.equal(day(m, 16).getAttribute('aria-disabled'), 'true');
  c.close();
});

test('calendar: the CTA sends the sentence and saves the dates once, then folds; taps after it change nothing', async () => {
  const c = setup(), m = draw(c, '[[t:noches]]');
  day(m, 20).click(); day(m, 23).click(); cta(m).click(); cta(m).click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { llegada: '20/11/2026', salida: '23/11/2026', noches: '3', importe: '657 €' }],
    ['landbot-msg-send', { type: 'text', message: 'Quiero reservar del 20/11/2026 al 23/11/2026: 3 noches, 657 €' }]]);
  const w = m.widgets()[0];
  assert.ok(w.classList.contains('is-collapsed')); assert.equal(w.querySelector('.kit-sent-t').textContent, 'Quiero reservar del 20/11/2026 al 23/11/2026: 3 noches, 657 €');
  assert.deepEqual(json(c.w.LBW.kit.last.noches.state).nights, 3);
  day(m, 24).click(); assert.equal(day(m, 24).getAttribute('aria-pressed'), null);
  c.close();
});

test('calendar: keyboard: arrows, Home/End, PageUp/PageDown move the one Tab stop and turn the months; Enter picks', async () => {
  const c = setup(), m = draw(c, '[[t:noches]]'), d = c.d, w = m.widgets()[0];
  day(m, 14).focus(); assert.equal(d.activeElement, day(m, 14));
  key(c, day(m, 14), 'ArrowRight'); assert.equal(d.activeElement, day(m, 15));
  key(c, d.activeElement, 'ArrowDown'); assert.equal(d.activeElement, day(m, 22));
  key(c, d.activeElement, 'ArrowUp'); key(c, d.activeElement, 'ArrowLeft'); assert.equal(d.activeElement, day(m, 14));
  key(c, d.activeElement, 'Home'); assert.equal(d.activeElement, day(m, 9));    // Monday of that week (past days are focusable, not pickable)
  key(c, d.activeElement, 'End'); assert.equal(d.activeElement, day(m, 15));    // Sunday
  assert.deepEqual([...w.querySelectorAll('.kit-cal-d[tabindex="0"]')], [day(m, 15)]);
  key(c, d.activeElement, 'PageDown'); assert.equal(d.activeElement, day(m, 15, 12));   // December is already in view
  key(c, d.activeElement, 'PageDown'); assert.equal(d.activeElement, day(m, 15, 1, 2027)); // January: the view turns
  assert.equal(w.querySelector('.kit-cal-cap').textContent, 'Diciembre de 2026');
  await wait(450); assert.ok(c.said().some((s) => s.includes('Diciembre de 2026 · Enero de 2027')), c.said().join(' | '));
  key(c, d.activeElement, 'PageUp'); key(c, d.activeElement, 'PageUp');
  assert.equal(d.activeElement, day(m, 15)); assert.equal(w.querySelector('.kit-cal-cap').textContent, 'Noviembre de 2026');
  key(c, d.activeElement, 'PageUp'); assert.equal(d.activeElement.getAttribute('data-day'), day(m, 1).getAttribute('data-day'), 'never before this month');
  // the month buttons: the previous one is disabled here, but keeps focus; the next one turns the view and keeps focus
  const next = w.querySelector('.kit-cal-nav.is-next'); next.focus(); next.click();
  assert.equal(w.querySelector('.kit-cal-cap').textContent, 'Diciembre de 2026'); assert.ok(d.activeElement.classList.contains('is-next'));
  // a day button is a <button>: Enter and Space are its click
  day(m, 18, 12).click(); assert.equal(day(m, 18, 12).getAttribute('aria-pressed'), 'true');
  c.close();
});

test('calendar: the tag presets a month, a day or a stay; attack values and days that can\'t be picked are ignored', () => {
  const c = setup();
  let m = draw(c, '[[t:noches from=20/11/2026|to=23/11/2026]]');
  assert.equal(m.querySelector('.kit-cal-sum').textContent, 'Del 20 al 23 nov · 3 noches · desde 657 €');
  m = draw(c, '[[t:noches month=2027-01]]');
  assert.equal(m.querySelector('.kit-cal-cap').textContent, 'Enero de 2027');
  m = draw(c, '[[t:noches from=2026-11-20|to=2026-11-21]]');   // one night: below the minimum, so only the check-in
  assert.deepEqual([...m.querySelectorAll('[aria-pressed="true"]')].length, 1);
  for (const bad of ['from=<img src=x onerror=window.__pwned=1>', 'month=javascript:alert(1)', 'month=2026-13', 'from=31/02/2026', 'from=16/11/2026', 'from=1/1/2030', 'from=__proto__', 'to=20/11/2026', 'month=@{mes}']) {
    m = draw(c, '[[t:noches ' + bad + ']]'); const w = m.widgets()[0];
    assert.ok(w, bad); assert.equal(w.querySelectorAll('[aria-pressed="true"]').length, 0, bad);
    assert.equal(w.querySelector('.kit-cal-cap').textContent, 'Noviembre de 2026', bad);
    assert.equal(w.querySelector('img'), null);
  }
  assert.equal(c.w.__pwned, undefined);
  const d = c.dropped().join('\n');
  for (const r of [/noches: bad value from=<img/, /bad value month=javascript/, /bad value month=2026-13/, /bad value from=31\/02\/2026/, /bad value from=16\/11\/2026/, /bad value from=1\/1\/2030/]) assert.match(d, r);
  c.close();
});

test('calendar: one day ("single"), a notice of one day, closed weekdays and dates; the sentence by LBW.day', async () => {
  const c = setup(), m = draw(c, '[[t:mesa]]'), w = m.widgets()[0];
  assert.equal(w.querySelectorAll('table[role="grid"]').length, 1); assert.ok(!w.classList.contains('is-two'));
  assert.equal(day(m, 14).getAttribute('aria-disabled'), 'true', 'today is inside the notice');
  assert.equal(day(m, 17).getAttribute('aria-label'), 'martes, 17 de noviembre, cerrado');
  assert.deepEqual([...w.querySelectorAll('.kit-cal-k')].map((k) => k.textContent), ['quedan pocas', 'completo'], 'no prices: no price line');
  await wait(20); assert.equal(cta(m).textContent, 'Elige un día');
  day(m, 15).click(); assert.equal(m.querySelector('.kit-cal-sum').textContent, 'domingo, 15 de noviembre');
  day(m, 19).click(); assert.equal(m.querySelectorAll('[aria-pressed="true"]').length, 1);
  cta(m).click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { dia: '19/11/2026' }], ['landbot-msg-send', { type: 'text', message: 'Quiero mesa el jueves, 19 de noviembre (19/11/2026)' }]]);
  const m2 = draw(c, '[[t:mesa month=2026-12]]');
  assert.equal(day(m2, 24, 12).getAttribute('aria-label'), 'jueves, 24 de diciembre, cerrado');
  c.close();
});

test('calendar: the kit\'s six languages, with LBW.day\'s dates', () => {
  const c = setup();
  const want = { en: ['Previous month', 'Saturday, November 21, 219 €, 2 left'], it: ['Mese precedente', 'sabato 21 novembre, 219 €, ne restano 2'],
    de: ['Vorheriger Monat', 'Samstag, 21. November, 219 €, noch 2'], fr: ['Mois précédent', 'samedi 21 novembre, 219 €, plus que 2'], ca: ['Mes anterior', 'dissabte, 21 de novembre, 219 €, en queden 2'] };
  for (const [l, [prev, name]] of Object.entries(want)) {
    const m = draw(c, `[[t:noches lang=${l}]]`), w = m.widgets()[0];
    assert.equal(w.getAttribute('lang'), l);
    assert.equal(w.querySelector('.kit-cal-nav').getAttribute('aria-label'), prev);
    assert.equal(day(m, 21).getAttribute('aria-label').replace(/ /g, ' '), name, l);
  }
  const m = draw(c, '[[t:noches lang=en|from=20/11/2026|to=23/11/2026]]');
  assert.equal(m.querySelector('.kit-cal-sum').textContent.replace(/ /g, ' '), 'Nov 20 – Nov 23 · 3 nights · from 657 €');
  c.close();
});

const LIVE = { type: 'calendar', title: 'Cabaña', cta: 'Reservar', money: MONEY, nights: { min: 1 }, rates: [{ from: '14/11/2026', to: '31/12/2026', price: 150 }],
  source: { data: 'temporada', path: 'dias', wait: 30, upgrade: 900, map: { date: '{fecha}', price: '{precio}', state: '{estado}', left: '{quedan}' } },
  send: { text: 'Del {from:dmy} al {to:dmy}', fields: { llegada: '{from:dmy}' } } };
const REPR = "{'dias': [{'fecha': '2026-11-20', 'precio': 199.5, 'estado': 'free', 'quedan': None}, {'fecha': '21/11/2026', 'precio': '229', 'estado': 'few', 'quedan': 1},"
  + " {'fecha': '22/11/2026', 'precio': 229, 'estado': 'full'}, {'fecha': '31/02/2026', 'precio': 1}, {'fecha': '25/11/2026', 'precio': '1.234,50'},"
  + " {'fecha': '27/11/2026', 'precio': 99, 'estado': '<b>x</b>'}, {'fecha': '28/11/2026', 'quedan': 0}]}";

test('calendar: days from a data message: live at once when there, strict rows, and "unlisted": "closed"', () => {
  const c = setup({ cab: LIVE, solo: { ...LIVE, rates: undefined, unlisted: 'closed', source: { ...LIVE.source, upgrade: 0 } } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  c.w.LBW.data.put('temporada', REPR);
  const m = draw(c, '[[t:cab]]');
  assert.equal(day(m, 20).getAttribute('aria-label'), 'viernes, 20 de noviembre, 199,50 €');
  assert.equal(day(m, 20).querySelector('.kit-cal-p').textContent, '199,50');
  assert.equal(day(m, 21).getAttribute('aria-label'), 'sábado, 21 de noviembre, 229 €, queda 1');
  assert.ok(day(m, 22).classList.contains('is-full')); assert.ok(day(m, 28).classList.contains('is-full'), '"quedan": 0 is full');
  assert.ok(day(m, 19).classList.contains('is-free') && day(m, 19).querySelector('.kit-cal-p').textContent === '', 'not in the data, no saved rates under live data: free with no price');
  assert.ok(day(m, 27).classList.contains('is-free') && day(m, 25).querySelector('.kit-cal-p').textContent === '', 'bad rows are skipped');
  const d = c.dropped().join('\n'); assert.match(d, /cab: day skipped/);
  assert.equal(m.querySelector('b'), null);
  const s = draw(c, '[[t:solo]]');
  assert.ok(day(s, 19).classList.contains('is-closed'), 'unlisted: closed'); assert.ok(day(s, 20).classList.contains('is-free'));
  c.close();
});

test('calendar: the saved copy first, then the late data repaints the same cells (focus kept, "Actualizado"); not once a day is picked', async () => {
  const c = setup({ cab: LIVE }), m = draw(c, '[[t:cab]]');
  assert.ok(m.widgets()[0].classList.contains('is-loading'));
  await wait(120);
  const w = m.widgets()[0];
  assert.equal(day(m, 20).querySelector('.kit-cal-p').textContent, '150', 'the saved rates');
  const b = day(m, 20); b.focus();
  c.w.LBW.data.put('temporada', REPR); await wait(1300);
  assert.equal(w.getAttribute('data-lbw-upgraded'), '1');
  assert.equal(day(m, 20).querySelector('.kit-cal-p').textContent, '199,50');
  assert.equal(c.d.activeElement, b, 'the same button, still focused');
  assert.ok(c.said().some((s) => s.startsWith('Actualizado: ')), c.said().join(' | '));
  // picked before the data came: the saved copy stays
  const c2 = setup({ cab: LIVE }), m2 = draw(c2, '[[t:cab]]'); await wait(120);
  day(m2, 18).click();
  c2.w.LBW.data.put('temporada', REPR); await wait(1300);
  assert.equal(m2.widgets()[0].getAttribute('data-lbw-upgraded'), null);
  assert.equal(day(m2, 20).querySelector('.kit-cal-p').textContent, '150');
  assert.match(c2.dropped().join('\n'), /cab: data "temporada" came late; the saved copy stays/);
  c.close(); c2.close();
});

test('calendar: params fill its texts; the same widget twice in a message draws once', () => {
  const c = setup({ cab: { ...W.noches, params: { casa: { type: 'one', values: ['norte', 'sur'], labels: { norte: 'Cabaña Norte', sur: 'Cabaña Sur' }, required: true } }, title: 'Noches en la {casa:label}' } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:cab casa=sur]] [[t:cab casa=norte]]');
  assert.equal(m.widgets().length, 1); assert.equal(m.querySelector('.lbw-title').textContent, 'Noches en la Cabaña Sur');
  assert.equal(draw(c, '[[t:cab casa=este]]').widgets().length, 0, 'a required param that isn\'t valid draws nothing');
  c.close();
});

test('check: a calendar says what is wrong, sentence by sentence', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'calendar', mode: 'week', cta: 'X', nights: { min: 5, max: 2 }, horizon: 900, months: 3, send: { text: 'Del {from} al {to:date}' } },
    b: { type: 'calendar', cta: 'X', rates: [{ from: '1/12/2026', to: '1/11/2026', price: '189 €' }], days: [{ date: '31/02/2026', state: 'lleno' }, { date: '1/12/2026' }, { date: '2/12/2026', left: 2, price: 199 }, { date: '2/12/2026', left: 1.5 }],
      send: { text: '{total} por {nights} noches, {price:money}', fields: { llegada: '{from:dmy}', 'Mal': 'x', z: '{nope}' } } },
    d: { type: 'calendar', mode: 'single', cta: 'X', nights: { min: 1 }, closed: { weekdays: [7], dates: ['31/31'] }, unlisted: 'maybe', send: { text: '{to:dmy} {nights}', fields: { a: '{day:dmy}' } } },
    f: { type: 'calendar', cta: 'X', money: MONEY, unlisted: 'closed', source: { data: 'Mala clave', map: { date: 'fecha', color: '{x}' }, upgrade: 99999 }, params: { nights: { type: 'int', min: 1, max: 9 }, x: { type: 'day', param: 'month' } },
      send: { text: '{from:dmy}', fields: { a: '{from:dmy}' } } },
    g: { type: 'calendar', cta: 'X', unlisted: 'closed', send: { text: '{from:dmy}', fields: { a: '{from:dmy}' } } } }).join('\n');
  for (const r of [/a: "mode" is "range"/, /a: nights: "min" \(5\) is more than "max" \(2\)/, /a: "horizon" is how many days ahead/, /a: "months" is 1 or 2/, /a: send\.text: "\{from\}" is a day: write \{from:date\} or \{from:dmy\}/, /a: send\.fields is required/,
    /b: rates\[0\]: "to" is before "from"/, /b: rates\[0\]\.price is a plain amount/, /b: days\[0\]\.date is a date/, /b: days\[0\]\.state is free, few, full or closed/, /b: days\[1\] says nothing about the day/,
    /b: days\[3\]: 2\/12\/2026 is already in days\[2\]/, /b: days\[3\]\.left is how many are left/, /b: send\.text: "\{total\}" is an amount in cents: write \{total:money\}/, /b: send\.text: "\{price\}" is not a value here/,
    /b: prices need "money"/, /b: send\.fields: field "Mal" must be a Landbot field name/, /b: send\.fields: "z" holds \{nope\}/,
    /d: "nights" is for a range/, /d: closed\.weekdays\[0\] is a weekday, 0 \(Sunday\) to 6/, /d: closed\.dates\[0\] is D\/M/, /d: "unlisted" is "free"/, /d: send\.text: "\{to\}" is not a value here/,
    /f: source\.data "Mala clave" is a key of LBW\.data/, /f: source\.map: unknown key "color"/, /f: source\.map\.date is one column/, /f: source\.upgrade is how long/, /g: "unlisted": "closed" with no "rates", "days" or "source"/,
    /f: params\.nights: "nights" is a name the calendar already fills/, /f: params\.x: the tag key "month" is already read by this widget/])
    assert.match(e, r);
  assert.doesNotMatch(e, /could not be checked/);
  c.close();
});

test('calendar → confirm (v0.10 merge): a pass reads the stay: the check-in big, no time, {to:dmy} {nights} {total:money}, an all-day .ics', async () => {
  const widgets = { ...W, hecho: { type: 'confirm', form: 'noches', style: 'pass', status: 'Reserva pedida', title: 'Cabaña · {nights} noches',
    rows: [['Salida', '{to:dmy}'], ['Total', '{total:money}']] } };
  const c = setup(widgets); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors)); assert.deepEqual(c.check(widgets), []);
  const m = draw(c, '[[t:noches]]'); day(m, 20).click(); day(m, 23).click(); cta(m).click(); await wait(300);
  const p = draw(c, '[[t:hecho]]').widgets()[0];
  assert.ok(p.classList.contains('kit-pass'));
  assert.equal(p.querySelector('.kit-pass-d').textContent, '20');
  assert.equal(p.querySelector('.kit-pass-t'), null, 'a stay has no time');
  assert.match(p.textContent, /Cabaña · 3 noches/); assert.match(p.textContent, /23\/11\/2026/); assert.match(p.textContent, /657\s€/);
  assert.ok(p.querySelector('.kit-pass-cal'), 'add to calendar');
  c.close();
});

test('calendar (v0.10.0.1): one place left says "queda 1", in the singular', () => {
  const w = { ...W, noches: { ...W.noches, days: [{ date: '21/11/2026', state: 'few', left: 1 }, { date: '22/11/2026', state: 'few', left: 3 }] } };
  const c = setup(w), m = draw(c, '[[t:noches]]');
  assert.match(day(m, 21).getAttribute('aria-label'), /queda 1$/); assert.match(day(m, 22).getAttribute('aria-label'), /quedan 3$/);
  c.close();
});
