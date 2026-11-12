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

// ── 0.8.1: what a design critique of a live demo found ──
test('0.8.1: no blank last line and no empty bubble once the tags are gone', () => {
  const c = chat();
  const a = c.bot(null, '<p>Here are the hours.</p><p>[[t:info id=a lang=en]]</p>'); c.LBW.scan();
  assert.equal(a.querySelector('[data-lb-part="message-text"]').innerHTML, '<p>Here are the hours.</p>');
  const b = c.bot(null, 'Here are the hours.<br><br>[[t:info id=a lang=en]] [[t:desk lang=en]]'); c.LBW.scan();
  assert.equal(b.querySelector('[data-lb-part="message-text"]').innerHTML, 'Here are the hours.');
  const only = c.bot(null, '<p>[[t:info id=a lang=en]]</p>'); c.LBW.scan();
  assert.equal(only.widgets().length, 1); assert.ok(only.querySelector('[data-lb-part="message-text"]').hasAttribute('data-lbw-empty')); assert.ok(only.classList.contains('lbw-only'));
  const kept = c.bot(null, '<p>See <a href="https://shop.example/x">this page</a></p><p></p><p>[[t:info id=a lang=en]]</p><p>And a last word.</p>'); c.LBW.scan();
  assert.equal(kept.querySelector('[data-lb-part="message-text"]').innerHTML, '<p>See <a href="https://shop.example/x">this page</a></p><p></p><p>And a last word.</p>');   // the author's own empty <p> stays: only what held a tag goes
  const plain = c.bot(null, '<p>No tags here.</p><p></p>'); c.LBW.scan();
  assert.equal(plain.querySelector('[data-lb-part="message-text"]').innerHTML, '<p>No tags here.</p><p></p>');           // untouched: not ours
});

test('0.8.1: chips leave out what a card of the same message already offers', () => {
  const cfg = CFG(); cfg.widgets.chips = { type: 'chips', crowd: 0, items: { plan: { en: ['Plan it', 'I want a plan'], es: ['Planificar', 'Quiero un plan'] }, more: { en: ['More', 'Tell me more'], es: ['Más', 'Cuéntame más'] } } };
  const c = chat(cfg);
  assert.deepEqual(c.result.errors, []);
  const m = draw(c, 'Text [[t:info id=a lang=en]] [[t:chips q=plan,more lang=en]]');                                    // the info card has the "plan" reply
  assert.deepEqual(texts(m, '.kit-chips [data-say]'), ['More']);
  assert.deepEqual(texts(draw(c, 'Text [[t:chips q=plan,more lang=en]]'), '.kit-chips [data-say]'), ['Plan it', 'More']);
  assert.equal(draw(c, 'Texto [[t:info id=a lang=es]] [[t:chips q=plan lang=es]]').querySelector('.kit-chips'), null);   // nothing left: no chips row
});

test('0.8.1: a season card: closed with the days left, open until, and nothing published', () => {
  const mk = (ranges, today) => { const cfg = CFG(); cfg.widgets.season = { type: 'season', kicker: { en: 'Season', es: 'Temporada' }, ranges, reply: 'plan', note: { en: 'Dates from the website.', es: 'Fechas de la web.' } };
    const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = today; c.w.__lbwNow = '10:30'; c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); return c; };
  const R = [['19/3/2027', '1/11/2027'], ['20/3/2026', '2/11/2026']];
  let c = mk(R, '11/11/2026'); assert.deepEqual(c.result.errors, []);
  let t = draw(c, 'x [[t:season lang=es]]').widgets()[0].textContent;
  assert.match(t, /Cerrado hoy/); assert.match(t, /Abre viernes, 19 de marzo de 2027/); assert.match(t, /128 días/); assert.match(t, /Planificar/);
  c = mk(R, '1/11/2027'); t = draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent;
  assert.match(t, /Open today/); assert.match(t, /Open until Monday, 1 November 2027|Open until Monday, November 1, 2027/);
  c = mk(R, '18/3/2027'); assert.match(draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent, /1 day/);
  c = mk(R, '2/11/2027'); assert.match(draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent, /aren’t published yet/);
  const bad = (f) => { const cfg = CFG(); cfg.widgets.season = { type: 'season', ranges: R }; f(cfg, cfg.widgets.season); return errors(cfg); };
  assert.match(bad((cfg, w) => { w.ranges = [['19 March', '1/11/2027']]; }), /D\/M\/YYYY/);
  assert.match(bad((cfg, w) => { w.ranges = [['1/11/2027', '19/3/2027']]; }), /before the first/);
  assert.match(bad((cfg) => { delete cfg.timeZone; }), /needs "timeZone"/);
  assert.match(bad((cfg, w) => { w.words = { opened: 'x' }; }), /unknown key "opened"/);
});

