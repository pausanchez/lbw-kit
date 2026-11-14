// test/screen.test.mjs · screen mode (runtime/screen.js, "screen" in a kit config): the newest widget is the screen, the
// messages before its turn fold (marked, never removed), an app header shows the steps, a bar mirrors the primary action.
// The step comes from a closed list; an agent's free text stays visible; focus and the live region; the fallbacks (no hook,
// a wrong config); the host adapter's new functions on the real v4 DOM; the checker and the schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { boot, json, read, wait } from './helpers.mjs';
import { generate, validate } from '../scripts/schema.mjs';

const BASE = { prefix: 's', langs: ['es', 'en'], defaultLang: 'es', quietMs: 10, links: [] };
const SCREEN = () => ({ on: true, header: { title: { es: 'Tu reserva', en: 'Your booking' }, steps: [['plan', 'Plan'], ['dias', { es: 'Días', en: 'Days' }], ['listo', 'Listo']] } });
const W = () => ({
  plan: { type: 'form', title: 'Tu plan', cta: 'Enviar mi plan', step: 'plan',
    steps: [{ key: 'nivel', title: 'Nivel', ask: '¿Qué nivel?', items: [['suave', 'Suave'], ['duro', 'Duro']] }], summary: 'Mi plan: {nivel:label}', fields: { s_nivel: '{nivel}' } },
  dias: { type: 'cards', step: 'dias', allowDup: true, item: { kicker: 'Reserva', title: 'Elige tus días' } },
  fin: { type: 'cards', allowDup: true, item: { title: 'Hecho' } },
  chips: { type: 'chips', screen: false, items: { si: ['Sí', 'Sí, quiero'], no: ['No', 'Ahora no'] } },
});
const SCRIPTS = ['runtime/screen.js', 'kit/setup.js', 'kit/setup-check.js'];
function setup(o = {}) {
  const { widgets = W(), before } = o, screen = 'screen' in o ? o.screen : SCREEN();
  const c = boot({ kit: true, scripts: SCRIPTS });
  if (before) before(c);
  const cfg = { ...BASE, widgets }; if (screen !== undefined) cfg.screen = screen;
  c.result = json(c.w.LBW.kit.setup(cfg));
  c.win = c.d.querySelector('[data-lb-part="window"]');
  c.draw = (text) => { const m = c.bot(text); c.LBW.scan(); return m; };
  c.say = (text) => { const m = c.user(text); c.LBW.scan(); return m; };
  c.past = () => [...c.chat.children].map((m) => (m.hasAttribute('data-lbw-past') ? 'past' : 'on'));
  c.slot = (n) => c.win.querySelector(`[data-lbw-slot="${n}"]`);
  c.steps = () => [...c.slot('head').querySelectorAll('.lbw-scr-steps li')].map((li) => (li.className || '-') + (li.getAttribute('aria-current') === 'step' ? '*' : ''));
  return c;
}

// ── off: nothing changes ────────────────────────────────────────────────────────────────────────
test('screen: unused (no "screen", or "on": false), the chat is untouched', () => {
  const plain = Object.fromEntries(Object.entries(W()).map(([k, w]) => { const x = { ...w }; delete x.step; return [k, x]; }));
  for (const screen of [undefined, { on: false, header: { steps: [['a', 'A'], ['b', 'B']] } }]) {
    const c = setup({ screen, widgets: plain });
    assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
    c.draw('Hola'); c.say('Quiero reservar'); const m = c.draw('Elige: [[s:plan]]');
    assert.equal(m.widgets().length, 1);
    assert.equal(c.win.hasAttribute('data-lbw-screen'), false);
    assert.equal(c.d.querySelectorAll('[data-lbw-slot], [data-lbw-past], [data-lbw-in]').length, 0);
    assert.equal(c.LBW.screen.state(), null);
    assert.equal(c.LBW.screen.history(true), false);
    c.close();
  }
});

