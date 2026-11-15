// test/focus.test.mjs · v0.14 focus moments ("focus" on a widget, LBW.kit.focus) and what replaced v0.13's screen mode:
// the moment is drawn inside its widget (a labelled region, its title, "Step 2 of 3 · Label", the primary action docked);
// the step comes from the config or the tag's closed list; once sent it folds to its receipt ("after": "keep" leaves it open),
// a failed send opens it again; an older copy of the same moment goes inert; a question typed mid-moment doesn't end it;
// focus moves in only when the visitor isn't in the text box; the adapter's one mark; "actionRows"; the tracker's big ETA;
// the checker (focus, actionRows, the "screen" warnings) and the schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { boot, json, read, wait } from './helpers.mjs';
import { generate, validate } from '../scripts/schema.mjs';
import { checkConfig, checkWarnings, checkConfigDetailed } from '../scripts/lib.mjs';

const BASE = { prefix: 's', langs: ['es', 'en'], defaultLang: 'es', quietMs: 10, links: [] };
const STEPS = [['plan', 'Plan'], ['dias', { es: 'Días', en: 'Days' }], ['listo', 'Listo']];
const W = () => ({
  plan: { type: 'form', title: 'Tu plan', cta: 'Enviar mi plan', focus: { title: { es: 'Tu escapada', en: 'Your trip' }, steps: STEPS, step: 'plan' },
    steps: [{ key: 'nivel', title: 'Nivel', items: [['suave', 'Suave'], ['duro', 'Duro']] }], summary: 'Mi plan: {nivel:label}', fields: { s_nivel: '{nivel}' } },
  abierto: { type: 'form', title: 'Abierto', cta: 'Enviar', focus: { after: 'keep' },
    steps: [{ key: 'k', title: 'K', items: [['a', 'A'], ['b', 'B']] }], summary: 'Elijo {k:label}' },
  justo: { type: 'form', title: 'Justo', cta: 'Enviar', focus: true, steps: [{ key: 'k', title: 'K', items: [['a', 'A'], ['b', 'B']] }], summary: 'Elijo {k:label}' },
  vs: { type: 'compare', title: 'Compara', focus: { steps: STEPS, step: 'dias' }, rows: [['precio', 'Precio']],
    items: { a: { name: 'A', values: { precio: '10 €' }, reply: ['Quiero A', 'Me quedo con A'] }, b: { name: 'B', values: { precio: '12 €' }, reply: ['Quiero B', 'Me quedo con B'] } } },
  info: { type: 'cards', actionRows: true, item: { title: 'Info' }, reply: ['Más', 'Quiero saber más'], links: ['web'] },
  chips: { type: 'chips', items: { si: ['Sí', 'Sí, quiero'], no: ['No', 'Ahora no'] } },
});
function setup(widgets = W(), extra = {}, o = {}) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'], ...o });
  c.result = json(c.w.LBW.kit.setup({ ...BASE, links: ['https://x.example/'], actions: { web: { link: 'https://x.example/', label: 'Web' } }, ...extra, widgets }));
  c.check = (w, x = {}) => json(c.w.LBW.kit.setup.check({ ...BASE, links: ['https://x.example/'], actions: { web: { link: 'https://x.example/', label: 'Web' } }, ...x, widgets: w }));
  c.draw = (text) => { const m = c.bot(text); c.LBW.scan(); return m; };
  c.say = (text) => { const m = c.user(text); c.LBW.scan(); return m; };
  c.said = () => [...(c.w.__lbwAnnounced || [])].map(String);
  return c;
}
const pick = (w, k) => w.querySelector(`[data-k="${k}"]`).click();

// ── drawn inside the widget ─────────────────────────────────────────────────────────────────────────
test('focus: a labelled region with its own title, "Paso 1 de 3 · Plan" and a bar; the CTA docked; the message marked', () => {
  const c = setup(); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = c.draw('Empecemos: [[s:plan]]'), w = m.widgets()[0];
  assert.ok(w.classList.contains('is-focus'));
  assert.equal(w.getAttribute('role'), 'region');
  const h = w.querySelector('.kit-focus-h'); assert.equal(h.textContent, 'Tu escapada', 'focus.title replaces the widget\'s title');
  assert.equal(w.getAttribute('aria-labelledby'), h.id); assert.equal(h.getAttribute('role'), 'heading'); assert.equal(h.getAttribute('tabindex'), '-1');
  const st = w.querySelector('.kit-focus-step'); assert.equal(st.textContent, 'Paso 1 de 3 · Plan'); assert.equal(w.getAttribute('aria-describedby'), st.id);
  assert.deepEqual([...w.querySelectorAll('.kit-focus-bar li')].map((li) => li.className), ['is-cur', '', '']);
  assert.equal(w.querySelector('.kit-focus-bar').getAttribute('aria-hidden'), 'true');
  assert.ok(w.querySelector('.lbw-cta').classList.contains('kit-dock'));
  assert.equal(m.getAttribute('data-lbw-focus'), '', 'the one mark on Landbot\'s tree: the message that holds it');
  assert.equal(c.d.querySelectorAll('[data-lbw-focus]').length, 1);
  // in English: the title and the step label by language, "Step 1 of 3"
  const e = c.draw('Let\'s go: [[s:plan lang=en]]').widgets()[0];
  assert.equal(e.querySelector('.kit-focus-h').textContent, 'Your trip'); assert.equal(e.querySelector('.kit-focus-step').textContent, 'Step 1 of 3 · Plan');
  c.close();
});

