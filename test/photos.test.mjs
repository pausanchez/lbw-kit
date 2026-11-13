// test/photos.test.mjs · v0.8.1.10: a CDN's size folders written once ("photos"), and a slide's photo as "set:file".
// H10 wrote srcset by hand for 9 rooms and 27 gallery photos (three folders each): 108 URLs where 36 file names say it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json } from './helpers.mjs';

const PHOTOS = { h: { base: 'https://img.example/gallery/', sizes: [['S/', 495], ['M/', 964], ['', 1440]], ratio: [4, 3] } };
const LINKS = ['https://img.example/', 'https://site.example/'];
function setup(widgets, extra = {}, scripts = ['kit/setup.js', 'kit/setup-check.js']) {
  const c = boot({ kit: true, scripts });
  const cfg = { prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: LINKS, photos: PHOTOS, widgets, ...extra };
  c.result = json(c.w.LBW.kit.setup(cfg));
  c.check = (x) => json(c.w.LBW.kit.setup.check(x));
  c.cfg = cfg;
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const ROOMS = { type: 'carousel', items: [
  { id: 'a', name: { es: 'Doble', en: 'Double' }, img: 'h:01_a.jpg', gallery: { title: 'Doble', photos: ['h:01_a.jpg', { photo: 'h:02_a.jpg', alt: 'Baño' }] } },
  { id: 'b', name: 'Suite', img: { photo: 'h:01_b.jpg', alt: { es: 'La suite', en: 'The suite' } } }] };

test('photos: "set:file" becomes src (smallest), srcset (every size), width and height from the ratio; a gallery photo gets the largest as "big"', () => {
  const c = setup({ r: ROOMS });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const x = json(c.w.LBW.kit.setup._.photosIn(c.cfg)).widgets.r.items;
  assert.deepEqual(x[0].img, { src: 'https://img.example/gallery/S/01_a.jpg', srcset: [['https://img.example/gallery/S/01_a.jpg', 495], ['https://img.example/gallery/M/01_a.jpg', 964], ['https://img.example/gallery/01_a.jpg', 1440]], width: 495, height: 371, alt: { es: 'Doble', en: 'Double' } });
  assert.deepEqual(x[0].gallery.photos[1], { alt: 'Baño', src: 'https://img.example/gallery/M/02_a.jpg', srcset: [['https://img.example/gallery/S/02_a.jpg', 495], ['https://img.example/gallery/M/02_a.jpg', 964], ['https://img.example/gallery/02_a.jpg', 1440]], big: 'https://img.example/gallery/02_a.jpg' });
  assert.equal(x[0].gallery.photos[0].alt, 'Doble');
  const m = draw(c, '[[t:r lang=en]]'), img = [...m.querySelectorAll('.kit-slide img')];
  assert.equal(img[0].getAttribute('srcset'), 'https://img.example/gallery/S/01_a.jpg 495w, https://img.example/gallery/M/01_a.jpg 964w, https://img.example/gallery/01_a.jpg 1440w');
  assert.equal(img[0].getAttribute('alt'), 'Double'); assert.equal(img[1].getAttribute('alt'), 'The suite');
  assert.equal(img[0].getAttribute('width'), '495'); assert.equal(img[0].getAttribute('height'), '371');
  c.close();
});

test('photos: a full address and a written-out img are left as they are; the config passed in is not changed', () => {
  const own = { src: 'https://img.example/x.jpg', alt: 'X' };
  const c = setup({ r: { type: 'carousel', items: [{ id: 'a', name: 'A', img: own }, { id: 'b', name: 'B', img: 'https://img.example/y.jpg' }] } });
  const x = json(c.w.LBW.kit.setup._.photosIn(c.cfg)).widgets.r.items;
  assert.deepEqual(x[0].img, own); assert.equal(x[1].img, 'https://img.example/y.jpg');
  const r2 = { r: ROOMS }; setup(r2).close(); assert.equal(ROOMS.items[0].img, 'h:01_a.jpg');
  c.close();
});

test('check: a photo set says what is wrong, and a photo from a set that does not exist is named', () => {
  const c = setup({});
  const bad = (photos, widgets = {}) => c.check({ prefix: 't', links: LINKS, photos, widgets }).join('\n');
  assert.match(bad({ h: { base: 'https://cdn.other/g/', sizes: [['', 100]] } }), /photos\.h\.base "https:\/\/cdn\.other\/g\/" is not under any entry of "links"/);
  assert.match(bad({ h: { base: 'https://img.example/g', sizes: [['', 100]] } }), /photos\.h\.base is an https address ending in "\/"/);
  assert.match(bad({ h: { base: 'https://img.example/g/', sizes: [['B/', 900], ['A/', 400]] } }), /photos\.h\.sizes: the widths go up \(900, then 400\)/);
  assert.match(bad({ h: { base: 'https://img.example/g/', sizes: [['/A', 400]] } }), /leading "\/"/);
  assert.match(bad({ h: { base: 'https://img.example/g/', sizes: [['A/', '400']] } }), /sizes\[0\] is \[folder, width\]/);
  assert.match(bad({ h: { base: 'https://img.example/g/', sizes: [['A/', 400]], ratio: [4], crop: 1 } }), /ratio is \[width, height\][\s\S]*unknown key "crop"|unknown key "crop"[\s\S]*ratio is \[width, height\]/);
  const e = bad(PHOTOS, { r: { type: 'carousel', items: [{ id: 'a', name: 'A', img: 'x:01.jpg', gallery: { photos: ['h:1.jpg', 'q:2.jpg'] } }] } });
  assert.match(e, /r: items\[0\]\.img: "x:" is not a set in "photos"/);
  assert.match(e, /r: items\[0\]\.gallery\.photos\[1\]: "q:" is not a set in "photos"/);
  assert.deepEqual(c.check({ prefix: 't', langs: ['es', 'en'], defaultLang: 'es', links: LINKS, photos: PHOTOS, widgets: { r: ROOMS } }), []);
  c.close();
});

test('photos: without the checker (the bundle a bot loads), a photo from an unknown set is left out and the slide still draws', () => {
  const c = setup({ r: { type: 'carousel', items: [{ id: 'a', name: 'A', img: 'nope:1.jpg' }, { id: 'b', name: 'B', img: 'h:2.jpg' }] } }, {}, ['kit/setup.js']);
  const m = draw(c, '[[t:r]]');
  assert.equal(m.querySelectorAll('.kit-slide').length, 2);
  assert.equal(m.querySelectorAll('.kit-slide img').length, 1);
  c.close();
});

test('photos 0.8.1.12: a person\'s img from a set is one URL (the smallest size); an unknown set is named', () => {
  const ppl = { type: 'people', items: { ana: { name: 'Ana', role: 'Recepción', img: 'h:ana.jpg' }, ben: { name: 'Ben', role: 'Spa', img: 'zz:ben.jpg' } } };
  const c = setup({ team: ppl });
  const x = json(c.w.LBW.kit.setup._.photosIn(c.cfg)).widgets.team.items;
  assert.equal(x.ana.img, 'https://img.example/gallery/S/ana.jpg'); assert.equal(x.ben.img, undefined);
  assert.match(c.check(c.cfg).join('\n'), /team: ben\.img: "zz:" is not a set in "photos"/);
  c.close();
});

test('photos 0.8.1.12: a live carousel maps { "photo": "set:{column}" } row by row; a row with a missing file has no photo', async () => {
  const csv = 'id,name,foto\na,Doble,01_a.jpg\nb,Suite,\n';
  const live = { type: 'carousel', items: [{ id: 'a', name: 'Doble' }], source: { csv: 'https://site.example/rooms.csv', map: { name: '{name}', img: { photo: 'h:{foto}', alt: '{name}' } } } };
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.w.fetch = () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(csv) });
  const cfg = { prefix: 't', langs: ['es'], links: LINKS, photos: PHOTOS, widgets: { r: live } };
  assert.deepEqual(json(c.w.LBW.kit.setup.check(cfg)), []);
  json(c.w.LBW.kit.setup(cfg));
  const m = c.bot('Text [[t:r]]'); c.LBW.scan(); await new Promise((r) => setTimeout(r, 40));
  const img = [...m.querySelectorAll('.kit-slide img')];
  assert.equal(img.length, 1); assert.equal(img[0].getAttribute('src'), 'https://img.example/gallery/S/01_a.jpg');
  assert.match(img[0].getAttribute('srcset'), /M\/01_a\.jpg 964w/); assert.equal(img[0].getAttribute('alt'), 'Doble');
  const bad = json(c.w.LBW.kit.setup.check({ ...cfg, widgets: { r: { ...live, source: { ...live.source, map: { name: '{name}', img: { photo: 'zz:{foto}' } } } } } })).join('\n');
  assert.match(bad, /source\.map\.img\.photo: "zz:" is not a set in "photos"/);
  c.close();
});