// ── on ──────────────────────────────────────────────────────────────────────────────────────────
test('screen: a widget in the newest message becomes the screen; earlier messages are marked, not removed', () => {
  const c = setup(); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  c.draw('Hola, soy el asistente.'); c.say('Quiero reservar');
  const m = c.draw('Te ayudo: [[s:plan]]');
  assert.equal(c.win.getAttribute('data-lbw-screen'), 'collapse');
  assert.deepEqual(c.past(), ['past', 'past', 'on'], 'the welcome and the question fold; they stay in the DOM');
  assert.equal(c.chat.children.length, 3);
  assert.deepEqual(json(c.LBW.screen.state()), { step: 'plan', index: 0, of: 3, widget: 'plan', open: false, past: 2 });
  const head = c.slot('head');
  assert.equal(head.nextElementSibling, c.chat, 'the header is our own element, right before the message column');
  assert.equal(head.getAttribute('lang'), 'es');
  assert.equal(head.querySelector('.lbw-scr-title').textContent, 'Tu reserva');
  assert.equal(head.querySelector('ol').getAttribute('aria-label'), 'Pasos');
  assert.deepEqual(c.steps(), ['is-cur*', '-', '-']);
  const hist = head.querySelector('.lbw-scr-hist');
  assert.equal(hist.tagName, 'BUTTON'); assert.equal(hist.textContent, 'Ver conversación ▾'); assert.equal(hist.querySelector('.lbw-scr-chev').getAttribute('aria-hidden'), 'true'); assert.equal(hist.getAttribute('aria-expanded'), 'false'); assert.equal(hist.hidden, false);
  assert.ok(m.widgets()[0].querySelector('.lbw-cta'));
  c.close();
});

test('screen: the next screen; the tag\'s step wins; the agent\'s text in the same turn stays; steps done say so', () => {
  const c = setup();
  c.draw('Te ayudo: [[s:plan]]'); c.say('Mi plan: Suave');
  c.draw('¡Genial! Ahora los días.');
  c.draw('[[s:dias step=listo]]');
  assert.deepEqual(c.past(), ['past', 'past', 'on', 'on'], 'the agent\'s bubble before the widget is part of its turn');
  assert.equal(c.LBW.screen.state().step, 'listo');
  assert.deepEqual(c.steps(), ['is-done', 'is-done', 'is-cur*']);
  assert.deepEqual([...c.slot('head').querySelectorAll('.lbw-scr-sr')].map((x) => x.textContent), [', hecho', ', hecho']);
  assert.deepEqual([...c.slot('head').querySelectorAll('.lbw-scr-ck')].map((x) => x.getAttribute('aria-hidden')), ['true', 'true'], 'the ✓ is a picture; the words say it');
  // a number is a step too, and a widget with no step keeps the last one
  c.say('Vale'); c.draw('[[s:dias step=2]]'); assert.equal(c.LBW.screen.state().step, 'dias');
  c.say('Y ahora'); c.draw('[[s:fin]]'); assert.deepEqual(json(c.LBW.screen.state()).step, 'dias');
  assert.equal(c.LBW.screen.state().widget, 'fin');
  c.close();
});

test('screen: the agent\'s free text after the screen is a normal bubble on it; nothing after the screen ever folds', () => {
  const c = setup();
  c.draw('Te ayudo: [[s:plan]]');
  c.say('¿Admitís perros?'); c.draw('Sí, perros pequeños sin coste.'); c.say('Genial'); c.draw('De nada. **Sigue con tu plan** cuando quieras.');
  assert.deepEqual(c.past(), ['on', 'on', 'on', 'on', 'on']);
  assert.equal(c.LBW.screen.state().widget, 'plan');
  assert.equal(c.LBW.screen.state().past, 0);
  assert.equal(c.slot('head').querySelector('.lbw-scr-hist').hidden, true, 'nothing folded: no "View conversation"');
  // the visitor wrote after it, and the screen is still live (a normal chat would quiet it); the next screen quiets it
  const plan = c.chat.children[0].widgets()[0];
  assert.ok(plan.classList.contains('is-screen'));
  assert.equal(plan.querySelector('.lbw-once.is-stale'), null);
  assert.notEqual(plan.querySelector('.lbw-cta').disabled, true);
  c.draw('[[s:dias]]'); c.say('Vale');
  assert.ok(!plan.classList.contains('is-screen'));
  assert.ok(plan.querySelector('.lbw-once.is-stale'), 'an earlier screen goes quiet as before');
  // and with screen mode off, the same chat quiets it at once (no change for bots that don't use it)
  const off = setup({ screen: undefined, widgets: Object.fromEntries(Object.entries(W()).map(([k, w]) => { const x = { ...w }; delete x.step; return [k, x]; })) });
  const p0 = off.draw('Te ayudo: [[s:plan]]').widgets()[0]; off.say('¿Admitís perros?');
  assert.ok(p0.querySelector('.lbw-once.is-stale'));
  off.close();
  c.close();
});

