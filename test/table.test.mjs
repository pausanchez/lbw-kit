// test/table.test.mjs · v0.8.1.10: a table (a price list, a timetable). Real <table> markup, numbers aligned, rows past
// `fold` behind one button, and `pick`: each row a button that sends a sentence and SAVES fields in Landbot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, wait } from './helpers.mjs';

function setup(widgets) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.result = json(c.w.LBW.kit.setup({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', quietMs: 10, links: ['https://site.example/'], widgets }));
  c.check = (w) => json(c.w.LBW.kit.setup.check({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: ['https://site.example/'], widgets: w }));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const rows = (n) => Array.from({ length: n }, (_, i) => [`${10 + i}:00`, String(20 - i), `${(12 + i).toFixed(2).replace('.', ',')} €`]);
const W = {
  precios: { type: 'table', kicker: { es: 'Tarifas', en: 'Prices' }, items: {
    verano: { title: { es: 'Verano 2027', en: 'Summer 2027' }, cols: [['hab', { es: 'Habitación', en: 'Room' }], ['m2', 'm²', 'end'], ['desde', { es: 'Desde', en: 'From' }, 'end']],
      rows: [['Classic', '21', '120 €'], ['Deluxe Mare', '27', '165 €']], note: { es: 'Precio por noche, IVA incluido.', en: 'Per night, VAT included.' }, source: 'Web del hotel, 12/11/2026', link: ['Tarifas ↗', 'https://site.example/tarifas'] } },
    reply: ['Reservar', 'Quiero reservar con la tarifa {title}', { tarifa: '{id}' }] },
  sesiones: { type: 'table', fold: 4, item: { title: 'Visitas guiadas', cols: [['hora', 'Hora'], ['plazas', 'Plazas', 'end'], ['precio', 'Precio', 'end']], rows: rows(7) },
    pick: { say: { es: 'Quiero la visita de las {hora}', en: 'I want the {hora} tour' }, fields: { visita: '{hora}' }, label: { es: 'Elegir', en: 'Choose' } } }
};

test('table: real table markup, the header as column headers, the first cell as a row header, numbers aligned to the end', async () => {
  const c = setup(W); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:precios id=verano lang=en]]'), tb = m.querySelector('table.kit-tbl');
  assert.equal(tb.querySelector('caption').textContent, 'Summer 2027');
  assert.deepEqual([...tb.querySelectorAll('thead th')].map((x) => [x.textContent, x.getAttribute('scope'), x.className]), [['Room', 'col', ''], ['m²', 'col', 'is-end'], ['From', 'col', 'is-end']]);
  const r = tb.querySelectorAll('tbody tr')[1];
  assert.equal(r.firstElementChild.tagName, 'TH'); assert.equal(r.firstElementChild.getAttribute('scope'), 'row');
  assert.deepEqual([...r.children].map((x) => x.textContent), ['Deluxe Mare', '27', '165 €']);
  await wait(10); const wr = m.querySelector('.kit-tbl-wrap');   // nothing scrolls in jsdom (no layout): no region, no empty tab stop
  assert.equal(wr.getAttribute('role'), null); assert.equal(wr.getAttribute('tabindex'), null);
  assert.equal(m.querySelector('.kit-stat-src').textContent, 'Web del hotel, 12/11/2026');
  assert.equal(draw(c, '[[t:precios id=nope]]').querySelector('.kit-tbl'), null);
  c.close();
});

test('table: a reply saves its fields; rows past fold wait behind one button that says how many', async () => {
  const c = setup(W), m = draw(c, '[[t:precios id=verano]]');
  m.querySelector('.lbw-pill.is-primary').click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { tarifa: 'verano' }], ['landbot-msg-send', { type: 'text', message: 'Quiero reservar con la tarifa Verano 2027' }]]);
  await wait(1300);
  const s = draw(c, '[[t:sesiones]]'), more = s.querySelector('.kit-tbl-more');
  assert.equal(s.querySelectorAll('tbody tr.is-folded').length, 3); assert.equal(more.textContent, 'Ver las 7 filas'); assert.equal(more.getAttribute('aria-expanded'), 'false');
  more.click(); assert.ok(s.querySelector('.kit-tbl').classList.contains('is-open')); assert.equal(more.textContent, 'Ver menos');
  c.close();
});

