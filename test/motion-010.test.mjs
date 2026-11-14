// test/motion-010.test.mjs · v0.10 "motion & feedback": the motion gate, entrances on the newest message only, skeletons
// shaped like their widget, press → queued → sent (a spinner, then ✓, the other answers folding away), a failed send's own
// state, and the receipt of a finished card. Every v0.9.5 accessibility behaviour must hold with all of it on: the live
// region says what it said before (no more, no less), focus stays on the pressed control, the others stay in the group,
// disabled. jsdom has no layout and no Element.animate: the final states are checked, which are also what a hidden tab
// or reduced motion gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, read } from './helpers.mjs';

const GALLERY = JSON.parse(read('gallery/config.json'));
function chat({ cfg = GALLERY, reduce = false, before } = {}) {
  const c = boot({ lbw: false, kit: false });
  if (reduce) c.w.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
  if (before) before(c.w);
  ['runtime/lbw.js', 'kit/kit.js', 'kit/setup.js'].forEach((p) => c.w.eval(read(p)));
  c.LBW = c.w.LBW; c.w.__lbwToday = '13/11/2026'; c.w.__lbwNow = '21:04';
  c.result = json(c.LBW.kit.setup(JSON.parse(JSON.stringify(cfg))));
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  c.html = () => c.d.documentElement;
  return c;
}
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const k = (m, key) => m.querySelector(`[data-k="${key}"]`);
function hide(c, hidden) {
  Object.defineProperty(c.d, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible'), configurable: true });
  c.d.dispatchEvent(new c.w.Event('visibilitychange'));
}

// ── 1 · the gate ───────────────────────────────────────────────────────────────────────────────
test('gate: html.lbw-motion while the tab is visible; off when hidden (one-off classes dropped), on again when back', async () => {
  const c = chat(); await wait(5);
  assert.ok(c.html().classList.contains('lbw-motion')); assert.equal(c.LBW.motion(), true);
  const m = draw(c, 'Hola [[gx:chips q=tarifas,taller]]');
  assert.ok(m.classList.contains('lbw-enter'), 'the newest message rises in');
  hide(c, true);
  assert.ok(!c.html().classList.contains('lbw-motion')); assert.equal(c.LBW.motion(), false);
  assert.ok(!m.classList.contains('lbw-enter'), 'a hidden tab shows the end state: no entrance left to replay');
  hide(c, false);
  assert.ok(c.html().classList.contains('lbw-motion'));
  assert.ok(!m.classList.contains('lbw-enter'), 'coming back does not replay it');
});

test('gate: prefers-reduced-motion keeps it off; LBW.init({ motion: false }) too', async () => {
  const r = chat({ reduce: true }); await wait(5);
  assert.ok(!r.html().classList.contains('lbw-motion')); assert.equal(r.LBW.motion(), false);
  const m = draw(r, 'Hola [[gx:chips q=tarifas,taller]]');
  assert.ok(!m.classList.contains('lbw-enter'), 'no entrance');
  const o = chat({ cfg: { ...GALLERY, motion: false } }); await wait(5);
  assert.ok(!o.html().classList.contains('lbw-motion')); assert.equal(o.LBW.motion(), false);
});

test('entrance: only the newest message (a chat loading its history draws the rest at once); the widget HTML is untouched', async () => {
  const c = chat(); await wait(5);
  const a = c.bot('Old [[gx:tarifas id=verano]]'), b = c.bot('Mira [[gx:vs ids=urbana,ebike]]'); c.LBW.scan();
  assert.ok(!a.classList.contains('lbw-enter')); assert.ok(b.classList.contains('lbw-enter'));
  assert.doesNotMatch(b.widgets()[0].outerHTML, /lbw-enter|lbw-motion/);
  await wait(950); assert.ok(!b.classList.contains('lbw-enter'), 'a one-off class: gone after the animation');
  assert.deepEqual(c.said(), ['Comparar: Dos bicis frente a frente'], 'v0.9.5: one line, the newest');
});

// ── 2 · skeletons ──────────────────────────────────────────────────────────────────────────────
test('skeleton: shaped like the widget (card, carousel tiles, table rows), hidden from screen readers, then the card', async () => {
  const c = chat(); await wait(5);
  const U = c.LBW.ui, mk = (cls, shape) => U.loading('es', cls, shape);
  const card = mk('np-card'), car = mk('kit-carousel x'), tbl = mk('kit-table'), forced = mk('np-card', 'table');
  assert.ok(card.querySelector('.lbw-skel.is-card .lbw-sk.is-k + .lbw-sk.is-t')); assert.equal(card.querySelectorAll('.lbw-sk.is-r').length, 2);
  assert.equal(car.querySelectorAll('.lbw-skel.is-carousel .lbw-sk-tile').length, 3);
  assert.ok(car.querySelector('.lbw-sk-tile .lbw-sk.is-ph'), 'a photo block per tile');
  assert.equal(tbl.querySelectorAll('.lbw-skel.is-table .lbw-sk-row').length, 5);
  assert.ok(forced.querySelector('.lbw-skel.is-table'));
  for (const o of [card, car, tbl]) { assert.equal(o.getAttribute('aria-busy'), 'true'); assert.equal(o.querySelector('.lbw-skel').getAttribute('aria-hidden'), 'true'); assert.equal(o.querySelector('.lbw-skel').textContent, ''); }
  // through LBW.later: the skeleton says nothing, then the card says its title once (v0.9.5)
  let done; c.LBW.widget('late', (p, ctx) => { const o = U.loading(ctx.lang, 'kit-carousel'); return c.LBW.later(o, new Promise((r) => (done = r)), () => { U.head(o.box, 'Rutas', 'Tres salidas'); }); });
  const m = draw(c, 'Un momento [[gx:late]]'); await wait(450);
  assert.deepEqual(c.said(), [], 'a skeleton is not announced');
  done(1); await wait(450);
  assert.equal(m.querySelector('.lbw-skel'), null, 'no layout here, so no cross-fade: the skeleton is gone at once');
  assert.equal(m.widgets()[0].getAttribute('aria-busy'), null);
  assert.deepEqual(c.said(), ['Rutas: Tres salidas']);
});

// ── 3 · press → queued → sent ──────────────────────────────────────────────────────────────────
test('press: queued shows on the control and its widget; once sent ✓ and the other answers fold, still in the group and disabled; focus stays', async () => {
  const c = chat({ cfg: { ...GALLERY, quietMs: 400 } }); await wait(5);
  const m = draw(c, '¿Algo más? [[gx:chips q=tarifas,taller,ruta]]'), g = m.querySelector('.lbw-once'), bs = [...g.querySelectorAll('button.lbw-pill')], w = m.widgets()[0];
  await wait(20);
  bs[1].focus(); bs[1].click();
  assert.ok(bs[1].classList.contains('is-sent'), 'marked at once (v0.9.5)');
  assert.equal(bs[1].getAttribute('data-lbw-job'), 'queued'); assert.equal(w.getAttribute('data-lbw-job'), 'queued');
  assert.ok(g.classList.contains('lbw-press'));
  assert.ok(!bs[0].classList.contains('is-folded'), 'nothing folds before the message is out');
  assert.equal(bs[0].disabled, true); assert.equal(bs[1].getAttribute('aria-disabled'), 'true'); assert.equal(c.d.activeElement, bs[1]);
  await wait(700);
  assert.equal(c.sent.filter((x) => x[0] === 'landbot-msg-send').length, 1);
  assert.equal(bs[1].getAttribute('data-lbw-job'), 'sent'); assert.equal(w.getAttribute('data-lbw-job'), 'sent');
  assert.ok(g.classList.contains('is-folded'));
  for (const x of [bs[0], bs[2]]) { assert.ok(x.classList.contains('is-folded') && x.isConnected && x.disabled && g.contains(x), 'folded, not removed'); }
  assert.ok(!bs[1].classList.contains('is-folded'));
  assert.equal(c.d.activeElement, bs[1], 'focus never moved');
  assert.equal(m.querySelector('.lbw-receipt'), null, 'a question chip is not a finished card: no receipt');
  await wait(400); assert.deepEqual(c.said(), [], 'nothing new for the live region (chips have no title)');
});

test('press: a failed send has its own state (no fold, an alert line); Retry goes back to queued, then sent and folded', async () => {
  const c = chat({ cfg: { ...GALLERY, quietMs: 10 } }); await wait(5);
  let net = 'net'; const lb = { calls: 0, sendMessage() { lb.calls++; return net === 'net' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(); } };
  c.LBW.landbot(lb);
  const m = draw(c, '[[gx:permiso]]'), [yes, no] = m.querySelectorAll('.kit-consent-b button');
  await wait(20); yes.click(); await wait(300);
  assert.equal(yes.getAttribute('data-lbw-job'), 'failed'); assert.ok(yes.classList.contains('is-unsent'));
  assert.ok(!no.classList.contains('is-folded') && !no.disabled, 'the choice is open again');
  assert.equal(m.querySelector('.lbw-unsent').getAttribute('role'), 'alert');
  assert.equal(m.querySelector('.lbw-receipt'), null);
  net = 'ok'; m.querySelector('.lbw-retry').click();
  assert.match(yes.getAttribute('data-lbw-job'), /^(queued|sending)$/);
  await wait(300);
  assert.equal(yes.getAttribute('data-lbw-job'), 'sent'); assert.ok(no.classList.contains('is-folded') && no.disabled);
  assert.equal(lb.calls, 2);
  assert.match(m.querySelector('.lbw-receipt').textContent, /^Enviado · 21:04$/, 'a consent is a finished card');
});

// ── 4 · done ───────────────────────────────────────────────────────────────────────────────────
test('done: a rating gets a receipt with a self-drawing check ("Enviado · 21:04"), the card is finished; stars do not fold', async () => {
  const c = chat({ cfg: { ...GALLERY, quietMs: 10 } }); await wait(5);
  const m = draw(c, '[[gx:estrellas]]'), b = [...m.querySelectorAll('.kit-rate-b')]; await wait(20);
  b[3].click(); await wait(300);
  const r = m.querySelector('.lbw-receipt'), w = m.widgets()[0];
  assert.ok(r); assert.equal(r.textContent, 'Enviado · 21:04');
  const svg = r.querySelector('.lbw-check svg'); assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.querySelectorAll('[pathLength="1"]').length, 2, 'circle and tick, drawn by stroke-dashoffset');
  assert.ok(w.classList.contains('is-finished'));
  assert.equal(m.querySelectorAll('.is-folded').length, 0, 'a rating keeps its scale');
  assert.equal(r.getAttribute('role'), null); assert.equal(r.getAttribute('aria-live'), null, 'the receipt is not another live region');
});

