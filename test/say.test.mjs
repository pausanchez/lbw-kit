// test/say.test.mjs · talking back: a click posts as the visitor, once, with its fields, when the chat is quiet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json } from './helpers.mjs';

function chat(opts) {
  const c = boot(opts);
  c.LBW.init({ prefix: 't', langs: ['en'], quietMs: 10 });
  c.LBW.widget('size', (p, ctx) => {
    const U = c.LBW.ui, g = U.once('lbw-chips'), o = U.card(ctx.lang);
    ['s', 'm'].forEach((s) => g.appendChild(U.reply(s.toUpperCase(), 'I take ' + s.toUpperCase(), { fields: { size: s } })));
    o.box.appendChild(g); return o;
  });
  return c;
}

test('reply: one click sends the sentence with its fields and closes the group', async () => {
  const c = chat(), m = c.bot('Pick [[t:size]]');
  c.LBW.scan(); await wait(40);
  const [s, mBtn] = m.querySelectorAll('button');
  mBtn.click(); mBtn.click(); s.click();
  await wait(400);
  assert.deepEqual(c.sent, [['landbot-custom-data', { size: 'm' }], ['landbot-msg-send', { type: 'text', message: 'I take M' }]]);
  assert.ok(mBtn.classList.contains('is-sent'));
  assert.ok(m.querySelector('.lbw-once').classList.contains('is-done'));
  assert.equal(s.disabled, true);
  c.close();
});

test('say: waits while the chat shows a reply arriving', async () => {
  const c = chat(), busy = c.d.createElement('div');
  busy.setAttribute('role', 'status'); c.d.querySelector('[data-lb-part="window"]').appendChild(busy);
  await wait(40);
  assert.equal(c.LBW.say('Hello'), true);
  assert.equal(c.LBW.say('Hello again'), false, 'a second send inside 1.2 s is refused');
  await wait(400);
  assert.equal(c.sent.length, 0);
  busy.remove(); await wait(400);
  assert.deepEqual(c.sent, [['landbot-msg-send', { type: 'text', message: 'Hello' }]]);
  c.close();
});

test('say: on the share page it uses _landbot.sendMessage, the fields as custom_data in the same message', async () => {
  const c = chat(), got = [];
  c.w._landbot = { sendMessage: (m) => { got.push(['send', json(m)]); return Promise.resolve(); }, setCustomData: (f) => got.push(['data', f]) };
  await wait(40);
  c.LBW.say('Hi', { a: '1' }); await wait(400);
  assert.deepEqual(got, [['send', { type: 'text', message: 'Hi', custom_data: { a: '1' } }]]);
  assert.deepEqual(c.sent, [], 'not also through the legacy bridge');
  c.close();
});

// v0.9.0 · the v4 widget API (Landbot.Widget.sendMessage): LBW.landbot(this) from the bot's Custom JS
function widget(c, opts) {
  const w = { calls: [], sendMessage(m) { w.calls.push(['send', json(m)]); return opts && opts.reject ? Promise.reject(new Error('offline')) : Promise.resolve(); },
    setCustomData(f) { w.calls.push(['data', json(f)]); } };
  assert.equal(c.LBW.landbot(w), true); return w;
}

test('landbot(this): a click goes through the widget\'s sendMessage, its fields as custom_data, once', async () => {
  const c = chat(), w = widget(c), said = [];
  c.LBW.on('say', (e) => said.push(json(e)));
  const m = c.bot('Pick [[t:size]]'); c.LBW.scan(); await wait(40);
  const b = m.querySelectorAll('button')[1]; b.click(); b.click();
  await wait(400);
  assert.deepEqual(w.calls, [['send', { type: 'text', message: 'I take M', custom_data: { size: 'm' } }]]);
  assert.deepEqual(c.sent, [], 'nothing through the legacy bridge');
  assert.deepEqual(json(c.w.__lbwSent), ['I take M']); assert.deepEqual(json(c.w.__lbwStored), [{ size: 'm' }]);
  assert.deepEqual(said, [{ text: 'I take M', fields: { size: 'm' } }]);
  c.close();
});

test('landbot(this): a send without fields carries no custom_data', async () => {
  const c = chat(), w = widget(c); await wait(40);
  c.LBW.say('Hello'); await wait(400);
  assert.deepEqual(w.calls, [['send', { type: 'text', message: 'Hello' }]]);
  c.close();
});

test('landbot(this): a rejected send is logged and goes once through the next way, fields included', async () => {
  const c = chat(), w = widget(c, { reject: true }); await wait(40);
  c.LBW.say('Hi', { a: '1' }); await wait(400);
  assert.equal(w.calls.length, 1);
  assert.ok(c.dropped().some((d) => /send failed \(widget\): Hi \(offline\)/.test(d)));
  assert.deepEqual(c.sent, [['landbot-custom-data', { a: '1' }], ['landbot-msg-send', { type: 'text', message: 'Hi' }]]);
  c.close();
});

