// test/params.test.mjs · typed values in a tag (v0.8.2): a flow's @{field} or a value the agent copied from a source,
// read strictly, shown in any text of the widget and used in formulas. Good, edge and attack values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json } from './helpers.mjs';

const CFG = () => ({
  prefix: 'p', langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', quietMs: 10, links: ['https://tours.example/'],
  widgets: {
    tour: { type: 'cards', money: { cur: '€', after: true, dec: ',', th: '.' },
      params: {
        nota: { type: 'text', max: 40 },
        fecha: { type: 'day', required: true, min: 'today' },
        plazas: { type: 'int', min: 0, max: 99, required: true },
        precio: { type: 'money', max: 100000, required: true },
        zona: { type: 'one', values: ['norte', 'sur'], labels: { norte: { es: 'Norte', en: 'North' }, sur: { es: 'Sur', en: 'South' } }, default: 'norte' },
        hora: { type: 'time' }
      },
      items: { kayak: { title: { es: 'Kayak · {fecha:date}', en: 'Kayak · {fecha:date}' }, rows: [['Plazas', '{plazas}'], ['Precio', '{precio:money}'], ['Zona', '{zona:label}'], ['Hora', '{hora:time}'], ['Nota', '{nota}']], link: ['Reservar ↗', 'https://tours.example/kayak/?d={fecha:dmy}&z={zona}'] } },
      reply: ['Reservar', 'Quiero el kayak del {fecha:dmy}, {precio:money}', { reserva: 'kayak-{fecha:dmy}', plazas: '{plazas}', nota: '{nota}' }] },
    total: { type: 'calc', title: 'Kayak a {precio:money} por persona', cta: 'Enviar', money: { cur: '€', after: true, dec: ',', th: '.' },
      params: { precio: { type: 'money', max: 100000, required: true } },
      state: { n: { min: 1, max: 10, default: 2, int: true } }, controls: [{ stepper: 'n', label: 'Personas' }],
      compute: { importe: 'n * precio' }, result: { total: ['Total', '{importe:money}'] },
      send: { text: 'Somos {n}: {importe:money} ({precio:money} cada uno)', fields: { importe: '{importe}' } } },
    plain: { type: 'cards', items: { a: { title: 'A' } } }
  }
});
function chat(cfg = CFG()) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026';
  // what the clicks sent, as { text, fields } (fields go first, as landbot-custom-data, then the message)
  c.said = () => { const out = []; let f = {}; c.sent.forEach(([k, v]) => { if (k === 'landbot-custom-data') f = v; else { out.push({ text: v.message, fields: f }); f = {}; } }); return out; };
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const rows = (m) => Object.fromEntries([...m.querySelectorAll('.lbw-rows > div, dl > div')].map((r) => [r.querySelector('dt').textContent, r.querySelector('dd').textContent.replace(/ /g, ' ')]));
const errors = (cfg) => [...boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }).LBW.kit.setup.check(cfg)].join('\n');
const GOOD = 'fecha=21/11/2026|plazas=4|precio=34.99|hora=10:30';

test('params: the config is valid', () => {
  assert.equal(errors(CFG()), '');
  assert.deepEqual(chat().result.errors, []);
});

test('params: good values are shown in every text, formatted, and saved with the reply', async () => {
  const c = chat(), m = draw(c, 'Aquí lo tienes [[p:tour id=kayak|nota=Trae agua|' + GOOD + '|lang=es]]');
  const w = m.widgets()[0]; assert.ok(w, 'drawn');
  assert.equal(w.querySelector('.lbw-title, h3, strong').textContent, 'Kayak · sábado, 21 de noviembre');
  assert.deepEqual(rows(m), { Plazas: '4', Precio: '34,99 €', Zona: 'Norte', Hora: '10:30', Nota: 'Trae agua' });
  assert.equal(w.querySelector('a').getAttribute('href'), 'https://tours.example/kayak/?d=21%2F11%2F2026&z=norte');   // encoded in a URL
  w.querySelector('button').click(); await wait(300);
  assert.deepEqual(c.said()[0], { text: 'Quiero el kayak del 21/11/2026, 34,99 €', fields: { reserva: 'kayak-21/11/2026', plazas: '4', nota: 'Trae agua' } });
  assert.ok(!/ /.test(c.said()[0].text));                                                     // a sentence sent has no no-break space
  assert.equal(m.text(), 'Aquí lo tienes');
});

