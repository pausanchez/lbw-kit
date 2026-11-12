// test/critique-h10.test.mjs · v0.8.1.7: what the design critique of the H10 demo's mock found in the library.
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
  assert.equal(img.getAttribute('sizes'), '(max-width: 480px) 72vw, 300px');
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
  assert.equal(m.querySelector('.kit-cmp-same').textContent, 'The same in both: View: Sea');
  c.close();
});
