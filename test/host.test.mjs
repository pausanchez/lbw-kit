// test/host.test.mjs · runtime/host-v4.js is the one place the library meets the Landbot v4 web chat. This test keeps it so
// (no Landbot hook or global anywhere else in runtime/ and kit/), checks each adapter function against the chat's real DOM
// (test/fixtures/host-v4/, captured from a live share page by scripts/capture-host.mjs), and shows what happens when Landbot
// renames a hook: check() names exactly that hook, the runtime logs "host changed: …", and the fix is host-v4.js alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { read, wait, json } from './helpers.mjs';

const FIX = (name) => read('test/fixtures/host-v4/' + name + '.html').replace(/^<!--[\s\S]*?-->\n/, '');
const HOST = 'runtime/host-v4.js';

// a page holding a fixture, with the adapter (and, when asked, the runtime) evaluated inside it
function page(html, { lbw = false, host = read(HOST), before } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://chat.example/' });
  const w = dom.window;
  if (before) before(w);
  w.eval(host);
  if (lbw) w.eval(read('runtime/lbw.js'));
  return { w, d: w.document, H: w.LBW_HOST, dropped: () => [...(w.__lbwDropped || [])].map(String) };
}

// ── 1 · no Landbot hook or global outside the adapter ─────────────────────────────────────────────
function sources() {
  let files;
  try { files = execFileSync('git', ['ls-files', 'runtime', 'kit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n'); }
  catch (e) { files = ['runtime', 'kit'].flatMap((d) => fs.readdirSync(d).map((f) => d + '/' + f)); }
  if (!files.includes(HOST)) files.push(HOST);   // a new file git doesn't know yet
  return files.filter((f) => /\.js$/.test(f) && fs.existsSync(f));
}
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');   // comments out (a URL's // has no space before it)
test('host: no data-lb- hook, _landbot or Landbot. outside runtime/host-v4.js (runtime/ and kit/, comments excluded)', () => {
  const files = sources();
  assert.ok(files.includes('runtime/lbw.js') && files.includes('kit/kit.js') && files.includes('runtime/fallback.js'), files.join(', '));
  const bad = [];
  for (const f of files) {
    if (f === HOST) continue;
    code(read(f)).split('\n').forEach((line, i) => { if (/data-lb-|_landbot|\bLandbot\./.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(bad, []);
  assert.match(code(read(HOST)), /data-lb-part="message"/, 'the hooks are in the adapter');
});

// ── 2 · each function on the real DOM ─────────────────────────────────────────────────────────────
test('host: the welcome screen (a window, two bot messages, buttons, no text box)', () => {
  const { d, H } = page(FIX('welcome'));
  const ms = H.messages();
  assert.equal(ms.length, 2);
  assert.ok([].every.call(ms, H.isBot)); assert.ok(![].some.call(ms, H.isUser));
  assert.equal(H.messages(null, 'bot').length, 2); assert.equal(H.messages(null, 'user').length, 0);
  assert.equal(H.textOf(ms[0]), 'Bot message');
  assert.equal(H.texts(null, 'bot').length, 2);
  const box = H.textBox(ms[1]); assert.equal(box.textContent, 'Bot message'); assert.equal(H.textBox(box), box);
  assert.equal(H.messageOf(box), ms[1]); assert.equal(H.messageOf(ms[1]), ms[1]);
  assert.equal(H.messageOf(d.querySelector('button')), null, 'a welcome button is not in a message');
  assert.ok(H.window()); assert.ok(H.isWindow(H.window())); assert.ok(!H.isWindow(ms[0]));
  assert.ok(H.window().contains(ms[0]));
  assert.equal(H.input(), null, 'the v4 chat has no text box while it shows buttons');
  assert.equal(H.busy(), false);
  assert.deepEqual(json(H.check()), { ok: true, missing: [], input: false });
});

test('host: one bot message on its own', () => {
  const { d, H } = page(FIX('bot-text'));
  const m = d.body.firstElementChild;
  assert.equal(H.messages().length, 1); assert.equal(H.messages()[0], m);
  assert.ok(H.isBot(m)); assert.ok(!H.isUser(m));
  assert.equal(H.textOf(m), 'Bot message');
  assert.equal(H.messageOf(H.textBox(m)), m, 'from its text box up to the message');
  assert.equal(H.messageOf(H.textBox(m).firstChild), null, 'a text node is no element (as lbw.js always asked from an element)');
  assert.equal(H.messageOf(m.querySelector('img')), m, 'the avatar is in the message');
  assert.deepEqual(json(H.check()), { ok: false, missing: ['data-lb-part="window"'], input: false }, 'only the window is missing');
});

test('host: the buttons box is no message', () => {
  const { d, H } = page(FIX('buttons'));
  assert.equal(d.querySelectorAll('button').length, 4);
  assert.equal(H.messages().length, 0);
  assert.equal(H.messageOf(d.querySelector('button')), null);
  assert.deepEqual(json(H.check()).missing, ['data-lb-part="window"', 'data-lb-part="message"'], 'with no message, author and text are not judged');
});

test('host: after a click, the visitor\'s message among the bot\'s, in order', () => {
  const { H } = page(FIX('user-message'));
  const ms = [...H.messages()], users = [...H.messages(null, 'user')];
  assert.equal(ms.length, 8); assert.equal(users.length, 1);
  assert.equal(ms.indexOf(users[0]), 2, 'the welcome, then the visitor, then the reply');
  assert.ok(H.isUser(users[0])); assert.ok(!H.isBot(users[0]));
  assert.equal(H.textOf(users[0]), 'User message');
  assert.deepEqual([...H.texts(null, 'user')].map((t) => t.textContent), ['User message']);
  assert.equal(H.texts(null, 'bot').length, 7); assert.equal(H.texts().length, 8);
  assert.equal(H.texts(null, 'bot', ':not([data-lbw])').length, 7);
  H.texts(null, 'bot')[0].setAttribute('data-lbw', '1');
  assert.equal(H.texts(null, 'bot', ':not([data-lbw])').length, 6, 'extra narrows the boxes');
  assert.ok(users[0].matches(H.sel.user) && !ms[0].matches(H.sel.user));
  assert.deepEqual(json(H.check()), { ok: true, missing: [], input: false });
});

test('host: input() takes only Landbot\'s own text box', () => {
  const { d, H } = page(FIX('user-message'));
  const win = H.window(), add = (where, html) => { const x = d.createElement('div'); x.innerHTML = html; where.appendChild(x); return x.firstElementChild; };
  add(d.body, '<form><input type="text" name="newsletter"></form>');
  assert.equal(H.input(), null, 'a page input outside the chat is never it');
  const field = add(win, '<div data-lb-part="input-field"><div class="lbw"><input type="text"></div><input type="checkbox"><input type="text" disabled><input type="text" placeholder="Type here"></div>');
  const box = field.querySelector('[placeholder]');
  assert.equal(H.input(), box);
  assert.deepEqual(json(H.check()), { ok: true, missing: [], input: true });
  box.remove(); assert.equal(H.input(), null);
  const ta = add(win, '<textarea data-lb-part="input-field"></textarea>'); assert.equal(H.input(), ta, 'a box that is the hook itself');
});

test('host: busy() while the chat shows its typing indicator', () => {
  const { d, H } = page(FIX('welcome'));
  assert.equal(H.busy(), false);
  const s = d.createElement('div'); s.setAttribute('role', 'status'); H.window().appendChild(s);
  assert.equal(H.busy(), true);
  s.remove(); d.body.appendChild(s);
  assert.equal(H.busy(), false, 'a status outside the chat window is not the chat');
});

test('host: observe() says whether a change was in a message, outside the skipped widgets', async () => {
  const { d, H } = page(FIX('user-message'));
  const seen = [], mo = H.observe(d.documentElement, (recs, inChat) => seen.push(inChat), '.lbw');
  const m = H.messages()[3];
  H.textBox(m).firstChild.nodeValue = 'Bot message, longer'; await wait(5);
  const w = d.createElement('div'); w.className = 'lbw'; m.appendChild(w); await wait(5);   // the widget's own node is added to the message
  w.appendChild(d.createElement('span')); await wait(5);                                    // a change inside the widget
  d.querySelector('[data-lb-part="header"]').appendChild(d.createElement('i')); await wait(5);
  mo.disconnect();
  assert.deepEqual(seen, [true, true, false, false]);
});

test('host: send() keeps the fallback chain: the widget, then _landbot, then Landbot.exec, then the text box', async () => {
  const run = (setup, fields) => new Promise((res) => {
    const c = page(FIX('user-message'), { before: (w) => setup && setup.before && setup.before(w) }), drops = [];
    const o = { widget: setup && setup.widget ? setup.widget(c.w) : null, drop: (x) => drops.push(x) };
    c.H.send('Option 1', fields, (ok) => res({ ok, drops, c }), o);
  });
  const log = [];
  // the widget LBW.landbot() took: one message, the fields as custom_data
  let r = await run({ widget: () => ({ sendMessage: (m) => { log.push(['widget', JSON.parse(JSON.stringify(m))]); return Promise.resolve(); } }) }, { plan: 'a' });
  assert.equal(r.ok, true); assert.deepEqual(log.pop(), ['widget', { type: 'text', message: 'Option 1', custom_data: { plan: 'a' } }]);
  // it rejects (not the network): the share page's _landbot is next
  r = await run({ widget: () => ({ sendMessage: () => Promise.reject(new Error('nope')) }),
    before: (w) => { w._landbot = { sendMessage: (m) => { log.push(['_landbot', m.message]); } }; } });
  assert.equal(r.ok, true); assert.deepEqual(log.pop(), ['_landbot', 'Option 1']); assert.deepEqual(r.drops, ['send failed (widget): Option 1 (nope)']);
  // a network failure stops at once: no deprecated bridge after it
  r = await run({ widget: () => ({ sendMessage: () => Promise.reject(new TypeError('Failed to fetch')) }),
    before: (w) => { w.Landbot = { exec: () => log.push(['exec']) }; } });
  assert.equal(r.ok, false); assert.equal(log.length, 0);
  // the legacy bridge: the fields first, then the message
  r = await run({ before: (w) => { w.Landbot = { exec: (n, p) => log.push([n, JSON.parse(JSON.stringify(p))]) }; } }, { plan: 'b' });
  assert.equal(r.ok, true); assert.deepEqual(log.splice(0), [['landbot-custom-data', { plan: 'b' }], ['landbot-msg-send', { type: 'text', message: 'Option 1' }]]);
  // nothing: typed into Landbot's text box, with an Enter
  r = await run({ before: (w) => { const f = w.document.createElement('div'); f.setAttribute('data-lb-part', 'input-field'); f.innerHTML = '<input type="text">'; w.document.querySelector('[data-lb-part="window"]').appendChild(f);
    f.firstChild.addEventListener('keydown', (e) => log.push(['enter', e.key, f.firstChild.value])); } });
  assert.equal(r.ok, true); assert.deepEqual(log.pop(), ['enter', 'Enter', 'Option 1']);
  // and no box: dropped, never typed elsewhere
  r = await run({});
  assert.equal(r.ok, false); assert.deepEqual(r.drops, ['no way to send: Option 1']);
});

test('host: store() and widget()', () => {
  const c = page(FIX('welcome'), { before: (w) => { w._landbot = { setCustomData: (f) => (w.got = ['_landbot', f]) }; } }), drops = [];
  assert.equal(c.H.widget(), c.w._landbot);
  assert.equal(c.H.store({ a: 1 }, { widget: { setCustomData: (f) => (c.w.got = ['widget', f]) }, drop: (x) => drops.push(x) }), true); assert.equal(c.w.got[0], 'widget');
  assert.equal(c.H.store({ a: 1 }, { widget: null, drop: (x) => drops.push(x) }), true); assert.equal(c.w.got[0], '_landbot');
  delete c.w._landbot;
  assert.equal(c.H.store({ a: 1 }, { widget: null, drop: (x) => drops.push(x) }), false); assert.deepEqual(drops, ['no way to store fields']);
});

// ── 3 · Landbot renames a hook ─────────────────────────────────────────────────────────────────────
const RENAMED = () => FIX('user-message').replaceAll('data-lb-part="message"', 'data-lb-part="chat-message"');

test('host: a renamed message hook: check() reports exactly that one', () => {
  assert.deepEqual(json(page(RENAMED()).H.check()), { ok: false, missing: ['data-lb-part="message"'], input: false });
  const author = FIX('user-message').replaceAll('data-lb-author="bot"', 'data-lb-author="assistant"');
  assert.deepEqual(json(page(author).H.check()).missing, ['data-lb-author="bot"']);
  const text = FIX('user-message').replaceAll('data-lb-part="message-text"', 'data-lb-part="text"');
  assert.deepEqual(json(page(text).H.check()).missing, ['data-lb-part="message-text"']);
  const win = FIX('user-message').replace('data-lb-part="window"', 'data-lb-part="panel"');
  assert.deepEqual(json(page(win).H.check()).missing, ['data-lb-part="window"']);
});

test('host: the runtime checks once at start, silent on the real DOM, "host changed: …" when a hook is gone', async () => {
  const ok = page(FIX('user-message'), { lbw: true });
  ok.w.LBW.init({ prefix: 't', quietMs: 10 }); await wait(20);
  ok.d.body.appendChild(ok.d.createElement('i')); await wait(20);
  assert.deepEqual(ok.dropped().filter((x) => /^host changed/.test(x)), []);

  let now = Date.now();
  const bad = page(RENAMED(), { lbw: true, before: (w) => { w.Date.now = () => now; } });
  bad.w.LBW.init({ prefix: 't', quietMs: 10 }); await wait(20);
  assert.deepEqual(bad.dropped(), [], 'not before the welcome had its time (10 s)');
  now += 10001; bad.d.body.appendChild(bad.d.createElement('i')); await wait(20);
  now += 60000; bad.d.body.appendChild(bad.d.createElement('i')); await wait(20);
  assert.deepEqual(bad.dropped().filter((x) => /^host changed/.test(x)), ['host changed: data-lb-part="message"'], 'once');
});

test('host: the fix for a renamed hook is host-v4.js alone (lbw.js unchanged draws the widget again)', async () => {
  const tag = (html) => html.replace('>Bot message</div>\n', '>Bot message</div>\n').replace(/(data-lb-author="bot"[\s\S]*?data-lb-part="message-text">)Bot message/, '$1Here [[t:probe id=1]]');
  const draw = async (host) => {
    const c = page(tag(RENAMED()), { lbw: true, host });
    c.w.LBW.widget('probe', (p, ctx) => c.w.LBW.ui.card(ctx.lang)); c.w.LBW.init({ prefix: 't', quietMs: 10 }); await wait(30);
    return c.d.querySelectorAll('.lbw').length;
  };
  assert.equal(await draw(read(HOST)), 0, 'with today\'s adapter the renamed chat draws nothing');
  const patched = read(HOST).replace("message: '[data-lb-part=\"message\"]'", "message: '[data-lb-part=\"chat-message\"]'");
  assert.notEqual(patched, read(HOST));
  assert.equal(await draw(patched), 1, 'one line changed in the adapter, and the widget is back');
});