test('landbot(this): rejected, then _landbot (another object) takes it with custom_data; the bridge stays unused', async () => {
  const c = chat(), w = widget(c, { reject: true }), got = [];
  c.w._landbot = { sendMessage: (m) => { got.push(json(m)); return Promise.resolve(); } };
  await wait(40);
  c.LBW.say('Hi', { a: '1' }); await wait(400);
  assert.deepEqual(got, [{ type: 'text', message: 'Hi', custom_data: { a: '1' } }]);
  assert.equal(w.calls.length, 1); assert.deepEqual(c.sent, []);
  c.close();
});

test('landbot(this): when _landbot IS the bound widget a rejection doesn\'t send through it twice', async () => {
  const c = chat({ landbot: false }), w = widget(c, { reject: true });
  c.w._landbot = w; await wait(40);
  c.LBW.say('Hi'); await wait(400);
  assert.equal(w.calls.length, 1);
  assert.ok(c.dropped().some((d) => /no way to send: Hi/.test(d)));
  c.close();
});

test('landbot(this): the window or a non-widget is not bound; the legacy bridge keeps working', async () => {
  const c = chat();
  assert.equal(c.LBW.landbot(c.w), false); assert.equal(c.LBW.landbot({}), false); assert.equal(c.LBW.landbot(), false);
  assert.ok(c.dropped().some((d) => /LBW\.landbot: not a widget/.test(d)));
  await wait(40); c.LBW.say('Hi', { a: '1' }); await wait(400);
  assert.deepEqual(c.sent, [['landbot-custom-data', { a: '1' }], ['landbot-msg-send', { type: 'text', message: 'Hi' }]]);
  c.close();
});

test('store: fields with no message go to the bound widget\'s setCustomData, else the bridge', () => {
  const c = chat(); c.LBW.store({ x: '1' });
  assert.deepEqual(c.sent, [['landbot-custom-data', { x: '1' }]]);
  const w = widget(c); c.LBW.store({ y: '2' });
  assert.deepEqual(w.calls, [['data', { y: '2' }]]); assert.equal(c.sent.length, 1);
  assert.deepEqual(json(c.w.__lbwStored), [{ x: '1' }, { y: '2' }]);
  c.close();
});

test('say: with no send API it types into the chat\'s box and presses Enter', async () => {
  const c = chat({ landbot: false }), field = c.d.createElement('div'), box = c.d.createElement('textarea');
  field.setAttribute('data-lb-part', 'input-field'); field.appendChild(box); c.d.body.appendChild(field);
  let enter = 0; box.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter++; });
  await wait(40);
  c.LBW.say('Typed'); await wait(400);
  assert.equal(box.value, 'Typed'); assert.equal(enter, 1);
  c.close();
});

test('say (v0.9.4.1): the v4 chat\'s box is an <input>: typed there, never into a widget\'s own field', async () => {
  const c = chat({ landbot: false }), field = c.d.createElement('div'), box = c.d.createElement('input');
  box.type = 'text'; box.placeholder = 'Type here…';
  const mine = c.d.createElement('div'); mine.className = 'lbw'; const own = c.d.createElement('input'); own.type = 'text'; mine.appendChild(own); c.d.body.appendChild(mine);
  field.setAttribute('data-lb-part', 'input-field'); field.appendChild(box); c.d.body.appendChild(field);
  let enter = 0; box.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter++; });
  await wait(40);
  c.LBW.say('Typed in v4'); await wait(400);
  assert.equal(box.value, 'Typed in v4'); assert.equal(enter, 1); assert.equal(own.value, '');
  c.close();
});

test('once: chips nobody used go quiet when the visitor writes after them', () => {
  const c = chat(), m = c.bot('Pick [[t:size]]');
  c.LBW.scan(); c.user('something else'); c.LBW.scan();
  const g = m.querySelector('.lbw-once');
  assert.ok(g.classList.contains('is-stale'));
  assert.ok([...g.querySelectorAll('button')].every((b) => b.disabled));
  c.close();
});

test('say: sends that waited go out in the order they were made', async () => {
  const c = chat(), busy = c.d.createElement('div');
  busy.setAttribute('role', 'status'); c.d.querySelector('[data-lb-part="window"]').appendChild(busy);
  await wait(40);
  for (const t of ['one', 'two', 'three']) { assert.equal(c.LBW.say(t), true, t); await wait(1230); }
  assert.equal(c.sent.length, 0);
  busy.remove(); await wait(1200);
  assert.deepEqual(c.sent.map((x) => x[1].message), ['one', 'two', 'three']);
  c.close();
});

test('say: a send that throws is logged and the next one still goes', async () => {
  const c = chat({ landbot: false }), got = [];
  c.w._landbot = { sendMessage: (m) => { if (m.message === 'one') throw new Error('boom'); got.push(m.message); } };
  const busy = c.d.createElement('div'); busy.setAttribute('role', 'status'); c.d.querySelector('[data-lb-part="window"]').appendChild(busy);
  await wait(40);
  c.LBW.say('one'); await wait(1230); c.LBW.say('two'); await wait(1230);
  busy.remove(); await wait(900);
  assert.deepEqual(got, ['two']);
  c.close();
});
