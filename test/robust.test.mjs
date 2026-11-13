// test/robust.test.mjs · v0.9.5, production robustness: a visitor never sees a raw [[…]] tag, a lost click or a dead card.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { boot, wait, json, read } from './helpers.mjs';

const fallback = () => read('runtime/fallback.js');

// ── 1 · raw tags never painted: readiness, the fallback, the guard CSS, the guarded setup line ─────────────────────────
test('ready: LBW.ready and html.lbw-ready come after init and the first scan, with a ready event', async () => {
  const c = boot(), seen = [];
  assert.equal(c.LBW.ready, false);
  c.LBW.on('ready', (e) => seen.push(json(e)));
  c.LBW.init({ prefix: 't' });
  assert.equal(c.LBW.ready, false, 'not before the first scan');
  assert.ok(!c.d.documentElement.classList.contains('lbw-ready'));
  await wait(20);
  assert.equal(c.LBW.ready, true);
  assert.ok(c.d.documentElement.classList.contains('lbw-ready'));
  assert.deepEqual(seen, [{ version: c.LBW.version }]);
});

test('fallback: with no library it strips at once (no 4 s wait), hides a bubble it emptied and ends the guard', async () => {
  const c = boot({ lbw: false });
  const only = c.bot('[[np:service id=x]]'), m = c.bot('Here it is [[np:service id=extension]]');
  c.w.eval(fallback());
  assert.equal(m.text(), 'Here it is', 'stripped synchronously');
  assert.equal(only.style.display, 'none', 'a message that was only tags is hidden, not an empty bubble');
  assert.ok(c.d.documentElement.classList.contains('lbw-off'));
  const late = c.bot(null, 'And <em>this</em> [[np:faq id=planning]]'); await wait(0);
  assert.equal(late.text(), 'And this');
  assert.notEqual(late.style.display, 'none');
});

test('fallback: the library loaded but never ready (a config that does not parse): strips after LBW_FALLBACK_MS', async () => {
  const c = boot();   // LBW is there, init() never runs
  c.w.LBW_FALLBACK_MS = 30;
  const m = c.bot('Kept for now [[zz:thing]]');
  c.w.eval(fallback());
  assert.equal(m.text(), 'Kept for now [[zz:thing]]', 'it gives the runtime its time first');
  await wait(250);
  assert.equal(m.text(), 'Kept for now');
  assert.ok(c.d.documentElement.classList.contains('lbw-off'));
});

test('fallback: does nothing when the runtime gets ready in time, nor once it is ready', async () => {
  const c = boot();
  c.LBW.init({ prefix: 't' });
  c.LBW.widget('card', (p, ctx) => c.LBW.ui.card(ctx.lang));
  c.w.eval(fallback());   // runs before the runtime's first scan (as in Custom JS: the scan is on a 0 ms timer)
  const m = c.bot('Look [[t:card]]');
  await wait(250);
  assert.equal(m.widgets().length, 1, 'the runtime drew it: the fallback did not strip it first');
  assert.ok(!c.d.documentElement.classList.contains('lbw-off'));
});

