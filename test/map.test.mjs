// test/map.test.mjs · v0.10: "type": "map". 1–5 places on the client's map image or on a schematic drawn from lat/lng, with the
// list a screen reader reads: distance, open now (contact's hours), "Cómo llegar ↗" built from lat/lng or the address and
// refused when `links` doesn't allow it. A pin and its row select each other. Nothing is fetched but the image.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, json } from './helpers.mjs';

const LINKS = ['https://rodanorte.example/', 'https://www.google.com/maps/'];
const WEEK = { 1: [[600, 840], [1020, 1200]], 2: [[600, 840], [1020, 1200]], 3: [[600, 840], [1020, 1200]], 4: [[600, 840], [1020, 1200]], 5: [[600, 840], [1020, 1200]], 6: [[600, 840]] };
const PLACES = [
  { id: 'tienda', name: 'Tienda Roda Norte', kind: 'Tienda', address: 'Muelle de las Bicis 4', lat: 43.2600, lng: -2.9300, hours: { week: WEEK, holidays: ['8/12'] } },
  { id: 'taller', name: 'Taller', kind: 'Taller', address: 'Calle del Piñón 18', lat: 43.2560, lng: -2.9240, hours: { week: { 1: [[540, 1080]], 2: [[540, 1080]], 3: [[540, 1080]], 4: [[540, 1080]], 5: [[540, 1080]] } } },
  { id: 'recogida', name: 'Punto de recogida', kind: 'Recogida', address: "Plaza d'Arriba 2", lat: 43.2630, lng: -2.9170, status: { text: 'Taquillas 24 h', tone: 'ok' } },
];
const W = {
  donde: { type: 'map', kicker: 'Dónde estamos', title: 'Tienda, taller y recogida', from: { name: 'el centro', lat: 43.2580, lng: -2.9290 }, directions: 'google',
    lines: [{ kind: 'water', pts: [[43.2650, -2.9400], [43.2590, -2.9250], [43.2540, -2.9150]], label: 'Ría' }, { kind: 'park', pts: [[43.262, -2.935], [43.264, -2.932], [43.262, -2.929]] }],
    places: PLACES },
};
function setup(widgets, links = LINKS, extra = {}) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] });
  c.w.__lbwToday = '16/11/2026'; c.w.__lbwNow = '12:00';   // a Monday at noon
  const base = { prefix: 't', langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', quietMs: 10, links };
  c.result = json(c.w.LBW.kit.setup({ ...base, ...extra, widgets }));
  c.check = (w, more = {}) => json(c.w.LBW.kit.setup.check({ ...base, ...more, widgets: w }));
  return c;
}
const draw = (c, tag) => { const m = c.bot('Text ' + tag); c.LBW.scan(); return m; };
const rowsOf = (m) => [...m.querySelectorAll('.kit-map-place')];
const pinsOf = (m) => [...m.querySelectorAll('.kit-map-pin')];

test('map: the config is valid; a schematic with numbered pin buttons, and the list as an ordered list', () => {
  const c = setup(W); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  assert.ok(c.LBW.kit.setup.types.includes('map'));
  const m = draw(c, '[[t:donde]]'), o = m.widgets()[0];
  assert.ok(o.classList.contains('kit-map'));
  assert.equal(o.querySelector('[role="heading"]').textContent, 'Tienda, taller y recogida');
  const svg = o.querySelector('svg.kit-map-sch'); assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.querySelectorAll('.kit-map-ln').length, 2); assert.equal(svg.querySelector('.kit-map-lab').textContent, 'Ría');
  assert.ok(svg.querySelector('.kit-map-from'));
  const g = o.querySelector('.kit-map-pins'); assert.equal(g.getAttribute('role'), 'radiogroup'); assert.equal(g.getAttribute('aria-label'), 'Mapa: Tienda, taller y recogida');
  assert.deepEqual(pinsOf(m).map((p) => p.getAttribute('aria-label')), ['1. Tienda Roda Norte', '2. Taller', '3. Punto de recogida']);
  assert.ok(pinsOf(m).every((p) => p.tagName === 'BUTTON' && p.getAttribute('role') === 'radio'));
  assert.deepEqual(pinsOf(m).map((p) => p.tabIndex), [0, -1, -1]);   // one Tab stop
  pinsOf(m).forEach((p) => { const x = parseFloat(p.style.left), y = parseFloat(p.style.top); assert.ok(x >= 10 && x <= 90 && y >= 20 && y <= 95, p.style.cssText); });
  // west is left, north is up
  const [t, ta, r] = pinsOf(m).map((p) => [parseFloat(p.style.left), parseFloat(p.style.top)]);
  assert.ok(t[0] < ta[0] && ta[0] < r[0]); assert.ok(r[1] < t[1] && t[1] < ta[1]);
  assert.equal(o.querySelector('.kit-map-list').tagName, 'OL');
  assert.deepEqual(rowsOf(m).map((li) => li.querySelector('.kit-map-name').textContent), ['Tienda Roda Norte', 'Taller', 'Punto de recogida']);
  assert.equal(rowsOf(m)[0].querySelector('.kit-map-n').getAttribute('aria-hidden'), 'true');
  assert.equal(rowsOf(m)[0].querySelector('.kit-map-addr').textContent, 'Muelle de las Bicis 4');
  assert.ok(!o.querySelector('.is-on')); assert.ok(pinsOf(m).every((p) => p.getAttribute('aria-checked') === 'false'));
  c.close();
});

