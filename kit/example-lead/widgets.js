/* The lead-gen set written by hand (a fictional solar installer, fake data): the same seven widgets as config.json, which
   test/lead.test.mjs holds to this file character by character. prefix lg · en. Tags:
     [[lg:trust]]  [[lg:team who=ana]]  [[lg:ok]]  [[lg:visit]]  [[lg:done]]  [[lg:quote panels=6 plan=plus]]  [[lg:saving panels=10]] */
(function () {
  var U = LBW.ui, K = LBW.kit, D = LBW.day, T = LBW.time;
  LBW.init({ prefix: 'lg', langs: ['en'], defaultLang: 'en', timeZone: 'Europe/London', maxPerMessage: 3, links: ['https://solar.example/', 'tel:'] });
  var call = function () { return U.tel('Call us', '0116 000 0000', '', '44'); };
  var long = function (n, lang) { return D.format(n, lang, { weekday: 'long', day: 'numeric', month: 'long' }); };

  K.stats('trust', { cls: 'lg-trust', single: true,
    items: { _: { kicker: 'Since 2009', title: 'Numbers from our site', stats: [['1,200', 'homes'], ['4.8', 'rating'], ['15 yr', 'warranty']], source: 'solar.example, Nov 2026' } },
    reply: function () { return ['Book a visit', 'I want to book a visit']; }, links: function () { return [call()]; } });

  var TEAM = { ana: { name: 'Ana Ruiz', role: 'Energy adviser', note: 'Mon–Thu' }, ben: { name: 'Ben Cole', role: 'Surveyor', img: 'https://solar.example/img/ben.jpg' } };
  K.people('team', { cls: 'lg-team', kicker: 'Your advisers', title: 'Who will call you', note: 'From the public team page.', items: TEAM,
    select: function (p) { var ids = Object.keys(TEAM), l = p.list('who', ids, 4); return l.length ? l : p.has('who') ? [] : ids; },
    reply: function (id, x) { return ['Ask ' + x.name, 'I want to talk to ' + x.name]; } });

  K.consent('ok', { cls: 'lg-ok', icon: 'shield', title: 'Can we keep your answers?', text: 'Only to prepare your quote.',
    yes: ['Yes, keep them', 'Yes, you can keep my answers', { lg_consent: 'yes' }], no: ['No thanks', 'No, do not keep them', { lg_consent: 'no' }],
    link: ['Privacy ↗', 'https://solar.example/privacy/'] });

  var WEEK = { 1: [[540, 600], [600, 660, 'busy'], [840, 900]], 3: [[600, 660]], 5: [[540, 600], [660, 720]] }, closed = D.on(['25/12']);
  K.slots('visit', { cls: 'lg-visit', kicker: 'Free survey', title: 'Pick a time', cta: 'Book it', note: 'A demo: nothing is booked.',
    days: function () { var t = D.today(), out = []; for (var n = t + 1; out.length < 3 && n < t + 60; n++) { var s = WEEK[D.parts(n).w]; if (s && !closed(n)) out.push({ day: n, slots: s }); } return out; },
    say: function (sel, ctx) { return ['My visit: ' + long(sel.day, ctx.lang) + ', ' + T.format(sel.from) + '–' + T.format(sel.to), { lg_day: D.str(sel.day), lg_from: T.format(sel.from) }]; },
    ics: { title: 'Solar survey', where: 'At your home' } });

  K.confirm('done', { cls: 'lg-done', form: 'visit', status: 'Request received',
    title: function (l) { return 'See you ' + long(l.state.day, 'en'); },
    rows: function (l) { return [['When', T.format(l.state.from) + '–' + T.format(l.state.to)], ['Sent', l.text]]; },
    steps: ['We call to confirm', 'The surveyor visits'], note: 'A demo: nothing is booked.', actions: function () { return [call()]; } });

  var PLAN = [['basic', 'Basic'], ['plus', 'Plus']], PRICE = { basic: 450000, plus: 620000 };   // cents, fake
  var eur = function (c, nb) { return K.h.money(c, { cur: '€', after: true, cents: false, nb: nb }); };
  var quote = function (s) { return PRICE[s.plan] + s.panels * 30000; };
  K.review('quote', { cls: 'lg-quote', kicker: 'Your quote', title: 'Review it', cta: 'Confirm', discard: ['Discard', 'Discard the quote'], note: 'Fake prices.',
    state: function (p) { return { panels: p.num('panels', 4, 20, 8, { int: true }), plan: p.one('plan', ['basic', 'plus']) || 'basic' }; },
    lines: [{ label: 'Panels', value: function (s) { return String(s.panels); } }, { label: 'Plan', select: { key: 'plan', items: PLAN } }, { label: 'Install', value: function (s) { return eur(PRICE[s.plan]); } }],
    total: { label: 'Total', value: function (s) { return eur(quote(s)); } },
    send: function (s) { return ['I confirm: ' + s.panels + ' panels, ' + K.h.label(PLAN, s.plan) + ', ' + eur(quote(s), false), { lg_plan: s.plan }]; } });

  K.chart('saving', { cls: 'lg-saving', kicker: 'Estimate', title: 'Savings over 10 years', sub: 'From the published tariff', note: 'An example, not a promise.',
    data: function (p) {
      var n = p.num('panels', 4, 20, 8, { int: true }), x = [], saved = [], cost = [], even = Math.ceil(450000 / (n * 9000));
      for (var i = 1; i <= 10; i++) { x.push('Y' + i); saved.push(n * 9000 * i); cost.push(450000); }
      return { type: 'line', x: x, series: [{ label: 'Saved', values: saved }, { label: 'Cost', values: cost }], y: { format: function (v) { return eur(v); }, ticks: 4 },
        mark: { at: even - 1, label: 'Break-even' }, summary: 'Savings pass the cost in year ' + even };
    },
    links: function () { return [call()]; } });
})();
