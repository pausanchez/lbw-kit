// test/critique-081.test.mjs · v0.8.1.7: what the design critique of a demo's mock found in the library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json } from './helpers.mjs';

function setup(widgets) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.result = json(c.w.LBW.kit.setup({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: ['https://img.example/', 'https://site.example/'], widgets }));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };

test('0.8.1.7: an email in a row may break after @; other values are plain text', () => {
  const c = setup({ k: { type: 'cards', item: { title: 'T', rows: [['Email', 'hola@hotel.example'], ['Tel', '+34 600 000 000']] } } });
  const dd = [...draw(c, '[[t:k]]').querySelectorAll('dd')];
  assert.equal(dd[0].textContent, 'hola@hotel.example'); assert.ok(dd[0].querySelector('wbr'));
  assert.equal(dd[1].querySelector('wbr'), null);
  c.close();
});

test('0.8.1.7: slides ask for their drawn size; a gallery of one shows no count and speaks the card\'s language', () => {
  const c = setup({ r: { type: 'carousel', items: [{ id: 'a', name: 'A', img: { src: 'https://img.example/a.jpg', srcset: [['https://img.example/a.jpg', 495]], width: 495, height: 371 }, gallery: { photos: [{ src: 'https://img.example/a.jpg' }] } }, { id: 'b', name: 'B' }] } });
  const m = draw(c, '[[t:r lang=es]]'), img = m.querySelector('.kit-slide img');
  assert.equal(img.getAttribute('sizes'), '(max-width: 480px) 65vw, 300px');
  assert.equal(m.querySelector('.kit-zoom-n').textContent, '⤢');
  assert.match(m.querySelector('.kit-zoom').getAttribute('aria-label'), /^Fotos · A/);
  c.close();
});

test('0.8.1.7: compare with "primary": false draws equals; one equal row stays on the label\'s line', () => {
  const c = setup({ v: { type: 'compare', primary: false, same: 'fold', rows: [['s', 'Size'], ['v', 'View']], items: {
    a: { name: 'A', values: { s: '21', v: 'Sea' }, reply: ['A', 'Pick A'] }, b: { name: 'B', values: { s: '23', v: 'Sea' }, reply: ['B', 'Pick B'] } } } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const m = draw(c, '[[t:v ids=a,b lang=en]]');
  assert.equal(m.querySelectorAll('.lbw-pill.is-primary').length, 0);
  assert.equal(m.querySelector('.kit-cmp-same').textContent, 'The same in both · View: Sea');
  c.close();
});

test('0.8.1.8: a swipe pages the lightbox; a vertical or short one does not', () => {
  const c = boot({ kit: true }), K = c.w.LBW.kit;
  c.w.LBW.init({ prefix: 't', langs: ['en'], links: ['https://img.example/'] });
  const opener = c.d.createElement('button'); c.d.body.appendChild(opener);
  const lb = K.h.lightbox({ photos: [{ src: 'https://img.example/1.jpg' }, { src: 'https://img.example/2.jpg' }, { src: 'https://img.example/3.jpg' }], title: 'R', lang: 'en' }, 0, opener);
  const stage = lb.el.querySelector('.kit-ovl-stage'), cur = () => stage.querySelector('img').getAttribute('src');
  const swipe = (x0, x1, y1 = 0) => { const s = new c.w.Event('touchstart'); s.touches = [{ clientX: x0, clientY: 0 }]; stage.dispatchEvent(s); const e = new c.w.Event('touchend'); e.changedTouches = [{ clientX: x1, clientY: y1 }]; stage.dispatchEvent(e); };
  swipe(200, 100); assert.equal(cur(), 'https://img.example/2.jpg');
  swipe(200, 180); assert.equal(cur(), 'https://img.example/2.jpg', 'a short move');
  swipe(200, 100, 300); assert.equal(cur(), 'https://img.example/2.jpg', 'mostly vertical');
  swipe(100, 220); assert.equal(cur(), 'https://img.example/1.jpg');
  lb.close(); c.close();
});

test('0.8.1.9 (critique 0.8.1.3): compare replies sit in one column each; the season row says when it opens', () => {
  const c = setup({ v: { type: 'compare', rows: [['s', 'Size']], items: { a: { name: 'A', values: { s: '1' }, reply: ['A', 'Pick A'] }, b: { name: 'B', values: { s: '2' }, reply: ['B', 'Pick B'] }, d: { name: 'D', values: { s: '3' }, reply: ['D', 'Pick D'] } } } });
  const g = draw(c, '[[t:v ids=a,b,d lang=en]]').querySelector('.kit-cmp-acts');
  assert.ok(g); assert.equal(g.style.getPropertyValue('--kit-n'), '3');
  c.close();
  const c2 = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c2.w.__lbwToday = '12/11/2026';
  c2.w.LBW.kit.setup({ prefix: 't', langs: ['es'], timeZone: 'Europe/Madrid', links: [], widgets: { s: { type: 'season', ranges: [['1/3/2027', '31/10/2027']] } } });
  const rows = [...draw(c2, '[[t:s lang=es]]').querySelectorAll('dt')].map((x) => x.textContent);
  assert.equal(rows[0], 'Abre en');
  c2.close();
});

test('0.8.1.9 review: compare columns follow the items; a reply sits in its own item\'s column; the first reply is the primary', () => {
  const c = setup({ v: { type: 'compare', rows: [['s', 'Size']], items: { a: { name: 'A', values: { s: '1' } }, b: { name: 'B', values: { s: '2' }, reply: ['B', 'Pick B'] }, d: { name: 'D', values: { s: '3' }, reply: ['D', 'Pick D'] } } } });
  const g = draw(c, '[[t:v ids=a,b,d lang=en]]').querySelector('.kit-cmp-acts'), bs = [...g.querySelectorAll('.lbw-pill')];
  assert.equal(g.style.getPropertyValue('--kit-n'), '3');
  assert.deepEqual(bs.map((b) => b.style.getPropertyValue('--kit-col')), ['2', '3']);
  assert.ok(bs[0].classList.contains('is-primary') && !bs[1].classList.contains('is-primary'));
  c.close();
});

test('0.8.1.9 review: a card whose replies went stale with nothing sent is marked is-spent by the runtime', () => {
  const c = setup({ ch: { type: 'chips', items: { a: ['A', 'Say A'] } } });
  const m = draw(c, '[[t:ch q=a]]'); c.user('typed something'); c.LBW.scan();
  assert.ok(m.querySelector('.lbw').classList.contains('is-spent'));
  c.close();
});
