// test/tracker.test.mjs · v0.10: "type": "tracker", a step timeline whose current step the tag names (a flow writes
// estado=@{estado}). States, tones, the default, the eta, actions with fields, the update rule, live data, attacks, the checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, wait } from './helpers.mjs';

const BASE = { prefix: 't', langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', quietMs: 10, links: ['tel:'] };
const W = () => ({
  bici: { type: 'tracker', kicker: 'Taller', title: 'Tu reparación', default: 'recibida',
    ref: { param: 'orden', label: 'Orden' }, eta: { day: 'dia', time: 'hora', text: { es: 'Lista {when}', en: 'Ready {when}' } }, live: 'orden_live',
    steps: [
      { key: 'recibida', label: { es: 'Recibida', en: 'Received' }, time: '{entrada:time}' },
      { key: 'diagnostico', label: 'Diagnóstico', detail: 'Te llamamos si hay algo más' },
      { key: 'taller', label: 'En el taller' },
      { key: 'lista', label: 'Lista para recoger', actions: [{ reply: ['Voy a recogerla', 'Voy a recoger la bici {ref}', { estado: 'recogida', orden: '{ref}', paso: '{step}' }], primary: true, icon: 'check' }] },
      { key: 'entregada', label: 'Entregada' }],
    states: [
      { key: 'pieza', at: 'taller', text: 'Retrasado: esperando una pieza', actions: [{ reply: ['Avisadme', 'Avisadme cuando llegue la pieza'] }] },
      { key: 'anulada', end: true, text: 'Reparación anulada' },
      { key: 'rechazada', end: true, at: 'diagnostico', text: 'No se puede reparar', tone: 'danger' }],
    params: { entrada: { type: 'time' } },
    links: [{ tel: '600 000 000', cc: '34', label: 'Llamar' }] },
  cita: { type: 'tracker', title: 'Tu cita', steps: [{ key: 'pedida', label: 'Pedida' }, { key: 'confirmada', label: 'Confirmada' }] }
});
function setup(widgets = W()) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.w.__lbwToday = '16/11/2026'; c.w.__lbwNow = '12:00';
  c.result = json(c.w.LBW.kit.setup({ ...BASE, widgets }));
  c.check = (w) => json(c.w.LBW.kit.setup.check({ ...BASE, widgets: w }));
  return c;
}
const draw = (c, tag, text = 'Así va: ') => { const m = c.bot(text + tag); c.LBW.scan(); return m; };
const steps = (t) => [...t.querySelectorAll('.kit-trk-step')].map((li) => li.className.replace('kit-trk-step ', '') + (li.getAttribute('aria-current') === 'step' ? '*' : ''));
const status = (t) => { const s = t.querySelector('.kit-statusbar'); return [s.textContent, s.className.match(/is-(\w+)/)[1]]; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test('tracker: the config is valid; an ordered list, the current step aria-current, every step its state in words', async () => {
  const c = setup(); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const t = draw(c, '[[t:bici orden=RN-2318|estado=taller|entrada=9:30|lang=es]]').widgets()[0];
  assert.equal(t.querySelector('ol.kit-trk-steps').getAttribute('aria-label'), 'Pasos');
  assert.deepEqual(steps(t), ['is-past', 'is-past', 'is-now*', 'is-next', 'is-next']);
  assert.deepEqual([...t.querySelectorAll('.kit-trk-step .kit-sr')].map((x) => x.textContent), [' (hecho)', ' (hecho)', ' (ahora)', ' (pendiente)', ' (pendiente)']);
  assert.ok(t.querySelectorAll('.is-past .kit-trk-dot svg').length === 2, 'past steps carry a ✓, not only a colour');
  assert.deepEqual(status(t), ['En el taller', 'info']);
  assert.equal(t.querySelector('.lbw-head .kit-tag').textContent, 'Orden RN-2318');
  assert.equal(t.querySelector('.kit-trk-t').textContent, '9:30', 'a step time from a param');
  assert.equal(t.querySelector('.is-next .kit-trk-d'), null, 'a future step keeps its detail for later');
  assert.equal(t.querySelector('.kit-trk-acts'), null); assert.equal(t.querySelector('.lbw-actions a[href^="tel:"]').textContent, 'Llamar');
  const en = draw(c, '[[t:bici estado=recibida|lang=en]]').widgets()[0];
  assert.equal(en.querySelector('.kit-trk-l').textContent, 'Received'); assert.equal(en.querySelector('ol').getAttribute('aria-label'), 'Steps');
  c.close();
});

test('tracker: done, a delay (warn) and an end (danger), with tones, icons and no eta at the end', () => {
  const c = setup();
  const done = draw(c, '[[t:bici estado=entregada|hora=18:00]]').widgets()[0];
  assert.deepEqual(steps(done), ['is-past', 'is-past', 'is-past', 'is-past', 'is-past*']); assert.deepEqual(status(done), ['Entregada', 'ok']);
  assert.equal(done.querySelector('.kit-trk-eta'), null, 'no eta once it is over');
  const late = draw(c, '[[t:bici estado=pieza|hora=18:00]]').widgets()[0];
  assert.deepEqual(steps(late), ['is-past', 'is-past', 'is-now is-warn*', 'is-next', 'is-next']); assert.deepEqual(status(late), ['Retrasado: esperando una pieza', 'warn']);
  assert.ok(late.querySelector('.is-warn .kit-trk-dot svg')); assert.equal(late.querySelector('.kit-trk-acts button').textContent, 'Avisadme');
  const off = draw(c, '[[t:bici estado=anulada]]').widgets()[0];
  assert.deepEqual(steps(off), ['is-next', 'is-next', 'is-next', 'is-next', 'is-next']); assert.deepEqual(status(off), ['Reparación anulada', 'danger']);
  const no = draw(c, '[[t:bici estado=rechazada]]').widgets()[0];
  assert.deepEqual(steps(no), ['is-past', 'is-now is-danger*', 'is-next', 'is-next', 'is-next']);
  c.close();
});

test('tracker: an unset or unknown @{estado} draws the default; with no default it draws nothing (logged)', () => {
  const c = setup();
  for (const v of ['@{estado}', '', 'Visitor #123', 'enviada']) assert.deepEqual(steps(draw(c, `[[t:bici orden=RN-1|estado=${v}]]`).widgets()[0])[0], 'is-now*', v);
  assert.ok(c.dropped().some((d) => d.includes('estado=enviada')));
  assert.equal(draw(c, '[[t:cita estado=@{estado}]]').widgets().length, 0);
  assert.equal(draw(c, '[[t:cita estado=perdida]]').widgets().length, 0);
  assert.deepEqual(steps(draw(c, '[[t:cita estado=Confirmada]]').widgets()[0]), ['is-past', 'is-past*'], 'case and - do not matter');
  c.close();
});

test('tracker: the eta says today, tomorrow or the day, with the time; a past or broken one is left out', () => {
  const c = setup(), eta = (tag) => { const t = draw(c, tag).widgets()[0], e = t.querySelector('.kit-trk-eta'); return e ? e.textContent : null; };
  assert.equal(eta('[[t:bici estado=taller|hora=18:00|lang=es]]'), 'Lista hoy a las 18:00');
  assert.equal(eta('[[t:bici estado=taller|dia=17/11/2026|lang=es]]'), 'Lista mañana');
  assert.match(eta('[[t:bici estado=taller|dia=2026-11-21|hora=9.30|lang=es]]'), /^Lista el sábado, 21 de noviembre a las 9:30$/);
  assert.equal(eta('[[t:bici estado=taller|hora=18:00|lang=en]]'), 'Ready today at 18:00');
  assert.equal(eta('[[t:bici estado=taller|hora=11:00]]'), null, 'earlier today: passed');
  assert.equal(eta('[[t:bici estado=taller|dia=15/11/2026]]'), null, 'yesterday');
  assert.equal(eta('[[t:bici estado=taller|dia=31/02/2026|hora=25:99]]'), null);
  assert.ok(c.dropped().some((d) => d.includes('hora=25:99')) && c.dropped().some((d) => d.includes('eta has passed')));
  c.close();
});

test('tracker: the step\'s actions send their sentence and SAVE their fields, with {ref} and {step}', async () => {
  const c = setup(), t = draw(c, '[[t:bici orden=RN-2318|estado=lista]]').widgets()[0], b = t.querySelector('.kit-trk-acts button');
  assert.equal(b.textContent, 'Voy a recogerla'); assert.ok(b.classList.contains('is-primary') && b.querySelector('svg'));
  b.click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { estado: 'recogida', orden: 'RN-2318', paso: 'lista' }], ['landbot-msg-send', { type: 'text', message: 'Voy a recoger la bici RN-2318' }]]);
  assert.ok(t.querySelector('.kit-trk-acts').classList.contains('is-done'));
  // no ref in the tag: the field it would fill is left out, never saved empty
  const n = draw(c, '[[t:bici estado=lista]]').widgets()[0]; assert.equal(n.querySelector('.lbw-head .kit-tag'), null);
  assert.equal(n.querySelector('.kit-trk-acts button').getAttribute('data-store'), JSON.stringify({ estado: 'recogida', paso: 'lista' }));
  c.close();
});

