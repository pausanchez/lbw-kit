// test/density-010.test.mjs · v0.10 "density & forms": compact is the default for form, calc, review and slots ("density":
// "comfy" or :root { --lbw-density: comfy } keeps the v0.9.5 layout). One question at a time, segmented picks, a footer with
// the total and the CTA, a receipt, a date strip, a scale that keeps one row where it fits. Every v0.9.5 a11y behaviour stays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

const GALLERY = JSON.parse(read('gallery/config.json'));
function chat(patch) {
  const cfg = JSON.parse(JSON.stringify(GALLERY)); if (patch) patch(cfg.widgets);
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '13/11/2026';
  c.result = json(c.w.LBW.kit.setup(cfg)); c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  return c;
}
const said = (c) => c.sent.filter((x) => x[0] === 'landbot-msg-send').map((x) => x[1].message);
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const k = (m, key) => m.querySelector(`[data-k="${key}"]`);
const modes = (m) => [...m.querySelectorAll('.kit-form > .kit-step')].map((s) => s.className.replace('kit-step is-', ''));

test('form (compact): one question at a time, answered steps fold to a line that opens them again, "n / m" beside the title', async () => {
  const c = chat(), m = draw(c, '[[gx:plan]]'); await wait(20);
  assert.ok(m.querySelector('.lbw').classList.contains('kit-dense'));
  assert.deepEqual(modes(m), ['open', 'wait', 'wait']);
  assert.equal(m.querySelector('.kit-stepn').textContent, '1 / 3'); assert.equal(m.querySelector('.kit-stepn').getAttribute('aria-hidden'), 'true');
  // a pick by click (or Enter/Space) folds the step and focus goes to the next question, never to <body>
  k(m, 'suave').focus(); k(m, 'suave').click(); await wait(10);
  assert.deepEqual(modes(m), ['sum', 'open', 'wait']);
  assert.equal(c.d.activeElement, k(m, 'solo'), 'focus on the next group\'s tab stop');
  const sum = m.querySelector('.kit-step.is-sum > .kit-sum');
  assert.equal(sum.textContent, 'Tu nivelPaseo tranquiloCambiar'); assert.equal(sum.getAttribute('aria-expanded'), 'false');
  assert.equal(m.querySelector('.kit-stepn').textContent, '2 / 3');
  // the single choice is a segmented control (2–3 short options); the group keeps its role and name
  const g = k(m, 'solo').parentNode; assert.equal(g.getAttribute('role'), 'radiogroup'); assert.ok(g.getAttribute('aria-labelledby'));
  assert.ok(g.parentNode.classList.contains('is-seg'));
  k(m, 'pareja').click(); await wait(10);
  assert.deepEqual(modes(m), ['sum', 'sum', 'open']);
  // a multi step stays open while the visitor picks; then everything is answered and the CTA is ready
  k(m, 'casco').click(); await wait(10);
  assert.deepEqual(modes(m), ['sum', 'sum', 'open']); assert.equal(m.querySelector('.kit-stepn').textContent, '3 / 3');
  assert.equal(m.querySelector('.lbw-cta').getAttribute('aria-disabled'), null);
  // "Cambiar" opens an answered step again, focused on its checked option
  m.querySelector('.kit-sum').click(); await wait(10);
  assert.deepEqual(modes(m), ['open', 'sum', 'sum']); assert.equal(c.d.activeElement, k(m, 'suave'));
  // arrows move and choose inside the group without moving on (the WAI radio pattern stays usable)
  k(m, 'suave').dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await wait(10);
  assert.equal(k(m, 'medio').getAttribute('aria-checked'), 'true'); assert.deepEqual(modes(m), ['open', 'sum', 'sum']);
  assert.equal(c.d.activeElement, k(m, 'medio'));
  m.querySelector('.lbw-cta').click(); await wait(1600);
  assert.equal(said(c).length, 1); assert.match(said(c)[0], /^Mi plan: Algo de subida · en pareja · Extras: casco$/);
});

test('form (compact): the not-ready CTA still says what is missing and takes focus to the open question', async () => {
  const c = chat(), m = draw(c, '[[gx:plan]]'); await wait(20);
  const cta = m.querySelector('.lbw-cta'); assert.equal(cta.getAttribute('aria-disabled'), 'true'); assert.equal(cta.textContent, '¿Qué nivel tienes?');
  cta.focus(); cta.click(); await wait(10);
  assert.equal(c.d.activeElement, k(m, 'suave'));
});

test('form: "density": "comfy" (or --lbw-density on :root) keeps the v0.9.5 layout: every step open, no fold lines', async () => {
  const c = chat((w) => { w.plan.density = 'comfy'; }); assert.deepEqual(c.result.errors, []);
  const m = draw(c, '[[gx:plan]]'); await wait(20);
  assert.ok(!m.querySelector('.kit-dense, .kit-sum, .kit-stepn, .is-seg'));
  assert.equal(m.querySelectorAll('.kit-form > .kit-step > .kit-q').length, 3);
  const c2 = chat(); c2.d.documentElement.style.setProperty('--lbw-density', 'comfy');
  const m2 = draw(c2, '[[gx:alquiler dias=3 bici=urbana]]'); await wait(20);
  assert.ok(!m2.querySelector('.kit-dense, .kit-foot'));
});