test('map: a pin selects its row and a row selects its pin; the arrows move along the pins', () => {
  const c = setup(W), m = draw(c, '[[t:donde]]'), p = pinsOf(m), r = rowsOf(m);
  p[1].click();
  assert.deepEqual(r.map((li) => li.classList.contains('is-on')), [false, true, false]);
  assert.equal(r[1].querySelector('.kit-map-pick').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(p.map((x) => x.tabIndex), [-1, 0, -1]);
  r[2].querySelector('.kit-map-pick').click();
  assert.deepEqual(p.map((x) => x.getAttribute('aria-checked')), ['false', 'false', 'true']);
  r[0].querySelector('.kit-map-addr').click();   // anywhere on the row
  assert.equal(p[0].getAttribute('aria-checked'), 'true');
  p[0].focus(); p[0].dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(c.d.activeElement, p[1]); assert.ok(r[1].classList.contains('is-on'));
  p[1].dispatchEvent(new c.w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.ok(r[2].classList.contains('is-on'));
  assert.deepEqual(c.sent, []);   // selecting sends nothing
  c.close();
});

test('map: ids=a,b picks those places in that order; id=a highlights one; an ids naming none draws nothing', () => {
  const c = setup(W);
  let m = draw(c, '[[t:donde ids=recogida,tienda]]');
  assert.deepEqual(rowsOf(m).map((li) => li.getAttribute('data-id')), ['recogida', 'tienda']);
  assert.deepEqual(pinsOf(m).map((p) => p.getAttribute('aria-label')), ['1. Punto de recogida', '2. Tienda Roda Norte']);
  m = draw(c, '[[t:donde id=taller]]');
  assert.deepEqual(rowsOf(m).map((li) => li.classList.contains('is-on')), [false, true, false]);
  assert.equal(pinsOf(m)[1].getAttribute('aria-checked'), 'true'); assert.equal(pinsOf(m)[1].tabIndex, 0);
  m = draw(c, '[[t:donde ids=tienda id=taller]]');   // a highlight outside the places shown: no highlight
  assert.equal(rowsOf(m).length, 1); assert.ok(!m.querySelector('.is-on'));
  m = draw(c, '[[t:donde ids=nada,otra]]'); assert.equal(m.widgets().length, 0);
  c.close();
});

test('map: open now from the place\'s hours, pinned today and now (as contact\'s), and a status where there are no hours', () => {
  const c = setup(W);
  let r = rowsOf(draw(c, '[[t:donde]]'));
  assert.equal(r[0].querySelector('.kit-statusbar').textContent, 'Abierto ahora · hasta las 14:00');
  assert.ok(r[0].querySelector('.kit-statusbar').classList.contains('is-ok'));
  assert.equal(r[1].querySelector('.kit-statusbar').textContent, 'Abierto ahora · hasta las 18:00');
  assert.equal(r[2].querySelector('.kit-statusbar').textContent, 'Taquillas 24 h');
  c.w.__lbwNow = '15:00';
  r = rowsOf(draw(c, '[[t:donde]]'));
  assert.equal(r[0].querySelector('.kit-statusbar').textContent, 'Cerrado ahora · abre hoy a las 17:00');
  assert.ok(r[0].querySelector('.kit-statusbar').classList.contains('is-info'));
  c.w.__lbwToday = '14/11/2026'; c.w.__lbwNow = '15:00';   // Saturday afternoon: the shop opens Monday, the workshop too
  r = rowsOf(draw(c, '[[t:donde lang=en]]'));
  assert.equal(r[0].querySelector('.kit-statusbar').textContent, 'Closed now · opens Monday at 10:00');
  c.w.__lbwToday = '7/12/2026'; c.w.__lbwNow = '21:00';   // the night before a holiday
  r = rowsOf(draw(c, '[[t:donde]]'));
  assert.equal(r[0].querySelector('.kit-statusbar').textContent, 'Cerrado ahora · abre el miércoles a las 10:00');
  c.close();
});

test('map: distance from "from", in metres or km with a walk time; a written distance wins; sort by distance', () => {
  const places = [...PLACES.slice(0, 2), { ...PLACES[2], distance: 'En la estación' }, { id: 'lejos', name: 'Almacén', lat: 43.30, lng: -2.99 }];
  const c = setup({ donde: { ...W.donde, places, sort: 'distance' } }); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  const r = rowsOf(draw(c, '[[t:donde]]')), d = (id) => r.find((li) => li.getAttribute('data-id') === id).querySelector('.kit-map-dist').textContent;
  assert.equal(d('tienda'), '240\u00a0m desde el centro · 3 min a pie');
  assert.equal(d('taller'), '460\u00a0m desde el centro · 6 min a pie');
  assert.equal(d('recogida'), 'En la estación');
  assert.equal(d('lejos'), '6,8\u00a0km desde el centro');   // past 40 minutes no walk time
  assert.deepEqual(r.map((li) => li.getAttribute('data-id')), ['tienda', 'taller', 'recogida', 'lejos']);
  const e = rowsOf(draw(c, '[[t:donde lang=en]]'));
  assert.equal(e[0].querySelector('.kit-map-dist').textContent, '240\u00a0m from el centro · 3 min walk');
  c.close();
});

test('map: "Cómo llegar ↗" is built from lat,lng or the address, encoded, and only under "links"', () => {
  const places = [{ id: 'a', name: 'A', lat: 43.26, lng: -2.93 }, { id: 'b', name: 'B', address: "Plaza d'Arriba 2 <b>\"x\"</b>", at: [50, 50] }];
  let c = setup({ m: { type: 'map', directions: 'google', image: { src: 'https://rodanorte.example/mapa.png', width: 800, height: 500 }, places: [{ ...places[0], at: [20, 30] }, places[1]] } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  let r = rowsOf(draw(c, '[[t:m]]'));
  assert.equal(r[0].querySelector('a').href, 'https://www.google.com/maps/dir/?api=1&destination=43.26,-2.93');
  assert.equal(r[0].querySelector('a').textContent, 'Cómo llegar ↗'); assert.equal(r[0].querySelector('a').target, '_blank');
  assert.equal(r[1].querySelector('a').getAttribute('href'), 'https://www.google.com/maps/dir/?api=1&destination=Plaza%20d%27Arriba%202%20%3Cb%3E%22x%22%3C%2Fb%3E');
  c.close();
  // apple and a template of the client's own, with its label
  c = setup({ m: { type: 'map', directions: { url: 'https://rodanorte.example/ruta/?lat={lat}&lng={lng}', label: 'Ver la ruta ↗' }, places: [places[0]] } });
  r = rowsOf(draw(c, '[[t:m]]'));
  assert.equal(r[0].querySelector('a').getAttribute('href'), 'https://rodanorte.example/ruta/?lat=43.26&lng=-2.93'); assert.equal(r[0].querySelector('a').textContent, 'Ver la ruta ↗');
  c.close();
  // the runtime refuses what `links` doesn't allow: no link, logged (a config the checker would stop, forced through)
  c = setup({ m: { type: 'map', directions: 'apple', places: [places[0]] } });
  assert.ok(c.check({ m: { type: 'map', directions: 'apple', places: [places[0]] } }).some((e) => /directions: "https:\/\/maps\.apple\.com\/\?daddr=" is not under any entry of "links" \(add "https:\/\/maps\.apple\.com\/"\)/.test(e)));
  c.close();
  c = boot({ kit: true, scripts: ['kit/setup.js'] });   // no checker: setup trusts the config
  c.w.LBW.kit.setup({ prefix: 't', langs: ['es'], links: LINKS, widgets: { m: { type: 'map', directions: 'apple', places: [places[0]] } } });
  r = rowsOf(draw(c, '[[t:m]]'));
  assert.equal(r.length, 1); assert.equal(r[0].querySelector('a'), null);
  assert.ok(c.dropped().some((x) => /link not allowed: https:\/\/maps\.apple\.com\/\?daddr=43\.26,-2\.93/.test(x)));
  c.close();
});

test('map: the client\'s image, pins by "at" or by lat/lng inside "bounds"; an image outside "links" falls back to the schematic', () => {
  const img = { src: 'https://rodanorte.example/mapa.png', width: 800, height: 400, alt: 'Plano del barrio', bounds: [[43.27, -2.94], [43.25, -2.91]] };
  let c = setup({ m: { type: 'map', image: img, places: [{ id: 'a', name: 'A', lat: 43.26, lng: -2.925 }, { id: 'b', name: 'B', at: [10, 90] }] } });
  assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  let m = draw(c, '[[t:m]]'), o = m.widgets()[0];
  assert.equal(o.querySelector('.kit-map-fig img').getAttribute('src'), img.src); assert.equal(o.querySelector('.kit-map-fig img').alt, '');
  assert.equal(o.querySelector('.kit-map-fig').style.getPropertyValue('--kit-map-ar'), '2');
  assert.equal(o.querySelector('svg.kit-map-sch'), null);
  assert.equal(o.querySelector('.kit-map-pins').getAttribute('aria-label'), 'Plano del barrio');
  assert.deepEqual(pinsOf(m).map((p) => [p.style.left, p.style.top]), [['50%', '50%'], ['10%', '90%']]);
  c.close();
  c = boot({ kit: true, scripts: ['kit/setup.js'] });
  c.w.LBW.kit.setup({ prefix: 't', langs: ['es'], links: LINKS, widgets: { m: { type: 'map', image: { ...img, src: 'https://evil.example/x.png' }, places: [{ id: 'a', name: 'A', lat: 43.26, lng: -2.925 }] } } });
  m = draw(c, '[[t:m]]');
  assert.equal(m.querySelector('img'), null); assert.ok(m.querySelector('svg.kit-map-sch')); assert.equal(pinsOf(m).length, 1);
  assert.ok(c.dropped().some((x) => /image not allowed: https:\/\/evil\.example/.test(x)));
  c.close();
});

test('map: attacks on the tag draw nothing extra, run nothing and never highlight', () => {
  const c = setup(W);
  for (const tag of ['[[t:donde id=<img/src=x/onerror=window.__pwned=1>]]', '[[t:donde id=__proto__]]', '[[t:donde id=constructor]]', '[[t:donde id=javascript:alert(1)]]']) {
    const m = draw(c, tag); assert.equal(m.widgets().length, 1, tag); assert.ok(!m.querySelector('.is-on'), tag); assert.equal(rowsOf(m).length, 3, tag);
  }
  for (const tag of ['[[t:donde ids=javascript:alert(1)]]', '[[t:donde ids=__proto__,constructor]]', '[[t:donde ids=<b>x</b>]]']) assert.equal(draw(c, tag).widgets().length, 0, tag);
  const m = draw(c, '[[t:donde ids=taller,<script>,tienda]]'); assert.deepEqual(rowsOf(m).map((li) => li.getAttribute('data-id')), ['taller', 'tienda']);
  assert.equal(c.w.__pwned, undefined); assert.ok(!c.d.querySelector('.lbw script, .lbw img[onerror]')); assert.ok(!c.d.body.textContent.includes('onerror'));
  c.close();
});

test('map: five places at most; a highlighted sixth takes the fifth place', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, name: 'Sitio ' + i, lat: 43.25 + i / 1000, lng: -2.93 + i / 1000 }));
  const c = setup({ m: { type: 'map', places: many } }); assert.equal(c.result.ok, true, JSON.stringify(c.result.errors));
  assert.equal(rowsOf(draw(c, '[[t:m]]')).length, 5);
  const r = rowsOf(draw(c, '[[t:m id=p6]]'));
  assert.deepEqual(r.map((li) => li.getAttribute('data-id')), ['p0', 'p1', 'p2', 'p3', 'p6']); assert.ok(r[4].classList.contains('is-on'));
  c.close();
});

