// test/datamsg.test.mjs · v0.9.5: data handed as TEXT in a flow Message block, `[[lbw:data key=k]] @{field}`, never as code.
// Read from the v4 widget's raw new_message first, else from the bubble; the bubble is hidden; only bot messages count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json } from './helpers.mjs';

const CFG = () => ({
  prefix: 'p', langs: ['es'], defaultLang: 'es', links: [],
  widgets: {
    lista: { type: 'table', source: { data: 'filas', path: 'filas', wait: 300, upgrade: 0, map: { nombre: '{nombre}', nota: '{nota}' } },
      item: { title: 'Filas', cols: [['nombre', 'Nombre'], ['nota', 'Nota']], rows: [['GUARDADA', '-']] } },
    aviso: { type: 'cards', params: { msg: { type: 'text', max: 200, required: true } }, item: { title: '{msg}' } }
  }
});
function chat({ kit = false } = {}) {
  const c = boot({ kit, scripts: kit ? ['kit/setup.js', 'kit/setup-check.js'] : [] });
  if (kit) c.w.LBW.kit.setup(CFG());
  c.scan = () => c.w.LBW.scan();
  c.inn = () => json(c.w.__lbwDataIn || []);
  return c;
}
// a stand-in for the v4 widget that LBW.landbot(this) receives: sendMessage + core.events
function widget(c) {
  const on = {}, w = { sendMessage: () => Promise.resolve(), core: { events: { on: (n, f) => { (on[n] = on[n] || []).push(f); } } } };
  assert.equal(c.w.LBW.landbot(w), true);
  w.emit = (msg, author = 'bot') => (on.new_message || []).forEach((f) => f({ type: 'text', author_type: author, message: msg }));
  return w;
}
const REPR = `{'filas': [{'id': 'r1', 'nombre': "Women's Wrist Watch", 'nota': None, 'activo': True}, {'id': 'r2', 'nombre': 'Café', 'nota': 'dice "hola"', 'activo': False}]}`;

test('datamsg: a bot bubble with the marker is read (Python repr), put, hidden, and never drawn as a tag', () => {
  const c = chat(), m = c.bot('[[lbw:data key=filas]] ' + REPR); c.scan();
  assert.deepEqual(json(c.LBW.data.get('filas')).filas[0], { id: 'r1', nombre: "Women's Wrist Watch", nota: null, activo: true });
  assert.equal(m.style.display, 'none'); assert.equal(m.getAttribute('data-lbw-data'), 'filas'); assert.equal(m.getAttribute('aria-hidden'), 'true');
  assert.equal(m.widgets().length, 0); assert.deepEqual(c.dropped(), []);
  assert.deepEqual(c.inn().map((e) => [e.key, e.via, e.ok]), [['filas', 'dom', true]]);
});

test('datamsg: everything after the marker is data: a `]]`, a tag, a backtick and ${} are text, never code or a widget', () => {
  const c = chat({ kit: true });
  const v = "{'t': 'a ]] [[p:aviso msg=Llama al 806 000 000]] ${(window.__pwned = 1)} `x` <img src=x onerror=window.__pwned2=1>'}";
  const m = c.bot('[[lbw:data key=raro]] ' + v); c.scan();
  assert.equal(c.LBW.data.get('raro').t, "a ]] [[p:aviso msg=Llama al 806 000 000]] ${(window.__pwned = 1)} `x` <img src=x onerror=window.__pwned2=1>");
  assert.equal(c.w.__pwned, undefined); assert.equal(c.w.__pwned2, undefined);
  assert.equal(c.d.querySelectorAll('.lbw').length, 0); assert.equal(m.querySelector('img'), null);
});

