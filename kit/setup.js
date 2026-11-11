/* kit/setup.js · the declarative layer: a bot's widgets from one JSON object, no JavaScript to write.
   Load it after lbw.js and kit.js (the lbw-kit bundle has it):  <script>LBW.kit.setup({ …config… })</script>

   config = { prefix, langs, defaultLang, timeZone, maxPerMessage, links: ['https://shop.example/', 'tel:'],
              actions: { name: action },        buttons named once, used by name in any widget
              replies: { name: [label, say] },  quick replies named once
              widgets: { tagName: { type: one of the 13 kit makers, … } } }   (LBW.kit.setup.types lists them)
   action = 'name'  |  { use: 'name', primary: true }  |  { tel, cc, label }  |  { wa, text, label }  |  { link, label }  |  { mail, label }
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
   { ok, errors, widgets }.
   Languages: any text may be { "en": "Hours", "es": "Horario" } (the keys are languages of `langs`); the tag's lang picks one,
   and a missing one falls back to defaultLang. A carousel item with "until": "D/M/YYYY" is left out after that day.
   Dates and times (slots, confirm): {day:date} "Friday, November 13" (in the chat's language), {day:dmy} 13/11/2026, {from:time} 10:00.
   What still needs your own script after setup(): slots read from an API (Calendly), a chart's own y format. */
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
  // sc = { v: values, items: { key: [[k, label]] | fn(values) → that }, money: fn(cents), lang, sep, h12 (for :date and :time) }
  var HOLE = /\{([^{}]*)\}/g, SLOT = /^([A-Za-z_]\w*)((?::(?:label|labels|lower|money|date|dmy|time))*)$/;
  function tpl(str, sc) {
    return String(str == null ? '' : str).replace(HOLE, function (m, body) {
      var x = SLOT.exec(body); if (!x) return '';
      var k = x[1], v = own(sc.v, k) ? sc.v[k] : null; if (v == null || isObj(v)) return '';
      var its = typeof sc.items[k] === 'function' ? sc.items[k](sc.v) : sc.items[k];
      (x[2] ? x[2].slice(1).split(':') : []).forEach(function (mod) {
        if (mod === 'label' && !isArr(v)) v = H.label(its, v);
        else if (mod === 'label' || mod === 'labels') v = (isArr(v) ? v : [v]).map(function (y) { return H.label(its, y); }).join(', ');
        else if (mod === 'lower') v = String(v).toLowerCase();
        else if (mod === 'money') v = sc.money(v);
        else if (mod === 'date') v = LBW.day.format(v, sc.lang || 'en', { weekday: 'long', day: 'numeric', month: 'long' });
        else if (mod === 'dmy') v = LBW.day.str(v);
        else if (mod === 'time') v = LBW.time.format(v, sc.sep, { h12: sc.h12 });
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
    if (a.mail) return U.link(a.label, 'mailto:' + a.mail, cls);
    if (a.reply) return U.reply(a.reply[0], a.reply[1], { primary: !!a.primary });
    return null;
  }
  function actions(cfg, list, text) { return (list || []).map(function (a) { return action(cfg, a, text); }); }
  function reply(cfg, spec) { return typeof spec === 'string' ? (own(cfg.replies || {}, spec) ? cfg.replies[spec] : null) : spec || null; }

  // state from the tag, tables and compute lines, for review and chart (calc has its own, with steppers)
  function numbers(w) {
    var lines = Object.keys(w.compute || {}).map(function (k) { return [k, compile(w.compute[k])]; });
    return {
      state: function (p) {
        var st = {};
        Object.keys(w.state || {}).forEach(function (k) { var d = w.state[k], par = d.param || k;
          st[k] = d.values ? p.one(par, d.values) || d['default'] : p.num(par, d.min, d.max, d['default'], { int: !!d['int'] }); });
        return st;
      },
      scope: function (state, nb) {
        var v = merge(w.tables, state), ok = true; lines.forEach(function (l) { v[l[0]] = l[1](v); if (!isFinite(v[l[0]])) ok = false; });
        return { ok: ok, v: v, items: {}, money: function (n) { return H.money(n, merge(w.money, nb === false ? { nb: false } : null)); } };
      }
    };
  }
  var FORMS = {};   // form name → its items by step key, for a confirm card's :label
  function timeOf(x) { return typeof x === 'number' ? x : LBW.time.read(x); }

  // ── one maker per type ───────────────────────────────────────────────────────────────────────────
  var MAKE = {
    cards: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'param', 'items', 'kicker', 'disclaimer', 'single', 'fallback', 'pointsCls', 'allowDup', 'lang']), r = reply(cfg, w.reply);
      if (w.item) { o.items = { _: w.item }; o.single = true; }
      if (r) o.reply = function (id, it) { var sc = plain({ id: id, title: it.title }); return [tpl(r[0], sc), tpl(r[1], sc)]; };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.cards(name, o);
    },
    form: function (cfg, name, w, lang) {
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
      FORMS[name + '|' + lang] = items;
      o.summary = function (s) { return tpl(w.summary, sc(s)); };
      if (w.fields) o.fields = function (s) { var f = {}; Object.keys(w.fields).forEach(function (k) { f[k] = tpl(w.fields[k], sc(s)); }); return f; };
      K.form(name, o);
    },
    contact: function (cfg, name, w, lang) {
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
    chips: function (cfg, name, w, lang) { K.chips(name, pick(w, ['cls', 'lang', 'max', 'items', 'own', 'carriedBy'])); },
    carousel: function (cfg, name, w, lang) {
      var by = w.filter && w.filter.by, param = (w.filter && w.filter.param) || by, vals = [];
      if (by) w.items.forEach(function (r) { if (r[by] != null && vals.indexOf(r[by]) < 0) vals.push(r[by]); });
      K.carousel(name, merge(pick(w, ['cls', 'lang', 'allowDup']), {
        select: function (p) {
          var k = by ? p.one(param, vals) : null, today = LBW.day.today();
          // an item with "until": "D/M/YYYY" is left out from the day after: a list that doesn't go stale
          var rows = w.items.filter(function (r) { return (!k || r[by] === k) && (r.until == null || LBW.day.read(r.until) >= today); });
          return { items: w.max ? rows.slice(0, w.max) : rows, kicker: w.kicker, title: (k && w.titles && own(w.titles, k) && w.titles[k]) || w.title, lead: w.lead, note: w.note,
            reply: reply(cfg, w.reply), links: actions(cfg, w.links) };
        },
        slide: function (r) { return r; }
      }));
    },
    calc: function (cfg, name, w, lang) {
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
    },
    stats: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'items', 'allowDup']), r = reply(cfg, w.reply);
      if (w.item) { o.items = { _: w.item }; o.single = true; }
      if (r) o.reply = function (id, it) { var sc = plain({ id: id, title: it.title }); return [tpl(r[0], sc), tpl(r[1], sc)]; };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.stats(name, o);
    },
    people: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'note', 'items', 'allowDup']), r = reply(cfg, w.reply), ids = Object.keys(w.items);
      // [[p:team who=ana,ben]] shows those; no `who` shows everyone; a `who` that names nobody known shows nothing
      if (w.filter) o.select = function (p) { var l = p.list(w.filter.param, ids, 4); return l.length ? l : p.has(w.filter.param) ? [] : ids; };
      if (r) o.reply = function (id, x) { var sc = plain({ id: id, name: x.name, role: x.role }); return [tpl(r[0], sc), tpl(r[1], sc)]; };
      K.people(name, o);
    },
    consent: function (cfg, name, w, lang) { K.consent(name, pick(w, ['cls', 'lang', 'icon', 'title', 'text', 'yes', 'no', 'link', 'allowDup'])); },
    slots: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'sep', 'h12', 'collapse', 'allowDup', 'ics']), D = LBW.day;
      var norm = function (l) { return l.map(function (x) { return [timeOf(x[0]), timeOf(x[1]), x[2]]; }); };
      o.days = function () {   // from the config only: fixed dates from today on, or the next open days of a weekly diary
        var today = D.today(), now = LBW.time.now(), out = [], wk = w.weekly;
        // today's slots that have already started are gone; a day with nothing free left is not offered (and not counted in `ahead`)
        var live = function (day, l) { var sl = norm(l).filter(function (x) { return day > today || x[0] > now; }); return sl.some(function (x) { return x[2] !== 'busy'; }) ? { day: day, slots: sl } : null; };
        if (w.days) return w.days.map(function (d) { var n = D.read(d.date); return n != null && n >= today ? live(n, d.slots) : null; }).filter(Boolean);
        var skip = D.on(wk.skip || []);
        for (var n = today + (wk.from == null ? 1 : wk.from); out.length < (wk.ahead || 5) && n < today + 60; n++) { var sl = wk.week[D.parts(n).w], d = sl && sl.length && !skip(n) ? live(n, sl) : null; if (d) out.push(d); }
        return out;
      };
      o.say = function (sel, ctx) {
        var sc = { v: sel, items: {}, money: String, lang: w.lang || ctx.lang, sep: w.sep, h12: w.h12 }, f = {};
        Object.keys(w.say.fields || {}).forEach(function (k) { f[k] = tpl(w.say.fields[k], sc); });
        return [tpl(w.say.text, sc), f];
      };
      K.slots(name, o);
    },
    confirm: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'form', 'allowDup']), src = cfg.widgets[w.form] || {};
      // what the form or the booking sent: its state, plus {text} for the sentence. Dates are written in the language of this tag
      var sc = function (l, ctx) { return { v: merge(l.state, { text: l.text }), items: FORMS[w.form + '|' + lang] || {}, money: String, lang: w.lang || (ctx && ctx.lang) || cfg.defaultLang || 'en', sep: src.sep, h12: src.h12 }; };
      var T = function (t) { return function (l, ctx) { return tpl(t, sc(l, ctx)); }; };
      o.title = T(w.title); if (w.status != null) o.status = T(w.status); if (w.note != null) o.note = T(w.note);
      if (w.rows) o.rows = function (l, ctx) { var c = sc(l, ctx); return w.rows.map(function (r) { return [tpl(r[0], c), tpl(r[1], c)]; }); };
      if (w.steps) o.steps = function (l, ctx) { var c = sc(l, ctx); return w.steps.map(function (x) { return tpl(x, c); }); };
      if (w.actions) o.actions = function (l) { return actions(cfg, w.actions, l.text); };
      K.confirm(name, o);
    },
    review: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'collapse', 'allowDup']), N = numbers(w), items = {}, d = reply(cfg, w.discard);
      var sc = function (s, nb) { var c = N.scope(s, nb); c.items = items; return c; };
      var V = function (t) { return function (s) { var c = sc(s); if (!c.ok) LBW.drop('setup: ' + name + ': a compute line is not a number'); return c.ok ? tpl(t, c) : ''; }; };   // such a line stays empty
      o.state = N.state;
      o.ready = function (s) { return sc(s).ok || w.cta; };   // a quote that isn't a number can't be confirmed
      o.lines = w.lines.map(function (ln) { if (ln.select == null) return { label: ln.label, value: V(ln.value) }; items[ln.select] = ln.items; return { label: ln.label, select: { key: ln.select, items: ln.items } }; });
      if (w.total) o.total = { label: w.total.label, value: V(w.total.value) };
      if (d) o.discard = d;
      o.send = function (s) { var c = sc(s, false), f = {}; if (!c.ok) return null; Object.keys(w.send.fields || {}).forEach(function (k) { f[k] = tpl(w.send.fields[k], c); }); return [tpl(w.send.text, c), f]; };
      K.review(name, o);
    },
    chart: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'sub', 'note', 'allowDup']), N = numbers(w), y = w.y || {};
      var fns = w.series.map(function (se) { return se.values ? null : compile(se.value); }), at = w.mark && typeof w.mark.at === 'string' ? compile(w.mark.at) : null;
      o.data = function (p) {
        var base = N.scope(N.state(p)), xs = [], bad = !base.ok, i;
        if (isArr(w.x)) w.x.forEach(function (lab, k) { xs.push([k, String(lab)]); });
        else for (i = w.x.from; i <= w.x.to && xs.length < 60; i += w.x.step > 0 ? w.x.step : 1) xs.push([i, tpl(w.x.label || '{i}', plain({ i: i }))]);
        var series = w.series.map(function (se, k) {
          var vs = se.values ? se.values.slice() : xs.map(function (x) { return fns[k](merge(base.v, { i: x[0] })); });
          if (vs.length !== xs.length || !vs.every(function (n) { return typeof n === 'number' && isFinite(n); })) bad = true;
          return { label: se.label, values: vs };
        });
        if (bad || !xs.length) { LBW.drop('setup: ' + name + ': the chart has a value that is not a number'); return null; }   // nothing is better than a wrong picture
        var spec = { type: w.kind || 'line', x: xs.map(function (x) { return x[1]; }), series: series, height: w.height, summary: tpl(w.summary, base),
          y: { ticks: y.ticks, format: function (v) { return y.money ? H.money(v, w.money) : (Math.round(v * 100) / 100) + (y.suffix || ''); } } };
        if (w.mark) { var m = at ? Math.round(at(base.v)) : w.mark.at; if (isFinite(m)) spec.mark = { at: m, label: w.mark.label }; }
        return spec;
      };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.chart(name, o);
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
    calc: 'type cls lang kicker title cta state controls tables compute money result send notes links allowDup collapse',
    stats: 'type cls lang allowDup items item reply links',
    people: 'type cls lang kicker title note allowDup items filter reply',
    consent: 'type cls lang icon title text yes no link allowDup',
    slots: 'type cls lang kicker title cta note sep h12 collapse allowDup ics days weekly say',
    confirm: 'type cls lang allowDup form status title rows steps note actions',
    review: 'type cls lang kicker title cta note collapse allowDup state tables compute money lines total discard send',
    chart: 'type cls lang kicker title sub note links allowDup kind height state tables compute money x series y mark summary'
  };
  var ITEM = { cards: 'kicker title who line points pointsCls pointsTitle rows note noteCls link'.split(' '), stats: 'kicker title stats source'.split(' '), people: 'name role img note'.split(' '),
    slide: 'id img badge kicker name sub price save status desc reply link gallery until'.split(' ') };
  var NEED = { cards: [], form: ['steps', 'summary', 'cta'], contact: ['title'], chips: ['items'], carousel: ['items'], calc: ['state', 'controls', 'result', 'send', 'cta'],
    stats: [], people: ['items'], consent: ['title', 'yes', 'no'], slots: ['cta', 'say'], confirm: ['form', 'title'], review: ['state', 'lines', 'send', 'cta'], chart: ['title', 'x', 'series'] };
  // ── languages: a text may be an object of texts by language ──────────────────────────────────────
  // { "en": "Hours", "es": "Horario" }: every key a language of `langs`, every value a text or a list. Objects that are
  // maps by a name of yours are never read that way, whatever their keys: actions, replies, widgets, titles, fields, own,
  // carriedBy, tables, state, compute, map, week, and `items` in the types that keep items by id.
  var MAPS = { actions: 1, replies: 1, widgets: 1, own: 1, carriedBy: 1, titles: 1, tables: 1, fields: 1, state: 1, compute: 1, map: 1, week: 1 };
  var BYID = { cards: 1, stats: 1, people: 1, chips: 1 }, CODE = /^[a-z]{2,3}$/;
  function langsOf(cfg) { return isObj(cfg) && isArr(cfg.langs) && cfg.langs.length && cfg.langs.every(isStr) ? cfg.langs : [isObj(cfg) && isStr(cfg.defaultLang) ? cfg.defaultLang : 'en']; }
  function dfltOf(cfg, langs) { return isObj(cfg) && isStr(cfg.defaultLang) && langs.indexOf(cfg.defaultLang) >= 0 ? cfg.defaultLang : langs[0]; }
  function isText(v) { return typeof v === 'string' || isArr(v); }
  // the copy of x for one language. L = { lang, langs, dflt }; rep collects [path, problem] when given (check)
  function loc(x, L, path, asMap, rep) {
    if (isArr(x)) { var fieldsAt = /\.(yes|no)$/.test(path) ? 2 : -1; return x.map(function (y, i) { return loc(y, L, path + '[' + i + ']', i === fieldsAt, rep); }); }
    if (!isObj(x)) return x;
    var ks = Object.keys(x);
    if (!asMap && ks.length && ks.every(function (k) { return /^[a-z]{2}(-[a-z]{2})?$/i.test(k); }) && ks.some(function (k) { return L.langs.indexOf(k) >= 0; })) {
      var out = ks.filter(function (k) { return L.langs.indexOf(k) < 0; });
      if (out.length && ks.every(function (k) { return isText(x[k]); })) { if (rep) rep.push([path, 'has texts for "' + out.join('", "') + '", not in "langs"', 1]); return x; }
      if (!out.length && !ks.every(function (k) { return isText(x[k]); })) { if (rep && ks.every(function (k) { return !isObj(x[k]); })) rep.push([path, 'is by language but holds something that is not a text: only texts and lists can be by language']); }
      else if (!out.length) {
        if (rep && !own(x, L.dflt)) rep.push([path, 'has no text in the default language ("' + L.dflt + '")']);
        if (rep) {   // lists of [key, label] by language must hold the same keys, or a pick made in one language has no label in another
          var sig = function (v) { return isArr(v) && v.length && v.every(isArr) ? v.map(function (q) { return q[0]; }).join('\u0001') : null; }, first = sig(x[ks[0]]);
          if (first != null && ks.some(function (k) { return sig(x[k]) !== first; })) rep.push([path, 'has different keys in each language: the first item of every pair must be the same in all of them']);
        }
        return loc(own(x, L.lang) ? x[L.lang] : own(x, L.dflt) ? x[L.dflt] : x[ks[0]], L, path, false, null);
      }
    }
    var r = {}, byId = own(x, 'type') && own(BYID, x.type);
    ks.forEach(function (k) {
      if (k === '__proto__') return;
      if (!path && (k === 'labels' || k === 'langs')) { r[k] = x[k]; return; }
      r[k] = loc(x[k], L, path ? path + '.' + k : k, own(MAPS, k) || (k === 'items' && byId), rep);
    });
    return r;
  }
  // check every language's copy; a problem that every language has is reported once, the others with their language
  function check(cfg) {
    if (!isObj(cfg)) return check1(cfg);
    if (cfg.langs != null && langsOf({ langs: cfg.langs }) !== cfg.langs) return check1(cfg);
    var langs = langsOf(cfg), dflt = dfltOf(cfg, langs), seen = {}, out = [], rep = [], stray = false;
    var top = function (m) { out.push({ widget: null, message: m }); };
    langs.forEach(function (l) { if (!CODE.test(l)) top('language "' + l + '" must be a lower-case code such as es or ca (a tag\'s lang is read lower-cased; regions such as pt-BR are not supported)'); });
    if (isStr(cfg.defaultLang) && langs.indexOf(cfg.defaultLang) < 0) top('defaultLang "' + cfg.defaultLang + '" is not in "langs"');
    loc(cfg, { lang: dflt, langs: langs, dflt: dflt }, '', false, rep);
    rep.forEach(function (r) {
      var m = /^widgets\.([^.\[]+)\.?(.*)$/.exec(r[0]), w = m ? m[1] : null;
      out.push({ widget: w, message: (w ? w + ': ' + m[2] : r[0]) + ' ' + r[1] }); if (r[2]) stray = true;
    });
    if (stray) return out;   // fix the languages first: the rest would only repeat it in vaguer words
    var per = langs.map(function (l) { return check1(loc(cfg, { lang: l, langs: langs, dflt: dflt }, '', false, null)); });
    per.forEach(function (errs, i) { errs.forEach(function (e) {
      var all = per.every(function (o) { return o.some(function (x) { return x.message === e.message; }); }), key = (all ? '' : langs[i] + ' ') + e.message;
      if (seen[key]) return; seen[key] = 1;
      out.push({ widget: e.widget, message: all || langs.length < 2 ? e.message : '[' + langs[i] + '] ' + e.message });
    }); });
    return out;
  }
  function check1(cfg) {
    var errs = [], top = function (m) { errs.push({ widget: null, message: m }); };
    if (!isObj(cfg)) { top('the config is not an object'); return errs; }
    Object.keys(cfg).forEach(function (k) { if (TOP.indexOf(k) < 0) top('unknown key "' + k + '". Known: ' + TOP.join(', ')); });
    if (!/^[a-z][a-z0-9_]*$/i.test(cfg.prefix || '')) top('"prefix" is missing or not a plain word');
    var links = isArr(cfg.links) ? cfg.links.filter(isStr) : [];
    if (cfg.links != null && !isArr(cfg.links)) top('"links" must be a list');
    links.forEach(function (l) { if (/^https?:/.test(l) && !/\/$/.test(l)) top('link "' + l + '" must end in "/"'); });
    var linkOK = function (url) { return isStr(url) && !/[\s"'<>]/.test(url) && links.some(function (o) { return /^https?:/.test(o) && url.indexOf(/\/$/.test(o) ? o : o + '/') === 0; }); };
    ['actions', 'replies'].forEach(function (k) { if (cfg[k] != null && !isObj(cfg[k])) top('"' + k + '" must be an object'); });
    if (cfg.timeZone != null) { try { new Intl.DateTimeFormat('en', { timeZone: cfg.timeZone }); } catch (e) { top('timeZone "' + cfg.timeZone + '" is not a time zone (write it like Europe/Madrid)'); } }
    ['langs', 'defaultLang'].forEach(function (k) { var v = cfg[k]; if (v != null && !(k === 'langs' ? isArr(v) && v.length && v.every(isStr) : isStr(v))) top('"' + k + '" must be ' + (k === 'langs' ? 'a list of language codes' : 'a language code')); });
    var acts = isObj(cfg.actions) ? cfg.actions : {}, reps = isObj(cfg.replies) ? cfg.replies : {};

    // an action, by name or written out: one kind, a label, and a link the allow-list lets through
    function act(a, say, where) {
      var use = typeof a === 'string' ? a : isObj(a) ? a.use : null;
      if (use != null && !own(acts, use)) { say(where + ': action "' + use + '" is not in "actions"'); return; }
      var r = resolve({ actions: acts }, a); if (!r) { say(where + ': an action is a name or an object'); return; }
      var kinds = ['tel', 'wa', 'link', 'reply', 'mail'].filter(function (k) { return r[k] != null; });
      if (kinds.length !== 1) { say(where + ': an action needs one of tel, wa, link, reply, mail'); return; }
      if (r.reply) { if (!isPair(r.reply)) say(where + ': "reply" is [label, sentence]'); return; }
      if (!isStr(r.label)) say(where + ': the action has no "label"');
      if (r.tel && links.indexOf('tel:') < 0) say(where + ': a tel action needs "tel:" in "links"');
      if (r.wa && !linkOK('https://wa.me/')) say(where + ': a wa action needs "https://wa.me/" in "links"');
      if (r.link && !linkOK(r.link)) say(where + ': "' + r.link + '" is not under any entry of "links"');
      if (r.mail && links.indexOf('mailto:') < 0) say(where + ': a mail action needs "mailto:" in "links"');
      if (r.mail && !(typeof r.mail === 'string' && /^[^@\s?\/,;]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(r.mail))) say(where + ': "mail" is one plain address (a@b.co), with no subject or text');
    }
    Object.keys(acts).forEach(function (k) { act(acts[k], top, 'actions.' + k); });
    Object.keys(reps).forEach(function (k) { if (!isPair(reps[k])) top('replies.' + k + ' is [label, sentence]'); });
    if (!isObj(cfg.widgets)) { top('"widgets" is missing'); return errs; }

    Object.keys(cfg.widgets).forEach(function (name) {
      var w = cfg.widgets[name], err = function (m) { errs.push({ widget: name, message: name + ': ' + m }); };
      // every { } in a text: a known key, known modifiers, and a modifier that fits the key
      function text(t, where, keys, labels, money, dates, times) {
        labels = labels || []; money = money || []; dates = dates || []; times = times || [];
        if (t == null) return; if (typeof t !== 'string') { err(where + ' must be text'); return; }
        t.replace(HOLE, function (m, body) {
          var x = SLOT.exec(body); if (!x) { err(where + ': "' + m + '" is not a placeholder ({key}, with :label :labels :lower :money :date :dmy :time)'); return m; }
          if (keys.indexOf(x[1]) < 0) { err(where + ': "{' + x[1] + '}" is not a value here. Known: ' + (keys.join(', ') || 'none')); return m; }
          if ((x[2].match(/:(label|labels|money|date|dmy|time)\b/g) || []).length > 1) { err(where + ': "' + m + '" has two formats: one of :label :labels :money :date :dmy :time (then :lower if wanted)'); return m; }
          if (dates.indexOf(x[1]) >= 0 && !/:(date|dmy)\b/.test(x[2])) err(where + ': "' + m + '" is a day: write {' + x[1] + ':date} or {' + x[1] + ':dmy}');
          if (times.indexOf(x[1]) >= 0 && !/:time\b/.test(x[2])) err(where + ': "' + m + '" is a time: write {' + x[1] + ':time}');
          if (/:labels?\b/.test(x[2]) && labels.indexOf(x[1]) < 0) err(where + ': "' + m + '" asks for a label, and "' + x[1] + '" is not a pick');
          if (/:money\b/.test(x[2]) && money.indexOf(x[1]) < 0) err(where + ': "' + m + '" formats money, and "' + x[1] + '" is not a number');
          if (/:(date|dmy)\b/.test(x[2]) && dates.indexOf(x[1]) < 0) err(where + ': "' + m + '" formats a day, and "' + x[1] + '" is not one');
          if (/:time\b/.test(x[2]) && times.indexOf(x[1]) < 0) err(where + ': "' + m + '" formats a time, and "' + x[1] + '" is not one');
          return m;
        });
        if (/[{}]/.test(t.replace(HOLE, ''))) err(where + ': a stray "{" or "}"');
      }
      // options that are shown as text: an object or a list there would print as "[object Object]"
      function strs(o, keys, where) { if (isObj(o)) keys.forEach(function (k) { if (o[k] != null && typeof o[k] !== 'string') err((where ? where + '.' : '') + k + ' must be text'); }); }
      // an item's own keys: a misspelt or misplaced one would be dropped in silence and its button or line never drawn
      function only(o, known, where) { Object.keys(o).forEach(function (k) { if (known.indexOf(k) < 0) err(where + ': unknown key "' + k + '"' + (k === 'links' || k === 'buttons' ? ' (buttons go on the widget; an item has one "link": [label, url])' : '') + '. Known: ' + known.join(', ')); }); }
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
        ['links', 'buttons', 'buttonsWithSummary', 'actions'].forEach(function (k) { list(w[k], k, function (a, at) { act(a, err, at); }); });
        rep(w.reply, 'reply');
        strs(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'text', 'big', 'sub', 'disclaimer', 'lead'], '');
        if (w.item != null && !isObj(w.item)) err('"item" must be an object');

        if (w.type === 'cards') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var cs = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(cs).forEach(function (id) { var it = cs[id]; if (!isObj(it) || !isStr(it.title)) { err('card "' + id + '" has no "title"'); return; } strs(it, ['kicker', 'who', 'line', 'note', 'pointsTitle'], id); only(it, ITEM.cards, id); url(it.link, id + '.link'); pairs(it.rows, id + '.rows'); list(it.points, id + '.points', function (x, at) { if (!isStr(x)) err(at + ' must be text'); }); });
          param(w.param, 'param'); if (w.fallback != null && !own(cs, w.fallback)) err('fallback "' + w.fallback + '" is not one of the items');
          var r = reply({ replies: reps }, w.reply); if (isPair(r)) { text(r[0], 'reply', ['id', 'title'], [], []); text(r[1], 'reply', ['id', 'title'], [], []); }
        }

        if (w.type === 'form') {
          var keys = [], picks = [];
          list(w.steps, 'steps', function (st, at) {
            if (!isObj(st)) { err(at + ' must be an object'); return; }
            if (!isStr(st.key)) { err('step ' + keys.length + ' has no "key"'); return; }
            if (st.key === 'text') err('a step can\'t be called "text": {text} is the sentence the form sends');
            strs(st, ['title', 'ask'], st.key);
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
          if (w.max != null && !(Number.isInteger(w.max) && w.max >= 1)) err('"max" must be a whole number, 1 or more');
          if (w.own != null && !isObj(w.own)) err('"own" must be an object');
          if (w.carriedBy != null && !isObj(w.carriedBy)) err('"carriedBy" must be an object'); else Object.keys(w.carriedBy || {}).forEach(function (k) { if (!isArr(w.carriedBy[k])) err('carriedBy.' + k + ' must be a list of widget names'); });
        }

        if (w.type === 'carousel') {
          var n = list(w.items, 'items', function (it, at) { if (!isObj(it) || !isStr(it.name)) { err(at + ' has no "name"'); return; } only(it, ITEM.slide.concat(isObj(w.filter) && isStr(w.filter.by) ? [w.filter.by] : []), at); strs(it, ['kicker', 'sub', 'desc', 'badge', 'save'], at); url(it.link, at + '.link'); if (it.until != null && LBW.day.read(it.until) == null) err(at + '.until is a date, D/M/YYYY'); if (it.until != null && !isStr(cfg.timeZone)) err(at + '.until needs "timeZone" in the config (the day ends where the client is, not where the visitor is)'); if (it.img != null && !(isObj(it.img) && linkOK(it.img.src))) err(at + '.img.src is not under any entry of "links"'); rep(it.reply, at + '.reply'); }).length;
          if (isArr(w.items) && !n) err('"items" is empty');
          if (w.filter != null) { if (!isObj(w.filter) || !isStr(w.filter.by)) err('filter is { "by": a key of the items, "param": the tag key }'); else param(w.filter.param || w.filter.by, 'filter.param'); }
          if (w.titles != null && !isObj(w.titles)) err('"titles" must be an object');
        }

        if (w.type === 'calc' || w.type === 'review' || w.type === 'chart') {
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
          if (w.type === 'review') list(w.lines, 'lines', function (ln, at) {
            if (!isObj(ln) || !isStr(ln.label)) { err(at + ' has no "label"'); return; }
            if (ln.select == null) return;
            var d = own(st, ln.select) ? st[ln.select] : null; if (!isObj(d) || !isArr(d.values)) { err(at + ': select "' + ln.select + '" needs state.' + ln.select + '.values'); return; }
            pairs(ln.items, at + '.items'); if (!isArr(ln.items)) { err(at + ' has no "items"'); return; }
            var have = ln.items.map(function (x) { return isArr(x) ? x[0] : null; });
            d.values.forEach(function (v) { if (have.indexOf(v) < 0) err(at + '.items has no entry for "' + v + '"'); }); have.forEach(function (v) { if (v != null && d.values.indexOf(v) < 0) err(at + '.items has "' + v + '", which is not in state.' + ln.select + '.values'); });
            pickKeys.push(ln.select);
          });
          // an expression outside compute (a chart's series or mark): the same rules, plus the names in `more`
          var formula = function (src, where, more) {
            var f; try { f = compile(src); } catch (e) { err(where + ': ' + e.message); return; }
            f.names.forEach(function (x) { if (more.indexOf(x) >= 0) return; if (vals.indexOf(x) < 0) err(where + ': "' + x + '" is ' + (own(tb, x) ? 'a table: write ' + x + '[key]' : 'not in state or compute')); else if (nums.indexOf(x) < 0) err(where + ': "' + x + '" is a pick, not a number: use it as table[' + x + ']'); });
            f.tables.forEach(function (x) { if (!own(tb, x)) err(where + ': "' + x + '" is not in "tables"'); });
            f.lookups.forEach(function (l) { var d = own(st, l[1]) ? st[l[1]] : null; if (vals.indexOf(l[1]) < 0) err(where + ': "' + l[1] + '" is not in state or compute'); if (isObj(tb[l[0]]) && isObj(d) && isArr(d.values)) d.values.forEach(function (v) { if (!own(tb[l[0]], v)) err('tables.' + l[0] + ' has no "' + v + '" (a value of state.' + l[1] + ')'); }); });
          };
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
          if (w.type === 'review') {
            list(w.lines, 'lines', function (ln, at) { if (isObj(ln) && ln.select == null) { if (!isStr(ln.value)) err(at + ' needs "value" (a text) or "select" (a state key)'); else T(ln.value, at + '.value'); } });
            if (isArr(w.lines) && !w.lines.length) err('"lines" is empty');
            if (w.total != null) { if (!isObj(w.total) || !isStr(w.total.label) || !isStr(w.total.value)) err('total is { "label", "value" }'); else T(w.total.value, 'total.value'); }
            rep(w.discard, 'discard');
          }
          if (w.type === 'chart') {
            if (w.kind != null && ['line', 'area', 'bar'].indexOf(w.kind) < 0) err('"kind" is line, area or bar');
            var points = null;
            if (isArr(w.x)) { points = w.x.length; if (!points) err('"x" is empty'); if (!w.x.every(function (l) { return isStr(l) || typeof l === 'number'; })) err('"x" is a list of labels (text or numbers)'); }
            else if (isObj(w.x)) { var xs = w.x.step == null ? 1 : w.x.step; if (!Number.isInteger(w.x.from) || !Number.isInteger(w.x.to) || !Number.isInteger(xs) || xs < 1 || w.x.from > w.x.to) err('x is a list of labels or { "from", "to", "step", "label" } in whole numbers, step 1 or more'); else { points = Math.floor((w.x.to - w.x.from) / xs) + 1; if (points > 60) err('x has ' + points + ' points: 60 at most'); } text(w.x.label, 'x.label', ['i']); }
            else if (w.x != null) err('x is a list of labels or { "from", "to", "step", "label" }');
            var ns = list(w.series, 'series', function (se, at) {
              if (!isObj(se) || !isStr(se.label)) { err(at + ' has no "label"'); return; }
              if ((se.value == null) === (se.values == null)) { err(at + ' needs "value" (a formula of i) or "values" (numbers)'); return; }
              if (se.values != null) { if (!isArr(se.values) || !se.values.every(function (n) { return typeof n === 'number' && isFinite(n); })) err(at + '.values must be numbers'); else if (points != null && se.values.length !== points) err(at + '.values has ' + se.values.length + ' numbers for ' + points + ' points of x'); }
              else if (!isStr(se.value)) err(at + '.value must be a formula'); else formula(se.value, at + '.value', ['i']);
            }).length;
            if (isArr(w.series) && (ns < 1 || ns > 2)) err('"series" holds one or two series');
            if (w.y != null && !isObj(w.y)) err('"y" must be an object'); else if (isObj(w.y)) { if (w.y.ticks != null && !(Number.isInteger(w.y.ticks) && w.y.ticks >= 1 && w.y.ticks <= 10)) err('y.ticks is a whole number from 1 to 10'); strs(w.y, ['suffix'], 'y'); }
            if (w.height != null && !(typeof w.height === 'number' && w.height >= 100 && w.height <= 400)) err('"height" is a number from 100 to 400');
            if (w.mark != null) { if (!isObj(w.mark) || w.mark.at == null) err('mark is { "at": a point of x (a number or a formula), "label" }'); else if (typeof w.mark.at === 'string') formula(w.mark.at, 'mark.at', []); else if (!Number.isInteger(w.mark.at) || w.mark.at < 0 || (points != null && w.mark.at >= points)) err('mark.at is the position of a point of x, from 0' + (points != null ? ' to ' + (points - 1) : '') + ' (or a formula that gives it)'); strs(w.mark, ['label'], 'mark'); }
            T(w.summary, 'summary');
            ['title', 'sub', 'note'].forEach(function (k) { if (w[k] != null && typeof w[k] !== 'string') err('"' + k + '" must be text'); });
          }
        }

        if (w.type === 'stats') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var ss = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(ss).forEach(function (id) { var it = ss[id]; if (!isObj(it)) { err('"' + id + '" must be an object'); return; } strs(it, ['kicker', 'title', 'source'], id); only(it, ITEM.stats, id); pairs(it.stats, id + '.stats'); if (!isArr(it.stats) || it.stats.length < 2 || it.stats.length > 4) err(id + '.stats holds 2 to 4 [value, label]'); if (!isStr(it.source)) err(id + ' has no "source": say where and when the numbers were read'); });
          var sr = reply({ replies: reps }, w.reply); if (isPair(sr)) { text(sr[0], 'reply', ['id', 'title']); text(sr[1], 'reply', ['id', 'title']); }
        }

        if (w.type === 'people') {
          if (!isObj(w.items) || !Object.keys(w.items).length) err('"items" must be an object of people by id');
          else Object.keys(w.items).forEach(function (id) { var x = w.items[id]; if (!isObj(x) || !isStr(x.name) || !isStr(x.role)) { err('"' + id + '" needs "name" and "role"'); return; } strs(x, ['note'], id); only(x, ITEM.people, id); if (x.img != null && !linkOK(x.img)) err(id + '.img is not under any entry of "links"'); });
          if (w.filter != null) { if (!isObj(w.filter) || !isStr(w.filter.param)) err('filter is { "param": the tag key that lists ids }'); else param(w.filter.param, 'filter.param'); }
          if (isObj(w.items) && Object.keys(w.items).length > 4 && w.filter == null) err('a people card shows 4 at most: add "filter": { "param": "who" } so the tag picks them');
          var pr = reply({ replies: reps }, w.reply); if (isPair(pr)) { text(pr[0], 'reply', ['id', 'name', 'role']); text(pr[1], 'reply', ['id', 'name', 'role']); }
        }

        if (w.type === 'consent') {
          if (!isStr(w.title)) err('"title" must be text');
          ['yes', 'no'].forEach(function (k) { var a = w[k]; if (a == null) return; if (!isPair(a)) err('"' + k + '" is [label, sentence, { field: value }]'); else if (a[2] != null && !isObj(a[2])) err(k + '[2] must be an object of fields'); });
          if (w.icon != null && ['check', 'bell', 'shield'].indexOf(w.icon) < 0) err('"icon" is check, bell or shield');
          url(w.link, 'link');
        }

        if (w.type === 'slots') {
          var slot = function (x, at) { var a = isArr(x) ? timeOf(x[0]) : null, b = isArr(x) ? timeOf(x[1]) : null; if (a == null || b == null || a >= b || a < 0 || b > 1440 || a % 5 || b % 5) err(at + ' is [from, to] as "HH:MM" or minutes since midnight in steps of 5 (9:00 is 540), from before to'); else if (x[2] != null && x[2] !== 'busy') err(at + '[2] can only be "busy"'); };
          if ((w.days == null) === (w.weekly == null)) err('give "days" (fixed dates) or "weekly" (a week of slots), one of them');
          list(w.days, 'days', function (d, at) { if (!isObj(d) || LBW.day.read(d.date) == null) { err(at + '.date is D/M/YYYY'); return; } if (!isArr(d.slots) || !d.slots.length) err(at + ' has no "slots"'); else list(d.slots, at + '.slots', slot); });
          if (w.weekly != null) {
            if (!isObj(w.weekly) || !isObj(w.weekly.week) || !Object.keys(w.weekly.week).length) err('weekly needs "week": { "1": [["09:00", "10:00"]], … } (0 = Sunday)');
            else { Object.keys(w.weekly.week).forEach(function (k) { if (!/^[0-6]$/.test(k)) err('weekly.week.' + k + ': days are 0 (Sunday) to 6'); else list(w.weekly.week[k], 'weekly.week.' + k, slot); });
              list(w.weekly.skip, 'weekly.skip', function (x, at) { if (!/^\d{1,2}\/\d{1,2}(\/20\d\d)?$/.test(String(x))) err(at + ' is D/M or D/M/YYYY'); });
              if (w.weekly.ahead != null && !(Number.isInteger(w.weekly.ahead) && w.weekly.ahead >= 1 && w.weekly.ahead <= 5)) err('weekly.ahead is a whole number from 1 to 5 (the days offered)');
              if (w.weekly.from != null && !(Number.isInteger(w.weekly.from) && w.weekly.from >= 0)) err('weekly.from is a whole number of days from today (0 = today, 1 = tomorrow)'); }
          }
          if (!isObj(w.say) || !isStr(w.say.text)) err('say.text is missing');
          else { var SK = ['day', 'from', 'to'], S = function (t, where) { text(t, where, SK, [], [], ['day'], ['from', 'to']); }; S(w.say.text, 'say.text');
            if (w.say.fields != null && !isObj(w.say.fields)) err('say.fields must be an object'); else Object.keys(w.say.fields || {}).forEach(function (k) { S(w.say.fields[k], 'say.fields.' + k); }); }
          if (w.ics != null && (!isObj(w.ics) || !isStr(w.ics.title))) err('ics needs a "title"'); else strs(w.ics, ['where', 'label', 'file'], 'ics');
          if (w.sep != null && typeof w.sep !== 'string') err('"sep" must be text');
        }

        if (w.type === 'confirm') {
          var sw = isStr(w.form) && own(cfg.widgets, w.form) ? cfg.widgets[w.form] : null, kind = isObj(sw) ? sw.type : null;
          if (kind !== 'form' && kind !== 'slots') err('form "' + w.form + '" is not a form or a slots widget (the two that keep what they sent)');
          else {
            var ck = kind === 'slots' ? ['day', 'from', 'to'] : (isArr(sw.steps) ? sw.steps : []).map(function (x) { return isObj(x) ? x.key : null; }).filter(isStr);
            var C = function (t, where) { text(t, where, ck.concat(['text']), kind === 'form' ? ck : [], [], kind === 'slots' ? ['day'] : [], kind === 'slots' ? ['from', 'to'] : []); };
            if (!isStr(w.title)) err('"title" must be text'); else C(w.title, 'title');
            C(w.status, 'status'); C(w.note, 'note');
            list(w.rows, 'rows', function (x, at) { if (!isPair(x)) err(at + ' is [label, value]'); else { C(x[0], at); C(x[1], at); } });
            list(w.steps, 'steps', function (x, at) { if (!isStr(x)) err(at + ' must be text'); else C(x, at); });
            list(w.actions, 'actions', function (a, at) { var x = resolve({ actions: acts }, a); if (x) text(x.text, at + '.text', ['text']); });
          }
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
    var langs = langsOf(cfg), dflt = dfltOf(cfg, langs);
    LBW.init(merge(pick(cfg, ['prefix', 'langs', 'timeZone', 'maxPerMessage', 'links', 'labels', 'quietMs', 'maxWaitMs']), { langs: langs, defaultLang: dflt }));   // the runtime's default must be the config's
    Object.keys(cfg.widgets).forEach(function (name) {
      if (bad.indexOf(name) >= 0) return;
      // a text may be { en: …, es: … }: the maker runs once per language on a copy with that language's texts, and the
      // widget registered under `name` picks the one for the tag's lang
      var fns = {}, opts, cur, real = LBW.widget;
      try {
        LBW.widget = function (n, fn, o) { fns[cur] = fn; opts = o || opts; return LBW; };
        try { langs.forEach(function (l) { cur = l; var c = loc(cfg, { lang: l, langs: langs, dflt: dflt }, '', false, null); MAKE[c.widgets[name].type](c, name, c.widgets[name], l); }); }
        finally { LBW.widget = real; }
        var fixed = cfg.widgets[name].lang;   // a widget with its own `lang` always speaks it
        LBW.widget(name, function (p, ctx) { return (fns[isStr(fixed) && own(fns, fixed) ? fixed : ctx.lang] || fns[dflt])(p, ctx); }, opts);
        made.push(name);
      } catch (e) { root.__kitSetupErrors.push(name + ': ' + e.message); LBW.drop('setup: ' + name + ': ' + e.message); }
    });
    return { ok: !root.__kitSetupErrors.length, errors: root.__kitSetupErrors, widgets: made };
  }
  setup.check = function (cfg) { return check(cfg).map(function (e) { return e.message; }); };
  setup.types = Object.keys(KEYS);
  K.setup = setup;
})(typeof window !== 'undefined' ? window : this);
