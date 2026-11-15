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
  const css = read('kit/kit.css'); assert.match(css, /\.lbw\.is-inert > \.lbw-box \*:not\(\.lbw-title\):not\(:has\(\.lbw-title\)\), \.lbw\.is-inert > \.lbw-actions \{ display: none !important; \}/);
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

test('v0.14: screen mode is gone from the runtime: no LBW.screen, no LBW.unhold, no screen.js in the bundle', () => {
  const c = setup({});
  assert.equal(c.LBW.screen, undefined); assert.equal(c.LBW.unhold, undefined);
  assert.doesNotMatch(read('dist/lbw.min.js'), /lbw-scr-|data-lbw-screen/);
  assert.doesNotMatch(read('dist/lbw-kit.min.css'), /lbw-scr-|data-lbw-screen/);
  c.close();
});

test('tracker: "eta": { "big": true } draws the ETA as a large title (--lbw-title-xl)', () => {
  const c = setup({ pedido: { type: 'tracker', title: 'Tu pedido', steps: [{ key: 'hecho', label: 'Hecho' }, { key: 'ruta', label: 'En ruta' }, { key: 'listo', label: 'Entregado' }], eta: { time: 'hora', text: 'Llega {when}', big: true } } });
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
