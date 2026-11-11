/* Kit example (kit v0.4: open the mock with ?kitdev=1 for the dev checks; LBW.kit.describe('np') lists the tags) · a fictional builder (Northpeak Builders, fake data) using every kit option once. Copy it to start a demo:
   change the data, keep the shapes. prefix np · en. Tags:
     [[np:service id=extension]]  [[np:faq id=planning]]  [[np:area]]  [[np:plan kind=loft]]  [[np:contact]]  [[np:chips q=plan,area]]
     [[np:projects kind=loft]]  [[np:room size=12 finish=clad]]   (v0.2: carousel, calc) */
(function () {
  var U = LBW.ui, K = LBW.kit, SITE = 'https://northpeak.example/', TEL = '0116 000 0000', WA = '447700900000';
  LBW.init({ prefix: 'np', langs: ['en'], defaultLang: 'en', timeZone: 'Europe/London', maxPerMessage: 3, links: [SITE, 'tel:', 'https://wa.me/'] });
  var call = function (primary) { return U.tel('Call ' + TEL, TEL, primary ? 'is-primary' : '', '44'); };
  var plan = function () { return ['Plan my project', 'I want to plan my project']; };

  // cards: a table of items, one drawn per tag (services)
  K.cards('service', { cls: 'np-service', kicker: 'Service', pointsCls: 'is-check', reply: plan,
    items: {
      extension: { title: 'Extensions', line: 'Single and double storey, designed and built by one team.', pointsTitle: 'What it covers', points: ['Drawings and planning', 'Groundworks to roof', 'Project managed'], link: ['See the page ↗', SITE + 'extensions/'] },
      loft: { title: 'Loft conversions', line: 'Dormer, hip-to-gable and roof-light conversions.', pointsTitle: 'What it covers', points: ['Structural design', 'Stairs and insulation', 'Building Control'], link: ['See the page ↗', SITE + 'lofts/'] }
    } });

  // cards with a disclaimer and no reply (FAQ answers)
  K.cards('faq', { cls: 'np-faq', kicker: 'FAQ', disclaimer: 'General guidance from the website; your own project is checked at the survey.',
    items: { planning: { title: 'Do I need planning permission?', points: ['Often for extensions and new builds', 'Sometimes not, under permitted development'], note: 'The team checks it at the free consultation.', link: ['Read more ↗', SITE + 'faq/planning/'] } } });

  // a single card with rows (coverage)
  K.cards('area', { cls: 'np-area', single: true, links: function () { return [call(false)]; },
    items: { _: { kicker: 'Where we build', title: 'Leicestershire and around', rows: [['Base', 'Leicester'], ['Also', 'Nottinghamshire, Derbyshire'], ['Elsewhere', 'Ask the team']] } } });

  // form: one pick, one pick, many picks (with "none"), and a preset from the tag
  var KIND = [['extension', 'Extension'], ['loft', 'Loft conversion'], ['kitchen', 'Kitchen']];
  var DRAW = [['none', 'No drawings yet'], ['full', 'Full drawings']];
  var NEAR = [['tree', 'A tree within 10 m'], ['party', 'A shared wall'], ['none', 'None of these']];
  K.form('plan', { cls: 'np-plan', kicker: 'Project planner', title: 'What are you planning?', cta: 'Send my summary',
    preset: { param: 'kind', step: 'kind' }, note: 'Three questions, no name, address or phone.',
    steps: [
      { key: 'kind', title: 'The project', items: KIND, ask: 'What are you planning?' },
      { key: 'draw', title: 'Drawings', items: DRAW, ask: 'Do you have drawings?' },
      { key: 'near', title: 'Near the build (pick any)', items: NEAR, multi: true, none: 'none', ask: 'Anything near the build?' }
    ],
    summary: function (s) { return 'My project: ' + K.h.label(KIND, s.kind) + ' · ' + K.h.label(DRAW, s.draw) + ' · Near: ' + s.near.map(function (k) { return K.h.label(NEAR, k).toLowerCase(); }).join(', '); },
    fields: function (s) { return { np_kind: s.kind, np_drawings: s.draw, np_near: s.near.join(',') }; } });

  // contact: hours (open now), the last plan summary with Copy + WhatsApp, a compact redraw
  K.contact('contact', { cls: 'np-contact', kicker: 'Talk to the team', title: 'Book a free consultation', big: TEL,
    hours: { week: { 1: [[480, 1080]], 2: [[480, 1080]], 3: [[480, 1080]], 4: [[480, 1080]], 5: [[480, 1020]], 6: [[540, 780]] } },
    rows: [['WhatsApp', '+44 7700 900000'], ['Showroom', '1 Example Road, Leicester']],
    summary: { form: 'plan', rows: 4, text: function (l) { return l.text.replace(/^My project: /, 'Hello! I’d like a free consultation for: '); },
      actions: function (text) { return [K.h.wa('Send on WhatsApp ↗', WA, text, 'is-primary')]; } },
    note: 'This chat is a demo: it doesn’t book or send anything.',
    buttons: function (p, ctx, t, withSummary) { return [call(!withSummary), withSummary ? null : K.h.wa('WhatsApp ↗', WA, 'Hello! Can I have some help please?')]; },
    compact: { label: 'Free consultation', buttons: function () { return [call(true), K.h.wa('WhatsApp ↗', WA, 'Hello! Can I have some help please?')]; } } });

  // carousel: items from a table, filtered by the tag (a broken photo hides its frame, never a broken icon)
  var PROJECTS = [['p1', 'loft', 'Dormer loft conversion', 'Quorn', 'An ensuite and a bespoke staircase', 'p1.jpg'],
    ['p2', 'extension', 'Double storey extension', 'Anstey', 'Two bedrooms and a new kitchen', 'p2.jpg'],
    ['p3', 'loft', 'Hip-to-gable loft', 'Birstall', 'A full re-roof and a home office', 'p3.jpg']];
  var KINDS = { loft: 'Loft conversions', extension: 'Extensions' };
  K.carousel('projects', { cls: 'np-projects',
    select: function (p) { var k = p.one('kind', Object.keys(KINDS)), rows = PROJECTS.filter(function (r) { return !k || r[1] === k; });
      return { items: rows, kicker: 'Our work', title: k ? KINDS[k] + ' we’ve built' : 'Recent projects', reply: plan(), links: [U.link('All projects ↗', SITE + 'projects/')] }; },
    slide: function (r) { return { id: r[0], name: r[2], sub: r[3], desc: r[4], link: ['See the project ↗', SITE + 'projects/' + r[0] + '/'],
      img: { src: SITE + 'img/' + r[5], width: 640, height: 400, alt: r[2] + ', ' + r[3] } }; } });

  // calc: a live estimate from a stepper and a pick, sent once. Money in integer pence, one function for result and send.
  var FINISH = [['clad', 'Timber cladding'], ['render', 'Render']], RATE = { clad: 120000, render: 135000 };   // pence per m², fake
  function estimate(s) { var base = s.size * RATE[s.finish]; return { base: base, vat: Math.round(base * 0.2), total: Math.round(base * 1.2) }; }
  var gbp = function (c, nb) { return K.h.money(c, { cur: '£', cents: false, nb: nb }); };
  K.calc('room', { cls: 'np-room', kicker: 'Garden room', title: 'A rough estimate', cta: 'Send my estimate',
    state: function (p) { return { size: p.num('size', 8, 30, 12, { int: true }), finish: p.one('finish', ['clad', 'render']) || 'clad' }; },
    controls: [{ stepper: 'size', label: 'Size (m²)', min: 8, max: 30, step: 2, less: 'Smaller', more: 'Bigger' }, { pick: 'finish', title: 'Finish', items: FINISH }],
    result: function (s, out) { var e = estimate(s); U.rows(out, [['Build · ' + s.size + ' m²', gbp(e.base)], ['VAT 20%', gbp(e.vat)]]).classList.add('kit-lines'); K.h.total(out, 'Estimate', gbp(e.total)); },
    send: function (s) { return ['My garden room: ' + s.size + ' m², ' + K.h.label(FINISH, s.finish).toLowerCase() + ', estimate ' + gbp(estimate(s).total, false), { np_size: String(s.size), np_finish: s.finish }]; },
    notes: [['A fake rate for the kit example: a real demo takes it from the client’s own calculator.', 'is-muted']],
    links: function () { return [call(false)]; } });

  // chips: skip what the reply already shows
  K.chips('chips', { cls: 'np-chips',
    items: { plan: ['Plan my project', 'I want to plan my project'], area: ['Do you cover my area?', 'Do you cover my area?'], planning: ['Do I need planning?', 'Do I need planning permission?'], contact: ['Talk to the team', 'How do I talk to someone?'] },
    own: { plan: 'plan', area: 'area', contact: 'contact' }, carriedBy: { plan: ['service'] } });
})();
