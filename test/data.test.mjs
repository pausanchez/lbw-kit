// test/data.test.mjs · widgets drawn from LBW.data (v0.8.2): a flow's Code block hands rows to the chat, a tag draws them.
// Object and JSON-text input, malformed input → the saved copy, late data, every cell untrusted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json } from './helpers.mjs';

const CFG = () => ({
  prefix: 'p', langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', links: ['https://tours.example/'],
  widgets: {
    tour: { type: 'cards', kicker: 'Excursión',
      source: { data: 'tours', path: 'data.tours', map: { title: '{nombre}', line: '{desc}', rows: [['Plazas', '{plazas}'], ['Precio', '{precio} €']], link: ['Ver ↗', '{url}'] } },
      items: { kayak: { title: 'Kayak (copia guardada)' } } },
    horario: { type: 'table', params: { src: { type: 'one', values: ['horario_sab', 'horario_dom'], required: true } },
      source: { data: { param: 'src' }, map: { hora: '{hora}', plazas: '{libres}', precio: '{precio} €' } },
      item: { title: 'Salidas', cols: [['hora', 'Hora'], ['plazas', 'Plazas', 'end'], ['precio', 'Precio', 'end']], rows: [['10:00', '—', '—']] },
      pick: { say: 'Quiero la salida de las {hora}', fields: { salida: '{hora}' } } },
    rutas: { type: 'carousel', title: 'Rutas', source: { data: 'rutas', map: { name: '{name}', sub: '{sub}', price: { now: '{precio} €' } } }, items: [{ id: 'a', name: 'Ruta guardada' }] },
    equipo: { type: 'people', source: { data: 'equipo', map: { name: '{nombre}', role: '{cargo}', img: '{foto}' } } },
    cifras: { type: 'stats', item: { title: 'Hoy', stats: [['—', 'Ocupación'], ['—', 'Salidas']], source: 'Copia' },
      source: { data: 'cifras', map: { stats: [['{ocupacion} %', 'Ocupación'], ['{salidas}', 'Salidas']], source: 'Sistema de reservas, {hora}' } } },
    vs: { type: 'compare', rows: [['dep', 'Sale'], ['precio', 'Desde', 'is-strong']], source: { data: 'tours', path: 'data.tours', map: { name: '{nombre}', values: { dep: '{sale}', precio: '{precio} €' } } } }
  }
});
const TOURS = { data: { tours: [
  { id: 'kayak', nombre: 'Kayak al amanecer', desc: 'Dos horas por la bahía', plazas: 4, precio: '34,99', url: 'https://tours.example/kayak/', sale: '07:30' },
  { id: 'barco', nombre: 'Barco y baño', plazas: 0, precio: '', url: 'https://evil.example/', sale: '10:00' },
  { id: 'Bad Id', nombre: 'Malo' }, { id: 'kayak', nombre: 'Repetido' }, { id: 'sin-nombre', desc: 'x' }
] } };
function chat(cfg = CFG()) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026';
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); c.put = (k, v) => c.w.LBW.data.put(k, v); return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const title = (m) => (m.querySelector('.lbw-title') || {}).textContent;
const rows = (m) => Object.fromEntries([...m.querySelectorAll('dl > div')].map((r) => [r.querySelector('dt').textContent, r.querySelector('dd').textContent]));
const errors = (cfg) => [...boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }).LBW.kit.setup.check(cfg)].join('\n');

test('data: the config is valid', () => { assert.equal(errors(CFG()), ''); assert.deepEqual(chat().result.errors, []); });

test('data: LBW.data takes an object, a list or a JSON text, keeps a copy, and refuses the rest', () => {
  const c = chat(), D = c.w.LBW.data, o = { a: [1, 2] };
  assert.equal(D.put('x', o), true); o.a.push(3); assert.deepEqual(json(D.get('x')), { a: [1, 2] });   // a copy
  assert.equal(D.put('x', '[{"id":"a"}]'), true); assert.deepEqual(json(D.get('x')), [{ id: 'a' }]);
  assert.equal(D.put('x', JSON.stringify(JSON.stringify({ b: 1 }))), true); assert.deepEqual(json(D.get('x')), { b: 1 });   // written twice
  for (const bad of ['{bad', '[object Object]', "{'a': 1}", '42', 42, null, 'x'.repeat(600000)]) { assert.equal(D.put('y', bad), false, String(bad).slice(0, 20)); assert.equal(D.get('y'), undefined); }
  assert.equal(D.put('Bad Key', {}), false); assert.equal(D.put('__proto__', {}), false);
  assert.ok(c.dropped().some((x) => /data: "y" is unreadable \(not JSON\)/.test(x)));
});