test('check: a map says what is wrong, by key', () => {
  const c = setup({});
  const e = c.check({
    a: { type: 'map', places: [] },
    b: { type: 'map', directions: 'bing', places: [{ id: 'X Y', name: 'A', lat: 91, lng: 0 }, { id: 'b', lat: 40, lng: 200 }, { id: 'c', name: 'C' }] },
    d: { type: 'map', image: { src: 'https://evil.example/m.png', width: 0 }, lines: [{ kind: 'lava', pts: [[1, 2]] }], places: [{ id: 'a', name: 'A', at: [120, 5] }, { id: 'b', name: 'B', lat: 43, lng: -2 }] },
    f: { type: 'map', image: { src: 'https://rodanorte.example/m.png', width: 800, height: 500, bounds: [[43.27, -2.94], [43.25, -2.91]] }, places: [{ id: 'a', name: 'A', lat: 44, lng: -2.92 }] },
    g: { type: 'map', sort: 'distance', max: 9, places: [{ id: 'a', name: 'A', lat: 43, lng: -2, at: [1, 1], hours: { week: { 7: [[600, 500]], 1: [[600, 840], [800, 900]] }, holidays: ['25-12'] }, status: { text: 'x', tone: 'loud' } }, { id: 'a', name: 'B', lat: 43, lng: -2, colour: 'red' }] },
    h: { type: 'map', directions: { url: 'https://rodanorte.example/r/{place}' }, from: { name: 'Centro' }, places: [{ id: 'a', name: 'A', lat: 43, lng: -2, link: ['Ver ↗', 'https://evil.example/'] }] },
  }, { timeZone: undefined });
  const has = (re) => assert.ok(e.some((x) => re.test(x)), re + '\n' + e.join('\n'));
  has(/^a: "places" is a list of 1 to 20 places/);
  has(/^b: "directions" is google, apple, osm, or \{ "url"/);
  has(/^b: places\[0\]\.id is a lower-case word/); has(/^b: places\[0\]\.lat is a number from -90 to 90/);
  has(/^b: places\[1\] needs a "name"/); has(/^b: places\[1\]\.lng is a number from -180 to 180/);
  has(/^b: places\[2\] needs "lat" and "lng" \(the schematic map is drawn from them/);
  has(/^d: image\.src "https:\/\/evil\.example\/m\.png" is not under any entry of "links"/); has(/^d: image\.width is the picture's width in pixels/); has(/^d: image\.height is the picture's height/);
  has(/^d: places\[0\]\.at is \[x, y\] in % of the image, each 0 to 100/); has(/^d: places\[1\] needs "at": \[x, y\] in % of the image/);
  has(/^d: "lines" draw the schematic map; with an "image" they are not drawn/); has(/^d: lines\[0\]\.kind is water, road, rail or park/); has(/^d: lines\[0\]\.pts is 2 to 40 points/);
  has(/^f: places\[0\] is outside image\.bounds/);
  has(/^g: places\[0\]\.at places a pin on the "image"/); has(/^g: places\[0\]\.hours\.week\.7: days are 0 \(Sunday\) to 6/);
  has(/^g: places\[0\]\.hours\.week\.1\[1\] starts before the range above it ends/); has(/^g: places\[0\]\.hours\.holidays\[0\] is D\/M or D\/M\/YYYY/);
  has(/^g: places\[0\]: "hours" or "status", not both/); has(/^g: places\[0\]\.status\.tone "loud" is not a tone/);
  has(/^g: places\[1\]\.id "a" is there twice/); has(/^g: places\[1\]: unknown key "colour"/);
  has(/^g: "sort": "distance" needs "from"/); has(/^g: "max" is a whole number from 1 to 5/); has(/^g: "hours" need "timeZone" in the config/);
  has(/^h: directions\.url: \{place\} is not one of \{q\} \{lat\} \{lng\} \{address\}/); has(/^h: directions\.url names no place/);
  has(/^h: from needs "lat" and "lng"/); has(/^h: places\[0\]\.link: "https:\/\/evil\.example\/" is not under any entry of "links"/);
  const w2 = c.check({ g: { type: 'map', places: [{ id: 'a', name: 'A', lat: 43, lng: -2, hours: { week: { 1: [[600, 500]] } } }] } });
  assert.ok(w2.some((x) => /^g: places\[0\]\.hours\.week\.1\[0\] is \[open, close\] in minutes since midnight/.test(x)), w2.join('\n'));
  assert.deepEqual(c.check(W), []);
  c.close();
});
