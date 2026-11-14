// test/lead.test.mjs · the seven lead-gen makers from JSON: kit/example-lead/config.json must draw, click and send exactly
// what the hand-written kit/example-lead/widgets.js does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, wait, read, json } from './helpers.mjs';

const CONFIG = JSON.parse(read('kit/example-lead/config.json'));
const pin = (c) => { c.w.__lbwToday = '10/11/2026'; c.w.__lbwNow = '10:30'; return c; };   // a Tuesday
const byHand = () => pin(boot({ kit: true, scripts: ['kit/example-lead/widgets.js'] }));
function byJson(config = CONFIG) {
  const c = pin(boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }));
  c.result = json(c.w.LBW.kit.setup(JSON.parse(JSON.stringify(config))));
  return c;
}
const errors = (cfg) => [...boot({ kit: true, scripts: ['kit/setup.js', 'kit/setup-check.js'] }).LBW.kit.setup.check(cfg)];
// review gives each <select> a random id: the same card differs only there
const html = (m) => m.widgets().map((w) => w.outerHTML).join('\n').replace(/lg-quote-quote-(\d+)-[a-z0-9]+/g, 'id-$1');
const button = (m, label) => { const b = [...m.querySelectorAll('button')].find((x) => x.textContent.trim() === label); assert.ok(b, 'no button "' + label + '"'); return b; };

const JOURNEY = [
  ['[[lg:done]]'],                                  // nothing booked yet: draws nothing
  ['[[lg:trust]]'], ['[[lg:team]]'], ['[[lg:team who=ben]]'], ['[[lg:team who=nobody]]'], ['[[lg:ok]]'],
  ['[[lg:saving panels=10]]'], ['[[lg:saving]]'], ['[[lg:saving panels=abc]]'],
  ['[[lg:quote panels=6 plan=plus]]', async (m, c) => {
    const sel = m.querySelector('select'); sel.value = 'basic'; sel.dispatchEvent(new c.w.Event('change', { bubbles: true })); await wait(20);
    button(m, 'Confirm').click(); await wait(1300);
  }],
  ['[[lg:visit]]', async (m) => {   // the second day offered (Friday), its second slot
    m.querySelectorAll('.lbw-tog')[1].click(); await wait(20);
    m.querySelectorAll('button.kit-slot:not(.is-busy)')[1].click(); await wait(20); button(m, 'Book it').click(); await wait(1300);
  }],
  ['[[lg:done]]'],
];
async function run(c) {
  const out = [];
  for (const [text, act] of JOURNEY) {
    const m = c.bot('Text ' + text); c.LBW.scan(); await wait(20);
    if (act) await act(m, c);
    out.push({ text, html: html(m), left: m.text() });
  }
  await wait(2000);
  return out;
}

test('lead-gen: the example config is valid and registers the seven widgets', () => {
  const c = byJson();
  assert.deepEqual(c.result.errors, []);
  assert.deepEqual([...c.result.widgets].sort(), ['done', 'ok', 'quote', 'saving', 'team', 'trust', 'visit']);
  assert.equal(c.LBW.kit.setup.types.length, 20);   // v0.8.1.6: + rating; v0.8.1.10: + table; v0.10: + calendar, map, tracker
});

test('lead-gen: the JSON draws, clicks and sends exactly what the hand-written set does', async () => {
  const a = byHand(), b = byJson();
  const [ha, hb] = await Promise.all([run(a), run(b)]);
  for (let i = 0; i < ha.length; i++) {
    assert.equal(hb[i].left, ha[i].left, 'text left in ' + ha[i].text);
    assert.equal(hb[i].html, ha[i].html, 'widgets of ' + ha[i].text);
  }
  const drew = ha.map((x) => (x.html ? 1 : 0)).join('');
  assert.equal(drew, '011101111111', 'which steps drew a widget: ' + drew);
  assert.match(ha.at(-1).html, /See you Friday, November 13/);
  assert.deepEqual(b.sent, a.sent);
  assert.deepEqual(a.sent.filter((x) => x[0] === 'landbot-msg-send').map((x) => x[1].message),
    ['I confirm: 6 panels, Basic, 6,300 €', 'My visit: Friday, November 13, 11:00–12:00']);
  assert.deepEqual([...b.dropped()].sort(), [...a.dropped()].sort());
});

test('lead-gen: fixed dates are read from today on, and "HH:MM" equals minutes', async () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG)); delete cfg.widgets.visit.weekly;
  cfg.widgets.visit.days = [{ date: '9/11/2026', slots: [[540, 600]] }, { date: '12/11/2026', slots: [['09:30', '10:00'], [600, 660, 'busy']] }];
  const c = byJson(cfg); assert.deepEqual(c.result.errors, []);
  const m = c.bot('[[lg:visit]]'); c.LBW.scan(); await wait(20);
  assert.deepEqual([...m.querySelectorAll('.kit-slot')].map((b) => b.textContent), ['9:30–10:00', 'Busy · 10:00–11:00']);
  assert.equal(m.querySelectorAll('.lbw-tog').length, 1, 'the past day is not offered');
});

