// test/fields.test.mjs · v0.8.1.5: every JSON button that sends a sentence can also SAVE Landbot fields with it (the third
// element of a reply), so a flow can branch on what the visitor clicked, a webhook can send it, and the next card can read it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, wait } from './helpers.mjs';

function setup(widgets, extra = {}) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  const cfg = Object.assign({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', quietMs: 10, links: ['https://shop.example/'], widgets }, extra);
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg))));
  c.check = (w, x) => json(c.w.LBW.kit.setup.check(Object.assign({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: ['https://shop.example/'], widgets: w }, x || {})));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const click = async (c, m, label) => { const b = [...m.querySelectorAll('button')].find((x) => x.textContent === label); assert.ok(b, 'no button ' + label); b.click(); await wait(300); };

const ACTIONS = {
  cancel: { reply: [{ es: 'Anular la cita', en: 'Cancel it' }, { es: 'Quiero anular mi cita', en: 'I want to cancel' }, { estado: 'anulada', cita_motivo: 'visitante' }], danger: true },
  book: { reply: ['Pedir cita', 'Quiero pedir cita', { estado: 'pedida' }], icon: 'calendar', primary: true }
};
const W = {
  booking: { type: 'cards', links: ['cancel'], item: { title: 'Martes 17, 10:00' } },
  repair: { type: 'cards', reply: ['Pedir {title}', 'Quiero pedir {title}', { servicio: '{id}', estado: 'pedida' }], items: { revision: { title: 'Revisión' }, pinchazo: { title: 'Pinchazo' } } },
  team: { type: 'people', reply: ['Llamar a {name}', 'Que me llame {name}', { comercial: '{id}' }], items: { ana: { name: 'Ana Ruiz', role: 'Ventas' } } },
  trust: { type: 'stats', reply: ['Ver más', 'Cuéntame más', { visto: '{id}' }], items: { a: { title: 'Nosotros', stats: [['20', 'años'], ['4.8', 'nota']], source: 'Web, 2026' } } }
};

test('fields: a named action saves its fields with the sentence, in one message', async () => {
  const c = setup(W, { actions: ACTIONS }); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:booking]]'); await click(c, m, 'Anular la cita');
  assert.deepEqual(c.sent, [['landbot-custom-data', { estado: 'anulada', cita_motivo: 'visitante' }], ['landbot-msg-send', { type: 'text', message: 'Quiero anular mi cita' }]]);
  assert.deepEqual(JSON.parse(m.querySelector('[data-store]').getAttribute('data-store')), { estado: 'anulada', cita_motivo: 'visitante' });
  c.close();
});

test('fields: a card\'s reply saves which item it was ({id}, {title}); the language of the tag picks the sentence, not the fields', async () => {
  const c = setup(W, { actions: ACTIONS });
  const m = draw(c, '[[t:repair id=pinchazo lang=en]]'); await click(c, m, 'Pedir Pinchazo');
  assert.deepEqual(c.sent[0], ['landbot-custom-data', { servicio: 'pinchazo', estado: 'pedida' }]);
  assert.equal(c.sent[1][1].message, 'Quiero pedir Pinchazo');
  c.close();
});

test('fields: people and stats replies save theirs too', async () => {
  const c = setup(W, { actions: ACTIONS });
  const p = draw(c, '[[t:team]]'); await click(c, p, 'Llamar a Ana Ruiz');
  await wait(1300);   // the runtime takes one send per 1.2 s (a double click isn't two messages)
  const s = draw(c, '[[t:trust id=a]]'); await click(c, s, 'Ver más');
  assert.deepEqual(c.sent.filter((x) => x[0] === 'landbot-custom-data').map((x) => x[1]), [{ comercial: 'ana' }, { visto: 'a' }]);
  c.close();
});

test('fields: a reply with no third element sends only its sentence, as before', async () => {
  const c = setup({ c: { type: 'cards', links: [{ reply: ['Hola', 'Hola, qué tal'] }], item: { title: 'T' } } });
  const m = draw(c, '[[t:c]]'); await click(c, m, 'Hola');
  assert.deepEqual(c.sent, [['landbot-msg-send', { type: 'text', message: 'Hola, qué tal' }]]);
  c.close();
});

