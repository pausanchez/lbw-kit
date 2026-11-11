/* kit/setup.js · the declarative layer: a bot's widgets from one JSON object, no JavaScript to write.
   Load it after lbw.js and kit.js (the lbw-kit bundle has it):  <script>LBW.kit.setup({ …config… })</script>

   config = { prefix, langs, defaultLang, timeZone, maxPerMessage, links: ['https://shop.example/', 'tel:'],
              actions: { name: action },        buttons named once, used by name in any widget
              replies: { name: [label, say] },  quick replies named once
              widgets: { tagName: { type: 'cards' | 'form' | 'contact' | 'chips' | 'carousel' | 'calc', … } } }
   action = 'name'  |  { use: 'name', primary: true }  |  { tel, cc, label }  |  { wa, text, label }  |  { link, label }
            |  { reply: [label, say] }      (primary: true fills it)
   Where a kit maker takes a function, the JSON gives data instead:
     text      a template: 'My room: {size} m², {finish:label:lower}, {total:money}'. {key} is a value of the widget's
               state; :label / :labels read the label of a pick; :lower lower-cases; :money formats integer cents.
               Every { } is a placeholder: a text can't hold a literal brace
     numbers   calc.compute: { total: 'round(size * rate[finish] * 1.2)' }: + - * / ( ), round floor ceil abs min max,
               names from the state and from earlier compute lines, table[key] from calc.tables. Parsed here, never eval'd
     buttons   lists of actions
   LBW.kit.setup.check(config) → [errors] changes nothing and never throws (scripts/check-config.mjs runs it on a file).
   setup() registers every valid widget and skips a broken one (its tag then draws nothing), and returns
   { ok, errors, widgets }. slots, confirm, review, chart, stats, people and consent have no JSON form yet: call their
   makers in your own script after setup(). */