test('lead-gen: a chart with a value that is not a number draws nothing', async () => {
  const cfg = JSON.parse(JSON.stringify(CONFIG)); cfg.widgets.saving.series[0].value = 'panels / (i - 3)';
  const c = byJson(cfg); assert.deepEqual(c.result.errors, []);
  const m = c.bot('Text [[lg:saving]]'); c.LBW.scan(); await wait(20);
  assert.equal(m.widgets().length, 0); assert.equal(m.text(), 'Text');
  assert.ok(c.dropped().some((x) => /not a number/.test(x)));
});

test('lead-gen check: each type says what is wrong', () => {
  const e = (name, patch) => { const cfg = JSON.parse(JSON.stringify(CONFIG)); patch(cfg.widgets[name], cfg); return errors(cfg).join('\n'); };
  assert.match(e('trust', (w) => { w.item.stats = [['1', 'a']]; delete w.item.source; }), /stats holds 2 to 4[\s\S]*has no "source"/);
  assert.match(e('team', (w) => { delete w.items.ana.role; w.items.ben.img = 'https://evil.example/b.jpg'; w.reply = ['Ask {nam}', 'x']; w.filter = { param: 'Who' }; }),
    /"ana" needs "name" and "role"[\s\S]*ben\.img is not under[\s\S]*filter\.param "Who" must be lower-case[\s\S]*"\{nam\}" is not a value here/);
  assert.match(e('ok', (w) => { w.yes = ['Yes']; w.icon = 'star'; w.link = ['x', 'https://evil.example/']; }), /"yes" is \[label, sentence[\s\S]*"icon" is check, bell or shield[\s\S]*link: .* is not under/);
  assert.match(e('visit', (w) => { w.days = []; }), /give "days" \(fixed dates\) or "weekly"/);
  assert.match(e('visit', (w) => { w.weekly.week['7'] = []; w.weekly.week['1'] = [['10:00', '09:00'], ['9am', '10:00'], [600, 660, 'full']]; w.say.text = '{day:time} {from:date} {when}'; }),
    /weekly\.week\.1\[0\] is \[from, to\][\s\S]*weekly\.week\.1\[1\] is \[from, to\][\s\S]*\[2\] can only be "busy"[\s\S]*days are 0 \(Sunday\) to 6[\s\S]*"day" is not one[\s\S]*"from" is not one[\s\S]*"\{when\}" is not a value/);
  assert.match(e('done', (w) => { w.form = 'quote'; }), /form "quote" is not a form, a slots or a calendar widget/);
  assert.match(e('done', (w) => { w.title = 'See you {kind:label}'; w.rows = [['When', '{from:money}']]; }), /title: "\{kind\}" is not a value here[\s\S]*"from" is not a number/);
  assert.match(e('quote', (w) => { w.lines[1].items = [['basic', 'Basic']]; w.lines[0] = { label: 'Panels' }; w.total = { label: 'Total' }; w.compute.total = 'install + panel * 2'; w.discard = 'nope'; }),
    /lines\[1\]\.items has no entry for "plus"[\s\S]*"panel" is not in state or compute[\s\S]*lines\[0\] needs "value"[\s\S]*total is \{ "label", "value" \}[\s\S]*reply "nope" is not in "replies"/);
  assert.match(e('saving', (w) => { w.kind = 'pie'; w.x = { from: 1, to: 500 }; w.series = [{ label: 'A', value: 'panels * j' }, { label: 'B', values: [1, 2] }, { label: 'C' }]; w.mark = { at: 'evn' }; w.summary = '{i}'; }),
    /"kind" is line, area or bar[\s\S]*x has 500 points[\s\S]*"j" is not in state or compute[\s\S]*series\[2\] needs "value"[\s\S]*one or two series[\s\S]*mark\.at: "evn" is not in state[\s\S]*summary: "\{i\}" is not a value/);
  assert.match(e('saving', (w) => { w.x = ['a', 'b', 'c']; w.series = [{ label: 'B', values: [1, 2] }]; }), /values has 2 numbers for 3 points/);
  for (const name of Object.keys(CONFIG.widgets)) for (const junk of [null, 3, 'x', [], {}])
    for (const key of ['item', 'items', 'yes', 'weekly', 'days', 'say', 'rows', 'steps', 'lines', 'total', 'series', 'x', 'y', 'mark', 'state', 'tables', 'compute', 'send', 'filter', 'ics']) {
      const out = e(name, (w) => { w[key] = junk; });
      assert.doesNotMatch(out, /could not be checked/, `${name}.${key} = ${JSON.stringify(junk)} → ${out}`);
    }
});

// ── what the second review found ──
const clone = () => JSON.parse(JSON.stringify(CONFIG));
const patched = (name, patch) => { const cfg = clone(); patch(cfg.widgets[name], cfg); return cfg; };
const errs = (name, patch) => errors(patched(name, patch)).join('\n');

test('review: a quote that is not a number can\'t be confirmed, and says why in the log', async () => {
  const c = byJson(patched('quote', (w) => { w.compute.per = 'total / (panels - 4)'; }));
  assert.deepEqual(c.result.errors, []);
  const m = c.bot('[[lg:quote panels=4]]'); c.LBW.scan(); await wait(20);
  assert.equal(button(m, 'Confirm').getAttribute('aria-disabled'), 'true');   // v0.9.5: aria-disabled, still focusable
  assert.doesNotMatch(m.textContent, /NaN|Infinity|undefined/);
  assert.ok(c.dropped().some((x) => /quote: a compute line is not a number/.test(x)));
});

test('slots: times already past today are gone, and a day with nothing free is not counted', async () => {
  const all = [['08:00', '09:00'], ['09:00', '10:00'], ['11:00', '12:00']];
  const cfg = patched('visit', (w) => { w.weekly = { from: 0, ahead: 2, week: { 2: all, 3: [['09:00', '10:00', 'busy']], 4: [['09:00', '10:00', 'busy']], 5: [['09:00', '10:00']] } }; });
  const c = byJson(cfg); assert.deepEqual(c.result.errors, []);          // pinned: Tuesday 10 Nov 2026, 10:30
  const m = c.bot('[[lg:visit]]'); c.LBW.scan(); await wait(20);
  // v0.10: compact draws a date strip (weekday · day · month), named by the whole date
  assert.deepEqual([...m.querySelectorAll('.lbw-tog')].map((b) => b.getAttribute('aria-label') + ' | ' + [...b.children].map((s) => s.textContent).join(' ')), ['Tuesday, November 10 | Tue 10 Nov', 'Friday, November 13 | Fri 13 Nov']);
  assert.deepEqual([...m.querySelectorAll('button.kit-slot')].map((b) => b.textContent), ['11:00–12:00']);
});

test('slots: a booking refused by the 1.2 s lock is not confirmed', async () => {
  const c = byJson(), m = c.bot('[[lg:visit]]'); c.LBW.scan(); await wait(20);
  c.LBW.say('something else');                                           // takes the lock
  m.querySelector('button.kit-slot:not(.is-busy)').click(); await wait(20); button(m, 'Book it').click();
  const done = c.bot('[[lg:done]]'); c.LBW.scan();
  assert.equal(done.widgets().length, 0);
});

test('confirm: dates in the language of the tag; a form\'s picks by label, one or many', async () => {
  const cfg = clone(); cfg.langs = ['en', 'es'];
  cfg.widgets.plan = { type: 'form', cta: 'Send', summary: 'Plan: {kind:label}', steps: [{ key: 'kind', title: 'Kind', items: [['a', 'Roof'], ['b', 'Garden']] }, { key: 'extras', title: 'Extras', multi: true, items: [['x', 'Battery'], ['y', 'Charger']] }] };
  cfg.widgets.planned = { type: 'confirm', form: 'plan', title: 'Got it: {kind:label}', rows: [['Extras', '{extras:labels:lower}'], ['Also', '{extras:label}'], ['Sent', '{text}']] };
  const c = byJson(cfg); assert.deepEqual(c.result.errors, []);
  const v = c.bot('[[lg:visit lang=es]]'); c.LBW.scan(); await wait(20);
  v.querySelector('button.kit-slot:not(.is-busy)').click(); await wait(20); button(v, 'Book it').click(); await wait(1300);
  const d = c.bot('[[lg:done lang=es]]'); c.LBW.scan();
  assert.match(d.querySelector('.lbw-title').textContent, /^See you miércoles, 11 de noviembre$/);
  const f = c.bot('[[lg:plan]]'); c.LBW.scan(); await wait(20);
  for (const b of ['Garden', 'Battery', 'Charger', 'Send']) button(f, b).click();
  const p = c.bot('[[lg:planned]]'); c.LBW.scan();
  assert.equal(p.querySelector('.lbw-title').textContent, 'Got it: Garden');
  assert.deepEqual([...p.querySelectorAll('dd')].map((x) => x.textContent), ['battery, charger', 'Battery, Charger', 'Plan: Garden']);
});

test('chart: a list for x, fixed values, bars and a numbered mark', async () => {
  const c = byJson(patched('saving', (w) => { w.kind = 'bar'; w.x = ['2024', 2025, '2026']; w.series = [{ label: 'kWh', values: [10, 20, 15] }]; w.mark = { at: 1, label: 'Peak' }; w.y = { suffix: ' kWh', ticks: 2 }; delete w.compute; w.summary = 'Three years'; }));
  assert.deepEqual(c.result.errors, []);
  const m = c.bot('[[lg:saving]]'); c.LBW.scan(); await wait(20);
  assert.equal(m.querySelectorAll('rect.is-bar').length, 3);
  assert.equal(m.querySelector('.kit-mark-l').textContent, 'Peak');
  assert.deepEqual([...m.querySelectorAll('.kit-sr li')].map((x) => x.textContent), ['kWh · 2024: 10 kWh', 'kWh · 2025: 20 kWh', 'kWh · 2026: 15 kWh']);
});

test('check: what the second review found is now an error sentence', () => {
  assert.match(errs('saving', (w) => { w.y.ticks = 1e9; w.height = 'tall'; }), /y\.ticks is a whole number from 1 to 10[\s\S]*"height" is a number/);
  for (const x of [{ from: 1, to: 100, step: '2' }, { from: 0, to: 0.7, step: 0.1 }, { from: 1, to: 10, step: 0 }, { from: 5, to: 1 }]) assert.match(errs('saving', (w) => { w.x = x; }), /x is a list of labels or \{ "from", "to", "step", "label" \} in whole numbers/, JSON.stringify(x));
  assert.match(errs('saving', (w) => { w.x = [1, { a: 1 }, null]; w.series = [{ label: 'A', values: [1, 2, 3] }]; delete w.mark; }), /"x" is a list of labels/);
  assert.match(errs('saving', (w) => { w.mark = { at: 25, label: { a: 1 } }; }), /mark\.at is the position of a point of x, from 0 to 9[\s\S]*mark\.label must be text/);
  assert.match(errs('visit', (w) => { w.say.text = '{day} {from}'; }), /"\{day\}" is a day: write \{day:date\} or \{day:dmy\}[\s\S]*"\{from\}" is a time: write \{from:time\}/);
  assert.match(errs('visit', (w) => { w.say.text = '{day:date:dmy} {from:time:time}'; }), /has two formats[\s\S]*has two formats/);
  for (const sl of [[9, 10], [1500, 1560], [-60, 0], [541, 600]]) assert.match(errs('visit', (w) => { w.weekly.week['1'] = [sl]; }), /minutes since midnight in steps of 5/, JSON.stringify(sl));
  assert.match(errs('visit', (w) => { w.weekly.ahead = 0; w.weekly.from = 0.5; }), /weekly\.ahead is a whole number from 1 to 5[\s\S]*weekly\.from is a whole number of days/);
  for (const junk of [3, [], 'x']) assert.match(errs('trust', (w) => { w.item = junk; }), /"item" must be an object/, JSON.stringify(junk));
  assert.match(errs('trust', (w) => { w.item.title = { a: 1 }; w.kicker = ['x']; }), /kicker must be text[\s\S]*item\.title must be text/);
  assert.match(errs('team', (w) => { w.title = { a: 1 }; w.items.ana.note = 3; w.items.ben.img = 'https://solar.example/a b.jpg'; }), /title must be text[\s\S]*ana\.note must be text[\s\S]*ben\.img is not under/);
  assert.match(errs('team', (w) => { delete w.filter; for (const k of ['c', 'd', 'e']) w.items[k] = { name: 'N ' + k, role: 'R' }; }), /a people card shows 4 at most/);
  assert.match(errs('ok', (w) => { w.text = { a: 1 }; }), /text must be text/);
  assert.match(errs('quote', (w) => { w.cta = 3; w.note = []; }), /cta must be text[\s\S]*note must be text/);
  assert.match(errs('done', (w, cfg) => { cfg.widgets.plan = { type: 'form', cta: 'x', summary: 'x', steps: [{ key: 'text', items: [['a', 'A']] }] }; }), /a step can't be called "text"/);
  assert.match(errors(Object.assign(clone(), { timeZone: 'Europe/Madird' })).join('\n'), /timeZone "Europe\/Madird" is not a time zone/);
  assert.match(errors(Object.assign(clone(), { langs: 'en' })).join('\n'), /"langs" must be a list of language codes/);
});

test('people: a photo that fails to load becomes the initials', async () => {
  const c = byJson(), m = c.bot('[[lg:team who=ben]]'); c.LBW.scan(); await wait(20);
  const img = m.querySelector('.kit-person img'); assert.ok(img, 'the photo is tried first');
  img.dispatchEvent(new c.w.Event('error'));
  assert.equal(m.querySelector('.kit-person img'), null);
  assert.equal(m.querySelector('.kit-person .is-initials').textContent, 'BC');
});