test('done: a folded form\'s "Enviado" line takes the check and the time; a spinner state while it waits; labels override the word', async () => {
  const c = chat({ cfg: { ...GALLERY, quietMs: 300 } }); await wait(5);
  const m = draw(c, '[[gx:plan]]'); await wait(20);
  k(m, 'suave').click(); k(m, 'solo').click(); k(m, 'casco').click();
  const cta = m.querySelector('.lbw-cta'); cta.focus(); cta.click(); await wait(10);
  const w = m.widgets()[0], line = m.querySelector('.kit-sentline');
  assert.equal(w.getAttribute('data-lbw-job'), 'queued'); assert.equal(line.querySelector('.lbw-check'), null);
  assert.equal(c.d.activeElement, m.querySelector('.kit-sent-toggle'), 'v0.9.5 focus rule holds');
  await wait(500);
  assert.equal(w.getAttribute('data-lbw-job'), 'sent');
  assert.ok(line.classList.contains('lbw-receipt') && line.firstChild.classList.contains('lbw-check'));
  assert.match(line.querySelector('.kit-sent-l').textContent, / · 21:04$/);
  assert.equal(m.querySelectorAll('.lbw-receipt').length, 1, 'one receipt');
  // the word follows cfg.labels
  const e = chat({ cfg: { ...GALLERY, quietMs: 10, labels: { es: { sent: 'Recibido' } } } }); await wait(5);
  const n = draw(e, '[[gx:util]]'); await wait(20); n.querySelector('.kit-rate-b').click(); await wait(300);
  assert.equal(n.querySelector('.lbw-receipt').textContent, 'Recibido · 21:04');
});