test('calc (compact): the totals and the CTA share a footer; the change is still announced (the total only)', async () => {
  const c = chat(), m = draw(c, '[[gx:alquiler dias=3 bici=urbana]]'); await wait(20);
  const foot = m.querySelector('.kit-foot'); assert.ok(foot);
  assert.ok(foot.querySelector('.kit-foot-t > .kit-total')); assert.equal(foot.lastElementChild, m.querySelector('.lbw-cta'));
  assert.equal(m.querySelectorAll('.kit-total').length, 1, 'not drawn twice');
  assert.equal(foot.querySelector('.kit-total strong').textContent.replace(/\s/g, ' '), '45,00 €');
  assert.ok(k(m, 'urbana').closest('.kit-q').classList.contains('is-seg'));
  assert.ok(m.querySelector('.kit-stepgrid > .lbw-step'));
  m.querySelector('[aria-label="Más · Días"]').click(); await wait(1200);
  assert.ok(c.said().some((s) => /Total 60,00/.test(s)), c.said().join(' | '));
  m.querySelector('.lbw-cta').click(); await wait(1600);
  assert.match(said(c)[0], /^Mi alquiler: urbana, 4 días, 60,00/);
  assert.ok(m.querySelector('.lbw').classList.contains('is-collapsed'));
});

test('review (compact): a receipt whose total and Confirm sit in the footer; a select is a labelled chip', async () => {
  const c = chat(), m = draw(c, '[[gx:presu]]'); await wait(20);
  const foot = m.querySelector('.kit-foot');
  assert.ok(foot.querySelector('.kit-rtotal strong')); assert.equal(foot.querySelector('.kit-rtotal strong').textContent.replace(/\s/g, ' '), '45 €');
  assert.ok(foot.querySelector('.kit-discard'));
  const sel = m.querySelector('.kit-selw > select.kit-sel'); assert.ok(sel);
  assert.equal(m.querySelector(`label[for="${sel.id}"]`).textContent, 'Ruedas nuevas');
  sel.value = 'si'; sel.dispatchEvent(new c.w.Event('change')); await wait(1200);
  assert.equal(foot.querySelector('.kit-rtotal strong').textContent.replace(/\s/g, ' '), '75 €');
  assert.ok(c.said().some((s) => /Total 75/.test(s)));
});

test('slots (compact): the days are a date strip of radios named by the whole date; the times stay a radiogroup', async () => {
  const c = chat(), m = draw(c, '[[gx:cita]]'); await wait(20);
  const days = [...m.querySelectorAll('.kit-dates [role="radio"]')];
  assert.ok(days.length >= 2);
  assert.equal(days[0].closest('[role="radiogroup"]').getAttribute('aria-label'), 'Día');
  assert.match(days[0].getAttribute('aria-label'), /^[a-zé]+, \d+ de [a-z]+$/);
  assert.deepEqual([...days[0].children].map((s) => s.className), ['kit-dw', 'kit-dn', 'kit-dm']);
  assert.equal(days[0].getAttribute('aria-checked'), 'true'); assert.equal(days[0].tabIndex, 0); assert.equal(days[1].tabIndex, -1);
  days[1].click(); await wait(10);
  assert.equal(days[1].getAttribute('aria-checked'), 'true');
  assert.equal(m.querySelector('.kit-slotlist').getAttribute('role'), 'radiogroup');
});

test('check: "density" is compact or comfy, on form, calc, review and slots only', () => {
  const c = chat(), chk = (w) => json(c.w.LBW.kit.setup.check({ prefix: 'gx', widgets: { x: w } }));
  const base = JSON.parse(JSON.stringify(GALLERY.widgets.plan));
  assert.deepEqual(chk({ ...base, density: 'comfy' }), []);
  assert.deepEqual(chk({ ...base, density: 'compact' }), []);
  assert.match(chk({ ...base, density: 'tight' }).join(' '), /"density" is "compact"/);
  assert.match(chk({ ...GALLERY.widgets.nps, density: 'comfy' }).join(' '), /unknown option "density"/);
});

test('CSS: the density tokens are fenced on :root, controls keep 44 px, the footer sticks, edges use --lbw-control', () => {
  const lbw = read('runtime/lbw.css'), kit = read('kit/kit.css');
  const root = lbw.slice(lbw.indexOf(':root {'), lbw.indexOf('\n}', lbw.indexOf(':root {')));
  assert.match(root, /v0\.10 · density tokens[\s\S]*--lbw-control-h: 44px[\s\S]*--lbw-shadow-2[\s\S]*\/v0\.10 · density tokens/);
  const sec = kit.slice(kit.indexOf('/* v0.10 · density & forms'), kit.indexOf('/* /v0.10 · density & forms */'));
  assert.ok(sec.length > 1000);
  assert.match(sec, /\.kit-foot \{ position: sticky; bottom: 0;/);
  assert.match(sec, /\.lbw\.kit-dense > \.lbw-box \{ overflow: clip; \}/);
  assert.match(sec, /\.kit-sum \{[^}]*min-height: 44px/);
  assert.match(sec, /\.lbw-tog\.kit-day \{[^}]*min-height: 64px/);
  assert.match(sec, /\.kit-dense \.kit-q\.is-seg > \.lbw-chips \{[^}]*var\(--lbw-control\)/);
  assert.match(sec, /\.kit-foot > \.lbw-cta \{[^}]*min-height: 44px/);
  assert.match(sec, /prefers-reduced-motion: no-preference\) \{ \.lbw\.is-anim/);
  assert.ok(!/(tog|slot|day|sum|cta|sel|rate-b)[^{]*\{[^}]*min-height: (3\d|[12]\d)px/.test(sec), 'no target under 44 px');
});