test('params: edge values: unset fields, a default, 0, "34,9", whole cents, another language', async () => {
  const c = chat(), m = draw(c, '[[p:tour id=kayak|nota=@{nota}|zona=@{zona}|fecha=21/11/2026|plazas=0|precio=34,9|hora=@{hora}|lang=en]]');
  assert.deepEqual(rows(m), { Plazas: '0', Precio: '34,90 €', Zona: 'North' });                    // no "Nota" or "Hora" row: unset
  assert.match(m.widgets()[0].textContent, /Saturday, November 21/);
  const r = m.widgets()[0].querySelector('button'); r.click(); await wait(300);
  assert.deepEqual(c.said()[0].fields, { reserva: 'kayak-21/11/2026', plazas: '0' });                 // nota left out, never emptied
  const m2 = draw(c, '[[p:tour id=kayak|fecha=2026-11-21|plazas=12|precio=€ 5|zona=SUR|lang=es]]');
  assert.deepEqual(rows(m2), { Plazas: '12', Precio: '5,00 €', Zona: 'Sur' });
  const cfg = CFG(); cfg.widgets.tour.params.precio.cents = true;
  const m3 = draw(chat(cfg), '[[p:tour id=kayak|fecha=21/11/2026|plazas=1|precio=3499]]');
  assert.equal(rows(m3).Precio, '34,99 €');
});

test('params: a required value that is missing or not valid draws nothing, and says why', () => {
  const bad = [
    ['plazas=100', /bad value plazas=100/],                  // above max: never capped
    ['plazas=4.5', /bad value plazas=4\.5/], ['plazas=4 personas', /plazas/], ['plazas=-1', /plazas/],
    ['plazas=@{plazas}', /plazas is required/],              // a field never set
    ['precio=1.234,50', /bad value precio/], ['precio=34.999', /precio/], ['precio=100000.01', /precio/], ['precio=abc', /precio/],
    ['fecha=31/02/2026', /bad value fecha/], ['fecha=12/11/2026', /bad value fecha/],   // not a date; before today
    ['fecha=', /fecha is required/],
  ];
  for (const [v, why] of bad) {
    const c = chat(), k = v.split('=')[0], vals = GOOD.split('|').filter((x) => !x.startsWith(k + '=')).concat([v]).join('|');
    const m = draw(c, 'Hola [[p:tour id=kayak|' + vals + '|lang=es]]');
    assert.equal(m.widgets().length, 0, v); assert.equal(m.text(), 'Hola', v);
    assert.ok(c.dropped().some((x) => why.test(x)), v + ' → ' + c.dropped().join(' / '));
  }
  // an optional one that isn't valid: its default, or nothing; the card still draws
  const c = chat(), m = draw(c, '[[p:tour id=kayak|' + GOOD + '|zona=este|hora=25:00]]');
  assert.equal(rows(m).Zona, 'Norte'); assert.equal(rows(m).Hora, undefined);
});

test('params: attacks: a smuggled key, markup, braces and a placeholder in a text value', () => {
  const c = chat();
  // a visitor's note "Eve|plazas=99" adds a key; written first, the trusted key after it wins
  const m = draw(c, '[[p:tour nota=Eve|plazas=99|id=kayak|' + GOOD + '|lang=es]]');
  assert.equal(rows(m).Plazas, '4'); assert.equal(rows(m).Nota, 'Eve');
  const m2 = draw(c, '[[p:tour nota=<img src=x onerror=alert(1)> {precio:money} {id}|id=kayak|' + GOOD + ']]');
  assert.equal(m2.querySelector('img'), null);
  assert.equal(rows(m2).Nota, 'img src=x onerror=alert(1) precio:money');                           // text, no brackets, never expanded, cut at 40
  const m3 = draw(c, '[[p:tour nota=' + 'n'.repeat(90) + '|id=kayak|' + GOOD + ']]');
  assert.equal(rows(m3).Nota.length, 40);
  const m4 = draw(c, '[[p:tour id=kayak|' + GOOD + '|zona=norte,sur]]');                           // a list where one is read: the first known
  assert.equal(rows(m4).Zona, 'Norte');
});