test('focus: the tag picks step= from the closed list; anything else is logged and ignored (the config\'s step stays)', () => {
  const c = setup();
  const w = c.draw('[[s:plan step=dias]]').widgets()[0];
  assert.equal(w.querySelector('.kit-focus-step').textContent, 'Paso 2 de 3 · Días'); assert.equal(w.getAttribute('data-lbw-step'), 'dias');
  assert.deepEqual([...w.querySelectorAll('.kit-focus-bar li')].map((li) => li.className), ['is-done', 'is-cur', '']);
  for (const bad of ['otro', '2', '<b>x']) {
    const x = c.draw(`[[s:plan step=${bad}]]`).widgets()[0];
    assert.equal(x.querySelector('.kit-focus-step').textContent, 'Paso 1 de 3 · Plan', bad);
  }
  assert.ok(c.dropped().some((d) => /plan: step=otro is not one of its steps/.test(d)), c.dropped().join('\n'));
  // "focus": true: no steps, no step line; the widget's own title is the region's name
  const j = c.draw('[[s:justo]]').widgets()[0];
  assert.equal(j.querySelector('.kit-focus-step'), null); assert.equal(j.querySelector('.kit-focus-h').textContent, 'Justo');
  assert.equal(j.getAttribute('aria-labelledby'), j.querySelector('.kit-focus-h').id);
  c.close();
});