test('reduced motion: the same end states, at once (fold, receipt), and no one-off classes', async () => {
  const c = chat({ cfg: { ...GALLERY, quietMs: 10 }, reduce: true }); await wait(5);
  const m = draw(c, '[[gx:permiso]]'), [yes, no] = m.querySelectorAll('.kit-consent-b button'); await wait(20);
  yes.click(); await wait(300);
  assert.ok(no.classList.contains('is-folded')); assert.ok(m.querySelector('.lbw-receipt'));
  assert.equal(c.d.querySelectorAll('.lbw-enter, .lbw-swap, .lbw-new, .lbw-pop, .lbw-press').length, 0);
});

test('CSS: every animation is behind html.lbw-motion, motion is tokens, and the old static skeleton stays for a bare .lbw-skel', () => {
  const css = read('runtime/lbw.css') + read('kit/kit.css');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\banimation\s*:[^}]*\}/g) || [];
  assert.ok(rules.length > 10);
  for (const r of rules) assert.match(r.split('{')[0], /\.lbw-motion/, 'ungated animation: ' + r.slice(0, 120));
  for (const t of ['--lbw-dur', '--lbw-dur-fast', '--lbw-dur-slow', '--lbw-step', '--lbw-ease', '--lbw-rise']) assert.match(css, new RegExp(t + ':'));
  assert.match(css, /\.lbw-skel:empty \{ min-height: 128px/);
  assert.doesNotMatch(css.slice(css.indexOf('v0.10 · motion')), /animation[^;]*\b(height|width|top|left|margin)\b/, 'transform and opacity only');
});