// ── what the independent review of 0.8.1 found ──
test('review 3: the clean-up removes only what held a tag: images, rules, cells and spaces between words stay', () => {
  const c = chat(), box = (m) => m.querySelector('[data-lb-part="message-text"]');
  const a = c.bot(null, '<p>Hi <span><img src="https://shop.example/a.png"></span> there [[t:info id=a lang=en]]</p>'); c.LBW.scan();
  assert.ok(box(a).querySelector('img')); assert.match(box(a).textContent, /^Hi\s+there$/);
  const b = c.bot(null, '<p><img src="https://shop.example/a.png"></p><p>[[t:info id=a lang=en]]</p>'); c.LBW.scan();
  assert.ok(box(b).querySelector('img')); assert.ok(!box(b).hasAttribute('data-lbw-empty')); assert.equal(box(b).querySelectorAll('p').length, 1);
  const d = c.bot(null, 'Hello<span> </span>world<hr><table><tbody><tr><td></td><td>x</td></tr></tbody></table><ul><li></li><li>one</li></ul>[[t:info id=a lang=en]]'); c.LBW.scan();
  assert.match(box(d).textContent, /^Hello world/); assert.ok(box(d).querySelector('hr')); assert.equal(box(d).querySelectorAll('td').length, 2); assert.equal(box(d).querySelectorAll('li').length, 2);
  const e = c.bot(null, '<p>Before</p><p><em>[[t:info id=a lang=en]]</em></p>'); c.LBW.scan();
  assert.equal(box(e).innerHTML, '<p>Before</p>');                                                   // the tag's own wrappers go, up to the box
});

test('review 3: chips written BEFORE the card still leave out what the card offers; a final full stop doesn\'t hide a repeat', () => {
  const cfg = CFG(); cfg.widgets.chips = { type: 'chips', crowd: 0, items: { plan: { en: ['Plan it', 'I want a plan.'], es: ['Planificar', 'Quiero un plan'] }, more: { en: ['More', 'Tell me more'], es: ['Más', 'Cuéntame más'] } } };
  const c = chat(cfg), m = draw(c, 'Text [[t:chips q=plan,more lang=en]] [[t:info id=a lang=en]]');
  assert.deepEqual(texts(m, '.kit-chips [data-say]'), ['More']);
  assert.deepEqual([...m.querySelectorAll('.lbw')].map((w) => w.getAttribute('data-widget')), ['info', 'chips']);   // and the chips sit last
});

test('review 3: seasons that overlap or touch are one season; day words can be set', () => {
  const mk = (ranges, today, words) => { const cfg = CFG(); cfg.widgets.season = { type: 'season', ranges, words };
    const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = today; c.w.__lbwNow = '10:30'; c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)))); return c; };
  let c = mk([['1/1/2026', '30/11/2026'], ['1/12/2026', '31/12/2026']], '12/11/2026');
  assert.match(draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent, /Open until Thursday, (31 December|December 31)/);
  c = mk([['1/3/2026', '30/9/2026'], ['1/6/2026', '15/7/2026']], '1/7/2026');
  assert.match(draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent, /(30 September|September 30)/);
  c = mk([['19/3/2027', '1/11/2027']], '11/11/2026', { in: 'Em', day: '1 dia', days: '{n} dias' }); assert.deepEqual(c.result.errors, []);
  assert.match(draw(c, 'x [[t:season lang=en]]').widgets()[0].textContent, /Em128 dias|Em\s*128 dias/);
  c = mk([['19/3/2027', '1/11/2027']], '18/3/2027'); assert.match(draw(c, 'x [[t:season lang=es]]').widgets()[0].textContent, /En1 día|En\s*1 día/);
});

// ── 0.8.1.1: what a design critique of the live chat found ──
test('0.8.1.1: a carousel with several slides says "1 / n"; one slide has no count', async () => {
  const cfg = CFG(); cfg.widgets.list.items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const c = chat(cfg), m = draw(c, 'x [[t:list lang=en]]');
  assert.match(m.querySelector('.kit-count').textContent, /^(1 \/ 3)?$/);   // jsdom has no layout: the count shows when the strip overflows
  assert.equal(draw(c, 'y [[t:list ids=b lang=en]]').querySelector('.kit-count'), null);
});

test('0.8.1.1: a compare row where every column says the same is marked; the reply is revealed without throwing', async () => {
  const cfg = CFG(); cfg.widgets.vs = { type: 'compare', title: 'Two', rows: [['beds', 'Beds'], ['bbq', 'BBQ'], ['price', 'From', 'is-strong']],
    items: { a: { name: 'A', values: { beds: '2', bbq: 'Yes', price: '10' } }, b: { name: 'B', values: { beds: '3', bbq: 'Yes', price: '10' } } } };
  const c = chat(cfg); assert.deepEqual(c.result.errors, []);
  let raf = 0; c.w.requestAnimationFrame = (f) => { raf++; f(); };
  const m = draw(c, 'x [[t:vs ids=a,b lang=en]]');
  const rows = [...m.querySelectorAll('.kit-cmp-row')].map((r) => r.className);
  assert.ok(rows.some((r) => /is-same/.test(r))); assert.equal(rows.filter((r) => /is-same/.test(r)).length, 1);   // BBQ only: beds differ, the strong row keeps its own class
  await wait(30); assert.ok(raf >= 1);                                             // after a 0 ms timer: forms have drawn by then
  const bad = CFG(); bad.reveal = 'false'; assert.match(errors(bad), /"reveal" is true or false/);
});

