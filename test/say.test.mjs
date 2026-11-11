// test/say.test.mjs · talking back: a click posts as the visitor, once, with its fields, when the chat is quiet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait } from './helpers.mjs';

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

test('say: on the share page it uses _landbot', async () => {
  const c = chat({ landbot: false }), got = [];
  c.w._landbot = { sendMessage: (m) => got.push(['send', m.message]), setCustomData: (f) => got.push(['data', f.a]) };
  await wait(40);
  c.LBW.say('Hi', { a: '1' }); await wait(400);
  assert.deepEqual(got, [['data', '1'], ['send', 'Hi']]);
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

test('once: chips nobody used go quiet when the visitor writes after them', () => {
  const c = chat(), m = c.bot('Pick [[t:size]]');
  c.LBW.scan(); c.user('something else'); c.LBW.scan();
  const g = m.querySelector('.lbw-once');
  assert.ok(g.classList.contains('is-stale'));
  assert.ok([...g.querySelectorAll('button')].every((b) => b.disabled));
  c.close();
});