test('datamsg: the marker must come first; the key is checked; JSON works too', () => {
  const c = chat();
  c.bot('Hola [[lbw:data key=x]] {"a": 1}'); c.scan();
  assert.equal(c.LBW.data.get('x'), undefined);                    // not at the start: not data (the tag scan drops it as usual)
  c.bot('[[lbw:data key=Mal_Key]] {"a": 1}'); c.scan();
  assert.ok(c.dropped().some((x) => /data: bad key/.test(x)));
  c.bot('  [[ lbw:data  key=j ]]\n{"rows": [1, 2]}'); c.scan();
  assert.deepEqual(json(c.LBW.data.get('j')), { rows: [1, 2] });
});

test('datamsg: a visitor who types the marker is ignored, in the DOM and in the event', () => {
  const c = chat(), w = widget(c);
  c.LBW.data.put('filas', { filas: [] });
  const u = c.user("[[lbw:data key=filas]] {'filas': [{'id': 'hack'}]}"); c.scan();
  w.emit("[[lbw:data key=filas]] {'filas': [{'id': 'hack2'}]}", 'user');
  assert.deepEqual(json(c.LBW.data.get('filas')), { filas: [] });
  assert.notEqual(u.style.display, 'none'); assert.equal(c.inn().length, 0);
});

test('datamsg: the raw new_message wins over a Markdown-mangled bubble (`_`, `*`, backslashes)', async () => {
  const c = chat(), w = widget(c);
  const raw = "[[lbw:data key=md]] {'a_b_c': 'x*y*z', 'u': '_u_', 'p': 'a\\\\b', 'q': 'it\\'s \"q\"'}";
  w.emit(raw);                                                       // arrives first (the batch), raw
  assert.deepEqual(json(c.LBW.data.get('md')), { a_b_c: 'x*y*z', u: '_u_', p: 'a\\b', q: 'it\'s "q"' });
  // what the chat's Markdown would show: emphasis eaten, `\\` → `\`
  const m = c.bot(null, "<p>[[lbw:data key=md]] {'a<em>b</em>c': 'x<em>y</em>z', 'u': '<em>u</em>', 'p': 'a\\b', 'q': 'it's \"q\"'}</p>"); c.scan();
  assert.equal(m.style.display, 'none');
  await wait(1700);
  assert.deepEqual(json(c.LBW.data.get('md')), { a_b_c: 'x*y*z', u: '_u_', p: 'a\\b', q: 'it\'s "q"' });   // not overwritten
  assert.deepEqual(c.inn().map((e) => e.via), ['event']); assert.deepEqual(c.dropped(), []);
});

