// test/i18n.test.mjs · texts by language, items that expire, the mail action (lbw-kit 0.7.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, json } from './helpers.mjs';

const CFG = () => ({ prefix: 't', langs: ['en', 'es', 'ca'], defaultLang: 'en', timeZone: 'Europe/Madrid', links: ['https://shop.example/', 'tel:', 'mailto:'],
  actions: { call: { tel: '977 000 000', cc: '34', label: { en: 'Call', es: 'Llamar', ca: 'Truca' } }, mail: { mail: 'info@shop.example', label: { en: 'Email us', es: 'Escríbenos' } } },
  replies: { plan: { en: ['Plan', 'I want a plan'], es: ['Planificar', 'Quiero un plan'] } },
  widgets: {
    info: { type: 'cards', reply: 'plan', links: ['call', 'mail'], items: { a: { title: { en: 'Hours', es: 'Horario', ca: 'Horari' }, rows: [[{ en: 'Open', es: 'Abierto' }, '10:00']], points: { en: ['One', 'Two'], es: ['Uno', 'Dos'] } } } },
    plan: { type: 'form', cta: { en: 'Send', es: 'Enviar' }, summary: { en: 'Plan: {kind:label}', es: 'Mi plan: {kind:label}' },
      steps: [{ key: 'kind', title: { en: 'Kind', es: 'Tipo' }, items: { en: [['a', 'Roof'], ['b', 'Garden']], es: [['a', 'Tejado'], ['b', 'Jardín']] } }] },
    done: { type: 'confirm', form: 'plan', title: { en: 'Got it: {kind:label}', es: 'Hecho: {kind:label}' } },
    list: { type: 'carousel', title: { en: 'Coming up', es: 'Próximamente' }, items: [
      { id: 'x', name: { en: 'Past', es: 'Pasado' }, until: '10/11/2026' }, { id: 'y', name: { en: 'Coming', es: 'Próximo' }, until: '11/11/2026' }, { id: 'z', name: 'Always' }] },
    desk: { type: 'contact', title: { en: 'Talk to us', ca: 'Parla amb nosaltres' }, hours: { week: { 3: [[540, 1080]] } }, buttons: ['call'] }
  } });
function chat(cfg = CFG()) {
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '11/11/2026'; c.w.__lbwNow = '10:30';   // a Wednesday
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); return c;
}
const errors = (cfg) => [...boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }).LBW.kit.setup.check(cfg)].join('\n');
const draw = (c, text) => { const m = c.bot(text); c.LBW.scan(); return m; };
const texts = (m, sel) => [...m.querySelectorAll(sel)].map((x) => x.textContent);

test('languages: the config is valid and every widget registers once', () => {
  const c = chat();
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual([...c.result.widgets].sort(), ['desk', 'done', 'info', 'list', 'plan']);
});

test('languages: the tag\'s lang picks the texts, a missing one falls back to the default', () => {
  const c = chat();
  const read = (m) => ({ title: m.querySelector('.lbw-title').textContent, dt: texts(m, 'dt'), li: texts(m, 'li'), reply: m.querySelector('.lbw-reply').textContent, say: m.querySelector('.lbw-reply').getAttribute('data-say'),
    links: [...m.querySelectorAll('a')].map((a) => a.textContent + ' → ' + a.getAttribute('href')) });
  assert.deepEqual(read(draw(c, '[[t:info id=a lang=es]]')), { title: 'Horario', dt: ['Abierto'], li: ['Uno', 'Dos'], reply: 'Planificar', say: 'Quiero un plan', links: ['Llamar → tel:+34977000000', 'Escríbenos → mailto:info@shop.example'] });
  assert.deepEqual(read(draw(c, '[[t:info id=a lang=ca]]')), { title: 'Horari', dt: ['Open'], li: ['One', 'Two'], reply: 'Plan', say: 'I want a plan', links: ['Truca → tel:+34977000000', 'Email us → mailto:info@shop.example'] });
  assert.equal(draw(c, '[[t:info id=a]]').querySelector('.lbw-title').textContent, 'Hours');
  assert.equal(draw(c, '[[t:info id=a lang=fr]]').querySelector('.lbw-title').textContent, 'Hours', 'a language outside langs is the default');
});

