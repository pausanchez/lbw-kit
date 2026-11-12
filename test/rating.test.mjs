// test/rating.test.mjs · v0.8.1.6: thumbs, stars and a scale (NPS), each a one-tap message that SAVES Landbot fields
// (Landbot's own ask_rating and ask_scale don't draw on the v4 web chat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json, wait } from './helpers.mjs';

function setup(widgets) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.result = json(c.w.LBW.kit.setup({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', quietMs: 10, links: [], widgets }));
  c.check = (w) => json(c.w.LBW.kit.setup.check({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: [], widgets: w }));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const W = {
  util: { type: 'rating', kind: 'thumbs', title: '¿Te ha servido?', labels: ['No', 'Sí'], send: { text: 'Valoro la respuesta: {label}', fields: { util: '{value}' } } },
  stars: { type: 'rating', title: '¿Qué tal el servicio?', send: { text: { es: 'Le doy {value} de {max}', en: 'I give it {value} of {max}' }, fields: { estrellas: '{value}' } } },
  nps: { type: 'rating', kind: 'scale', title: '¿Nos recomendarías?', labels: ['Nada probable', 'Muy probable'], bands: [[6, 'detractor'], [8, 'pasivo'], [10, 'promotor']],
    send: { text: 'Mi nota: {value} de 10', fields: { nps: '{value}', nps_grupo: '{band}' } } }
};

test('rating: the config is valid; three kinds draw with 44 px targets and labels', () => {
  const c = setup(W); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const t = draw(c, '[[t:util]]').widgets()[0], s = draw(c, '[[t:stars]]').widgets()[0], n = draw(c, '[[t:nps]]').widgets()[0];
  assert.deepEqual([...t.querySelectorAll('.kit-rate-b')].map((b) => b.textContent), ['Sí', 'No']);
  assert.ok(t.querySelector('.is-down .kit-ico svg'));
  assert.equal(s.querySelectorAll('.kit-rate-b').length, 5); assert.equal(s.querySelector('.kit-rate-b').getAttribute('aria-label'), '1 de 5');
  assert.deepEqual([...n.querySelectorAll('.kit-rate-b')].map((b) => b.textContent), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  assert.equal(n.querySelector('.kit-rate-b').getAttribute('aria-label'), '0 de 10 · Nada probable');
  assert.deepEqual([...n.querySelectorAll('.kit-rate-ends span')].map((x) => x.textContent), ['0 · Nada probable', '10 · Muy probable']);
  c.close();
});

test('rating: one tap sends the sentence and SAVES the value and its band; then the group is done and the value stays marked', async () => {
  const c = setup(W), m = draw(c, '[[t:nps]]'), b = [...m.querySelectorAll('.kit-rate-b')];
  b[7].click(); b[9].click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { nps: '7', nps_grupo: 'pasivo' }], ['landbot-msg-send', { type: 'text', message: 'Mi nota: 7 de 10' }]]);
  assert.ok(m.querySelector('.kit-rate').classList.contains('is-done') && m.querySelector('.kit-rate').classList.contains('is-rated'));
  assert.deepEqual(b.filter((x) => x.classList.contains('is-on')).map((x) => x.textContent), ['7']);
  assert.equal(m.querySelector('[aria-current="true"]').textContent, '7');
  c.close();
});

test('rating: stars fill up to the value; thumbs save 1 or 0; the tag\'s language picks the sentence', async () => {
  const c = setup(W), s = draw(c, '[[t:stars lang=en]]'), stars = [...s.querySelectorAll('.kit-rate-b')];
  stars[3].click(); await wait(300);
  assert.equal(c.sent[1][1].message, 'I give it 4 of 5'); assert.deepEqual(c.sent[0][1], { estrellas: '4' });
  assert.deepEqual(stars.map((x) => x.classList.contains('is-on')), [true, true, true, true, false]);
  await wait(1300);
  const t = draw(c, '[[t:util]]'); [...t.querySelectorAll('.kit-rate-b')][1].click(); await wait(300);
  assert.deepEqual(c.sent.slice(2), [['landbot-custom-data', { util: '0' }], ['landbot-msg-send', { type: 'text', message: 'Valoro la respuesta: No' }]]);
  c.close();
});

test('check: a rating says what is wrong, and one that saves nothing is refused', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'rating', kind: 'dial', title: 'T', send: { text: 'x', fields: { f: '{value}' } } },
    b: { type: 'rating', kind: 'scale', min: 0, max: 20, title: 'T', send: { text: '{value}', fields: { f: '{nope}' } } },
    d: { type: 'rating', kind: 'stars', max: 12, labels: ['a', 'b'], title: 'T', send: { text: '{value}' } },
    f: { type: 'rating', kind: 'scale', title: 'T', bands: [[8, 'x'], [6, 'y']], send: { text: '{value}', fields: { f: '{value}' } } },
    g: { type: 'rating', kind: 'thumbs', max: 1, title: 'T', send: { text: '{value}', fields: { f: '{value}' } } } }).join('\n');
  for (const r of [/a: "kind" is thumbs, stars or scale/, /b: a scale holds 2 to 11 values/, /b: send\.fields: "f" holds \{nope\}/, /d: stars go from 1/, /d: stars have no "labels"/, /d: send\.fields is missing/, /f: bands\[1\]: bands go up/, /g: a thumbs rating has no "min" or "max"/])
    assert.match(e, r);
  assert.deepEqual(c.check(W), []);
  c.close();
});

test('review 0.8.1.6: {label} has words (thumbs without labels, a scale\'s ends); bands must cover the range; {label} where it is always empty is an error', async () => {
  const c = setup({
    t: { type: 'rating', kind: 'thumbs', title: 'T', send: { text: 'Valoro: {label}', fields: { f: '{value}' } } },
    s: { type: 'rating', kind: 'scale', min: 1, max: 5, labels: ['Mal', 'Genial'], title: 'S', send: { text: 'Nota {value} {label}', fields: { s: '{value}' } } } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const t = draw(c, '[[t:t]]'); [...t.querySelectorAll('.kit-rate-b')][1].click(); await wait(300);
  assert.equal(c.sent[1][1].message, 'Valoro: No');
  await wait(1300);
  const s = draw(c, '[[t:s]]'); [...s.querySelectorAll('.kit-rate-b')].pop().click(); await wait(300);
  assert.equal(c.sent[3][1].message, 'Nota 5 Genial');
  const e = c.check({
    a: { type: 'rating', kind: 'scale', title: 'T', bands: [[6, 'det']], send: { text: '{value} {band}', fields: { f: '{value}' } } },
    b: { type: 'rating', title: 'T', send: { text: '{value} {label}', fields: { f: '{value}' } } } }).join('\n');
  assert.match(e, /a: bands: the last top \(6\) is below the highest value \(10\)/);
  assert.match(e, /b: .*\{label\}/);
  c.close();
});