test('tracker: the newest tracker of a ref is the live one; the earlier one says "Actualizado" and its actions go quiet', async () => {
  const c = setup();
  const a = draw(c, '[[t:bici orden=RN-2318|estado=pieza]]').widgets()[0], other = draw(c, '[[t:bici orden=RN-9999|estado=taller]]').widgets()[0];
  await tick();
  assert.equal(a.querySelector('.kit-trk-upd'), null);
  const b = draw(c, '[[t:bici orden=rn-2318|estado=lista]]').widgets()[0]; await tick();
  assert.equal(a.querySelector('.kit-trk-upd').textContent, 'Actualizado: Lista para recoger');
  assert.ok(a.classList.contains('is-old') && a.querySelector('.kit-trk-acts').classList.contains('is-stale'));
  assert.ok(a.querySelector('.kit-trk-acts button').disabled);
  assert.equal(other.querySelector('.kit-trk-upd'), null, 'another ref stays live');
  assert.equal(b.querySelector('.kit-trk-upd'), null); assert.ok(!b.querySelector('.kit-trk-acts button').disabled);
  assert.ok(b.classList.contains('is-seen'), 'the newest one may pulse (no IntersectionObserver here: at once)');
  await wait(1500);
  assert.ok((c.w.__lbwAnnounced || []).some((x) => x.includes('Actualizado: Taller: Tu reparación · Lista para recoger')), JSON.stringify(c.w.__lbwAnnounced));
  // a third: the first says the newest state, and the second goes quiet too
  draw(c, '[[t:bici orden=RN-2318|estado=entregada]]'); await tick();
  assert.equal(a.querySelector('.kit-trk-upd').textContent, 'Actualizado: Entregada'); assert.ok(b.classList.contains('is-old'));
  c.close();
});