test('screen: a step outside the closed list is logged and ignored; attacks draw text only', () => {
  const c = setup();
  for (const v of ['nope', '__proto__', '9', '0', '<b>x</b>', 'plan,dias', 'constructor']) {
    c.say('otra'); c.draw(`[[s:dias step=${v}]]`);
    assert.equal(c.LBW.screen.state().step, 'dias', v + ': the widget\'s own step');
  }
  const d = c.dropped().filter((x) => x.startsWith('screen: unknown step'));
  assert.equal(d.length, 7, d.join('\n'));
  assert.match(d[0], /^screen: unknown step "nope" in \[\[s:dias step=nope\]\]/);
  assert.equal(c.slot('head').querySelector('b'), null);
  c.say('otra'); c.draw('[[s:dias step=@{paso}]]');   // a flow's field left unset: no step, no noise
  assert.equal(c.dropped().filter((x) => x.startsWith('screen: unknown step')).length, 7);
  c.close();
});

test('screen: a widget with "screen": false never becomes the screen', () => {
  const c = setup();
  c.draw('Te ayudo: [[s:plan]]'); c.say('Hola');
  const m = c.draw('¿Seguimos? [[s:chips q=si,no]]');
  assert.equal(m.widgets().length, 1);
  assert.equal(c.LBW.screen.state().widget, 'plan');
  assert.deepEqual(c.past(), ['on', 'on', 'on']);
  c.close();
});

test('screen: "View conversation" shows the earlier messages and folds them again; LBW.screen.history does the same', () => {
  const c = setup();
  c.draw('Hola'); c.say('Quiero reservar'); c.draw('Te ayudo: [[s:plan]]');
  const hist = c.slot('head').querySelector('.lbw-scr-hist');
  hist.focus(); hist.click();
  assert.equal(c.win.getAttribute('data-lbw-screen'), 'open');
  assert.equal(hist.getAttribute('aria-expanded'), 'true');
  assert.equal(c.LBW.screen.state().open, true);
  assert.equal(c.d.activeElement, hist, 'focus stays on the toggle');
  assert.deepEqual(c.past(), ['past', 'past', 'on'], 'the marks stay; the mode shows them');
  hist.click();
  assert.equal(c.win.getAttribute('data-lbw-screen'), 'collapse'); assert.equal(hist.getAttribute('aria-expanded'), 'false');
  assert.equal(c.LBW.screen.history(true), true); assert.equal(c.win.getAttribute('data-lbw-screen'), 'open');
  assert.equal(c.LBW.screen.history(false), false); assert.equal(c.win.getAttribute('data-lbw-screen'), 'collapse');
  // "history": "keep": nothing folds, and there is no toggle
  const k = setup({ screen: { ...SCREEN(), history: 'keep' } });
  k.draw('Hola'); k.say('Quiero'); k.draw('[[s:plan]]');
  assert.equal(k.win.getAttribute('data-lbw-screen'), 'keep'); assert.deepEqual(k.past(), ['on', 'on', 'on']);
  assert.equal(k.slot('head').querySelector('.lbw-scr-hist'), null); assert.equal(k.LBW.screen.history(true), false);
  c.close(); k.close();
});

test('screen: focus moves to the new screen\'s heading from the old screen, never from the text box; the step is announced', async () => {
  const c = setup({ before: (x) => { const box = x.d.createElement('div'); box.setAttribute('data-lb-part', 'input-field'); box.innerHTML = '<input type="text" aria-label="Mensaje">'; x.d.querySelector('[data-lb-part="window"]').appendChild(box); } });
  const first = c.draw('Te ayudo: [[s:plan]]').widgets()[0];
  assert.notEqual(c.d.activeElement, first.querySelector('.lbw-title'), 'the first screen leaves focus where it is');
  const cta = first.querySelector('.lbw-cta'); cta.focus(); assert.equal(c.d.activeElement, cta);
  c.say('Mi plan: Suave');
  const two = c.draw('[[s:dias]]').widgets()[0], title = two.querySelector('.lbw-title');
  assert.equal(c.d.activeElement, title, 'focus on the new heading');
  assert.equal(title.getAttribute('tabindex'), '-1');
  await wait(450);
  assert.ok((c.w.__lbwAnnounced || []).some((x) => /Paso 2 de 3: Días/.test(x)), JSON.stringify(c.w.__lbwAnnounced));
  // the visitor is typing: focus stays in the box
  const input = c.d.querySelector('[data-lb-part="input-field"] input'); input.focus();
  c.say('Y el sábado'); const three = c.draw('[[s:fin step=listo]]').widgets()[0];
  assert.equal(c.d.activeElement, input);
  assert.ok(!input.closest('[data-lbw-past], [data-lbw-slot]'), 'the text box is never folded or wrapped');
  assert.ok(three);
  c.close();
});