test('data: a card from rows already there (an object), mapped; a cell outside "links" is not a link', () => {
  const c = chat(); c.put('tours', TOURS);
  const m = draw(c, 'Mira [[p:tour id=kayak lang=es]]');
  assert.equal(m.widgets().length, 1); assert.ok(!m.widgets()[0].classList.contains('is-loading'));   // drawn at once
  assert.equal(title(m), 'Kayak al amanecer'); assert.deepEqual(rows(m), { Plazas: '4', Precio: '34,99 €' });
  assert.equal(m.querySelector('a').getAttribute('href'), 'https://tours.example/kayak/');
  const m2 = draw(c, '[[p:tour id=barco]]');
  assert.deepEqual(rows(m2), { Plazas: '0' });                                                     // an empty cell: no "Precio  €"
  assert.equal(m2.querySelector('a'), null);                                                        // a link outside "links"
  assert.equal(draw(c, 'x [[p:tour id=bad_id]]').widgets().length, 0);                              // a skipped row is not an id
  assert.ok(c.dropped().some((x) => /tour: source row skipped \(id "Bad Id"\)/.test(x)));
  assert.ok(c.dropped().some((x) => /no title, id "sin-nombre"/.test(x)));
  assert.equal(draw(c, 'Hola [[p:tour id=velero]]').text(), 'Hola');                               // an unknown id draws nothing
});

test('data: the same from a JSON text; malformed data → the saved copy; no saved copy → nothing', () => {
  const c = chat(); c.put('tours', JSON.stringify(TOURS));
  assert.equal(title(draw(c, '[[p:tour id=kayak]]')), 'Kayak al amanecer');
  for (const bad of ['{"data":{"tours":"pronto"}}', '{"error":"401"}', '{"data":{"tours":[]}}', '[{"nombre":"sin id"}]']) {
    const c2 = chat(); c2.put('tours', bad);
    assert.equal(title(draw(c2, '[[p:tour id=kayak]]')), 'Kayak (copia guardada)', bad);
    assert.ok(c2.dropped().some((x) => /tour: data "tours": .*\(the saved copy\)/.test(x)), bad);
  }
  const cfg = CFG(); delete cfg.widgets.tour.items; const c3 = chat(cfg); c3.put('tours', '{"error":1}');
  const m = draw(c3, 'Te cuento [[p:tour id=kayak]]'); assert.equal(m.widgets().length, 0); assert.equal(m.text(), 'Te cuento');
});

test('data: late data: a skeleton, then the rows; never → the saved copy after "wait"; unreadable → at once', async () => {
  const c = chat(), m = draw(c, '[[p:tour id=kayak]]');
  assert.ok(m.widgets()[0].classList.contains('is-loading'));
  setTimeout(() => c.put('tours', TOURS), 30); await wait(80);
  const w = m.widgets()[0]; assert.ok(!w.classList.contains('is-loading')); assert.equal(title(m), 'Kayak al amanecer');
  assert.equal(w.getAttribute('data-widget'), 'tour'); assert.ok(w.classList.contains('kit-card'));
  const cfg = CFG(); cfg.widgets.tour.source.wait = 50; const c2 = chat(cfg), m2 = draw(c2, '[[p:tour id=kayak]]');
  await wait(100); assert.equal(title(m2), 'Kayak (copia guardada)');
  const c3 = chat(), m3 = draw(c3, '[[p:tour id=kayak]]'); c3.put('tours', 'nope'); await wait(10);
  assert.equal(title(m3), 'Kayak (copia guardada)');
  delete cfg.widgets.tour.items; const c4 = chat(cfg), m4 = draw(c4, 'Hola [[p:tour id=kayak]]'); await wait(100);
  assert.equal(m4.widgets().length, 0); assert.equal(m4.text(), 'Hola');
});

test('data: a table whose rows come from the data the tag names; the saved rows otherwise', async () => {
  const c = chat(); c.put('horario_sab', [{ hora: '10:00', libres: 12, precio: 14 }, { hora: '12:00', libres: '', precio: 14 }, { hora: '<b>17:00</b>', libres: 3, precio: 12 }, {}, 'junk']);
  const m = draw(c, '[[p:horario src=horario_sab]]');
  const cells = [...m.querySelectorAll('tbody tr')].map((r) => [...r.children].slice(0, 3).map((x) => x.textContent));
  assert.deepEqual(cells, [['10:00', '12', '14 €'], ['12:00', '', '14 €'], ['<b>17:00</b>', '3', '12 €']]);   // markup is text; an empty row is left out
  assert.ok(draw(c, '[[p:horario src=horario_dom]]').widgets()[0].classList.contains('is-loading'));   // not there yet: a skeleton
  assert.equal(draw(c, 'x [[p:horario src=otra]]').widgets().length, 0);                            // a key not in the list: nothing
  assert.equal(draw(c, 'x [[p:horario]]').widgets().length, 0);                                     // required
  await wait(1600);                                                                                 // horario_dom never came: the saved row
  const saved = [...c.chat.querySelectorAll('[data-widget="horario"]')][1];
  assert.deepEqual([...saved.querySelectorAll('tbody tr')].map((r) => r.children[0].textContent), ['10:00']);
});