test('focus: a type without a CTA docks its row with the primary (compare); actionRows and every moment stack the buttons when narrow', () => {
  const c = setup();
  const v = c.draw('[[s:vs ids=a,b]]').widgets()[0];
  assert.ok(v.classList.contains('is-focus')); assert.equal(v.querySelector('.kit-focus-step').textContent, 'Paso 2 de 3 · Días');
  const i = c.draw('[[s:info]]').widgets()[0];
  assert.ok(i.classList.contains('lbw-stack')); assert.ok(!i.classList.contains('is-focus'));
  const css = read('runtime/lbw.css');
  assert.match(css, /@container lbw \(max-width: 480px\) \{\s*:is\(\.lbw-stack, \.is-focus\) > \.lbw-actions/);
  c.close();
});

// ── after: receipt, keep; a failed send ───────────────────────────────────────────────────────────────
test('focus: once sent it folds to its receipt (the "Sent · …" line), unmarks its message and says it politely', async () => {
  const c = setup(); const m = c.draw('[[s:plan]]'), w = m.widgets()[0];
  pick(w, 'suave'); await wait(5); w.querySelector('.lbw-cta').click(); await wait(400);
  assert.deepEqual(c.sent.at(-1), ['landbot-msg-send', { type: 'text', message: 'Mi plan: Suave' }]);
  assert.ok(w.classList.contains('is-receipt') && w.classList.contains('is-focus-done') && w.classList.contains('is-collapsed'));
  assert.ok(!w.classList.contains('is-focus'), 'no longer the live moment');
  assert.match(w.querySelector('.kit-sentline').textContent, /Enviado.*Mi plan: Suave/);
  assert.ok(w.querySelector('.kit-sentline .lbw-check'), 'the check of a receipt');
  assert.equal(m.hasAttribute('data-lbw-focus'), false);
  await wait(1500); assert.ok(c.said().some((s) => /Enviado: Mi plan: Suave/.test(s)), c.said().join(' | '));
  c.close();
});

test('focus: "after": "keep" leaves it open and done; a type that doesn\'t fold itself (compare) gets its line from what it sent', async () => {
  const c = setup(); const w = c.draw('[[s:abierto]]').widgets()[0];
  pick(w, 'a'); await wait(5); w.querySelector('.lbw-cta').click(); await wait(400);
  assert.ok(w.classList.contains('is-focus-done') && w.classList.contains('is-focus')); assert.ok(!w.classList.contains('is-receipt'));
  assert.ok(!w.classList.contains('is-collapsed'), 'open: the form\'s own fold is undone'); assert.ok(w.querySelector('.lbw-form.is-done'), 'and done: nothing sends twice');
  await wait(1300);   // one send per 1.2 s (a double click)
  const v = c.draw('[[s:vs ids=a,b]]').widgets()[0];
  [...v.querySelectorAll('button')].find((b) => b.textContent === 'Quiero B').click(); await wait(400);
  assert.ok(v.classList.contains('is-receipt'));
  assert.equal(v.querySelector('.kit-sentline .kit-sent-t').textContent, 'Me quedo con B');
  c.close();
});

test('focus: a send that fails opens the moment again (no receipt, its message marked); a retry folds it', async () => {
  const c = setup(W(), {}, { landbot: false }); const m = c.draw('[[s:plan]]'), w = m.widgets()[0];
  pick(w, 'duro'); await wait(5); w.querySelector('.lbw-cta').click(); await wait(400);
  assert.ok(c.dropped().some((d) => /no way to send: Mi plan: Duro/.test(d)));
  assert.ok(w.classList.contains('is-focus')); assert.ok(!w.classList.contains('is-receipt')); assert.ok(!w.classList.contains('is-focus-done'));
  assert.equal(m.getAttribute('data-lbw-focus'), '');
  c.w.Landbot = { exec: (n, p) => c.sent.push([n, json(p)]) };
  await wait(1300); w.querySelector('.lbw-retry').click(); await wait(80);
  assert.ok(w.classList.contains('is-receipt'));
  c.close();
});

// ── one live copy; a question mid-moment ────────────────────────────────────────────────────────────
test('focus: drawn again, the older copy goes inert (no control, its message unmarked); a receipt is history and stays', () => {
  const c = setup(); const m1 = c.draw('[[s:plan]]'), a = m1.widgets()[0];
  c.say('¿Puedo ir con niños?');
  const m2 = c.draw('Sí, claro. Sigue: [[s:plan]]'), b = m2.widgets()[0];
  assert.ok(a.classList.contains('is-inert')); assert.equal(a.getAttribute('inert'), ''); assert.ok(!a.classList.contains('is-focus'));
  assert.equal(a.getAttribute('role'), null, 'no second region of the same name');
  assert.equal(m1.hasAttribute('data-lbw-focus'), false); assert.equal(m2.getAttribute('data-lbw-focus'), '');
  assert.ok(b.classList.contains('is-focus') && !b.classList.contains('is-inert'));
  assert.equal(c.d.querySelectorAll('.lbw.is-focus[data-widget="plan"]').length, 1);
  const css = read('kit/kit.css'); assert.match(css, /\.lbw\.is-inert > \.lbw-box > :not\(\.kit-gone\), \.lbw\.is-inert > \.lbw-actions \{ display: none !important; \}/);
  assert.equal(a.querySelector('.lbw-box > .kit-gone .kit-gone-t').textContent, 'Tu escapada', 'one line: its title');
  c.close();
});

test('focus: a receipted copy is not made inert by a later draw', async () => {
  const c = setup(); const a = c.draw('[[s:justo]]').widgets()[0];
  pick(a, 'a'); await wait(5); a.querySelector('.lbw-cta').click(); await wait(400);
  c.say('Otra vez'); const b = c.draw('[[s:justo]]').widgets()[0];
  assert.ok(a.classList.contains('is-receipt') && !a.classList.contains('is-inert'));
  assert.ok(b.classList.contains('is-focus'));
  c.close();
});

test('focus: a question typed mid-moment doesn\'t end it (it still sends); an older moment goes quiet as before; other cards too', async () => {
  const c = setup(); const chips = c.draw('[[s:chips q=si,no]]').widgets()[0];
  const m = c.draw('[[s:plan]]'), w = m.widgets()[0];
  c.say('¿Cuánto cuesta?'); c.draw('Depende del plan: lo ves al final.');
  assert.equal(w.querySelector('.lbw-once.is-stale'), null, 'the moment stays live');
  assert.ok(chips.querySelector('.lbw-once.is-stale'), 'an older one-shot group goes quiet, as before v0.14');
  pick(w, 'suave'); await wait(5); w.querySelector('.lbw-cta').click(); await wait(400);
  assert.deepEqual(c.sent.at(-1), ['landbot-msg-send', { type: 'text', message: 'Mi plan: Suave' }]);
  // a newer moment drawn after the visitor wrote: the older one, still open, goes quiet
  const o = c.draw('[[s:abierto]]').widgets()[0]; c.say('Hola'); c.draw('[[s:justo]]');
  assert.ok(o.querySelector('.lbw-once.is-stale'), 'only the newest open moment is kept live');
  c.close();
});

// ── focus on arrival ─────────────────────────────────────────────────────────────────────────────────
test('focus: arriving, focus moves to its heading, unless the visitor is in the text box or not in this document (an iframe)', () => {
  const c = setup(); let has = false; c.d.hasFocus = () => has;
  const x = c.draw('[[s:plan]]').widgets()[0];
  assert.notEqual(c.d.activeElement, x.querySelector('.kit-focus-h'), 'the page around the chat\'s iframe keeps its focus');
  has = true;
  const w = c.draw('[[s:plan]]').widgets()[0];
  assert.equal(c.d.activeElement, w.querySelector('.kit-focus-h'));
  const f = c.d.createElement('div'); f.setAttribute('data-lb-part', 'input-field'); const box = c.d.createElement('input'); box.type = 'text'; f.appendChild(box); c.d.querySelector('[data-lb-part="window"]').appendChild(f);
  box.focus(); assert.equal(c.d.activeElement, box);
  c.say('Una pregunta'); c.draw('Respuesta: [[s:plan]]');
  assert.equal(c.d.activeElement, box, 'typing is never interrupted');
  c.close();
});

// ── hand-written widgets, the adapter, the tracker ─────────────────────────────────────────────────────
test('focus: LBW.kit.focus(o, focus, p) on a widget written by hand', () => {
  const c = setup({}, {});
  c.LBW.widget('viaje', (p, ctx) => c.LBW.kit.focus(c.LBW.ui.card(ctx.lang, 'np-viaje'), { title: 'Tu viaje', steps: [['a', 'Dónde'], ['b', 'Cuándo']], step: 'a' }, p));
  const w = c.draw('[[s:viaje step=b]]').widgets()[0];
  assert.ok(w.classList.contains('is-focus')); assert.equal(w.querySelector('.kit-focus-h').textContent, 'Tu viaje');
  assert.equal(w.querySelector('.kit-focus-step').textContent, 'Paso 2 de 2 · Cuándo');
  assert.deepEqual([...c.LBW.kit.focus.types], ['form', 'calendar', 'slots', 'calc', 'review', 'compare', 'confirm']);
  c.close();
});

test('host: mark() puts data-lbw-focus on the message that holds a node, on the real v4 DOM, and nothing else', () => {
  const html = read('test/fixtures/host-v4/user-message.html').replace(/^<!--[\s\S]*?-->\n/, '');
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { runScripts: 'outside-only' }), w = dom.window;
  w.eval(read('runtime/host-v4.js')); const H = w.LBW_HOST, m = H.messages()[1], t = H.textBox(m);
  assert.equal(H.mark(t, true), m); assert.equal(m.getAttribute('data-lbw-focus'), '');
  assert.equal(w.document.querySelectorAll('[data-lbw-focus]').length, 1);
  assert.equal(H.mark(t, false), m); assert.equal(m.hasAttribute('data-lbw-focus'), false);
  assert.equal(H.mark(w.document.body, true), null, 'a node in no message: nothing marked');
  // v0.12's scope plus mark(): screen mode's functions are gone
  for (const k of ['column', 'rowOf', 'slot', 'collapse', 'layout', 'scroller', 'present', 'scrollTo', 'header']) assert.equal(H[k], undefined, k);
  assert.doesNotMatch(read('runtime/host-v4.js'), /responsive-container|data-lbw-(past|slot|screen|cur|chrome|aside|off)/);
});

