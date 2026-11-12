// test/kit.test.mjs · the kit drawn from kit/example/widgets.js (a fictional builder, fake data), and the fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait } from './helpers.mjs';

const MAKERS = ['cards', 'form', 'contact', 'chips', 'carousel', 'calc', 'slots', 'confirm', 'review', 'chart', 'stats', 'people', 'consent', 'compare', 'season'];
const example = () => boot({ kit: true, scripts: ['kit/example/widgets.js'] });

test('kit: every maker is there', () => {
  const c = boot({ kit: true });
  for (const m of MAKERS) assert.equal(typeof c.LBW.kit[m], 'function', m);
  c.close();
});

test('kit example: each tag draws its widget', () => {
  const c = example();
  const tags = ['service id=extension', 'faq id=planning', 'area', 'plan kind=loft', 'contact', 'projects kind=loft', 'room size=12 finish=clad'];
  const drawn = tags.map((t) => { const m = c.bot(`Text [[np:${t}]]`); c.LBW.scan(); return [t, m]; });
  for (const [t, m] of drawn) {
    assert.equal(m.text(), 'Text', t);
    assert.equal(m.widgets().length, 1, t + ' → ' + c.dropped().join(' | '));
  }
  assert.match(drawn[0][1].textContent, /Extensions/);
  c.close();
});

test('kit example: an invented id draws nothing', () => {
  const c = example(), m = c.bot('Text [[np:service id=castle]]');
  c.LBW.scan();
  assert.equal(m.text(), 'Text'); assert.equal(m.widgets().length, 0);
  c.close();
});

test('fallback: with no library, tags are removed from the bot\'s messages', async () => {
  const c = boot({ lbw: false });
  c.w.LBW_FALLBACK_MS = 10;
  c.w.eval((await import('./helpers.mjs')).read('runtime/fallback.js'));
  const m = c.bot('Here it is [[np:service id=extension]]'), u = c.user('[[np:x]]');
  await wait(40);
  const late = c.bot(null, 'And <em>this</em> [[np:faq id=planning]] `[[np:area]]` [[np:open');
  await wait(40);
  assert.equal(m.text(), 'Here it is');
  assert.equal(late.text(), 'And this');
  assert.equal(u.text(), '[[np:x]]');
  c.close();
});

test('fallback: does nothing once the library is there', async () => {
  const c = boot();
  c.w.LBW_FALLBACK_MS = 10;
  c.w.eval((await import('./helpers.mjs')).read('runtime/fallback.js'));
  const m = c.bot('Kept [[zz:thing]]');   // LBW.init() was never called, so nothing scans: the text must stay as it is
  await wait(40);
  assert.equal(m.text(), 'Kept [[zz:thing]]');
  c.close();
});