test('tracker: a data message under "live" redraws the newest tracker of that ref in place; an unknown state changes nothing', async () => {
  const c = setup(), m = draw(c, '[[t:bici orden=RN-2318|estado=taller]]'), t = m.widgets()[0]; await tick();
  c.bot('[[lbw:data key=orden_live]] [{"orden": "RN-0001", "estado": "entregada"}, {"orden": "RN-2318", "estado": "lista", "hora": "18:00"}]'); c.LBW.scan(); await tick();
  assert.equal(m.widgets()[0], t, 'the same card, redrawn in place');
  assert.deepEqual(status(t), ['Lista para recoger', 'info']); assert.equal(t.querySelector('.kit-trk-eta').textContent, 'Lista hoy a las 18:00');
  assert.equal(t.getAttribute('data-lbw-upgraded'), '1'); assert.equal(t.querySelector('.kit-trk-acts button').textContent, 'Voy a recogerla');
  c.bot('[[lbw:data key=orden_live]] {"orden": "RN-2318", "estado": "<img src=x onerror=alert(1)>"}'); c.LBW.scan(); await tick();
  assert.deepEqual(status(t), ['Lista para recoger', 'info']); assert.ok(c.dropped().some((d) => d.includes('no known state')));
  await wait(1500); assert.ok((c.w.__lbwAnnounced || []).some((x) => x.startsWith('Actualizado: Taller: Tu reparación · Lista para recoger')));
  c.close();
});