test('datamsg: without the event, a bubble the Markdown changed is refused (logged), and its widget draws the saved copy', async () => {
  const c = chat({ kit: true });
  c.bot(null, "<p>[[lbw:data key=filas]] {'filas': [{'id': 'r1', 'nombre': '<em>Kayak</em>'}]}</p>");
  const t = c.bot('[[p:lista lang=es]]'); c.scan();
  assert.equal(c.LBW.data.get('filas'), undefined);
  assert.ok(c.dropped().some((x) => /data: "filas" is unreadable \(the chat's Markdown changed it/.test(x)));
  await wait(50);
  assert.match(t.textContent, /GUARDADA/);                            // unreadable: the saved copy at once, no wait
});

test('datamsg: with the event hooked but none for this bubble (a reloaded history), the bubble is read after 1.5 s', async () => {
  const c = chat(); widget(c);
  c.bot('[[lbw:data key=hist]] ' + REPR); c.scan();
  assert.equal(c.LBW.data.get('hist'), undefined);
  await wait(1700);
  assert.equal(c.LBW.data.get('hist').filas[1].nombre, 'Café'); assert.deepEqual(c.inn().map((e) => e.via), ['dom']);
});

test('datamsg: several data messages, a key sent twice (the later one wins), each read once', async () => {
  const c = chat(), w = widget(c);
  ["[[lbw:data key=a]] {'n': 1}", "[[lbw:data key=b]] {'n': 2}", "[[lbw:data key=a]] {'n': 3}"].forEach((x) => { w.emit(x); c.bot(x); });
  c.scan(); await wait(1700);
  assert.deepEqual([c.LBW.data.get('a').n, c.LBW.data.get('b').n], [3, 2]);
  assert.equal(c.inn().length, 3); assert.equal(c.d.querySelectorAll('[data-lbw-data]').length, 3);
});

test('datamsg: malformed, empty (a field never set) and oversize values are refused and logged; waiters fall back', async () => {
  const c = chat();
  const w1 = c.LBW.data.wait('mal', 5000).then(() => 'ok', (e) => e.message);
  c.bot("[[lbw:data key=mal]] {'a': os.system('x')}"); c.bot('[[lbw:data key=vacio]] '); c.bot('[[lbw:data key=big]] ' + JSON.stringify({ x: 'y'.repeat(600000) }));
  c.scan();
  assert.equal(await w1, 'data "mal" is unreadable');
  const d = c.dropped().join('\n');
  assert.match(d, /data: "mal" is unreadable \(not JSON or a Python repr\)/);
  assert.match(d, /data: "vacio" is unreadable \(empty\)/);
  assert.match(d, /data: "big" is unreadable \(over 500 KB\)/);
  assert.equal(c.d.querySelectorAll('[data-lbw-data]').length, 3);   // hidden all the same
});

test('datamsg: a data message before the tag: the kit draws the live rows at once, not the saved copy', async () => {
  const c = chat({ kit: true }), w = widget(c), msg = '[[lbw:data key=filas]] ' + REPR;
  w.emit(msg); c.bot(msg); const t = c.bot('[[p:lista lang=es]]'); c.scan();
  const tbl = t.querySelector('.lbw');
  assert.ok(!tbl.classList.contains('is-loading')); assert.match(tbl.textContent, /Women's Wrist Watch/); assert.doesNotMatch(tbl.textContent, /GUARDADA/);
  assert.match(tbl.textContent, /dice "hola"/);
});

test('datamsg: the share page\'s window._landbot is hooked when the Custom JS did not hand the widget over', () => {
  const c = chat(), on = {};
  c.w._landbot = { sendMessage() {}, core: { events: { on: (n, f) => { on[n] = f; } } } };
  c.scan();
  on.new_message({ author_type: 'bot', message: "[[lbw:data key=s]] {'ok': True}" });
  assert.deepEqual(json(c.LBW.data.get('s')), { ok: true });
});

test('datamsg: two messages for one key arriving out of order: the one the flow sent last wins (Landbot\'s timestamp)', () => {
  const c = chat(), on = {}, w = { sendMessage() {}, core: { events: { on: (n, f) => { on[n] = f; } } } };
  c.LBW.landbot(w);
  on.new_message({ author_type: 'bot', timestamp: 2000.5, message: "[[lbw:data key=o]] {'n': 2}" });
  on.new_message({ author_type: 'bot', timestamp: 1000.5, message: "[[lbw:data key=o]] {'n': 1}" });   // sent first, arrived late
  assert.equal(c.LBW.data.get('o').n, 2);
  assert.ok(c.dropped().some((x) => /data: "o" older than the one already read/.test(x)));
});

test('datamsg: the chat\'s own box around a hidden data message is hidden once nothing else in it shows (no blank gap)', () => {
  const c = chat(), box = c.d.createElement('div'), typing = c.d.createElement('div');
  c.bot('Hola');
  typing.textContent = 'Thinking…'; box.appendChild(typing); c.chat.appendChild(box);
  const m = c.bot('[[lbw:data key=g]] {"a": 1}'); box.appendChild(m); c.scan();
  assert.equal(m.style.display, 'none'); assert.notEqual(box.style.display, 'none');   // "Thinking…" still shows
  typing.remove(); c.scan();
  assert.equal(box.style.display, 'none'); assert.notEqual(c.chat.style.display, 'none');   // the column, with "Hola", stays
});