test('params: numbers are names in formulas; the calc computes with them', async () => {
  const c = chat(), m = draw(c, '[[p:total precio=20|n=3|lang=es]]'); await wait(20);   // a calc draws its result on a 0 ms timer
  const w = m.widgets()[0]; assert.ok(w);
  assert.match(w.textContent, /Kayak a 20,00\s€ por persona/); assert.match(w.textContent.replace(/ /g, ' '), /Total60,00 €/);
  [...w.querySelectorAll('button')].find((b) => b.textContent === 'Enviar').click(); await wait(300);
  assert.deepEqual(c.said()[0],{ text: 'Somos 3: 60,00 € (20,00 € cada uno)', fields: { importe: '6000' } });
  assert.equal(draw(c, '[[p:total n=3]]').widgets().length, 0);                                       // the price is required
});

test('params: a widget without params is unchanged', () => {
  const c = chat(), m = draw(c, '[[p:plain id=a plazas=4]]');
  assert.equal(m.widgets()[0].textContent, 'A');
});

test('params: check() names what is wrong', () => {
  const bad = (f) => { const cfg = CFG(); f(cfg.widgets.tour.params, cfg.widgets.tour, cfg); return errors(cfg); };
  assert.match(bad((p) => { p.plazas.type = 'integer'; }), /params\.plazas\.type is one of one, list, int/);
  assert.match(bad((p) => { delete p.plazas.max; }), /params\.plazas needs "min" and "max"/);
  assert.match(bad((p) => { p.plazas.default = 2; }), /"required" or a "default", not both/);
  assert.match(bad((p) => { p.zona.default = 'este'; }), /params\.zona\.default is not one of its values/);
  assert.match(bad((p) => { delete p.precio.max; }), /params\.precio\.max is the highest amount in cents/);
  assert.match(bad((p) => { p.nota.max = 1000; }), /from 1 to 300/);
  assert.match(bad((p) => { p.fecha.min = 'tomorrow'; }), /"today" or a date/);
  assert.match(bad((p, w, cfg) => { delete cfg.timeZone; }), /"today" needs "timeZone"/);
  assert.match(bad((p) => { p.nota.limit = 3; }), /params\.nota: unknown key "limit"/);
  assert.match(bad((p) => { p.title = { type: 'text' }; }), /"title" is a name the kit already fills/);
  assert.match(bad((p) => { p.id = { type: 'text' }; }), /already fills|already read/);
  assert.match(bad((p) => { p.zona.param = 'id'; }), /the tag key "id" is already read by this widget/);
  assert.match(bad((p) => { p.zona.param = 'lang'; }), /already read by this widget \(the language\)/);
  assert.match(bad((p) => { p.hora.param = 'plazas'; }), /the tag key "plazas" is read by another param/);
  assert.match(bad((p, w) => { w.items.kayak.rows[0][1] = '{fecha}'; }), /"\{fecha\}" is a day: write \{fecha:date\}/);
  assert.match(bad((p, w) => { w.items.kayak.rows[0][1] = '{precio}'; }), /"\{precio\}" is an amount in cents: write \{precio:money\}/);
  assert.match(bad((p, w) => { w.items.kayak.rows[0][1] = '{plazas:money}'; }), /int param, which takes no format/);
  assert.match(bad((p, w) => { delete p.zona.labels; }), /asks for a label, and params\.zona has no "labels"/);
  assert.match(bad((p, w) => { w.money = { currency: '€' }; }), /money: unknown key "currency"/);
  // the rest of the checks still see the texts: an unknown placeholder in a reply is still caught
  assert.match(bad((p, w) => { w.reply[1] = 'Quiero {tour}'; }), /"\{tour\}" is not a value here/);
  // formulas: a param that isn't a number is not a name
  const c = CFG(); c.widgets.total.params.zona = { type: 'one', values: ['a'], default: 'a' }; c.widgets.total.compute.x = 'zona * 2';
  assert.match(errors(c), /"zona" is not in state or compute/);
  const d = CFG(); d.widgets.total.params.n = { type: 'int', min: 0, max: 3 };
  assert.match(errors(d), /params\.n has the name of a state key/);
});