test('data: a carousel, a people card, stats and a compare from LBW.data', async () => {
  const c = chat();
  c.put('rutas', [{ id: 'r1', name: 'Ruta del faro', sub: '2 h', precio: 15 }, { id: 'r2', name: 'x'.repeat(400) }]);
  c.put('equipo', [{ id: 'ana', nombre: 'Ana Ruiz', cargo: 'Guía', foto: 'https://tours.example/ana.jpg' }, { id: 'bo', nombre: 'Bo', cargo: 'Patrón', foto: 'javascript:alert(1)' }]);
  c.put('cifras', { ocupacion: 82, salidas: '', hora: '10:05' });
  c.put('tours', TOURS);
  const m = draw(c, '[[p:rutas]] [[p:equipo]] [[p:cifras]]'); await wait(20);
  const names = [...m.querySelectorAll('.lbw-name')].map((x) => x.textContent);
  assert.equal(names[0], 'Ruta del faro'); assert.equal(names[1].length, 300);                      // cut at 300
  assert.deepEqual([...m.querySelectorAll('.kit-person strong')].map((x) => x.textContent), ['Ana Ruiz', 'Bo']);
  assert.equal(m.querySelectorAll('.kit-person img').length, 1);                                     // the javascript: photo is refused (initials)
  assert.deepEqual([...m.querySelectorAll('.kit-stat strong')].map((x) => x.textContent), ['82 %']);  // the empty stat is left out alone
  assert.match(m.querySelector('.kit-stat-src').textContent, /Sistema de reservas, 10:05/);
  const v = draw(c, '[[p:vs ids=kayak,barco]]');
  assert.deepEqual([...v.querySelectorAll('.kit-cmp-row.is-head .kit-cmp-cell')].map((x) => x.textContent), ['Kayak al amanecer', 'Barco y baño']);
  assert.match(v.textContent, /07:30/); assert.match(v.textContent, /34,99 €/);
});

test('data: params and data together: the tag names the key, and values show beside the rows', () => {
  const cfg = CFG(); cfg.widgets.horario.kicker = 'Día {src:label}'; cfg.widgets.horario.params.src.labels = { horario_sab: 'sábado', horario_dom: 'domingo' };
  const c = chat(cfg); c.put('horario_dom', [{ hora: '09:00', libres: 2, precio: 10 }]);
  const m = draw(c, '[[p:horario src=horario_dom]]');
  assert.match(m.textContent, /Día domingo/); assert.equal(m.querySelector('tbody td').textContent, '2');
});

test('data: check() names what is wrong in a data source', () => {
  const bad = (name, f) => { const cfg = CFG(); f(cfg.widgets[name], cfg); return errors(cfg); };
  assert.match(bad('tour', (w) => { w.source.data = 'Tours'; }), /source\.data "Tours" is a key of LBW\.data/);
  assert.match(bad('tour', (w) => { delete w.source.data; }), /source\.data is missing/);
  assert.match(bad('tour', (w) => { w.source.json = 'https://x.example/'; }), /source: unknown key "json"/);
  assert.match(bad('tour', (w) => { w.source.map.reply = ['Pedir', '{nombre}']; }), /can't fill "reply" or "fields"/);
  assert.match(bad('tour', (w) => { w.source.map.title = 'Fijo'; }), /source\.map\.title must name a column/);
  assert.match(bad('tour', (w) => { w.source.map.price = '{precio}'; }), /source\.map: unknown key "price"/);
  assert.match(bad('tour', (w) => { w.source.map.rows = [['Plazas']]; }), /source\.map\.rows\[0\] is \[text, text\]/);
  assert.match(bad('tour', (w) => { w.source.map.line = '{a b}'; }), /"\{a b\}" is not a column name/);
  assert.match(bad('tour', (w) => { w.source.wait = 20000; }), /source\.wait .* 0 to 8000/);
  assert.match(bad('tour', (w) => { w.source.merge = true; delete w.items; }), /source\.merge needs saved items/);
  assert.match(bad('horario', (w) => { w.source.data = { param: 'zona' }; }), /names a param of type "one"/);
  assert.match(bad('horario', (w) => { w.source.map.foo = '{x}'; }), /source\.map: unknown key "foo"/);
  assert.match(bad('horario', (w) => { w.items = { a: w.item }; delete w.item; }), /a table with a "source" is one table/);
  assert.match(bad('horario', (w) => { w.source.id = 'hora'; }), /need no id column/);
  assert.match(bad('vs', (w) => { w.source.map.values.vista = '{v}'; }), /source\.map\.values\.vista is not one of the rows/);
  assert.match(bad('rutas', (w) => { w.source.csv = 'https://x.example/a.csv'; }), /one of "csv" or "json"/);
  assert.match(bad('equipo', (w) => { delete w.source.map.role; }), /source\.map\.role must name a column/);
  assert.match(bad('equipo', (w) => { delete w.source; }), /"items" must be an object of people by id/);
});