test('screen: the bar mirrors the primary action once ready (aria-hidden, out of the tab order) and a press is the original\'s click', async () => {
  const c = setup();
  const w = c.draw('Te ayudo: [[s:plan]]').widgets()[0], cta = w.querySelector('.lbw-cta'), bar = c.slot('bar');
  assert.equal(bar.previousElementSibling, c.chat, 'the bar is our own element, right after the message column');
  assert.equal(bar.getAttribute('aria-hidden'), 'true');
  await wait(0);   // a form sets its CTA's state on a 0 ms timer
  assert.equal(cta.getAttribute('aria-disabled'), 'true');
  assert.equal(bar.hidden, true, 'not ready: the card says what is missing, the bar waits');
  w.querySelector('[role="radio"]').click();
  assert.equal(cta.getAttribute('aria-disabled'), null);
  await wait(0);
  assert.equal(bar.hidden, false, 'ready (and, with no IntersectionObserver, taken as out of view)');
  const go = bar.querySelector('button');
  assert.equal(go.tabIndex, -1);
  assert.equal(go.textContent, cta.textContent.trim());
  let n = 0; cta.addEventListener('click', () => n++);
  go.click(); assert.equal(n, 1);
  // a card with no button of its own: no bar
  c.say('Mi plan'); c.draw('[[s:dias]]'); assert.equal(c.slot('bar').hidden, true);
  // "bar": false
  const k = setup({ screen: { ...SCREEN(), bar: false } }); k.draw('[[s:plan]]'); assert.equal(k.slot('bar').hidden, true);
  c.close(); k.close();
});

test('screen: a new screen rises in under the motion gate only', async () => {
  const c = setup();
  c.draw('Hola'); c.say('Quiero'); const m = c.draw('[[s:plan]]');
  assert.equal(c.LBW.motion(), true);
  assert.ok(m.hasAttribute('data-lbw-in'));
  assert.equal(c.d.querySelectorAll('[data-lbw-in]').length, 1, 'only the new turn moves');
  await wait(950); assert.equal(c.d.querySelectorAll('[data-lbw-in]').length, 0, 'and the mark goes');
  const k = boot({ kit: true, scripts: SCRIPTS });
  k.w.LBW.kit.setup({ ...BASE, motion: false, screen: SCREEN(), widgets: W() });
  k.user('Quiero'); const m2 = k.bot('[[s:plan]]'); k.LBW.scan();
  assert.equal(k.w.LBW.motion(), false); assert.equal(m2.hasAttribute('data-lbw-in'), false);
  c.close(); k.close();
});

test('screen: a chat loading its history makes the last screen current, says nothing and moves no focus', async () => {
  const c = boot({ kit: true, scripts: SCRIPTS });
  c.bot('Te ayudo: [[s:plan]]'); c.user('Mi plan: Suave'); c.bot('[[s:dias]]'); c.user('Hola'); c.bot('Hola de nuevo');
  c.w.LBW.kit.setup({ ...BASE, screen: SCREEN(), widgets: W() });
  await wait(20);
  assert.equal(c.w.LBW.screen.state().widget, 'dias');
  assert.deepEqual([...c.chat.children].map((m) => m.hasAttribute('data-lbw-past')), [true, true, false, false, false]);
  assert.equal(c.d.activeElement, c.d.body);
  await wait(450);
  assert.ok(!(c.w.__lbwAnnounced || []).some((x) => /Paso/.test(x)));
  c.close();
});

test('screen: the progress header says "Paso n de m" and draws a bar', () => {
  const c = setup({ screen: { ...SCREEN(), header: { ...SCREEN().header, progress: true } } });
  c.draw('[[s:dias lang=en]]');
  const p = c.slot('head').querySelector('.lbw-scr-prog');
  assert.equal(p.querySelector('p').textContent, 'Step 2 of 3: Days');
  assert.equal(p.querySelector('.lbw-scr-track').getAttribute('aria-hidden'), 'true');
  assert.equal(c.slot('head').getAttribute('lang'), 'en');
  assert.equal(c.slot('head').querySelector('.lbw-scr-title').textContent, 'Your booking');
  c.close();
});

