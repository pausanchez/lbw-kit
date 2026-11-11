// test/runtime.test.mjs · lbw.js against a stand-in chat DOM: the tag parser, untrusted values, links, scanning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json, pkg } from './helpers.mjs';

// a chat with prefix `t` and a widget `probe` that hands back the params of its tag
function chat(init) {
  const c = boot();
  c.LBW.init(Object.assign({ prefix: 't', langs: ['en', 'es'], defaultLang: 'en', links: ['https://shop.example/', 'https://other.example', 'tel:'], quietMs: 10 }, init));
  c.LBW.widget('card', (p, ctx) => {
    const id = p.one('id', ['boots', 'hat']); if (!id) return null;
    const o = c.LBW.ui.card(ctx.lang, 't-card'); c.LBW.ui.head(o.box, 'Kicker', id); return o;
  });
  c.LBW.widget('probe', (p, ctx) => { c.p = p; c.ctx = ctx; return c.LBW.ui.card(ctx.lang); });
  return c;
}

test('version: one number for the package, lbw.js and the kit', () => {
  const c = boot({ kit: true });
  assert.equal(c.LBW.version, pkg.version);
  assert.equal(c.LBW.kit.version, pkg.version);
  c.close();
});

test('parse: spaces, pipes, loose tokens, quotes', () => {
  const { LBW, close } = boot(), parse = (s) => json(LBW.parse(s));
  assert.deepEqual(parse('id=boots lang=en'), { id: 'boots', lang: 'en' });
  assert.deepEqual(parse('name=Ana Maria|size=m|lang=es'), { name: 'Ana Maria', size: 'm', lang: 'es' });
  assert.deepEqual(parse('ids=a b lang=en'), { ids: 'a,b', lang: 'en' });
  assert.deepEqual(parse('ID="boots"'), { id: 'boots' });
  assert.deepEqual(parse(''), {});
  close();
});

test('missing: unset fields and Landbot\'s default name read as missing', () => {
  const { LBW, close } = boot();
  for (const v of ['', null, undefined, '  ', '@{name}', '@name', 'Visitor #537058751', 'Visitor,#5']) assert.equal(LBW.missing(v), true, String(v));
  for (const v of ['Ana', '0', '@ home', 'Visitor']) assert.equal(LBW.missing(v), false, v);
  close();
});

test('params: closed lists, numbers, text and days', () => {
  const c = chat();
  c.bot('[[t:probe ids=Sea-Fast+b,zzz,b n=4,5 big=99 txt=<b>hi</b> d=21/11/2026 bad=31/2/2026 name=@{name}]]');
  c.LBW.scan();
  const p = c.p;
  assert.deepEqual(json(p.list('ids', ['sea_fast', 'b'])), ['sea_fast', 'b']);
  assert.equal(p.one('ids', ['b']), 'b');
  assert.equal(p.one('ids', ['nope']), null);
  assert.equal(p.num('n', 0, 10, 1), 4.5);
  assert.equal(p.num('n', 0, 10, 1, { int: true }), 1);
  assert.equal(p.num('big', 0, 10, 1), 10);
  assert.equal(p.num('big', 0, 10, 1, { reject: true }), 1);
  assert.equal(p.num('absent', 0, 10, 7), 7);
  assert.equal(p.text('txt'), 'bhi/b');
  assert.equal(p.day('d'), c.LBW.day.read('21/11/2026'));
  assert.equal(p.day('bad'), null);
  assert.equal(p.has('name'), false);
  assert.ok(c.dropped().some((x) => x.includes('unknown value ids=zzz')));
  c.close();
});

test('links: only allowed origins, never a look-alike host or another scheme', () => {
  const c = chat(), U = c.LBW.ui;
  const a = U.link('Buy', 'https://shop.example/boots');
  assert.equal(a.href, 'https://shop.example/boots'); assert.equal(a.target, '_blank'); assert.equal(a.rel, 'noopener');
  assert.ok(U.link('x', 'https://other.example/page'));
  for (const bad of ['https://shop.example.evil.com/', 'https://other.example.evil.com/x', 'http://shop.example/', 'javascript:alert(1)',
    'data:text/html,x', '//shop.example/', 'https://shop.example/a"b', 'https://shop.example/a b', 'mailto:a@b.co']) assert.equal(U.link('x', bad), null, bad);
  assert.equal(U.tel('Call', '06 52 64 45 30', '', '33').getAttribute('href'), 'tel:+33652644530');
  assert.equal(U.tel('Call', 'not a number'), null);
  const refused = U.img('https://evil.example/a.jpg');
  assert.ok(refused.classList.contains('is-empty')); assert.equal(refused.querySelector('img'), null);
  assert.ok(U.img('https://shop.example/a.jpg').querySelector('img'));
  c.close();
});

