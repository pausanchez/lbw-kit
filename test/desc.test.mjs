// test/desc.test.mjs · v0.8.1.10: options that say what they mean (a form's [key, label, desc], a chip's { label, say, desc })
// and chips that save Landbot fields with their sentence.
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
  plan: { type: 'form', cta: 'Ver', summary: 'Viajo: {who:label}', fields: { viaje: '{who}' }, steps: [
    { key: 'who', title: '¿Quién viaja?', items: { es: [['pareja', 'En pareja', 'Suites con terraza o jacuzzi'], ['familia', 'En familia', 'Sofá cama y cuna gratis']], en: [['pareja', 'As a couple', 'Suites with a terrace or a hot tub'], ['familia', 'As a family', 'Sofa bed and a free cot']] } },
    { key: 'view', title: 'Vistas', items: [['mar', 'Mar'], ['ciudad', 'Ciudad']] }] },
  chips: { type: 'chips', items: {
    plan: { label: { es: 'Planear', en: 'Plan' }, say: { es: 'Quiero planear mi estancia', en: 'I want to plan my stay' }, desc: { es: 'Tres preguntas y te propongo una habitación', en: 'Three taps and I suggest a room' }, fields: { interes: 'plan' } },
    mar: ['Vistas al mar', '¿Qué habitaciones tienen vistas al mar?'] } }
};

test('desc: a form step with descriptions becomes a list; the label and its line are separate; a step without stays as chips', () => {
  const c = setup(W); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:plan lang=en]]'), groups = [...m.querySelectorAll('.kit-q .lbw-chips')];
  assert.ok(groups[0].classList.contains('is-list')); assert.ok(!groups[1].classList.contains('is-list'));
  const b = groups[0].querySelector('.lbw-tog');
  assert.equal(b.querySelector('.kit-opt-l').textContent, 'As a couple'); assert.equal(b.querySelector('.kit-opt-d').textContent, 'Suites with a terrace or a hot tub');
  assert.ok(b.classList.contains('has-desc')); assert.equal(groups[1].querySelector('.lbw-tog').textContent, 'Mar');
  c.close();
});

test('desc: picking a described option sends the label, never the description, and saves the key', async () => {
  const c = setup(W), m = draw(c, '[[t:plan]]');
  m.querySelector('[data-k="familia"]').click(); m.querySelector('[data-k="mar"]').click();
  m.querySelector('.lbw-form .lbw-cta').click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { viaje: 'familia' }], ['landbot-msg-send', { type: 'text', message: 'Viajo: En familia' }]]);
  c.close();
});

test('chips: an object chip shows its line and SAVES its fields with the sentence; a pair chip still works beside it', async () => {
  const c = setup(W), m = draw(c, 'Hola [[t:chips q=plan,mar lang=es]]'), g = m.querySelector('.kit-chips .lbw-chips');
  assert.ok(g.classList.contains('is-list'));
  const [a, b] = [...g.querySelectorAll('.lbw-pill')];
  assert.equal(a.querySelector('.kit-opt-d').textContent, 'Tres preguntas y te propongo una habitación'); assert.equal(b.textContent, 'Vistas al mar');
  a.click(); await wait(300);
  assert.deepEqual(c.sent, [['landbot-custom-data', { interes: 'plan' }], ['landbot-msg-send', { type: 'text', message: 'Quiero planear mi estancia' }]]);
  c.close();
});

test('check: a desc is one short line; an object chip needs label and say; a pair chip has no third element', () => {
  const c = setup({});
  const e = c.check({
    f: { type: 'form', cta: 'x', summary: '{a}', steps: [{ key: 'a', items: [['k', 'L', 'x'.repeat(81)], ['j', 'J', ''], ['i', 'I', 'd', 'extra']] }] },
    h: { type: 'chips', items: { a: { label: 'A', desc: 'd', colour: 'red' }, b: ['B', 'say', 'desc'], d: { label: 'D', say: 'S', fields: 'x' }, g: { label: 'G', say: 'S', fields: { 'Bad Name': '1' } } } } }).join('\n');
  for (const r of [/f: a\.items\[0\]\[2\]: a desc is one short line, 80 characters at most \(81\)/, /f: a\.items\[1\]\[2\]: a desc is one line of text/, /f: a\.items\[2\] is \[key, label\] or \[key, label, desc\]/,
    /h: items\.a: unknown key "colour"/, /h: items\.a needs "label" and "say"/, /h: items\.b is \[label, sentence\] or \{/, /h: items\.d\.fields is \{ "field": "value" \}/, /h: items\.g\.fields: field "Bad Name" must be a Landbot field name/])
    assert.match(e, r);
  assert.deepEqual(c.check(W), []);
  c.close();
});