// ── the fallbacks: a normal chat ───────────────────────────────────────────────────────────────
test('screen: a missing hook (no chat window) leaves a normal chat and says why', () => {
  const c = setup({ before: (x) => x.d.querySelector('[data-lb-part="window"]').removeAttribute('data-lb-part') });
  c.draw('Hola'); c.say('Quiero'); const m = c.draw('[[s:plan]]');
  assert.equal(m.widgets().length, 1, 'the widget is drawn as always');
  assert.equal(c.d.querySelectorAll('[data-lbw-slot], [data-lbw-past], [data-lbw-screen]').length, 0);
  assert.equal(c.LBW.screen.state(), null);
  assert.ok(c.dropped().includes('screen: host changed: data-lb-part="window" (a normal chat)'), c.dropped().join('\n'));
  c.close();
});

test('screen: a wrong "screen" is reported, the widgets still work and the chat stays normal', () => {
  const plan = { ...W().plan }; delete plan.step;
  const c = setup({ screen: { on: true, history: 'fold', header: { steps: [['plan', 'Plan']] } }, widgets: { plan } });
  assert.equal(c.result.ok, false);
  assert.deepEqual(c.result.widgets, ['plan'], 'a screen error never stops the widgets');
  assert.ok(c.result.errors.some((e) => /^screen\.history/.test(e)));
  c.draw('Hola'); c.say('Q'); assert.equal(c.draw('[[s:plan]]').widgets().length, 1);
  assert.equal(c.win.hasAttribute('data-lbw-screen'), false);
  // with no checker (the bundle a bot loads) the runtime refuses it by itself
  const r = boot({ kit: true, scripts: ['runtime/screen.js', 'kit/setup.js'] });
  r.w.LBW.kit.setup({ ...BASE, screen: { on: true, history: 'fold' }, widgets: { plan: W().plan } });
  r.user('Q'); assert.equal(r.bot('[[s:plan]]').widgets().length, 0); r.LBW.scan();
  assert.equal(r.d.querySelector('[data-lb-part="window"]').hasAttribute('data-lbw-screen'), false);
  assert.ok(r.dropped().includes('screen: history is "collapse" or "keep" (a normal chat)'), r.dropped().join('\n'));
  assert.equal(r.w.LBW.screen.start({ on: true }), false, 'once refused, it stays off');
  c.close(); r.close();
});

test('screen: an error while laying out turns it off and the chat is normal again', () => {
  const c = setup();
  c.draw('Hola'); c.say('Q'); c.draw('[[s:plan]]');
  assert.equal(c.win.getAttribute('data-lbw-screen'), 'collapse');
  c.w.LBW_HOST.collapse = () => { throw new Error('boom'); };
  c.say('Mi plan'); c.draw('[[s:dias]]');
  assert.equal(c.win.hasAttribute('data-lbw-screen'), false);
  assert.equal(c.d.querySelectorAll('[data-lbw-slot]').length, 0);
  assert.ok(c.dropped().includes('screen: error: boom (a normal chat)'));
  c.close();
});