test('check: the fields a reply saves are named as Landbot names them, with text values', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'cards', item: { title: 'T' }, links: [{ reply: ['A', 'B', { 'Mal Nombre': 'x' }] }, { reply: ['C', 'D', { uuid: 'x' }] }, { reply: ['E', 'F', { ok: { nested: 1 } }] }, { reply: ['G', 'H', 'nope'] }],
      reply: ['Pedir', 'Quiero {nope}', { s: '{also}' }] } }, { replies: { r: ['L', 'S', {}] } }).join('\n');
  for (const m of [/field "Mal Nombre" must be a Landbot field name/, /field "uuid" is Landbot's own/, /the value of "ok" must be text/, /the third element is the fields it saves/, /reply\.s.*\{also\}|\{also\}/, /replies\.r: the third element/])
    assert.match(e, m);
  assert.deepEqual(c.check(W, { actions: ACTIONS }), []);
  c.close();
});

test('status: a status the tag names brings its own buttons (and fields); null or [] removes the card\'s', async () => {
  const c = setup({ repair: { type: 'cards', links: ['book'], item: { title: 'Revisión' },
    status: { param: 'estado', items: {
      lista: { text: 'Lista para recoger', tone: 'ok', links: [{ reply: ['Voy a recogerla', 'Voy a recogerla hoy', { estado: 'recogida' }], primary: true }] },
      recogida: { text: 'Recogida', tone: 'ok', links: [] } } } } }, { actions: ACTIONS });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const labels = (m) => [...m.querySelectorAll('.lbw-actions .lbw-pill')].map((b) => b.textContent);
  assert.deepEqual(labels(draw(c, '[[t:repair]]')), ['Pedir cita']);
  assert.deepEqual(labels(draw(c, '[[t:repair estado=recogida]]')), []);
  const m = draw(c, '[[t:repair estado=lista]]'); assert.deepEqual(labels(m), ['Voy a recogerla']);
  await click(c, m, 'Voy a recogerla');
  assert.deepEqual(c.sent[0], ['landbot-custom-data', { estado: 'recogida' }]);
  assert.deepEqual(c.check({ r: { type: 'cards', item: { title: 'T' }, status: { param: 'estado', items: { a: { text: 'A', links: [{ reply: ['x'] }], extra: 1 } } } } }).filter((e) => /status\.items\.a/.test(e)).length >= 2, true);
  c.close();
});

test('review 0.8.1.5: fields keyed like languages stay fields; an action on a card fills {id}; an empty placeholder never wipes a field', async () => {
  const c = setup({ c: { type: 'cards', links: [{ reply: ['A', 'B', { en: 'yes', cita: '{id}', vacio: '{title}x', nada: '{text}' }] }], items: { x: { title: 'X' } } } });
  const m = draw(c, '[[t:c id=x]]'); await click(c, m, 'A');
  assert.deepEqual(c.sent[0], ['landbot-custom-data', { en: 'yes', cita: 'x', vacio: 'Xx' }]);
  assert.ok(c.dropped().some((d) => /field "nada" left out/.test(d)));
  const e = c.check({
    a: { type: 'cards', item: { title: 'T' }, links: [{ reply: ['A', 'B', { en: 'yes' }] }] },
    b: { type: 'people', items: { ana: { name: 'Ana', role: 'R' } }, reply: ['L', 'S', { s: '{nope}' }] },
    d: { type: 'carousel', items: [{ id: 'a', name: 'A', reply: ['Ver', 'Quiero', { s: '{id}' }] }] },
    f: { type: 'cards', item: { title: 'T' }, status: { param: 'estado', items: { k: { text: 'K', reply: ['X {nope}', 'Y'] } } } } }).join('\n');
  assert.doesNotMatch(e, /^a:/m);
  for (const r of [/b: reply: "s" holds \{nope\}/, /d: items\[0\]\.reply: "s" holds \{id\}: this widget saves its values as written/, /f: .*\{nope\}/]) assert.match(e, r);
  c.close();
});