test('v0.14: screen mode is gone from the runtime: no LBW.screen, no screen.js in the bundle (LBW.unhold came back in v0.14.0.3)', () => {
  const c = setup({});
  assert.equal(c.LBW.screen, undefined);
  assert.doesNotMatch(read('dist/lbw.min.js'), /lbw-scr-|data-lbw-screen/);
  assert.doesNotMatch(read('dist/lbw-kit.min.css'), /lbw-scr-|data-lbw-screen/);
  c.close();
});

test('tracker: "eta": { "big": true } draws the ETA as a large title (--lbw-title-xl)', () => {
  const c = setup({ pedido: { type: 'tracker', title: 'Tu pedido', steps: [{ key: 'hecho', label: 'Hecho' }, { key: 'ruta', label: 'En ruta' }, { key: 'listo', label: 'Entregado' }], eta: { time: 'hora', text: 'Llega {when}', big: true } } });
  c.w.__lbwNow = '10:00';   // the ETA (18:30) is still to come, whatever the clock says
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const w = c.draw('[[s:pedido estado=ruta hora=18:30]]').widgets()[0], e = w.querySelector('.kit-trk-eta');
  assert.ok(e.classList.contains('is-big'), e.outerHTML);
  assert.match(read('kit/kit.css'), /\.kit-trk-eta\.is-big \{ font: 700 var\(--lbw-title-xl, 28px\)/);
  assert.match(read('runtime/lbw.css'), /--lbw-title-xl: 28px;/);
  assert.deepEqual(c.check({ p: { type: 'tracker', title: 'T', steps: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], eta: { time: 'h', big: 'yes' } } }), ['p: eta.big is true (the ETA as a large title, --lbw-title-xl) or false']);
  c.close();
});