(function (root) {
  'use strict';
  var LBW = root.LBW; if (!LBW || !LBW.kit) return;
  var U = LBW.ui, K = LBW.kit, H = K.h, own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; }
  function merge(a, b) { var r = {}; [a, b].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { if (k !== '__proto__') r[k] = o[k]; }); }); return r; }
  var isArr = Array.isArray, isObj = function (x) { return !!x && typeof x === 'object' && !isArr(x); }, isStr = function (x) { return typeof x === 'string' && x !== ''; };
  var isPair = function (x) { return isArr(x) && x.length >= 2 && isStr(x[0]) && isStr(x[1]); }, WORD = /^[a-z_][a-z0-9_]*$/;

  // ── numbers: a small expression language, compiled to a function of the scope ────────────────────
  // The function carries what it reads, for check(): .names (values), .tables (indexed), .lookups ([table, name] for table[name])
  var FN = { round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs, min: Math.min, max: Math.max }, ONE = { round: 1, floor: 1, ceil: 1, abs: 1 };
  function compile(src) {
    var s = String(src), i = 0, toks = [], m, re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([-+*\/()\[\],]))/g, p = 0, names = [], tables = [], lookups = [];
    while (i < s.length) {
      re.lastIndex = i; m = re.exec(s);
      if (!m || m.index !== i) { if (/^\s*$/.test(s.slice(i))) break; throw new Error('unexpected "' + s.slice(i, i + 8).trim() + '"'); }
      i = re.lastIndex; toks.push(m[1] != null ? { n: +m[1] } : m[2] ? { id: m[2] } : { op: m[3] });
    }
    function peek(op) { return toks[p] && toks[p].op === op; }
    function eat(op) { if (!peek(op)) throw new Error('expected "' + op + '"'); p++; }
    function bin(op, a, b) {
      return op === '+' ? function (x) { return +a(x) + +b(x); } : op === '-' ? function (x) { return a(x) - b(x); }
        : op === '*' ? function (x) { return a(x) * b(x); } : function (x) { return a(x) / b(x); };
    }
    function expr() { var a = term(); while (peek('+') || peek('-')) a = bin(toks[p++].op, a, term()); return a; }
    function term() { var a = unary(); while (peek('*') || peek('/')) a = bin(toks[p++].op, a, unary()); return a; }
    function unary() { if (peek('-')) { p++; var a = unary(); return function (x) { return -a(x); }; } return primary(); }
    function primary() {
      var t = toks[p++]; if (!t) throw new Error('unexpected end');
      if (t.n != null) return function () { return t.n; };
      if (t.op === '(') { var e = expr(); eat(')'); return e; }
      if (!t.id) throw new Error('unexpected "' + t.op + '"');
      if (peek('(')) {
        var args = []; if (!own(FN, t.id)) throw new Error('unknown function "' + t.id + '"');
        p++; if (!peek(')')) { args.push(expr()); while (peek(',')) { p++; args.push(expr()); } } eat(')');
        if (ONE[t.id] ? args.length !== 1 : !args.length) throw new Error(t.id + '() takes ' + (ONE[t.id] ? 'one value' : 'at least one value'));
        var fn = FN[t.id]; return function (x) { return fn.apply(null, args.map(function (a) { return a(x); })); };
      }
      if (peek('[')) {
        p++; tables.push(t.id); var k;   // table[name]: the name is a key (a pick's value), not a number to compute with
        if (toks[p] && toks[p].id && toks[p + 1] && toks[p + 1].op === ']') { var kid = toks[p++].id; lookups.push([t.id, kid]); k = function (x) { return own(x, kid) ? x[kid] : undefined; }; }
        else k = expr();
        eat(']');
        return function (x) { var tb = own(x, t.id) ? x[t.id] : null, key = k(x); return isObj(tb) && own(tb, key) ? tb[key] : NaN; };
      }
      names.push(t.id); return function (x) { return own(x, t.id) ? x[t.id] : NaN; };
    }
    var f = expr(); if (p < toks.length) throw new Error('unexpected "' + (toks[p].op || toks[p].id || toks[p].n) + '"');
    f.names = names; f.tables = tables; f.lookups = lookups; return f;
  }

  // ── text: '{key}' with :label :labels :lower :money ──────────────────────────────────────────────
  // sc = { v: values, items: { key: [[k, label]] | fn(values) → that }, money: fn(cents) }
  var HOLE = /\{([^{}]*)\}/g, SLOT = /^([A-Za-z_]\w*)((?::(?:label|labels|lower|money))*)$/;
  function tpl(str, sc) {
    return String(str == null ? '' : str).replace(HOLE, function (m, body) {
      var x = SLOT.exec(body); if (!x) return '';
      var k = x[1], v = own(sc.v, k) ? sc.v[k] : null; if (v == null || isObj(v)) return '';
      var its = typeof sc.items[k] === 'function' ? sc.items[k](sc.v) : sc.items[k];
      (x[2] ? x[2].slice(1).split(':') : []).forEach(function (mod) {
        if (mod === 'label') v = H.label(its, v);
        else if (mod === 'labels') v = (isArr(v) ? v : [v]).map(function (y) { return H.label(its, y); }).join(', ');
        else if (mod === 'lower') v = String(v).toLowerCase();
        else if (mod === 'money') v = sc.money(v);
      });
      return isArr(v) ? v.join(',') : String(v);
    });
  }
  var plain = function (v) { return { v: v || {}, items: {}, money: String }; };

  // ── buttons ──────────────────────────────────────────────────────────────────────────────────────
  function resolve(cfg, spec) {
    if (typeof spec === 'string') spec = { use: spec };
    if (isObj(spec) && spec.use != null) { var acts = cfg.actions || {}; if (!own(acts, spec.use) || !isObj(acts[spec.use])) return null; var o = merge(acts[spec.use], spec); delete o.use; return o; }
    return isObj(spec) ? spec : null;
  }
  function action(cfg, spec, text) {
    var a = resolve(cfg, spec); if (!a) return null; var cls = a.primary ? 'is-primary' : '';
    if (a.tel) return U.tel(a.label, a.tel, cls, a.cc);
    if (a.wa) return H.wa(a.label, a.wa, a.text == null ? '' : tpl(a.text, plain({ text: text || '' })), cls);
    if (a.link) return U.link(a.label, a.link, cls);
    if (a.reply) return U.reply(a.reply[0], a.reply[1], { primary: !!a.primary });
    return null;
  }
  function actions(cfg, list, text) { return (list || []).map(function (a) { return action(cfg, a, text); }); }
  function reply(cfg, spec) { return typeof spec === 'string' ? (own(cfg.replies || {}, spec) ? cfg.replies[spec] : null) : spec || null; }

  // ── one maker per type ───────────────────────────────────────────────────────────────────────────
  var MAKE = {
    cards: function (cfg, name, w) {
      var o = pick(w, ['cls', 'param', 'items', 'kicker', 'disclaimer', 'single', 'fallback', 'pointsCls', 'allowDup', 'lang']), r = reply(cfg, w.reply);
      if (w.item) { o.items = { _: w.item }; o.single = true; }
      if (r) o.reply = function (id, it) { var sc = plain({ id: id, title: it.title }); return [tpl(r[0], sc), tpl(r[1], sc)]; };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.cards(name, o);
    },
    form: function (cfg, name, w) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'preset', 'allowDup', 'collapse']), items = {};
      var sc = function (s) { return { v: s, items: items, money: String }; };
      o.steps = w.steps.map(function (st) {
        var s = pick(st, ['key', 'title', 'multi', 'none', 'ask', 'optional']);
        if (isArr(st.items)) s.items = items[st.key] = st.items;
        else {   // { by: 'kind', map: { extension: [[k, label]…], loft: […] }, else: […] }: the choices depend on an earlier answer
          var map = st.items.map || {}, rest = st.items['else'] || [];
          s.items = items[st.key] = function (state) { var k = state[st.items.by]; return own(map, k) ? map[k] : rest; };
        }
        return s;
      });
      o.summary = function (s) { return tpl(w.summary, sc(s)); };
      if (w.fields) o.fields = function (s) { var f = {}; Object.keys(w.fields).forEach(function (k) { f[k] = tpl(w.fields[k], sc(s)); }); return f; };
      K.form(name, o);
    },
    contact: function (cfg, name, w) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'big', 'rows', 'note', 'allowDup']), sm = w.summary;
      if (w.hours) { o.hours = pick(w.hours, ['week', 'sep', 'h12', 'open', 'closed', 'showNow']); if (w.hours.holidays) o.hours.holiday = LBW.day.on(w.hours.holidays); }
      o.buttons = function (p, ctx, topic, withSummary) { return actions(cfg, withSummary && w.buttonsWithSummary ? w.buttonsWithSummary : w.buttons); };
      if (sm) {
        o.summary = pick(sm, ['form', 'rows', 'copy']);
        o.summary.text = function (l) { var t = l.text; if (sm.strip && t.indexOf(sm.strip) === 0) t = t.slice(sm.strip.length); return sm.text ? tpl(sm.text, plain({ text: t })) : t; };
        if (sm.actions) o.summary.actions = function (text) { return actions(cfg, sm.actions, text); };
      }
      if (w.compact) o.compact = { label: w.compact.label, buttons: function () { return actions(cfg, w.compact.buttons); } };
      K.contact(name, o);
    },
    chips: function (cfg, name, w) { K.chips(name, pick(w, ['cls', 'lang', 'max', 'items', 'own', 'carriedBy'])); },
    carousel: function (cfg, name, w) {
      var by = w.filter && w.filter.by, param = (w.filter && w.filter.param) || by, vals = [];
      if (by) w.items.forEach(function (r) { if (r[by] != null && vals.indexOf(r[by]) < 0) vals.push(r[by]); });
      K.carousel(name, merge(pick(w, ['cls', 'lang', 'allowDup']), {
        select: function (p) {
          var k = by ? p.one(param, vals) : null, rows = w.items.filter(function (r) { return !k || r[by] === k; });
          return { items: w.max ? rows.slice(0, w.max) : rows, kicker: w.kicker, title: (k && w.titles && own(w.titles, k) && w.titles[k]) || w.title, lead: w.lead, note: w.note,
            reply: reply(cfg, w.reply), links: actions(cfg, w.links) };
        },
        slide: function (r) { return r; }
      }));
    },
    calc: function (cfg, name, w) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'notes', 'allowDup', 'collapse']), items = {}, steppers = {};
      var lines = Object.keys(w.compute || {}).map(function (k) { return [k, compile(w.compute[k])]; });
      // a stepper takes its range from the state it moves, so what it shows is what the result uses
      o.controls = w.controls.map(function (c) {
        var d = w.state[c.stepper || c.pick], x = pick(c, ['stepper', 'pick', 'label', 'title', 'items', 'step', 'less', 'more', 'hint']);
        if (c.pick) items[c.pick] = c.items; else { x.min = d.min; x.max = d.max; steppers[c.stepper] = c.step > 0 ? c.step : 1; }
        return x;
      });
      function sc(state, nb) {
        var v = merge(w.tables, state), ok = true; lines.forEach(function (l) { v[l[0]] = l[1](v); if (!isFinite(v[l[0]])) ok = false; });
        return { ok: ok, v: v, items: items, money: function (n) { return H.money(n, merge(w.money, nb === false ? { nb: false } : null)); } };
      }
      o.state = function (p) {
        var st = {};
        Object.keys(w.state).forEach(function (k) {
          var d = w.state[k], par = d.param || k;
          if (d.values) { st[k] = p.one(par, d.values) || d['default']; return; }
          var n = p.num(par, d.min, d.max, d['default'], { int: !!d['int'] }), step = steppers[k];
          st[k] = step ? +Math.max(d.min, Math.min(d.max, d.min + Math.round((n - d.min) / step) * step)).toFixed(6) : n;   // on the stepper's grid
        });
        return st;
      };
      // a result that isn't a number (a divide by zero) is never shown or sent: the card keeps its controls, the button stays off
      o.ready = function (s) { return sc(s).ok || w.cta; };
      o.result = function (s, out) {
        var c = sc(s), r = w.result; if (!c.ok) { LBW.drop('setup: ' + name + ': a compute line is not a number'); return; }
        if (r.rows) U.rows(out, r.rows.map(function (x) { return [tpl(x[0], c), tpl(x[1], c)]; })).classList.add('kit-lines');
        if (r.total) H.total(out, tpl(r.total[0], c), tpl(r.total[1], c));
        if (r.note) H.note(out, tpl(r.note, c));
      };
      o.send = function (s) {   // what the visitor sends: no no-break space in it
        var c = sc(s, false), f = {}; if (!c.ok) return null;
        Object.keys(w.send.fields || {}).forEach(function (k) { f[k] = tpl(w.send.fields[k], c); });
        return [tpl(w.send.text, c), f];
      };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.calc(name, o);
    }
  };

  // ── checking a config: every problem as a sentence, nothing drawn, never a throw ─────────────────
  var TOP = '$schema version prefix langs defaultLang timeZone maxPerMessage links labels quietMs maxWaitMs actions replies widgets'.split(' ');
  var KEYS = {
    cards: 'type cls param items item kicker disclaimer single fallback pointsCls allowDup lang reply links',
    form: 'type cls lang kicker title cta note preset steps summary fields allowDup collapse',
    contact: 'type cls lang kicker title big rows hours note buttons buttonsWithSummary summary compact allowDup',
    chips: 'type cls lang max items own carriedBy',
    carousel: 'type cls lang allowDup items filter kicker title titles lead note reply links max',
    calc: 'type cls lang kicker title cta state controls tables compute money result send notes links allowDup collapse'
  };
  var NEED = { cards: [], form: ['steps', 'summary', 'cta'], contact: ['title'], chips: ['items'], carousel: ['items'], calc: ['state', 'controls', 'result', 'send', 'cta'] };
  function check(cfg) {
    var errs = [], top = function (m) { errs.push({ widget: null, message: m }); };
    if (!isObj(cfg)) { top('the config is not an object'); return errs; }
    Object.keys(cfg).forEach(function (k) { if (TOP.indexOf(k) < 0) top('unknown key "' + k + '". Known: ' + TOP.join(', ')); });
    if (!/^[a-z][a-z0-9_]*$/i.test(cfg.prefix || '')) top('"prefix" is missing or not a plain word');
    var links = isArr(cfg.links) ? cfg.links.filter(isStr) : [];
    if (cfg.links != null && !isArr(cfg.links)) top('"links" must be a list');
    links.forEach(function (l) { if (/^https?:/.test(l) && !/\/$/.test(l)) top('link "' + l + '" must end in "/"'); });
    var linkOK = function (url) { return isStr(url) && links.some(function (o) { return /^https?:/.test(o) && url.indexOf(/\/$/.test(o) ? o : o + '/') === 0; }); };
    ['actions', 'replies'].forEach(function (k) { if (cfg[k] != null && !isObj(cfg[k])) top('"' + k + '" must be an object'); });
    var acts = isObj(cfg.actions) ? cfg.actions : {}, reps = isObj(cfg.replies) ? cfg.replies : {};

    // an action, by name or written out: one kind, a label, and a link the allow-list lets through
    function act(a, say, where) {
      var use = typeof a === 'string' ? a : isObj(a) ? a.use : null;
      if (use != null && !own(acts, use)) { say(where + ': action "' + use + '" is not in "actions"'); return; }
      var r = resolve({ actions: acts }, a); if (!r) { say(where + ': an action is a name or an object'); return; }
      var kinds = ['tel', 'wa', 'link', 'reply'].filter(function (k) { return r[k] != null; });
      if (kinds.length !== 1) { say(where + ': an action needs one of tel, wa, link, reply'); return; }
      if (r.reply) { if (!isPair(r.reply)) say(where + ': "reply" is [label, sentence]'); return; }
      if (!isStr(r.label)) say(where + ': the action has no "label"');
      if (r.tel && links.indexOf('tel:') < 0) say(where + ': a tel action needs "tel:" in "links"');
      if (r.wa && !linkOK('https://wa.me/')) say(where + ': a wa action needs "https://wa.me/" in "links"');
      if (r.link && !linkOK(r.link)) say(where + ': "' + r.link + '" is not under any entry of "links"');
    }
    Object.keys(acts).forEach(function (k) { act(acts[k], top, 'actions.' + k); });
    Object.keys(reps).forEach(function (k) { if (!isPair(reps[k])) top('replies.' + k + ' is [label, sentence]'); });
    if (!isObj(cfg.widgets)) { top('"widgets" is missing'); return errs; }

    Object.keys(cfg.widgets).forEach(function (name) {
      var w = cfg.widgets[name], err = function (m) { errs.push({ widget: name, message: name + ': ' + m }); };
      // every { } in a text: a known key, known modifiers, and a modifier that fits the key
      function text(t, where, keys, labels, money) {
        if (t == null) return; if (typeof t !== 'string') { err(where + ' must be text'); return; }
        t.replace(HOLE, function (m, body) {
          var x = SLOT.exec(body); if (!x) { err(where + ': "' + m + '" is not a placeholder ({key}, with :label :labels :lower :money)'); return m; }
          if (keys.indexOf(x[1]) < 0) { err(where + ': "{' + x[1] + '}" is not a value here. Known: ' + (keys.join(', ') || 'none')); return m; }
          if (/:labels?\b/.test(x[2]) && labels.indexOf(x[1]) < 0) err(where + ': "' + m + '" asks for a label, and "' + x[1] + '" is not a pick');
          if (/:money\b/.test(x[2]) && money.indexOf(x[1]) < 0) err(where + ': "' + m + '" formats money, and "' + x[1] + '" is not a number');
          return m;
        });
        if (/[{}]/.test(t.replace(HOLE, ''))) err(where + ': a stray "{" or "}"');
      }
      function list(l, where, each) { if (l == null) return []; if (!isArr(l)) { err(where + ' must be a list'); return []; } l.forEach(function (x, i) { each(x, where + '[' + i + ']'); }); return l; }
      function pairs(l, where) { list(l, where, function (x, at) { if (!isPair(x)) err(at + ' is [text, text]'); }); }
      function rep(r, where) { if (r == null) return; if (typeof r === 'string') { if (!own(reps, r)) err(where + ': reply "' + r + '" is not in "replies"'); } else if (!isPair(r)) err(where + ' is a name in "replies" or [label, sentence]'); }
      function param(v, where) { if (v != null && !WORD.test(v)) err(where + ' "' + v + '" must be lower-case (a tag\'s keys are read lower-cased)'); }
      function url(pair, where) { if (pair == null) return; if (!isPair(pair)) err(where + ' is [label, url]'); else if (!linkOK(pair[1])) err(where + ': "' + pair[1] + '" is not under any entry of "links"'); }

      try {
        if (!/^[a-z][a-z0-9_]*$/.test(name)) err('a widget name is lower-case letters, digits and _');
        if (!isObj(w) || !isStr(w.type) || !own(KEYS, w.type)) { err('unknown type "' + (isObj(w) ? w.type : w) + '". Known: ' + Object.keys(KEYS).join(', ')); return; }
        var known = KEYS[w.type].split(' ');
        Object.keys(w).forEach(function (k) { if (known.indexOf(k) < 0) err('unknown option "' + k + '" for ' + w.type + '. Known: ' + known.join(', ')); });
        NEED[w.type].forEach(function (k) { if (w[k] == null) err('missing "' + k + '"'); });
        ['links', 'buttons', 'buttonsWithSummary'].forEach(function (k) { list(w[k], k, function (a, at) { act(a, err, at); }); });
        rep(w.reply, 'reply');

        if (w.type === 'cards') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var cs = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(cs).forEach(function (id) { var it = cs[id]; if (!isObj(it) || !isStr(it.title)) { err('card "' + id + '" has no "title"'); return; } url(it.link, id + '.link'); pairs(it.rows, id + '.rows'); list(it.points, id + '.points', function (x, at) { if (!isStr(x)) err(at + ' must be text'); }); });
          param(w.param, 'param'); if (w.fallback != null && !own(cs, w.fallback)) err('fallback "' + w.fallback + '" is not one of the items');
          var r = reply({ replies: reps }, w.reply); if (isPair(r)) { text(r[0], 'reply', ['id', 'title'], [], []); text(r[1], 'reply', ['id', 'title'], [], []); }
        }

        if (w.type === 'form') {
          var keys = [], picks = [];
          list(w.steps, 'steps', function (st, at) {
            if (!isObj(st)) { err(at + ' must be an object'); return; }
            if (!isStr(st.key)) { err('step ' + keys.length + ' has no "key"'); return; }
            if (isArr(st.items)) pairs(st.items, st.key + '.items');
            else if (isObj(st.items)) {
              if (keys.indexOf(st.items.by) < 0) err(st.key + '.items.by "' + st.items.by + '" is not an earlier step');
              if (!isObj(st.items.map)) err(st.key + '.items.map must be an object'); else Object.keys(st.items.map).forEach(function (k) { pairs(st.items.map[k], st.key + '.items.map.' + k); });
              pairs(st.items['else'], st.key + '.items.else');
            } else err('step ' + st.key + ' has no "items"');
            keys.push(st.key); picks.push(st.key);
          });
          if (isArr(w.steps) && !w.steps.length) err('"steps" is empty');
          text(w.summary, 'summary', keys, picks, []);
          if (w.fields != null && !isObj(w.fields)) err('"fields" must be an object'); else Object.keys(w.fields || {}).forEach(function (k) { text(w.fields[k], 'fields.' + k, keys, picks, []); });
          if (w.preset != null) { if (!isObj(w.preset) || keys.indexOf(w.preset.step) < 0) err('preset.step is not one of the steps'); else param(w.preset.param, 'preset.param'); }
        }

        if (w.type === 'contact') {
          if (!isStr(w.title)) err('"title" must be text');
          pairs(w.rows, 'rows');
          if (w.hours != null && (!isObj(w.hours) || !isObj(w.hours.week))) err('"hours" needs "week": { "1": [[540, 1080]], … } (0 = Sunday, minutes)');
          if (w.summary != null) {
            if (!isObj(w.summary) || !isStr(w.summary.form)) err('summary.form must name a form widget');
            else { var fw = own(cfg.widgets, w.summary.form) ? cfg.widgets[w.summary.form] : null; if (!isObj(fw) || fw.type !== 'form') err('summary.form "' + w.summary.form + '" is not a form widget');
              text(w.summary.text, 'summary.text', ['text'], [], []); list(w.summary.actions, 'summary.actions', function (a, at) { act(a, err, at); var x = resolve({ actions: acts }, a); if (x) text(x.text, at + '.text', ['text'], [], []); }); }
          }
          if (w.compact != null) { if (!isObj(w.compact) || !isStr(w.compact.label)) err('compact needs a "label"'); else if (!isArr(w.compact.buttons) || !w.compact.buttons.length) err('compact needs "buttons"'); else list(w.compact.buttons, 'compact.buttons', function (a, at) { act(a, err, at); }); }
        }

        if (w.type === 'chips') {
          if (!isObj(w.items)) err('"items" must be an object of [label, sentence] by key'); else Object.keys(w.items).forEach(function (k) { if (!isPair(w.items[k])) err('items.' + k + ' is [label, sentence]'); });
          if (w.own != null && !isObj(w.own)) err('"own" must be an object');
          if (w.carriedBy != null && !isObj(w.carriedBy)) err('"carriedBy" must be an object'); else Object.keys(w.carriedBy || {}).forEach(function (k) { if (!isArr(w.carriedBy[k])) err('carriedBy.' + k + ' must be a list of widget names'); });
        }

        if (w.type === 'carousel') {
          var n = list(w.items, 'items', function (it, at) { if (!isObj(it) || !isStr(it.name)) { err(at + ' has no "name"'); return; } url(it.link, at + '.link'); if (it.img != null && !(isObj(it.img) && linkOK(it.img.src))) err(at + '.img.src is not under any entry of "links"'); rep(it.reply, at + '.reply'); }).length;
          if (isArr(w.items) && !n) err('"items" is empty');
          if (w.filter != null) { if (!isObj(w.filter) || !isStr(w.filter.by)) err('filter is { "by": a key of the items, "param": the tag key }'); else param(w.filter.param || w.filter.by, 'filter.param'); }
          if (w.titles != null && !isObj(w.titles)) err('"titles" must be an object');
        }

        if (w.type === 'calc') {
          var st = isObj(w.state) ? w.state : {}, tb = isObj(w.tables) ? w.tables : {}, cp = isObj(w.compute) ? w.compute : {}, res = isObj(w.result) ? w.result : {}, snd = isObj(w.send) ? w.send : {};
          ['state', 'result', 'send'].forEach(function (k) { if (w[k] != null && !isObj(w[k])) err('"' + k + '" must be an object'); });
          ['tables', 'compute', 'money'].forEach(function (k) { if (w[k] != null && !isObj(w[k])) err('"' + k + '" must be an object'); });
          var skeys = Object.keys(st), nums = [], pickKeys = [], vals = skeys.slice();
          if (isObj(w.state) && !skeys.length) err('"state" is empty');
          skeys.forEach(function (k) {
            var d = st[k]; if (!isObj(d)) { err('state.' + k + ' must be an object'); return; }
            param(d.param || k, 'state.' + k + (d.param ? '.param' : ''));
            if (d['default'] == null) err('state.' + k + ' has no "default"');
            if (d.values != null) { if (!isArr(d.values) || !d.values.length || !d.values.every(isStr)) err('state.' + k + '.values must be a list of words'); else if (d['default'] != null && d.values.indexOf(d['default']) < 0) err('state.' + k + '.default is not one of its values'); }
            else { nums.push(k); if (typeof d.min !== 'number' || typeof d.max !== 'number' || d.min > d.max) err('state.' + k + ' needs "values" or "min" and "max"'); else if (typeof d['default'] === 'number' && (d['default'] < d.min || d['default'] > d.max)) err('state.' + k + '.default is outside min–max'); else if (d['default'] != null && typeof d['default'] !== 'number') err('state.' + k + '.default must be a number'); }
          });
          Object.keys(tb).forEach(function (t) { if (own(st, t)) err('tables.' + t + ' has the name of a state key'); if (!isObj(tb[t])) err('tables.' + t + ' must be an object of numbers'); else Object.keys(tb[t]).forEach(function (k) { if (typeof tb[t][k] !== 'number') err('tables.' + t + '.' + k + ' must be a number'); }); });
          list(w.controls, 'controls', function (c, at) {
            if (!isObj(c) || (c.stepper == null) === (c.pick == null)) { err(at + ' is { "stepper": a state key, … } or { "pick": a state key, "items": … }'); return; }
            var k = c.stepper || c.pick, d = own(st, k) ? st[k] : null; if (!isObj(d)) { err(at + ': "' + k + '" is not in "state"'); return; }
            if (c.stepper) { if (d.values) err(at + ': a stepper moves a number, and state.' + k + ' has "values"'); if (!isStr(c.label)) err(at + ' has no "label"'); if (c.min != null || c.max != null) err(at + ': "min" and "max" go in state.' + k + ', not in the control'); if (c.step != null && !(c.step > 0)) err(at + '.step must be above 0'); }
            else { if (!d.values) err(at + ': a pick needs state.' + k + '.values'); pairs(c.items, at + '.items'); if (!isArr(c.items)) err(at + ' has no "items"');
              else if (isArr(d.values)) { var have = c.items.map(function (x) { return isArr(x) ? x[0] : null; }); d.values.forEach(function (v) { if (have.indexOf(v) < 0) err(at + '.items has no entry for "' + v + '"'); }); have.forEach(function (v) { if (v != null && d.values.indexOf(v) < 0) err(at + '.items has "' + v + '", which is not in state.' + k + '.values'); }); pickKeys.push(k); } }
          });
          Object.keys(cp).forEach(function (k) {
            var f; try { f = compile(cp[k]); } catch (e) { err('compute.' + k + ': ' + e.message); vals.push(k); nums.push(k); return; }
            f.names.forEach(function (x) { if (vals.indexOf(x) < 0) err('compute.' + k + ': "' + x + '" is ' + (own(tb, x) ? 'a table: write ' + x + '[key]' : own(cp, x) ? 'computed on a later line' : 'not in state or compute')); else if (nums.indexOf(x) < 0) err('compute.' + k + ': "' + x + '" is a pick, not a number: use it as table[' + x + ']'); });
            f.tables.forEach(function (x) { if (!own(tb, x)) err('compute.' + k + ': "' + x + '" is not in "tables"'); });
            f.lookups.forEach(function (l) { var d = own(st, l[1]) ? st[l[1]] : null; if (vals.indexOf(l[1]) < 0) err('compute.' + k + ': "' + l[1] + '" is not in state or compute'); if (isObj(tb[l[0]]) && isObj(d) && isArr(d.values)) d.values.forEach(function (v) { if (!own(tb[l[0]], v)) err('tables.' + l[0] + ' has no "' + v + '" (a value of state.' + l[1] + ')'); }); });
            if (own(st, k) || own(tb, k)) err('compute.' + k + ' has the name of a state key or a table');
            vals.push(k); nums.push(k);
          });
          var T = function (t, where) { text(t, where, vals, pickKeys, nums); };
          list(res.rows, 'result.rows', function (x, at) { if (!isPair(x)) err(at + ' is [label, value]'); else { T(x[0], at); T(x[1], at); } });
          if (res.total != null) { if (!isPair(res.total)) err('result.total is [label, value]'); else { T(res.total[0], 'result.total'); T(res.total[1], 'result.total'); } }
          T(res.note, 'result.note');
          if (isObj(w.send)) { if (!isStr(snd.text)) err('send.text is missing'); else T(snd.text, 'send.text'); if (snd.fields != null && !isObj(snd.fields)) err('send.fields must be an object'); else Object.keys(snd.fields || {}).forEach(function (k) { T(snd.fields[k], 'send.fields.' + k); }); }
          list(w.notes, 'notes', function (x, at) { if (!isArr(x) || !isStr(x[0])) err(at + ' is [text] or [text, class]'); });
        }
      } catch (e) { err('could not be checked (' + e.message + ')'); }
    });
    return errs;
  }

  function setup(cfg) {
    var errs = check(cfg), bad = [], made = [];
    root.__kitSetupErrors = errs.map(function (e) { return e.message; });
    errs.forEach(function (e) { if (e.widget != null) bad.push(e.widget); LBW.drop('setup: ' + e.message); try { console.error('[kit] setup: ' + e.message); } catch (x) {} });
    if (errs.some(function (e) { return e.widget == null; })) return { ok: false, errors: root.__kitSetupErrors, widgets: made };
    LBW.init(pick(cfg, ['prefix', 'langs', 'defaultLang', 'timeZone', 'maxPerMessage', 'links', 'labels', 'quietMs', 'maxWaitMs']));
    Object.keys(cfg.widgets).forEach(function (name) {
      if (bad.indexOf(name) >= 0) return;
      try { MAKE[cfg.widgets[name].type](cfg, name, cfg.widgets[name]); made.push(name); }
      catch (e) { root.__kitSetupErrors.push(name + ': ' + e.message); LBW.drop('setup: ' + name + ': ' + e.message); }
    });
    return { ok: !root.__kitSetupErrors.length, errors: root.__kitSetupErrors, widgets: made };
  }
  setup.check = function (cfg) { return check(cfg).map(function (e) { return e.message; }); };
  setup.types = Object.keys(KEYS);
  K.setup = setup;
})(typeof window !== 'undefined' ? window : this);