test('languages: a form sends, and a confirm card reads its labels, in the language of each tag', async () => {
  const c = chat(), f = draw(c, '[[t:plan lang=es]]'); await wait(20);
  assert.deepEqual(texts(f, '.lbw-tog'), ['Tejado', 'Jardín']);
  const click = (t) => [...f.querySelectorAll('button')].find((b) => b.textContent === t).click();
  click('Jardín'); click('Enviar'); await wait(1800);
  assert.deepEqual(c.sent.filter((x) => x[0] === 'landbot-msg-send').map((x) => x[1].message), ['Mi plan: Jardín']);
  assert.equal(draw(c, '[[t:done lang=es]]').querySelector('.lbw-title').textContent, 'Hecho: Jardín');
  assert.equal(draw(c, '[[t:done lang=en]]').querySelector('.lbw-title').textContent, 'Got it: Garden');
});

test('languages: the kit\'s own words exist in Catalan', () => {
  const c = chat(), m = draw(c, '[[t:desk lang=ca]]');
  assert.equal(m.querySelector('.lbw-title').textContent, 'Parla amb nosaltres');
  assert.equal(m.querySelector('.kit-status').textContent, 'Obert ara · fins a les 18:00');
  for (const l of ['en', 'es', 'it', 'de', 'fr', 'ca']) for (const k of ['copy', 'open', 'closed', 'sent', 'pick', 'close', 'prev', 'next', 'photos', 'enlarge']) assert.ok(c.LBW.kit.L[l][k], l + '.' + k);
});

test('dates: an item is shown until its day, then left out; a list with nothing left draws nothing', () => {
  const c = chat();
  assert.deepEqual(texts(draw(c, '[[t:list]]'), '.lbw-name'), ['Coming', 'Always']);
  assert.deepEqual(texts(draw(c, '[[t:list lang=es]]'), '.lbw-name'), ['Próximo', 'Always']);
  const cfg = CFG(); cfg.widgets.list.items = cfg.widgets.list.items.slice(0, 1);
  const c2 = chat(cfg), m = draw(c2, 'Text [[t:list]]');
  assert.equal(m.widgets().length, 0); assert.equal(m.text(), 'Text');
});

test('one language: texts by language work with a single language, and plain texts are untouched', () => {
  const one = chat({ prefix: 't', langs: ['es'], widgets: { a: { type: 'cards', items: { x: { title: { es: 'Horario' }, rows: [['es', 'en']] } } } } });
  assert.deepEqual(one.result.errors, []);
  const m = draw(one, '[[t:a id=x]]');
  assert.deepEqual([m.querySelector('.lbw-title').textContent, ...texts(m, 'dt'), ...texts(m, 'dd')], ['Horario', 'es', 'en']);
  const plain = chat({ prefix: 't', widgets: { a: { type: 'cards', items: { x: { title: 'Plain' } } } } });
  assert.deepEqual(plain.result.errors, []);
});

test('check: a language used in a text but missing from langs is named', () => {
  const cfg = CFG(); cfg.langs = ['en'];
  const out = errors(cfg);
  assert.match(out, /info: items\.a\.title has texts for "es", "ca", not in "langs"/);
  assert.match(out, /actions\.call\.label has texts for "es", "ca", not in "langs"/);
  assert.doesNotMatch(out, /must be text|has no "title"/, 'only the cause is reported');
});

test('check: languages, dates and mail are checked', () => {
  const e = (patch) => { const cfg = CFG(); patch(cfg); return errors(cfg); };
  assert.match(e((c) => { c.widgets.info.items.a.title = { es: 'Horario' }; }), /info: items\.a\.title has no text in the default language \("en"\)/);
  assert.match(e((c) => { c.actions.call.label = { ca: 'Truca' }; }), /actions\.call\.label has no text in the default language/);
  assert.match(e((c) => { c.defaultLang = 'de'; }), /defaultLang "de" is not in "langs"/);
  assert.match(e((c) => { c.widgets.plan.summary.es = 'Mi plan: {knd:label}'; }), /\[es\] plan: summary: "\{knd\}" is not a value here/);
  assert.doesNotMatch(e((c) => { c.widgets.plan.summary.es = 'Mi plan: {knd:label}'; }), /\[en\]|\[ca\] plan: summary/);
  assert.match(e((c) => { c.widgets.plan.cta = 3; }), /^plan: cta must be text$/m);
  assert.match(e((c) => { c.links = ['https://shop.example/', 'tel:']; }), /a mail action needs "mailto:" in "links"/);
  assert.match(e((c) => { c.actions.mail.mail = 'info@shop.example?subject=Hi'; }), /"mail" is one plain address/);
  assert.match(e((c) => { c.widgets.list.items[0].until = '31/2/2026'; }), /items\[0\]\.until is a date, D\/M\/YYYY/);
  assert.match(e((c) => { c.widgets.info.links = [{ mail: 'a@b.co', tel: '1', label: 'x' }]; }), /needs one of tel, wa, link, reply, mail/);
  for (const junk of [null, 3, 'x', [], {}, { en: 3 }, { xx: 'y' }]) for (const at of ['title', 'cta', 'steps', 'items', 'reply', 'links'])
    for (const w of ['info', 'plan', 'done', 'list', 'desk']) assert.doesNotMatch(e((c) => { c.widgets[w][at] = junk; }), /could not be checked/, `${w}.${at} = ${JSON.stringify(junk)}`);
});