// ── the checker, setup() and the schema ───────────────────────────────────────────────────────────────
test('check: "focus" and "actionRows", sentence by sentence; focus only on the types that take it', () => {
  const c = setup({});
  assert.deepEqual(c.check(W()), []);
  const f = (focus, type = 'form') => c.check({ x: { ...W().justo, type, focus } }).map((m) => m.replace(/^\[\w+\] /, '')).filter((m, i, a) => a.indexOf(m) === i);
  assert.deepEqual(f('yes'), ['x: "focus" is true, or { "title": "…", "steps": [["id", "Label"], …], "step": "id", "after": "receipt" | "keep" }']);
  assert.deepEqual(f({ after: 'fold', titel: 'x' }), ['x: focus: unknown key "titel". Known: title, steps, step, after. Did you mean "title"?', 'x: focus.after is "receipt" (it folds to one line once sent, the default) or "keep" (it stays open)']);
  assert.deepEqual(f({ steps: [['a', 'A']] }), ['x: focus.steps is a list of 2 to 8 [id, label]']);
  assert.deepEqual(f({ steps: [['a', 'A'], ['A b', 'B'], ['a', 'C']], step: 'z' }), ['x: focus.steps[1]: the id "A b" is a lower-case word (a tag writes it: step=ab)', 'x: focus.steps[2]: the id "a" is there twice', 'x: focus.step "z" is not one of focus.steps. Known: a. Did you mean "a"?']);
  assert.deepEqual(f({ step: 'a' }), ['x: focus.step names one of "focus.steps", and there are none']);
  assert.deepEqual(f({ title: 'x'.repeat(61) }), ['x: focus.title is one line of text, 60 characters at most']);
  assert.match(c.check({ x: { type: 'cards', item: { title: 'T' }, focus: true } })[0], /^x: unknown option "focus" for cards/);
  assert.deepEqual(c.check({ x: { type: 'cards', item: { title: 'T' }, actionRows: 'yes' } }), ['x: "actionRows" is true (the buttons as full-width rows while the widget is narrow) or false']);
  c.close();
});

test('check: v0.13\'s "screen" (and a widget\'s "screen" / "step") is a warning, never an error; setup() ignores it and draws as before', () => {
  const cfg = { ...BASE, screen: { on: true, header: { steps: [['a', 'A'], ['b', 'B']] }, bar: 'always' },
    widgets: { plan: { ...W().justo, step: 'a', screen: false }, chips: W().chips } };
  assert.deepEqual(checkConfig(cfg), [], 'no error');
  assert.deepEqual(checkWarnings(cfg), [
    'warning: "screen" was removed in v0.14 (screen mode) and is ignored: give the widget a "focus" for a focused task',
    'plan: warning: "screen" was removed in v0.14 (screen mode) and is ignored: give the widget a "focus" for a focused task',
    'plan: warning: "step" was removed in v0.14 (screen mode) and is ignored: give the widget a "focus" for a focused task',
  ]);
  assert.ok(checkConfigDetailed(cfg).every((e) => e.warning));
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  const r = json(c.w.LBW.kit.setup(cfg));
  assert.deepEqual(r, { ok: true, errors: [], widgets: ['plan', 'chips'] });
  assert.equal(c.w.__kitSetupWarnings.length, 3);
  const m = c.bot('[[s:plan]]'); c.LBW.scan();
  assert.equal(m.widgets().length, 1); assert.equal(c.d.querySelectorAll('[data-lbw-screen], [data-lbw-slot], [data-lbw-past]').length, 0);
  // the bundle a bot loads (no checker): the same config draws too
  const b = boot({ kit: true, scripts: ['kit/setup.js'] }); assert.equal(json(b.w.LBW.kit.setup(cfg)).ok, true);
  c.close(); b.close();
});

test('schema: "focus" on the seven types, "actionRows" on every type, "screen" kept as deprecated (never stricter than the checker)', () => {
  const { schema } = generate();
  const cfg = { ...BASE, screen: { on: true }, widgets: { ...W(), old: { ...W().justo, step: 'x', screen: true } } };
  assert.deepEqual(validate(schema, cfg), []);
  assert.ok(schema.properties.screen.deprecated);
  for (const t of ['form', 'calendar', 'slots', 'calc', 'review', 'compare', 'confirm']) assert.ok(schema.$defs[t].properties.focus, t);
  for (const t of ['cards', 'chips', 'tracker', 'rating']) { assert.equal(schema.$defs[t].properties.focus, undefined, t); assert.ok(schema.$defs[t].properties.actionRows, t); }
  assert.notDeepEqual(validate(schema, { ...BASE, widgets: { x: { ...W().justo, focus: { after: 'fold' } } } }), []);
  assert.notDeepEqual(validate(schema, { ...BASE, widgets: { x: { type: 'cards', item: { title: 'T' }, focus: true } } }), []);
});