// ── the adapter, on the real v4 DOM ────────────────────────────────────────────────────────────────
const FIX = (name) => read('test/fixtures/host-v4/' + name + '.html').replace(/^<!--[\s\S]*?-->\n/, '');
test('host: column, rowOf, slot, collapse and layout on the captured v4 window', () => {
  const dom = new JSDOM(`<!doctype html><html><body>${FIX('user-message')}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document; w.eval(read('runtime/host-v4.js')); const H = w.LBW_HOST;
  const win = H.window(), col = H.column(), ms = H.messages();
  assert.equal(col.parentElement, win); assert.equal(col.getAttribute('aria-label'), 'Label', 'the scrolling column (aria-label="Label" after sanitizing)');
  assert.ok(col.contains(ms[0]) && !col.contains(d.querySelector('[data-lb-part="header"]')) && !col.contains(d.querySelector('[data-lb-part="options-list"]')));
  const row = H.rowOf(ms[2]);
  assert.notEqual(row, ms[2]); assert.equal(row.firstElementChild, ms[2]); assert.equal(row.querySelectorAll('[data-lb-part="message"]').length, 1);
  assert.equal(H.rowOf(H.textBox(ms[2])), row, 'from anything inside the message');
  assert.equal(H.rowOf(d.querySelector('[data-lb-part="options-list"] button')), null);
  const head = H.slot('head'), bar = H.slot('bar');
  assert.equal(head.nextElementSibling, col); assert.equal(bar.previousElementSibling, col); assert.equal(H.slot('head'), head, 'made once');
  assert.equal(ms.length, 8);
  assert.equal(H.collapse(ms[3]), 3);
  assert.deepEqual([...ms].map((m) => H.rowOf(m).hasAttribute('data-lbw-past')), [true, true, true, false, false, false, false, false]);
  assert.equal(H.layout('collapse'), true); assert.equal(win.getAttribute('data-lbw-screen'), 'collapse');
  assert.equal(H.layout(null), true);
  assert.equal(d.querySelectorAll('[data-lbw-slot], [data-lbw-past], [data-lbw-screen]').length, 0, 'a normal chat again');
  assert.equal(H.column(d.createElement('div')), null);
});

// ── the checker and the schema ─────────────────────────────────────────────────────────────────────
test('check: a screen config, sentence by sentence; a screen error is marked so setup() keeps the widgets', () => {
  const c = boot({ kit: true, scripts: SCRIPTS }), check = (cfg) => json(c.w.LBW.kit.setup._check(cfg));
  assert.deepEqual(check({ ...BASE, screen: SCREEN(), widgets: W() }), []);
  const bad = check({ ...BASE, screen: { on: 'yes', bar: 1, history: 'fold', extra: 1, header: { title: 'x', steps: [['Plan', 'P'], ['b', 'B'], ['b', 'C']], progres: true } },
    widgets: { dias: { ...W().dias, step: 'nope', screen: 'no' } } });
  assert.deepEqual(bad.map((e) => e.message), [
    'screen: unknown key "extra". Known: on, header, bar, history',
    'screen.on is true (screen mode) or false',
    'screen.bar is true or false: false, no bottom bar',
    'screen.history is "collapse" (earlier messages fold behind "View conversation") or "keep" (they stay)',
    'screen.header: unknown key "progres". Known: title, steps, progress. Did you mean "progress"?',
    'screen.header.steps[0]: the id "Plan" is a lower-case word (a tag writes it: step=plan)',
    'screen.header.steps[2]: the id "b" is there twice',
    'dias: "screen" is true or false: false keeps this widget out of screen mode',
    'dias: "step" "nope" is not a step of "screen.header.steps". Known: b',
  ]);
  assert.deepEqual(bad.filter((e) => e.screen).length, 7);
  assert.ok(bad.slice(7).every((e) => e.widget === 'dias' && !e.screen));
  assert.deepEqual(check({ ...BASE, widgets: { dias: W().dias } }).map((e) => e.message), ['dias: "step" names a step of "screen.header.steps", and the config has none']);
  assert.deepEqual(check({ ...BASE, screen: { on: true, header: { progress: true } }, widgets: {} }).map((e) => e.message), ['screen.header.progress needs "steps"']);
  assert.deepEqual(check({ ...BASE, screen: { on: true, header: { steps: [['a', 'A']] } }, widgets: {} }).map((e) => e.message), ['screen.header.steps is a list of 2 to 8 [id, label]']);
  assert.deepEqual(check({ ...BASE, screen: [], widgets: {} }).map((e) => e.message)[0].slice(0, 20), '"screen" is { "on": ');
  c.close();
});

test('schema: "screen" and each widget\'s "screen" and "step" are described, and checked as far as the schema can', () => {
  const S = generate().schema;
  assert.deepEqual(Object.keys(S.properties.screen.properties), ['on', 'header', 'bar', 'history']);
  for (const t of ['form', 'cards', 'calendar', 'confirm']) assert.ok(S.$defs[t].properties.screen && S.$defs[t].properties.step, t);
  assert.deepEqual(validate(S, { ...BASE, screen: SCREEN(), widgets: W() }), []);
  const errs = validate(S, { prefix: 's', screen: { on: true, history: 'fold', zoom: 1 }, widgets: { a: { type: 'cards', step: 'Nope', screen: 'x', items: {} } } }).map((e) => e.path);
  for (const p of ['screen.zoom', 'screen.history', 'widgets.a.step', 'widgets.a.screen']) assert.ok(errs.some((x) => x.startsWith(p)), p + ' in ' + errs.join(', '));
});

test('screen: no Landbot hook or global in screen.js (the adapter does the DOM)', () => {
  const src = read('runtime/screen.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.doesNotMatch(src, /data-lb-|_landbot|\bLandbot\./);
  assert.match(read('scripts/build.mjs'), /runtime\/lbw\.js'\) \+ '\\n' \+ await js\('runtime\/screen\.js'\)/, 'built right after lbw.js');
});