// ── what the review of 0.7.2 found ──
test('languages: objects that are maps by a name are never read as texts, whatever their keys', () => {
  const c = chat({ prefix: 't', langs: ['en', 'es'], defaultLang: 'en', timeZone: 'Europe/Madrid',
    replies: { es: ['Sí', 'Sí, en español'] },
    widgets: {
      lang: { type: 'chips', items: { en: ['English', 'Speak English'], es: ['Español', 'Habla español'] } },
      labels: { type: 'cards', reply: 'es', items: { es: { title: { en: 'Spain', es: 'España' } }, labels: { title: { en: 'Labels', es: 'Etiquetas' } } } },
      trips: { type: 'carousel', filter: { by: 'to' }, title: 'Trips', titles: { es: 'Spain', en: 'England' }, items: [{ id: 'a', to: 'es', name: 'Madrid' }, { id: 'b', to: 'en', name: 'London' }] },
      where: { type: 'form', cta: 'Send', summary: '{c:label}, {city:label}', fields: { es: '{c}' },
        steps: [{ key: 'c', items: [['es', 'Spain'], ['en', 'England']] }, { key: 'city', items: { by: 'c', map: { es: [['m', 'Madrid']], en: [['l', 'London']] } } }] },
      ok: { type: 'consent', title: 'OK?', yes: ['Yes', 'Yes please', { es: 'si' }], no: ['No', 'No thanks', { es: 'no' }] }
    } });
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual(texts(draw(c, '[[t:lang q=en,es]]'), 'button'), ['English', 'Español']);
  assert.equal(draw(c, '[[t:labels id=es lang=es]]').querySelector('.lbw-title').textContent, 'España');
  assert.equal(draw(c, '[[t:labels id=labels lang=es]]').querySelector('.lbw-title').textContent, 'Etiquetas');
  assert.equal(draw(c, '[[t:trips to=es]]').querySelector('.lbw-title').textContent, 'Spain');
  assert.equal(draw(c, '[[t:ok]]').querySelector('.lbw-reply').getAttribute('data-store'), '{"es":"si"}');
});

test('languages: describe() lists each widget once, and a widget\'s own lang wins over the tag', () => {
  const cfg = CFG(); cfg.widgets.desk.lang = 'es'; cfg.widgets.desk.title.es = 'Habla con nosotros';
  const c = chat(cfg), d = json(c.LBW.kit.describe('t'));
  assert.equal(d.tags.length, 5, d.tags.join(' | '));
  const m = draw(c, '[[t:desk]]');
  assert.equal(m.querySelector('.lbw-title').textContent, 'Habla con nosotros');
  assert.equal(m.querySelector('.kit-status').textContent, 'Abierto ahora · hasta las 18:00');
});

test('languages: without defaultLang the first of langs is the default everywhere; a region reads as its language', () => {
  const cfg = CFG(); cfg.langs = ['es', 'ca']; delete cfg.defaultLang;
  for (const k of ['info', 'plan', 'done', 'list']) delete cfg.widgets[k];
  cfg.actions = { call: { tel: '977 000 000', cc: '34', label: { es: 'Llamar' } } };
  delete cfg.replies; cfg.widgets.desk.title = { es: 'Habla', ca: 'Parla' };
  const c = chat(cfg); assert.deepEqual(c.result.errors, []);
  const m = draw(c, '[[t:desk]]');
  assert.deepEqual([m.getAttribute ? m.querySelector('.lbw').getAttribute('lang') : '', m.querySelector('.lbw-title').textContent, m.querySelector('.kit-status').textContent], ['es', 'Habla', 'Abierto ahora · hasta las 18:00']);
  assert.equal(draw(c, '[[t:desk lang=ca-ES]]').querySelector('.lbw-title').textContent, 'Parla');
  assert.equal(draw(c, '[[t:desk lang=CA_es]]').querySelector('.lbw-title').textContent, 'Parla');
});