// ── v0.14.0.1 · from two live bots ───────────────────────────────────────────────────────────────────
const W2 = () => ({
  ...W(),
  viaje: { type: 'calc', title: 'Tu viaje', cta: 'Confirmar', focus: { title: 'Revisa tu viaje', steps: STEPS, step: 'listo' },
    state: { adults: { min: 1, max: 9, default: 1, int: true }, kids: { min: 0, max: 9, default: 0, int: true }, cabin: { values: ['eco', 'plus'], default: 'eco' } },
    controls: [{ stepper: 'adults', label: 'Adultos' }, { stepper: 'kids', label: 'Niños' }, { pick: 'cabin', title: 'Cabina', items: [['eco', 'Economy'], ['plus', 'Economy Plus']] }],
    tables: { fare: { eco: 99, plus: 136 } }, compute: { total: '(adults + kids) * fare[cabin]' }, result: { total: ['Total', '{total} €'] },
    send: { text: '{adults} adultos, {kids} niños, {cabin:label}: {total} €', fields: { a: '{adults}' } } },
  hora: { type: 'slots', title: 'Entrega', cta: 'Reservar', say: { text: 'Entrega el {day:dmy} a las {from:time}', fields: { e: '{from:time}' } }, focus: true,
    days: [{ date: '16/11/2026', slots: [['10:00', '11:00'], ['12:00', '13:00']] }, { date: '17/11/2026', slots: [['09:00', '10:00'], ['16:00', '17:00']] }] },
  noches: { type: 'calendar', title: 'Noches', cta: 'Reservar', months: 1, horizon: 120, hidePast: true, focus: { title: 'Elige tus noches', steps: STEPS, step: 'dias' },
    send: { text: 'Del {from:dmy} al {to:dmy}', fields: { ida: '{from:dmy}' } } },
});
const S2 = () => { const c = setup(W2()); c.w.__lbwToday = '14/11/2026'; return c; };
const live = (c, n) => [...c.d.querySelectorAll(`.lbw.is-focus[data-widget="${n}"]`)].pop();

test('carry: a redrawn moment keeps the visitor\'s live state (form picks, steppers, a pick, slots, a calendar range); the tag\'s new values win', async () => {
  const c = S2(); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  // a calc: 2 adults + 1 child + Economy Plus, then a question, then the same tag again
  const v1 = c.draw('[[s:viaje adults=1]]').widgets()[0];
  const more = (w, i) => w.querySelectorAll('.lbw-step')[i].querySelectorAll('button')[1].click();
  more(v1, 0); more(v1, 1); v1.querySelector('[data-k="plus"]').click(); await wait(10);
  c.say('¿Hay reembolso?'); const v2 = c.draw('No en esta tarifa. [[s:viaje adults=1]]').widgets()[0]; await wait(10);
  assert.deepEqual([...v2.querySelectorAll('.lbw-step-n')].map((x) => x.textContent), ['2', '1'], 'steppers carried');
  assert.equal(v2.querySelector('[data-k="plus"]').getAttribute('aria-checked'), 'true', 'the pick carried');
  assert.match(v2.textContent, /408 €/);
  assert.deepEqual(json(v2.__carried), ['adults', 'kids', 'cabin']);
  // the agent writes another value: that key takes it, the rest stay
  c.say('Somos tres adultos'); const v3 = c.draw('[[s:viaje adults=3]]').widgets()[0]; await wait(10);
  assert.deepEqual([...v3.querySelectorAll('.lbw-step-n')].map((x) => x.textContent), ['3', '1']);
  assert.equal(v3.querySelector('[data-k="plus"]').getAttribute('aria-checked'), 'true');
  // a form's pick
  const f1 = c.draw('[[s:plan]]').widgets()[0]; pick(f1, 'duro'); await wait(5);
  c.say('?'); const f2 = c.draw('[[s:plan]]').widgets()[0];
  assert.equal(f2.querySelector('[data-k="duro"]').getAttribute('aria-checked'), 'true');
  // slots: the day and the time
  const s1 = c.draw('[[s:hora]]').widgets()[0]; [...s1.querySelectorAll('[role="radio"]')].find((b) => /17/.test(b.getAttribute('aria-label') || '')).click(); await wait(5);
  [...s1.querySelectorAll('.kit-slot')].find((b) => /16:00/.test(b.textContent)).click(); await wait(5);
  c.say('¿Dejáis el paquete al vecino?'); const s2 = c.draw('[[s:hora]]').widgets()[0];
  assert.match(s2.querySelector('.kit-slot[aria-checked="true"]').textContent, /16:00/);
  // a calendar range: carried, unless the tag presets another one
  const d = (w, n) => w.querySelector(`[data-day="${Math.floor(Date.UTC(2026, 10, n) / 864e5)}"]`);
  const k1 = c.draw('[[s:noches]]').widgets()[0]; d(k1, 18).click(); d(k1, 20).click(); await wait(5);
  c.say('¿Perros?'); const k2 = c.draw('[[s:noches]]').widgets()[0];
  assert.equal(d(k2, 18).getAttribute('aria-pressed'), 'true'); assert.equal(d(k2, 20).getAttribute('aria-pressed'), 'true');
  c.say('Mejor del 23 al 25'); const k3 = c.draw('[[s:noches from=23/11/2026 to=25/11/2026]]').widgets()[0];
  assert.equal(d(k3, 23).getAttribute('aria-pressed'), 'true'); assert.equal(d(k3, 18).getAttribute('aria-pressed'), null);
  c.close();
});

test('carry: only from an open focus moment of the same name; a value that no longer fits is dropped', async () => {
  const c = S2();
  const f1 = c.draw('[[s:plan]]').widgets()[0]; pick(f1, 'duro'); await wait(5); f1.querySelector('.lbw-cta').click(); await wait(400);
  c.say('Otra'); const f2 = c.draw('[[s:plan]]').widgets()[0];
  assert.equal(f2.querySelector('[data-k="duro"]').getAttribute('aria-checked'), 'false', 'a sent moment hands nothing over');
  c.close();
});