test('review 4: closed → the days left and the whole next season, not a lone "Closes" row', () => {
  const cfg = CFG(); cfg.widgets.season = { type: 'season', ranges: [['19/3/2027', '14/11/2027']] };
  const c = boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }); c.w.__lbwToday = '12/11/2026'; c.w.__lbwNow = '10:30'; c.w.LBW.kit.setup(JSON.parse(JSON.stringify(cfg)));
  const t = draw(c, 'x [[t:season lang=es]]').widgets()[0].textContent;
  assert.match(t, /Temporada/); assert.match(t, /19 mar.* 2027 – 14 nov.* 2027/); assert.ok(!/Cierra|Hasta el/.test(t));
});

// ── 0.8.1.2: what the second live critique found ──
test('0.8.1.2: no chips row under a card that already has two actions of its own; "crowd": 0 keeps them', () => {
  const mk = (crowd) => { const cfg = CFG(); cfg.widgets.chips = Object.assign({ type: 'chips', items: { more: { en: ['More', 'Tell me more'], es: ['Más', 'Cuéntame más'] } } }, crowd == null ? {} : { crowd }); return chat(cfg); };
  let c = mk(); assert.deepEqual(c.result.errors, []);
  assert.equal(draw(c, 'Text [[t:info id=a lang=en]] [[t:chips q=more lang=en]]').querySelector('.kit-chips'), null);        // the card has a reply and two links
  assert.deepEqual(texts(draw(c, 'Text [[t:chips q=more lang=en]]'), '.kit-chips [data-say]'), ['More']);                   // alone: drawn
  assert.deepEqual(texts(draw(c, 'Text [[t:list lang=en]] [[t:chips q=more lang=en]]'), '.kit-chips [data-say]'), ['More']); // a strip's own slide buttons don't count
  c = mk(0); assert.deepEqual(texts(draw(c, 'Text [[t:info id=a lang=en]] [[t:chips q=more lang=en]]'), '.kit-chips [data-say]'), ['More']);
});

// ── 0.8.1.3: what the third live critique found ──
test('0.8.1.3: a phone number in a bubble stays on one line, once the text has settled; other numbers are left alone', async () => {
  const c = chat();
  c.w.LBW.init({ quietMs: 30 });
  const m = c.bot(null, 'Llama a reservas al +34 977 38 16 41 o al 977-38-16-41. [[t:info id=a lang=es]]'); c.LBW.scan();
  assert.equal(m.querySelector('[data-lb-part="message-text"] span'), null);                              // not while it may still be arriving
  await wait(150); c.LBW.scan();
  const sp = [...m.querySelectorAll('[data-lb-part="message-text"] span')].map((x) => x.textContent);
  assert.deepEqual(sp, ['+34 977 38 16 41', '977-38-16-41']); assert.equal(m.widgets().length, 1);
  const other = c.bot(null, 'Somos 2 adultos y 3 niños; el 11/11/2026 pagamos 1 234 €.'); c.LBW.scan(); await wait(150); c.LBW.scan();
  assert.equal(other.querySelector('span'), null);
});

test('0.8.1.3: compare with same: "fold" lists equal rows in one line; {names} in a title', () => {
  const cfg = CFG(); cfg.widgets.vs = { type: 'compare', title: { en: '{names}', es: '{names}' },  same: 'fold', rows: [['beds', 'Beds'], ['bbq', 'BBQ'], ['pets', 'Pets'], ['price', 'From', 'is-strong']],
    items: { a: { name: 'Villa A', values: { beds: '2', bbq: 'Yes', pets: 'No', price: '10' } }, b: { name: 'Bali', values: { beds: '3', bbq: 'Yes', pets: 'No', price: '10' } } } };
  const c = chat(cfg); assert.deepEqual(c.result.errors, []);
  const m = draw(c, 'x [[t:vs ids=a,b lang=es]]');
  assert.equal(m.querySelector('.lbw-title').textContent, 'Villa A · Bali');
  assert.deepEqual([...m.querySelectorAll('.kit-cmp-label')].map((x) => x.textContent), ['Beds', 'From']);           // equal rows out of the table; the strong row stays
  assert.equal(m.querySelector('.kit-cmp-same').textContent, 'Igual en las dos:\nBBQ: Yes\nPets: No');
  const bad = CFG(); bad.widgets.vs = Object.assign({}, cfg.widgets.vs, { same: 'hide' }); assert.match(errors(bad), /"same" is "fold"/);
});