test('tracker: attacks in the tag draw text only, or nothing', () => {
  const c = setup();
  const t = draw(c, '[[t:bici orden=<img src=x onerror=alert(1)>|estado=__proto__|hora=javascript:alert(1)|dia=<b>1</b>]]').widgets()[0];
  assert.deepEqual(steps(t)[0], 'is-now*', 'the default'); assert.equal(t.querySelector('.lbw-head .kit-tag'), null); assert.equal(t.querySelector('.kit-trk-eta'), null);
  assert.equal(t.querySelectorAll('img, b, script').length, 0);
  const u = draw(c, '[[t:bici orden=javascript:alert(1)|estado=constructor]]').widgets()[0];
  assert.equal(u.querySelector('.lbw-head .kit-tag'), null, 'a ref is a code: letters, digits and . _ / # -');
  assert.equal(draw(c, '[[t:cita estado=toString]]').widgets().length, 0);
  assert.ok(c.dropped().some((d) => d.includes('bad value orden=')));
  c.close();
});

test('tracker: describe() lists its tag with every step and state, and mock cases', () => {
  const c = setup(), d = json(c.LBW.kit.describe('t'));
  assert.ok(d.tags.includes('[[t:bici estado=recibida|diagnostico|taller|lista|entregada|pieza|anulada|rechazada]]  (tracker)'));
  assert.ok(d.cases.some((x) => x[0] === 'bici-attack'));
  c.close();
});

test('check: a tracker says what is wrong, sentence by sentence', () => {
  const c = setup({});
  const e = c.check({ x: { type: 'tracker', title: 'T', default: 'nada',
    steps: [{ key: 'a', label: 'A' }, { key: 'a', label: 'Una etiqueta de paso larguísima que no cabe en el paso', tone: 'rojo' }, { key: 'Mal', label: 'M' }, { key: 'c', label: '{x}', actions: [{ reply: ['Ok', 'Ok {nope}', { 'f': '{ref}', 'g': '{zzz}' }] }] }],
    states: [{ key: 'a', text: 'dup' }, { key: 'r', text: 'R' }, { key: 's', text: 'S', at: 'zz' }, { key: 'e', text: 'E', end: 'yes' }],
    ref: { param: 'orden', lbl: 'x' }, eta: { day: 'orden', text: 'Lista' }, live: 'Mal key', params: { estado: { type: 'text' } } },
    y: { type: 'tracker', title: 'T', param: 'Estado', steps: [{ key: 'solo', label: 'Solo' }] } });
  const want = [
    'x: steps[1]: the key "a" is there twice', 'x: steps[1].tone "rojo" is not a tone', 'x: steps[1].label is a short name, 40 characters at most',
    'x: steps[2] needs a "key"', 'x: steps[3].label: "{x}" is not a value here', 'x: steps[3].actions[0].reply: "g" holds {zzz}', 'x: steps[3].actions[0].reply: "{nope}" is not a value here',
    'x: states[0]: the key "a" is already a step or a state', 'x: states[1] needs "at"', 'x: states[2].at "zz" is not a step. Known: a, c', 'x: states[3].end is true',
    'y: param "Estado" must be lower-case', 'x: "default" "nada" is not a step or a state', 'x: ref: unknown key "lbl"',
    'x: eta.text needs {when}', 'x: the tag key "orden" is read twice', 'x: params.estado: the tag key "estado" is already read by this tracker', 'x: "live" is a key of LBW.data',
    'y: "steps" is 2 to 8 steps'];
  want.forEach((w) => assert.ok(e.some((m) => m.startsWith(w)), w + '\n' + e.join('\n')));
  assert.ok(!e.some((m) => m.includes('"f" holds')), '{ref} is a value in a step\'s reply fields');
  assert.deepEqual(c.check({ z: { type: 'tracker', steps: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] } }), ['z: missing "title"']);
  c.close();
});