test('superseded: an older copy, or an open moment followed by a newer one, is one line "Title · what it had"; trackers too', async () => {
  const c = S2();
  const f1 = c.draw('[[s:plan]]').widgets()[0]; pick(f1, 'suave'); await wait(5);
  c.say('Barcelona a Roma, somos dos'); c.draw('[[s:noches]]');
  assert.ok(f1.classList.contains('is-inert'), 'another moment supersedes an open one');
  assert.equal(f1.querySelector('.kit-gone').textContent, 'Tu escapadaSuave');
  assert.equal(f1.querySelector('.kit-gone-s').textContent, 'Suave');
  const t = setup({ pedido: { type: 'tracker', title: 'Pedido', ref: { param: 'ref' }, steps: [{ key: 'a', label: 'Hecho' }, { key: 'b', label: 'En reparto' }] } });
  const o1 = t.draw('[[s:pedido estado=a ref=48213]]').widgets()[0]; const o2 = t.draw('[[s:pedido estado=b ref=48213]]').widgets()[0]; await wait(5);
  assert.ok(o1.classList.contains('is-old')); assert.match(o1.querySelector('.kit-gone-t').textContent, /^Pedido .*48213$/);
  assert.equal(o1.querySelector('.kit-trk-upd').textContent, 'Actualizado: En reparto'); assert.equal(o2.querySelector('.kit-gone'), null);
  assert.match(read('kit/kit.css'), /\.lbw\.kit-tracker\.is-old > \.lbw-box > :not\(\.kit-gone\):not\(\.kit-trk-upd\)/);
  c.close(); t.close();
});

test('one echo: a receipt drops its sentence once the visitor\'s own bubble says it; it stays when no bubble does', async () => {
  const c = S2(); const m = c.draw('[[s:justo]]'), w = m.widgets()[0];
  pick(w, 'a'); await wait(5); w.querySelector('.lbw-cta').click(); await wait(500);
  const ln = w.querySelector('.kit-sentline'); assert.ok(!ln.classList.contains('is-echoed'), 'no bubble yet');
  c.user('Elijo A'); await wait(1000);
  assert.ok(ln.classList.contains('is-echoed'));
  assert.match(read('kit/kit.css'), /\.kit-sentline\.is-echoed \.kit-sent-t \{ display: none; \}/);
  c.close();
});

test('one counter: a moment with steps hides a compact form\'s "1 / 2"; spent and superseded cards drop their hint', () => {
  const c = setup({ two: { type: 'form', title: 'Dos', cta: 'Enviar', focus: { steps: STEPS, step: 'plan' },
    steps: [{ key: 'a', title: 'A', items: [['x', 'X'], ['y', 'Y']] }, { key: 'b', title: 'B', items: [['x', 'X'], ['y', 'Y']] }], summary: '{a} {b}' } });
  const w = c.draw('[[s:two]]').widgets()[0];
  assert.ok(w.classList.contains('has-steps') && w.querySelector('.kit-stepn'));
  const css = read('kit/kit.css');
  assert.match(css, /\.lbw\.is-focus\.has-steps \.kit-stepn \{ display: none; \}/);
  assert.match(css, /:is\(\.lbw\.is-spent, \.lbw\.is-inert\) \.lbw-cta:not\(\.is-sent\)/);
  c.close();
});

test('calendar: "hidePast" leaves out the weeks with no day to pick; a preset opens on its month; checked', () => {
  const c = S2();
  const w = c.draw('[[s:noches]]').widgets()[0];
  const days = [...w.querySelectorAll('.kit-cal-d')].map((b) => +b.getAttribute('data-day')), first = Math.floor(Date.UTC(2026, 10, 9) / 864e5);
  assert.ok(Math.min(...days) >= first, 'the weeks before 9 Nov (none can be picked) are gone');
  const x = c.draw('[[s:noches from=4/12/2026 to=6/12/2026]]').widgets()[0];
  assert.equal(x.querySelector('.kit-cal-cap').textContent, 'Diciembre de 2026');
  assert.deepEqual(c.check({ k: { ...W2().noches, hidePast: 'yes' } }), ['k: "hidePast" is true (the weeks before the first day that can be picked are left out) or false']);
  c.close();
});

test('text: the library\'s smallest text is a token, 14px; no label or caption is set under it', () => {
  assert.match(read('runtime/lbw.css'), /--lbw-text-min: 14px;/);
  for (const f of ['runtime/lbw.css', 'kit/kit.css']) assert.doesNotMatch(read(f), /font(-size)?:[^;]*\b(1[0-3]|[0-9])px/, f);
});