test('table: never folds a single row (the button would cost what the row costs)', () => {
  const c = setup({ s: { type: 'table', fold: 4, item: { title: 'T', cols: [['a', 'A'], ['b', 'B']], rows: rows(5).map((r) => r.slice(0, 2)) } } });
  const m = draw(c, '[[t:s]]'); assert.equal(m.querySelector('.kit-tbl-more'), null); assert.equal(m.querySelectorAll('.is-folded').length, 0);
  c.close();
});

test('table pick: one tap on a row sends its sentence and SAVES its fields; the row stays marked, the others go quiet', async () => {
  const c = setup(W), m = draw(c, '[[t:sesiones lang=es]]'), b = [...m.querySelectorAll('.kit-tbl-b')];
  assert.equal(b.length, 7); assert.equal(b[2].textContent, 'Elegir'); assert.equal(b[2].getAttribute('aria-label'), 'Elegir: Hora 12:00, Plazas 18, Precio 14,00 €');
  b[2].click(); b[3].click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { visita: '12:00' }], ['landbot-msg-send', { type: 'text', message: 'Quiero la visita de las 12:00' }]]);
  assert.ok(m.querySelector('.kit-tbl-once').classList.contains('is-done'));
  assert.deepEqual([...m.querySelectorAll('tr.is-picked th')].map((x) => x.textContent), ['12:00']);
  assert.equal(b[2].getAttribute('aria-label'), 'Elegido: Hora 12:00, Plazas 18, Precio 14,00 €'); assert.equal(b[2].getAttribute('aria-pressed'), 'true'); assert.equal(b[2].textContent, 'Elegido');
  c.close();
});

test('table pick (critique 0.8.1.11): a folded row picked stays shown; after a pick nothing is left to unfold', async () => {
  const c = setup(W), m = draw(c, '[[t:sesiones lang=es]]'), more = m.querySelector('.kit-tbl-more');
  more.click(); m.querySelectorAll('.kit-tbl-b')[6].click(); await wait(300);
  assert.equal(c.sent[1][1].message, 'Quiero la visita de las 16:00');
  assert.ok(more.hidden); assert.ok(m.querySelector('.kit-tbl').classList.contains('is-open'));
  assert.ok(m.querySelector('tr.is-picked').classList.contains('is-folded'));   // shown by .is-open and by its own rule
  c.close();
});

test('check: a table says what is wrong', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'table', items: { x: { cols: [['a', 'A'], ['b', 'B']], rows: [['1', '2']] } } },
    b: { type: 'table', item: { title: 'T', cols: [['a', 'A']], rows: [['1']] } },
    d: { type: 'table', item: { title: 'T', cols: [['a', 'A'], ['A b', 'B', 'right'], ['a', 'C']], rows: [['1', '2'], ['1', '2', { x: 1 }]] } },
    f: { type: 'table', fold: 1, item: { title: 'T', cols: [['a', 'A'], ['b', 'B']], rows: [['1', '2']], colour: 'red' }, pick: { say: 'Quiero {c}' } },
    g: { type: 'table', item: { title: 'T', cols: [['a', 'A'], ['b', 'B']], rows: rows(31).map((r) => r.slice(0, 2)) }, pick: { say: 'Quiero {a}', fields: { 'Mal campo': '{a}', ok: '{zz}' } } } }).join('\n');
  for (const r of [/a: table "x" has no "title"/, /b: item\.cols holds 2 to 5 columns/, /d: item\.cols\[1\]: the key "A b" is a plain lower-case word/, /d: item\.cols\[1\]: align is "start" or "end"/,
    /d: item\.cols: the key "a" is there twice/, /d: item\.rows\[0\] has 2 values for 3 columns/, /d: item\.rows\[1\]\[2\] must be text/, /f: "fold" is a whole number, 3 or more/, /f: item: unknown key "colour"/,
    /f: pick\.say: "\{c\}" is not a value here/, /f: pick\.fields is missing/, /g: item\.rows holds 1 to 30 rows/, /g: pick\.fields: field "Mal campo" must be a Landbot field name/, /g: pick\.fields: "ok" holds \{zz\}/])
    assert.match(e, r);
  assert.deepEqual(c.check(W), []);
  c.close();
});