test('photos 0.8.1.14: a srcset pasted from a WordPress page is parsed; width and height from the smallest file name; a gallery gets the largest as big', () => {
  const ss = 'https://site.example/wp-content/uploads/2026/06/FACHADA.jpg 2207w, https://site.example/wp-content/uploads/2026/06/FACHADA-380x282.jpg 380w, https://site.example/wp-content/uploads/2026/06/FACHADA-768x569.jpg 768w, https://site.example/wp-content/uploads/2026/06/FACHADA-480x356.jpg 480w';
  const live = { type: 'carousel', items: [{ id: 'a', name: 'Fachada', img: { srcset: ss }, gallery: { photos: [{ srcset: ss, alt: 'Vía Augusta' }] } }, { id: 'b', name: 'Nada', img: { srcset: 'no pairs here' } }] };
  const c = setup({ r: live }, { links: ['https://site.example/'] });
  const x = json(c.w.LBW.kit.setup._.photosIn(c.cfg)).widgets.r.items;
  assert.equal(x[0].img.src, 'https://site.example/wp-content/uploads/2026/06/FACHADA-380x282.jpg');
  assert.deepEqual(x[0].img.srcset.map((p) => p[1]), [380, 480, 768, 2207]);
  assert.deepEqual([x[0].img.width, x[0].img.height, x[0].img.alt], [380, 282, 'Fachada']);
  assert.equal(x[0].gallery.photos[0].big, 'https://site.example/wp-content/uploads/2026/06/FACHADA.jpg');
  assert.equal(x[0].gallery.photos[0].src, 'https://site.example/wp-content/uploads/2026/06/FACHADA-768x569.jpg');
  assert.match(c.check(c.cfg).join('\n'), /r: items\[1\]\.img: "srcset" holds no "url 480w" pairs/);
  c.close();
});