test('check: what the review of 0.7.2 found is an error sentence', () => {
  const e = (patch) => { const cfg = CFG(); patch(cfg); return errors(cfg); };
  assert.match(e((c) => { c.langs = ['en', 'pt-BR']; }), /language "pt-BR" must be a lower-case code/);
  assert.match(e((c) => { c.langs = ['EN', 'ES']; c.defaultLang = 'EN'; }), /language "EN" must be a lower-case code/);
  assert.match(e((c) => { c.widgets.plan.steps[0].items.es = [['x', 'Tejado'], ['b', 'Jardín']]; }), /plan: steps\[0\]\.items has different keys in each language/);
  assert.match(e((c) => { c.widgets.lang = { type: 'chips', max: { en: 1, es: 2 }, items: { a: ['A', 'Say a'] } }; }), /lang: max is by language but holds something that is not a text/);
  assert.match(e((c) => { c.widgets.lang = { type: 'chips', max: 'two', items: { a: ['A', 'Say a'] } }; }), /lang: "max" must be a whole number/);
  assert.doesNotMatch(e((c) => { c.defaultLang = null; }), /defaultLang/);
  assert.equal((e((c) => { c.defaultLang = 3; }).match(/defaultLang/g) || []).length, 1);
  assert.match(e((c) => { delete c.timeZone; }), /list: items\[0\]\.until needs "timeZone"/);
  assert.match(e((c) => { c.actions.mail.mail = 'a,b@b.co'; }), /"mail" is one plain address/);
  assert.match(e((c) => { c.actions.mail.mail = ['a@b.co']; }), /"mail" is one plain address/);
});

test('languages: rows of [label, value] may be a whole list per language; choices must keep their keys', () => {
  const cfg = CFG();
  cfg.widgets.info.items.a.rows = { en: [['Open', '10:00'], ['Price', '5 €']], es: [['Abierto', '10:00'], ['Precio', '5 €'], ['Reducida', '3 €']] };
  const c = chat(cfg); assert.deepEqual(c.result.errors, []);
  assert.deepEqual(texts(draw(c, '[[t:info id=a lang=es]]'), 'dt'), ['Abierto', 'Precio', 'Reducida']);
  assert.deepEqual(texts(draw(c, '[[t:info id=a lang=en]]'), 'dt'), ['Open', 'Price']);
  const bad = CFG(); bad.widgets.plan.steps[0].items.es = [['x', 'Tejado'], ['b', 'Jardín']];
  assert.match(errors(bad), /plan: steps\[0\]\.items has different keys in each language/);
});

test('0.7.8: ids= in a carousel tag shows only those slides, in that order; an unknown id draws nothing', () => {
  const cfg = CFG(); cfg.widgets.list.items = [{ id: 'stripe', name: 'Stripe', kind: 'pay' }, { id: 'xero-sync', name: 'Xero', kind: 'acc' }, { id: 'old', name: 'Old', kind: 'pay', until: '10/11/2026' }, { id: 'paypal', name: 'PayPal', kind: 'pay' }];
  cfg.widgets.list.filter = { by: 'kind' };
  const c = chat(cfg);
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual(texts(draw(c, 'a [[t:list ids=paypal,stripe lang=en]]'), '.lbw-name'), ['PayPal', 'Stripe']);
  assert.deepEqual(texts(draw(c, 'b [[t:list ids=Xero-Sync kind=pay lang=en]]'), '.lbw-name'), ['Xero']);           // ids win over the filter; case and dashes forgiven
  assert.equal(draw(c, 'c [[t:list ids=sage lang=en]]').widgets().length, 0);                                        // invented: nothing
  assert.equal(draw(c, 'd [[t:list ids=old lang=en]]').widgets().length, 0);                                         // expired: nothing
  assert.deepEqual(texts(draw(c, 'e [[t:list kind=pay lang=en]]'), '.lbw-name'), ['Stripe', 'PayPal']);              // no ids: as before
  const bad = CFG(); bad.widgets.list.filter = { by: 'kind', param: 'ids' }; bad.widgets.list.items.forEach((it) => { it.kind = 'a'; });
  assert.match(errors(bad), /can't be "ids"/);
});