test('scan: the tag leaves the text and a widget is drawn under the message', () => {
  const c = chat(), m = c.bot('Here it is [[t:card id=boots lang=es]]');
  c.LBW.scan();
  assert.equal(m.text(), 'Here it is');
  const [w, ...rest] = m.widgets();
  assert.equal(rest.length, 0);
  assert.equal(w.getAttribute('data-tag'), '[[t:card id=boots lang=es]]');
  assert.equal(w.getAttribute('data-widget'), 'card');
  assert.equal(w.getAttribute('lang'), 'es');
  assert.equal(w.querySelector('.lbw-title').textContent, 'boots');
  assert.ok(m.classList.contains('has-lbw'));
  c.LBW.scan();
  assert.equal(m.widgets().length, 1, 'a second scan draws nothing more');
  c.close();
});

test('scan: what can\'t be drawn is removed and logged, never shown', () => {
  const c = chat();
  const unknownId = c.bot('A [[t:card id=shoes]]'), unknownWidget = c.bot('B [[t:nope id=boots]]'), otherPrefix = c.bot('C [[x:card id=boots]]');
  const open = c.bot('D [[t:card id=boo'), tail = c.bot('E [[x:y]] id=boots|lang=en]]');
  c.LBW.widget('boom', () => { throw new Error('bang'); });
  const thrown = c.bot('F [[t:boom]]');
  c.LBW.scan();
  for (const [m, text] of [[unknownId, 'A'], [unknownWidget, 'B'], [otherPrefix, 'C'], [open, 'D'], [tail, 'E'], [thrown, 'F']]) {
    assert.equal(m.text(), text); assert.equal(m.widgets().length, 0);
  }
  const log = c.dropped().join('\n');
  for (const why of ['widget returned null', 'unknown widget', '[[x:card id=boots]]', 'tail of a broken tag', 'error: bang']) assert.ok(log.includes(why), why);
  c.close();
});

test('scan: only the bot\'s messages; a visitor typing a tag draws nothing', () => {
  const c = chat(), u = c.user('[[t:card id=boots]]');
  c.LBW.scan();
  assert.equal(u.text(), '[[t:card id=boots]]'); assert.equal(u.widgets().length, 0);
  c.close();
});

test('scan: at most maxPerMessage widgets, and `last` widgets go last', () => {
  const c = chat();
  c.LBW.widget('chips', (p, ctx) => c.LBW.ui.card(ctx.lang, 't-chips'), { last: true });
  const m = c.bot('[[t:chips]] [[t:card id=boots]] [[t:card id=hat]] [[t:card id=boots]]');
  c.LBW.scan();
  assert.deepEqual(m.widgets().map((w) => w.getAttribute('data-widget')), ['card', 'card', 'chips']);
  assert.ok(c.dropped().some((x) => x.includes('over the limit')));
  assert.equal(m.text(), '');
  c.close();
});

test('scan: a tag that Markdown split over several nodes is still read', () => {
  const c = chat(), m = c.bot(null, 'See <em>this</em> [[t:card id=<strong>boots</strong> lang=en]]');
  c.LBW.scan();
  assert.equal(m.text(), 'See this');
  assert.equal(m.widgets().length, 1);
  assert.equal(m.querySelector('.lbw-title').textContent, 'boots');
  c.close();
});

test('scan: a language outside `langs` falls back to the default', () => {
  const c = chat();
  c.bot('[[t:probe lang=fr]]'); c.LBW.scan();
  assert.equal(c.ctx.lang, 'en');
  c.close();
});

test('scan: tag values reach the page as text only', () => {
  const c = chat();
  c.LBW.widget('hello', (p, ctx) => { const o = c.LBW.ui.card(ctx.lang); c.LBW.ui.head(o.box, '', p.text('name', 60)); return o; });
  const m = c.bot('[[t:hello name=<img src=x onerror=alert(1)>|lang=en]]');
  c.LBW.scan();
  assert.equal(m.querySelector('img'), null);
  assert.equal(m.querySelector('.lbw-title').textContent, 'img src=x onerror=alert(1)');
  c.close();
});

test('scan: ctx.prev is the visitor\'s last message before the reply', () => {
  const c = chat();
  c.user('  Do you   have BOOTS? '); c.bot('[[t:probe]]'); c.user('later');
  c.LBW.scan();
  assert.equal(c.ctx.prev, 'do you have boots?');
  c.close();
});

test('observer: a message that arrives after init() is drawn without calling scan()', async () => {
  const c = chat();
  await wait(5);
  const m = c.bot('New [[t:card id=hat]]');
  await wait(30);
  assert.equal(m.text(), 'New'); assert.equal(m.widgets().length, 1);
  c.close();
});