// ── v0.14.0.2 · the newest widget stays live after the visitor types ─────────────────────────────────────
const TRK = { pedido: { type: 'tracker', title: 'Tu pedido', steps: [{ key: 'a', label: 'Preparado' }, { key: 'b', label: 'En reparto', actions: [{ reply: ['Dejar al vecino', 'Déjalo con un vecino'] }, { reply: ['Mañana', 'Entregadlo mañana'] }] }, { key: 'c', label: 'Entregado' }] },
  chips: W().chips, info: { type: 'cards', item: { title: 'Info' }, reply: ['Más', 'Quiero saber más'] } };
test('newest: after free text the newest widget\'s buttons still send (once); an older one goes quiet when a newer widget arrives', async () => {
  const c = setup(TRK); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = c.draw('Tu pedido: [[s:pedido estado=b]]'), t = m.widgets()[0];
  c.say('¿Es frágil?'); c.draw('Sí, va bien protegido.');   // the agent's answer: text, no tag
  const b = [...t.querySelectorAll('button')].find((x) => x.textContent === 'Dejar al vecino');
  assert.equal(t.querySelector('.lbw-once.is-stale'), null); assert.equal(b.disabled, false);
  await wait(30); b.click(); b.click(); await wait(400);
  assert.deepEqual(c.sent.filter((x) => x[0] === 'landbot-msg-send').map((x) => x[1].message), ['Déjalo con un vecino'], 'sent once');
  assert.ok(t.querySelector('.lbw-once.is-done'), 'the group is spent');
  // a newer widget after the visitor wrote: the older one goes quiet; the newest is live
  const m2 = c.draw('Más: [[s:info]]'), i = m2.widgets()[0];
  c.say('Gracias'); c.draw('De nada.');
  assert.equal(i.querySelector('.lbw-once.is-stale'), null, 'the newest');
  const m3 = c.draw('[[s:chips q=si,no]]');
  assert.ok(i.querySelector('.lbw-once.is-stale') && i.classList.contains('is-spent'), 'no longer the newest: quiet, as before');
  assert.equal(m3.querySelector('.lbw-once.is-stale'), null);
  c.close();
});

test('newest: a spent group stays spent (a sent chip doesn\'t come back); the newest chips stay live after free text', async () => {
  const c = setup(TRK); const m = c.draw('[[s:chips q=si,no]]'), g = m.querySelector('.lbw-once');
  c.say('Una pregunta'); c.draw('Respuesta.');
  assert.ok(!g.classList.contains('is-stale'), 'chips the bot offered last stay live');
  await wait(30); g.querySelector('button').click(); await wait(400);
  assert.ok(g.classList.contains('is-done'));
  c.say('Otra'); c.draw('Vale.');
  assert.ok(g.classList.contains('is-done') && [...g.querySelectorAll('button')].filter((x) => !x.disabled).length <= 1, 'still spent');
  c.close();
});

// ── v0.14.0.3 · the docked footer never sits over a control ──────────────────────────────────────────
test('dockShift: the least move after which no control is cut by the footer\'s edge with its centre under it', () => {
  const c = setup({}), S = c.LBW.kit.h.dockShift, room = { top: 0, min: -500, max: 500 };
  assert.equal(S([[100, 144], [300, 344]], 200, [10, 40], room), 0, 'none cut: no move');
  assert.equal(S([[180, 224]], 200, [10, 40], room), -5, 'a control cut with its centre under the edge: up until its centre is above it');
  assert.equal(S([[190, 214]], 200, null, room), -5);
  assert.equal(S([[150, 205]], 200, null, room), 0, 'its centre above the edge: tappable, left alone');
  // rows of 44 px controls one after another: a row boundary is put at the edge
  const rows = [0, 1, 2, 3, 4].map((i) => [100 + i * 46, 144 + i * 46]);
  const dy = S(rows, 230, null, room); assert.ok(dy !== null && Math.abs(dy) <= 46, String(dy));
  assert.ok(!rows.some(([a, b]) => a + dy < 229 && b + dy > 231 && (a + b) / 2 + dy > 228), 'no row cut after it');
  // the heading must stay in view: the move up that would hide it is refused, the move down taken
  assert.equal(S([[180, 224]], 200, [0, 30], { top: 0, min: -500, max: 500 }), 22, 'down, wholly under the edge');
  assert.equal(S([[180, 224]], 200, [0, 30], { top: 0, min: -500, max: 0 }), null, 'neither possible: null (the kit un-docks it)');
  c.close();
});

test('docked footer: lifted above a fading scroller edge, not docked when the moment fits; LBW.unhold is back', () => {
  const css = read('kit/kit.css');
  assert.match(css, /\.lbw\.is-focus \.kit-dock \{ position: sticky; bottom: calc\(8px \+ var\(--lbw-dock-b, 0px\)\)/);
  assert.match(css, /\.lbw\.is-focus\.is-undocked \.kit-dock, \.lbw\.is-focus\.is-undocked \.kit-foot \{ position: static; box-shadow: none; \}/);
  const c = setup({}); assert.equal(typeof c.LBW.unhold, 'function'); c.LBW.unhold(); c.close();
});