test('guard CSS: hides bot text until lbw-ready / lbw-off, with a time limit; goes into custom_css after the @import', () => {
  const g = read('dist/guard.min.css');
  assert.match(g, /html:not\(\.lbw-ready\):not\(\.lbw-off\) \[data-lb-part="?message"?\]\[data-lb-author="?bot"?\] \[data-lb-part="?message-text"?\]/);
  assert.match(g, /visibility:hidden/); assert.match(g, /var\(--lbw-guard-wait,\s*4s\)/); assert.match(g, /@keyframes lbw-guard\{to\{visibility:visible\}\}/);
  assert.doesNotMatch(g, /visibility:hidden\s*!important/, 'an !important visibility would beat the animation: hidden for good');
  // the rule works in a DOM: hidden before, shown once the class is on
  const c = boot({ lbw: false }), st = c.d.createElement('style'); st.textContent = g; c.d.head.appendChild(st);
  const m = c.bot('Hi'), t = m.querySelector('[data-lb-part="message-text"]'), u = c.user('Yo');
  assert.equal(c.w.getComputedStyle(t).visibility, 'hidden');
  assert.equal(c.w.getComputedStyle(u.querySelector('[data-lb-part="message-text"]')).visibility, 'visible', 'the visitor\'s messages are never hidden');
  c.d.documentElement.classList.add('lbw-ready');
  assert.equal(c.w.getComputedStyle(t).visibility, 'visible');
  // npm run bot: the guard is in the bot's own CSS (by URL, --all and --inline), right after the imports
  const cwd = new URL('..', import.meta.url);
  for (const mode of [[], ['--all'], ['--inline']]) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-g-'));
    const r = spawnSync(process.execPath, ['scripts/bot-code.mjs', 'kit/example/config.json', '--out', out, ...mode], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const css = fs.readFileSync(path.join(out, 'custom_css.css'), 'utf8'), js = fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8');
    assert.ok(css.includes(g.trim()), 'guard in custom_css ' + mode);
    if (!mode.length) assert.match(css, /^@import url\("[^"]+lbw-kit\.min\.css"\);\nhtml:not\(\.lbw-ready\)/);
    assert.ok(js.includes(read('dist/fallback.min.js').trim()), 'the fallback in custom_js ' + mode);
  }
});

test('bot-code: with the library blocked the Custom JS throws nothing, and the fallback strips at once', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lbw-b-')), cwd = new URL('..', import.meta.url);
  const r = spawnSync(process.execPath, ['scripts/bot-code.mjs', 'kit/example/config.json', '--out', out], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const scripts = [...fs.readFileSync(path.join(out, 'custom_js.html'), 'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((x) => x[1]).filter(Boolean);
  const c = boot({ lbw: false }), m = c.bot('Text [[np:service id=extension]]'), widget = { sendMessage() {} };
  for (const s of scripts) assert.doesNotThrow(() => c.w.Function(s).call(widget), 'no "LBW is not defined"');
  assert.equal(m.text(), 'Text');
});

// ── 2 · per-message isolation ──────────────────────────────────────────────────────────────────────────────────────
test('isolation: a widget that returns a string or a fragment loses only its own tag', async () => {
  const c = boot(); c.LBW.init({ prefix: 't' });
  c.LBW.widget('str', () => '<b>hi</b>');
  c.LBW.widget('frag', () => c.d.createDocumentFragment());
  c.LBW.widget('ok', (p, ctx) => c.LBW.ui.card(ctx.lang));
  const m = c.bot('Hi [[t:str]] [[t:ok]] [[t:frag]]'); c.LBW.scan();
  assert.equal(m.text().trim(), 'Hi');
  assert.deepEqual(m.widgets().map((w) => w.getAttribute('data-widget')), ['ok']);
  assert.ok(c.dropped().some((d) => /\[\[t:str\]\] \(widget returned string, not an element\)/.test(d)));
  assert.ok(c.dropped().some((d) => /\[\[t:frag\]\] \(widget returned a fragment, not an element\)/.test(d)));
});

test('isolation: an exception while a message is processed strips its tags and logs it; the next message still draws', async () => {
  const c = boot(); c.LBW.init({ prefix: 't' });
  c.LBW.widget('ok', (p, ctx) => c.LBW.ui.card(ctx.lang));
  const bad = c.bot('First [[t:ok]] [[t:ok]]'), good = c.bot('Second [[t:ok]]'), box = bad.querySelector('[data-lb-part="message-text"]');
  box.closest = function (sel) { delete box.closest; throw new Error('boom'); };   // the first thing the scan asks of it, once
  c.LBW.scan();
  assert.equal(bad.text(), 'First', 'no raw tag left');
  assert.ok(c.dropped().some((d) => /message failed: boom \(its tags removed\)/.test(d)));
  assert.equal(good.widgets().length, 1);
});

// ── 3 · the raw-tag detector ───────────────────────────────────────────────────────────────────────────────────────
test('detector: a [[prefix: the scan could not reach is logged as a drop, told to LBW.on(drop) and removed', async () => {
  const c = boot(), drops = []; c.LBW.init({ prefix: 't', rawMs: 30 }); c.LBW.on('drop', (d) => drops.push(String(d)));
  c.LBW.widget('ok', (p, ctx) => c.LBW.ui.card(ctx.lang));
  await wait(10);
  // Landbot renamed the author (S5): the runtime's selectors don't see this message
  const m = c.bot('Rooms [[t:ok id=x]]'); m.setAttribute('data-lb-author', 'assistant');
  const u = c.user('I typed [[t:ok]]');
  await wait(120);
  assert.ok(drops.some((d) => /^raw tag left: \[\[t:ok id=x\]\]/.test(d)), drops.join(' | '));
  assert.ok(c.dropped().some((d) => /^raw tag left/.test(d)));
  assert.equal(m.text(), 'Rooms');
  assert.equal(u.text(), 'I typed [[t:ok]]', 'the visitor\'s own text is not touched');
});

test('detector: text re-rendered into a bubble already scanned (S7) is caught too; stripRaw: false only logs', async () => {
  const c = boot(); c.LBW.init({ prefix: 't', rawMs: 30, stripRaw: false });
  c.LBW.widget('ok', (p, ctx) => c.LBW.ui.card(ctx.lang));
  const m = c.bot('Rooms [[t:ok]]'); await wait(10);
  assert.equal(m.widgets().length, 1);
  m.querySelector('[data-lb-part="message-text"]').textContent = 'Rooms [[t:ok]]';   // React restored its text
  await wait(120);
  assert.equal(c.dropped().filter((d) => /^raw tag left: \[\[t:ok\]\]/.test(d)).length, 1, 'once');
  assert.equal(m.text(), 'Rooms [[t:ok]]');
});

// ── 4 · a failed send ──────────────────────────────────────────────────────────────────────────────────────────────
function chat(lang = 'es') {
  const c = boot();
  c.LBW.init({ prefix: 't', langs: ['en', 'es'], defaultLang: 'en', quietMs: 10 });
  c.LBW.widget('size', (p, ctx) => {
    const U = c.LBW.ui, g = U.once('lbw-chips'), o = U.card(ctx.lang);
    ['s', 'm'].forEach((s) => g.appendChild(U.reply(s.toUpperCase(), 'I take ' + s.toUpperCase(), { fields: { size: s } })));
    o.box.appendChild(g); return o;
  });
  const m = c.bot('Pick [[t:size lang=' + lang + ']]');
  return { c, m };
}
function widget(c, mode) {   // mode(): 'net' rejects like Chrome offline, 'ok' resolves
  const w = { calls: [], sendMessage(msg) { w.calls.push(json(msg)); return mode() === 'net' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(); } };
  c.LBW.landbot(w); return w;
}

test('send failed (network): the card is not spent, "No se ha enviado. Reintentar" shows, no legacy bridge; online retries once', async () => {
  const { c, m } = chat('es'); let net = 'net'; const w = widget(c, () => net), unsent = [];
  c.LBW.on('unsent', (e) => unsent.push(json(e)));
  await wait(20);
  const [s, mm] = m.querySelectorAll('.lbw-reply');
  mm.click();
  assert.ok(mm.classList.contains('is-sent'), 'marked at once, as before');
  await wait(300);
  assert.equal(w.calls.length, 1);
  assert.deepEqual(c.sent, [], 'no Landbot.exec after a network failure');
  assert.ok(!mm.classList.contains('is-sent')); assert.ok(mm.classList.contains('is-unsent'));
  const g = m.querySelector('.lbw-once'); assert.ok(!g.classList.contains('is-done')); assert.equal(s.disabled, false); assert.equal(mm.disabled, false);
  const line = m.querySelector('.lbw-unsent'); assert.ok(line); assert.equal(line.getAttribute('role'), 'alert');
  assert.equal(line.textContent, 'No se ha enviado.Reintentar');
  assert.deepEqual(unsent, [{ text: 'I take M', fields: { size: 'm' } }]);
  net = 'ok'; c.w.dispatchEvent(new c.w.Event('online')); c.w.dispatchEvent(new c.w.Event('online'));
  assert.ok(mm.classList.contains('is-sent') && g.classList.contains('is-done'), 'marked again while it goes out');
  await wait(300);
  assert.equal(w.calls.length, 2, 'sent again once, never twice');
  assert.deepEqual(w.calls[1], { type: 'text', message: 'I take M', custom_data: { size: 'm' } });
  assert.equal(m.querySelector('.lbw-unsent'), null);
  assert.deepEqual(json(c.w.__lbwSent), ['I take M'], 'one "say" for the visitor\'s one click');
});

test('send failed: a tap on Retry sends it once (a double tap too); the browser said offline, so nothing was even tried', async () => {
  const { c, m } = chat('en'); let off = true; Object.defineProperty(c.w.navigator, 'onLine', { get: () => !off, configurable: true });
  const w = widget(c, () => 'ok'); await wait(20);
  m.querySelectorAll('.lbw-reply')[0].click(); await wait(300);
  assert.equal(w.calls.length, 0, 'offline: no way tried'); assert.deepEqual(c.sent, []);
  assert.ok(c.dropped().some((d) => /not sent \(offline\): I take S/.test(d)));
  const r = m.querySelector('.lbw-retry'); assert.equal(m.querySelector('.lbw-unsent').textContent, 'Not sent.Retry');
  off = false; r.click(); r.click(); m.querySelectorAll('.lbw-reply')[0].click();
  await wait(300);
  assert.equal(w.calls.length, 1);
  assert.ok(m.querySelectorAll('.lbw-reply')[0].classList.contains('is-sent'));
});

test('send failed (no way at all): another chip in the group cancels the failed one and sends instead; cfg.labels override the words', async () => {
  const c = boot({ landbot: false });
  c.LBW.init({ prefix: 't', langs: ['en'], quietMs: 10, labels: { en: { unsent: 'Oops.', retry: 'Again' } } });
  c.LBW.widget('size', (p, ctx) => { const U = c.LBW.ui, g = U.once(), o = U.card(ctx.lang); ['s', 'm'].forEach((s) => g.appendChild(U.reply(s, 'I take ' + s))); o.box.appendChild(g); return o; });
  const m = c.bot('Pick [[t:size]]'); await wait(20);
  const [s, mm] = m.querySelectorAll('.lbw-reply');
  s.click(); await wait(300);
  assert.ok(c.dropped().some((d) => /no way to send: I take s/.test(d)));
  assert.equal(m.querySelector('.lbw-unsent').textContent, 'Oops.Again');
  const got = []; c.w._landbot = { sendMessage: (x) => { got.push(x.message); return Promise.resolve(); } };
  await wait(1300);   // the 1.2 s lock
  mm.click(); await wait(300);
  assert.deepEqual(got, ['I take m'], 'the failed "I take s" is not sent as well');
  c.w.dispatchEvent(new c.w.Event('online')); await wait(300);
  assert.deepEqual(got, ['I take m']);
  assert.equal(m.querySelector('.lbw-unsent'), null);
});

test('send failed: a form opens again with its CTA live and its fields kept; the visitor writing ends the retry', async () => {
  const c = boot(); c.LBW.init({ prefix: 't', langs: ['en'], quietMs: 10 }); let net = 'net'; const w = widget(c, () => net); let sent = 0;
  c.LBW.widget('f', (p, ctx) => { const o = c.LBW.ui.card(ctx.lang), f = c.LBW.ui.form('x', { state: { n: 2 }, cta: 'Go', send: (st) => ['Go ' + st.n, { n: String(st.n) }], sent: () => sent++ });
    f.add(c.LBW.ui.stepper('N', 2, { min: 2, max: 4, change: (v) => { f.state.n = v; f.update(); } })); o.box.appendChild(f.el); return o; });
  const m = c.bot('Form [[t:f]]'); await wait(20);
  const cta = m.querySelector('.lbw-cta'), minus = m.querySelector('.lbw-step-b');
  assert.equal(minus.disabled, true, 'at its minimum');
  cta.click(); assert.equal(sent, 1); await wait(300);
  assert.equal(cta.disabled, false); assert.equal(minus.disabled, true, 'a button disabled before the send stays disabled');
  assert.ok(m.querySelector('.lbw-unsent'));
  c.user('never mind'); await wait(20);
  assert.equal(m.querySelector('.lbw-unsent'), null, 'the visitor moved on: no retry left');
  net = 'ok'; c.w.dispatchEvent(new c.w.Event('online')); await wait(300);
  assert.equal(w.calls.length, 1, 'a stale card is not sent behind the visitor\'s back');
});

test('send failed: a card button outside a one-shot group is not retried once the visitor wrote after it', async () => {
  const c = boot(); c.LBW.init({ prefix: 't', langs: ['en'], quietMs: 10 }); let net = 'net'; const w = widget(c, () => net);
  c.LBW.widget('card', (p, ctx) => { const o = c.LBW.ui.card(ctx.lang); o.box.appendChild(c.LBW.ui.reply('Details', 'Tell me more')); return o; });
  const m = c.bot('Card [[t:card]]'); await wait(20);
  m.querySelector('.lbw-reply').click(); await wait(300);
  assert.ok(m.querySelector('.lbw-unsent'));
  c.user('something else'); await wait(20);
  assert.equal(m.querySelector('.lbw-unsent'), null);
  net = 'ok'; c.w.dispatchEvent(new c.w.Event('online')); await wait(300);
  assert.equal(w.calls.length, 1, 'only the failed attempt');
  assert.equal(m.querySelector('.lbw-reply').disabled, false, 'a card button stays live, as before');
});

test('send: a rejection that is not the network still goes through the next way, and success leaves no retry', async () => {
  const c = boot(); c.LBW.init({ prefix: 't', quietMs: 10 });
  const w = { sendMessage: () => Promise.reject(new Error('busy')) }; c.LBW.landbot(w);
  await wait(20); c.LBW.say('Hi'); await wait(300);
  assert.deepEqual(c.sent, [['landbot-msg-send', { type: 'text', message: 'Hi' }]]);
  assert.equal(c.d.querySelector('.lbw-unsent'), null);
});
