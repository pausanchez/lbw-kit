/* kit/setup.js · the declarative layer: a bot's widgets from one JSON object, no JavaScript to write.
   Load it after lbw.js and kit.js (the lbw-kit bundle has it):  <script>LBW.kit.setup({ …config… })</script>

   config = { prefix, langs, defaultLang, timeZone, maxPerMessage, links: ['https://shop.example/', 'tel:'],
              actions: { name: action },        buttons named once, used by name in any widget
              replies: { name: [label, say] },  quick replies named once
              widgets: { tagName: { type: one of the kit makers, … } } }   (LBW.kit.setup.types lists them)
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
    chips: function (cfg, name, w, lang) { K.chips(name, pick(w, ['cls', 'lang', 'max', 'crowd', 'items', 'own', 'carriedBy'])); },
    carousel: function (cfg, name, w, lang) {
      var by = w.filter && w.filter.by, param = (w.filter && w.filter.param) || by, vals = (w.filter && w.filter.values) ? w.filter.values.slice() : [], src = w.source;
      if (by) (w.items || []).forEach(function (r) { if (r[by] != null && vals.indexOf(r[by]) < 0) vals.push(r[by]); });
      // v0.7.6 · "source": the slides come from a CSV or a JSON read live in the browser (a published Google Sheet, a public
      // API with CORS); "items" is then the snapshot shown when the source can't be read. Every cell is text, cut at 300
      // characters; a row with a bad or repeated id, or with no name, is skipped; a URL outside "links" draws no link or photo.
      // A map never fills "reply": a cell must not become a sentence the visitor sends to the agent.
      var load = src && function () { var o = { maxAge: src.maxAge }; return src.csv ? LBW.csv(src.csv, o) : LBW.json(src.json, o); };
      var memo = null;   // the rows of the last answer read: one pass, and one log line per skipped row, per fetch
      function live(data) {   // throws when the answer isn't the list (a sign-in page, an error object): the saved items are drawn then
        if (memo && memo.data === data) return memo.rows;
        var rows = src.json && src.path ? String(src.path).split('.').reduce(function (o, k) { return o != null && typeof o === 'object' && own(o, k) ? o[k] : null; }, data) : data;
        var seen = Object.create(null), out = [], idCol = src.id || 'id';
        if (!Array.isArray(rows)) throw new Error('the source did not answer a list');
        if (!rows.length) throw new Error('the source has no rows');   // an emptied sheet or a page that isn't the file: can't tell them apart
        // a JSON key may be dotted ("title.rendered", as WordPress nests it); every step is an own property
        var raw = function (r, k) { var v = String(k).split('.').reduce(function (o, j) { return o != null && typeof o === 'object' && own(o, j) ? o[j] : null; }, r); return v == null || typeof v === 'object' ? '' : String(v).trim(); };
        var cut = function (v) { return v.length > 300 ? Array.from(v).slice(0, 300).join('') : v; };
        // {column|text}: the cell is HTML (a WordPress title). Read as text in an inert document (nothing runs or loads), with
        // script and style left out and a space where a block or a <br> ends; decoded first, cut after.
        var text = function (v) {
          var d = new DOMParser().parseFromString(v.slice(0, 20000), 'text/html');
          [].forEach.call(d.querySelectorAll('script,style,template,noscript'), function (n) { n.remove(); });
          [].forEach.call(d.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,tr,td'), function (n) { n.insertAdjacentText(n.tagName === 'BR' ? 'beforebegin' : 'afterend', ' '); });
          return (d.body ? d.body.textContent : '').replace(/\s+/g, ' ').trim();
        };
        if (!rows.some(function (r) { return r && typeof r === 'object' && raw(r, idCol) !== ''; })) throw new Error('the source has no "' + idCol + '" column');
        rows.slice(0, src.max || 2000).forEach(function (r) {
          if (!r || typeof r !== 'object') return;
          var get = function (k, t) { var v = (lang && k.indexOf('.') < 0 && raw(r, k + '_' + lang)) || raw(r, k); return cut(t && v ? text(v) : v); };
          var id = cut(raw(r, idCol)); if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) || seen[id]) { LBW.drop(name + ': source row skipped (id "' + id.slice(0, 40) + '")'); return; }
          var it = { id: id };
          Object.keys(src.map).forEach(function (k) {
            var gap = false, put = function (x) {
              if (typeof x === 'string') return x.replace(/\{([A-Za-z0-9_.]+)(\|text)?\}/g, function (m, c, t) { var v = get(c, t); if (!v) gap = true; return v; });
              if (Array.isArray(x)) return x.map(put);
              if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (j) { o[j] = put(x[j]); }); return o; }
              return x; }, v = put(src.map[k]);
            if (!gap) it[k] = v;   // a field with an empty cell is left out whole (no "From  €", no link with no URL)
          });
          // "merge": true · the saved item with the same id gives the parts the map doesn't fill (a photo, a description, a
          // name by language when "name" isn't mapped). A mapped part comes only from the file: an emptied cell stays empty,
          // and a saved "until" never hides a live row.
          if (src.merge) (w.items || []).some(function (s) { if (String(s.id) !== id) return false; Object.keys(s).forEach(function (k) { if (k !== 'id' && k !== 'until' && !own(src.map, k)) it[k] = s[k]; }); return true; });
          if (!it.name) { LBW.drop(name + ': source row skipped (no name, id "' + id + '")'); return; }
          if (it.until != null && LBW.day.read(it.until) == null) { LBW.drop(name + ': source row skipped (id "' + id + '": "until" is not D/M/YYYY)'); return; }
          seen[id] = 1; out.push(it);
        });
        // "order": "items" · the saved items' order (an API that sorts its own way); rows that aren't saved go last, as they came
        if (src.order === 'items') { var pos = Object.create(null); (w.items || []).forEach(function (s, i) { pos[String(s.id)] = i; });
          out = out.map(function (it, i) { return [it, i]; }).sort(function (a, b) { var x = a[0].id in pos ? pos[a[0].id] : 1e9, y = b[0].id in pos ? pos[b[0].id] : 1e9; return x - y || a[1] - b[1]; }).map(function (p) { return p[0]; }); }
        memo = { data: data, rows: out };
        return out;
      }
      // fetched once when the chat loads; with a URL per language, only the default language's
      if (load && src.prefetch !== false && typeof fetch === 'function' && (!lang || lang === (cfg.defaultLang && (cfg.langs || []).indexOf(cfg.defaultLang) >= 0 ? cfg.defaultLang : (cfg.langs || [lang])[0]))) { try { load().then(null, function () {}); } catch (e) {} }
      K.carousel(name, merge(pick(w, ['cls', 'lang', 'allowDup']), {
        select: function (p) {
          var k = by ? p.one(param, vals) : null, today = LBW.day.today();
          // v0.7.8 · ids=a,b in the tag: only those slides, in that order ("does it work with X?"). Saved items only: a live
          // source's ids aren't known when the tag is read. An ids value that names no slide draws nothing.
          var want = !src && p.has('ids') ? p.list('ids', (w.items || []).map(function (r) { return String(r.id); }).filter(Boolean), w.max || 12) : null;
          if (want && !want.length) return null;
          // an item with "until": "D/M/YYYY" is left out from the day after: a list that doesn't go stale
          var mk = function (items) {
            var rows = (items || []).filter(function (r) { return (want || !k || r[by] === k) && (r.until == null || LBW.day.read(r.until) >= today); });
            if (want) rows = want.map(function (id) { return rows.filter(function (r) { return String(r.id) === id; })[0]; }).filter(Boolean);
            return { items: w.max ? rows.slice(0, w.max) : rows, kicker: w.kicker, title: (k && w.titles && own(w.titles, k) && w.titles[k]) || w.title, lead: w.lead, note: w.note,
              reply: reply(cfg, w.reply), links: actions(cfg, w.links) };
          };
          if (!src) return mk(w.items);
          return { later: load().then(live), then: mk, fallback: w.items && w.items.length ? function () { return mk(w.items); } : null };
        },
        slide: function (r) { return r; }
      }));
    },
    calc: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'cta', 'notes', 'allowDup', 'collapse']), items = {}, steppers = {};
      // a value the tag gives and no control shows (the tour, the plan) still has a label: "labels": { "boat": "Boat & swim" }
      Object.keys(w.state).forEach(function (k) { var lb = w.state[k].labels; if (lb) items[k] = Object.keys(lb).map(function (v) { return [v, lb[v]]; }); });
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
          if (!st) return;   // a required value the tag didn't give: the widget draws nothing
          var d = w.state[k], par = d.param || k;
          if (d.values) { st[k] = p.one(par, d.values) || (d.required ? null : d['default']); if (st[k] == null) st = null; return; }
          var n = p.num(par, d.min, d.max, d['default'], { int: !!d['int'] }), step = steppers[k];
          st[k] = step ? +Math.max(d.min, Math.min(d.max, d.min + Math.round((n - d.min) / step) * step)).toFixed(6) : n;   // on the stepper's grid
        });
        return st;
      };
      // a result that isn't a number (a divide by zero) is never shown or sent: the card keeps its controls, the button stays off
      o.ready = function (s) { return sc(s).ok || w.cta; };
      // the title, the kicker and the links can name what the tag chose: "title": "{tour:label}"
      o.title = function (p, ctx, s) { return tpl(w.title, sc(s)); };
      if (w.kicker != null) o.kicker = function (p, ctx, s) { return tpl(w.kicker, sc(s)); };
      o.result = function (s, out) {
        var c = sc(s), r = w.result; if (!c.ok) { LBW.drop('setup: ' + name + ': a compute line is not a number'); return; }
        // a row is [label, value] or [label, value, key]: with a key, the row is left out while that number is 0
        if (r.rows) U.rows(out, r.rows.filter(function (x) { return x[2] == null || +c.v[x[2]] !== 0; }).map(function (x) { return [tpl(x[0], c), tpl(x[1], c)]; })).classList.add('kit-lines');
        if (r.total) H.total(out, tpl(r.total[0], c), tpl(r.total[1], c));
        if (r.note) H.note(out, tpl(r.note, c));
      };
      o.send = function (s) {   // what the visitor sends: no no-break space in it
        var c = sc(s, false), f = {}; if (!c.ok) return null;
        Object.keys(w.send.fields || {}).forEach(function (k) { f[k] = tpl(w.send.fields[k], c); });
        return [tpl(w.send.text, c), f];
      };
      if (w.links) o.links = function (p, ctx, s) {
        var c = sc(s); return w.links.map(function (a) { var r = resolve(cfg, a); if (!r) return null; r = merge(r, null); if (r.link) r.link = tpl(r.link, c); if (r.label) r.label = tpl(r.label, c); return action(cfg, r); });
      };
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
    compare: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'param', 'items', 'rows', 'min', 'max', 'empty', 'note', 'allowDup']);
      // "titles": { "2": "Two ways to go", "3": "Three ways to go" }: a title by how many are compared
      if (w.titles) o.title = function (ids) { return own(w.titles, String(ids.length)) ? w.titles[ids.length] : w.title || ''; };
      K.compare(name, o);
    },
    season: function (cfg, name, w, lang) {
      K.season(name, merge(pick(w, ['cls', 'lang', 'kicker', 'ranges', 'words', 'rows', 'note', 'allowDup']), { reply: reply(cfg, w.reply), links: function () { return actions(cfg, w.links); } }));
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

  // ── languages: a text may be an object of texts by language ──────────────────────────────────────
  // { "en": "Hours", "es": "Horario" }: every key a language of `langs`, every value a text or a list. Objects that are
  // maps by a name of yours are never read that way, whatever their keys: actions, replies, widgets, titles, fields, own,
  // carriedBy, tables, state, compute, map, week, and `items` in the types that keep items by id.
  var MAPS = { actions: 1, replies: 1, widgets: 1, own: 1, carriedBy: 1, titles: 1, tables: 1, fields: 1, state: 1, compute: 1, map: 1, week: 1, values: 1 };
  var BYID = { cards: 1, stats: 1, people: 1, chips: 1, compare: 1 }, CODE = /^[a-z]{2,3}$/;
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
          // only for lists of choices (a step's or a control's `items`): rows of [label, value] differ by language by nature
          if (first != null && /(^|\.|\])items$|\.map\.[^.]+$|\.else$/.test(path) && ks.some(function (k) { return sig(x[k]) !== first; })) rep.push([path, 'has different keys in each language: the first item of every pair must be the same in all of them']);
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
  function setup(cfg) {
    // the checker is a separate file (kit/setup-check.js): `npm run bot` runs it before a config is uploaded, and the
    // bundle a bot loads leaves it out. Without it a config is taken as checked, and a widget that fails is skipped.
    var errs = setup._check ? setup._check(cfg) : [], bad = [], made = [];
    root.__kitSetupErrors = errs.map(function (e) { return e.message; });
    errs.forEach(function (e) { if (e.widget != null) bad.push(e.widget); LBW.drop('setup: ' + e.message); try { console.error('[kit] setup: ' + e.message); } catch (x) {} });
    if (errs.some(function (e) { return e.widget == null; })) return { ok: false, errors: root.__kitSetupErrors, widgets: made };
    var langs = langsOf(cfg), dflt = dfltOf(cfg, langs);
    LBW.init(merge(pick(cfg, ['prefix', 'langs', 'timeZone', 'maxPerMessage', 'links', 'labels', 'quietMs', 'maxWaitMs', 'reveal']), { langs: langs, defaultLang: dflt }));   // the runtime's default must be the config's
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
  setup.types = Object.keys(MAKE);
  // for kit/setup-check.js
  setup._ = { own: own, pick: pick, isArr: isArr, isObj: isObj, isStr: isStr, isPair: isPair, WORD: WORD, CODE: CODE, HOLE: HOLE, SLOT: SLOT,
    compile: compile, loc: loc, langsOf: langsOf, dfltOf: dfltOf, resolve: resolve, reply: reply, timeOf: timeOf };
  K.setup = setup;
})(typeof window !== 'undefined' ? window : this);
