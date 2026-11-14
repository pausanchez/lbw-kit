/* kit/setup.js · the declarative layer: a bot's widgets from one JSON object, no JavaScript to write.
   Load it after lbw.js and kit.js (the lbw-kit bundle has it):  <script>LBW.kit.setup({ …config… })</script>

   config = { prefix, langs, defaultLang, timeZone, maxPerMessage, links: ['https://shop.example/', 'tel:'],
              actions: { name: action },        buttons named once, used by name in any widget
              replies: { name: [label, say] },  quick replies named once
              widgets: { tagName: { type: one of the kit makers, … } } }   (LBW.kit.setup.types lists them)
   action = 'name'  |  { use: 'name', primary: true }  |  { tel, cc, label }  |  { wa, text, label }  |  { link, label }  |  { mail, label }
            |  { reply: [label, say] }      (primary: true fills it)
            any action may add "icon": one of LBW.kit.h.icons, and "danger": true (a destructive or "no" action) (v0.8.1.4)
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
   v0.9.0 · any widget may declare "params" (typed values from the tag: one list int num money text day time), shown in its
   texts as {name}; and cards, table, stats, people, compare and carousel take "source": { "data": "key", "map": {…} }: rows
   that a flow's Code block put in LBW.data, with "items" (or "item") as the saved copy.
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
  // v0.9.5 · a formula is compiled once per text: the function is pure (it reads only its scope), and the same compute lines
  // came back once per language and per widget. A text that doesn't parse isn't kept, so it throws the same error every time.
  var COMPILED = Object.create(null);
  function compile(src) { var k = String(src); return COMPILED[k] || (COMPILED[k] = compileNew(k)); }
  function compileNew(src) {
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
  var HOLE = /\{([^{}]*)\}/g, SLOT = /^([A-Za-z_]\w*)((?::(?:label|labels|lower|money|date|dmy|time|count))*)$/;
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
        // v0.9.4.2 · {plazas:count}: an int param's "forms" ({ zero, one, other }, {n} = the number), "1 libre" / "5 libres" / "Completa"
        else if (mod === 'count') { var fm = sc.forms && own(sc.forms, k) ? sc.forms[k] : null, nn = +v, f = fm ? (nn === 0 && fm.zero != null ? fm.zero : nn === 1 && fm.one != null ? fm.one : fm.other) : null; v = f == null ? String(v) : String(f).replace(/\{n\}/g, String(nn)); }
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
  function action(cfg, spec, text, extra) {   // extra: the card's own values for a reply's fields ({id}, {title})
    var a = resolve(cfg, spec); if (!a) return null; var cls = (a.primary ? 'is-primary' : '') + (a.danger ? ' is-danger' : ''), n = null;   // v0.8.1.4: "danger", "icon"
    if (a.tel) n = U.tel(a.label, a.tel, cls, a.cc);
    else if (a.wa) n = H.wa(a.label, a.wa, a.text == null ? '' : tpl(a.text, plain({ text: text || '' })), cls);
    else if (a.link) n = U.link(a.label, a.link, cls);
    else if (a.mail) n = U.link(a.label, 'mailto:' + a.mail, cls);
    else if (a.reply) n = U.reply(a.reply[0], a.reply[1], { primary: !!a.primary, cls: a.danger ? 'is-danger' : '', fields: fieldsOf(a.reply[2], plain(merge(extra, { text: text || '' }))) });
    return n && a.icon ? H.withIcon(n, a.icon) : n;
  }
  // v0.8.1.5 · a reply's third element: the Landbot fields it writes with its sentence ({ "estado": "anulada" }). Values are
  // templates over the same scope as the sentence ({id}, {title}…), so a card's button can save which item it was.
  // a value whose placeholders came out empty is left out: an empty string would wipe what Landbot already holds in that field
  function fieldsOf(f, sc) { if (!isObj(f)) return undefined; var o = {}; Object.keys(f).forEach(function (k) { if (k === '__proto__' || f[k] == null) return; var raw = String(f[k]), v = tpl(raw, sc); if (v === '' && raw !== '') { LBW.drop('setup: field "' + k + '" left out: "' + raw + '" has nothing to fill it here'); return; } o[k] = v; }); return o; }
  function actions(cfg, list, text, extra) { return (list || []).map(function (a) { return action(cfg, a, text, extra); }); }
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

  // ── rows read live (v0.7.6; shared by every type since v0.9.0): a CSV, a JSON or LBW.data → items ─────────────────
  // Every cell is untrusted: text only, cut at 300 characters; an id is a lower-case word (40 at most) and unique, or the row
  // is skipped; a part with an empty cell is left out whole (no "From  €"), except a line of rows, stats, points or values,
  // which is left out alone. A URL outside "links" is never drawn (the runtime's link and img refuse it).
  // src = { path, id, map, merge, order, max }; o = { saved: [items with id] | null, need: [parts a row must fill],
  // img: 'img' | 'url' (how a mapped photo is written out), single: true (no id; an object is one row), table: true (rows of
  // one table: no id, an empty row skipped) }. Throws when the answer isn't a list (a sign-in page, an error object): the
  // caller draws the saved copy then.
  var ROWID = /^[a-z0-9][a-z0-9_-]{0,39}$/, PER = { rows: 1, stats: 1, points: 1, values: 1 };
  function dig(o, path) { return String(path).split('.').reduce(function (x, k) { return x != null && typeof x === 'object' && own(x, k) ? x[k] : null; }, o); }
  function mapRows(cfg, name, src, data, lang, o) {
    var rows = src.path ? dig(data, src.path) : data, ids = !o.single && !o.table;
    if (o.single && isObj(rows)) rows = [rows];
    var seen = Object.create(null), out = [], idCol = src.id || 'id';
    if (!isArr(rows)) throw new Error('the source did not answer a list');
    if (!rows.length) throw new Error('the source has no rows');   // an emptied sheet or a page that isn't the file: can't tell them apart
    // a JSON key may be dotted ("title.rendered", as WordPress nests it); every step is an own property
    var raw = function (r, k) { var v = dig(r, k); return v == null || typeof v === 'object' ? '' : String(v).trim(); };
    var cut = function (v) { return v.length > 300 ? Array.from(v).slice(0, 300).join('') : v; };
    // {column|text}: the cell is HTML (a WordPress title). Read as text in an inert document (nothing runs or loads), with
    // script and style left out and a space where a block or a <br> ends; decoded first, cut after.
    var text = function (v) {
      var d = new DOMParser().parseFromString(v.slice(0, 20000), 'text/html');
      [].forEach.call(d.querySelectorAll('script,style,template,noscript'), function (n) { n.remove(); });
      [].forEach.call(d.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,tr,td'), function (n) { n.insertAdjacentText(n.tagName === 'BR' ? 'beforebegin' : 'afterend', ' '); });
      return (d.body ? d.body.textContent : '').replace(/\s+/g, ' ').trim();
    };
    if (ids && !rows.some(function (r) { return r && typeof r === 'object' && raw(r, idCol) !== ''; })) throw new Error('the source has no "' + idCol + '" column');
    var saved = function (id) { return o.single ? (o.saved || [])[0] : (o.saved || []).filter(function (s) { return isObj(s) && String(s.id) === id; })[0]; };
    rows.slice(0, src.max || 2000).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var get = function (k, t) { var v = (lang && k.indexOf('.') < 0 && raw(r, k + '_' + lang)) || raw(r, k); return cut(t && v ? text(v) : v); };
      var id = ids ? cut(raw(r, idCol)) : '', at = ids ? 'id "' + id + '"' : 'row ' + out.length;
      if (ids && (!ROWID.test(id) || seen[id])) { LBW.drop(name + ': source row skipped (id "' + id.slice(0, 40) + '")'); return; }
      var it = ids ? { id: id } : {};
      Object.keys(src.map).forEach(function (k) {
        if (k === '__proto__') return;
        var gap = false, put = function (x, per) {
          if (typeof x === 'string') return x.replace(/\{([A-Za-z0-9_.]+)(\|text)?\}/g, function (m, c, t) { var v = get(c, t); if (!v) gap = true; return v; });
          if (!isArr(x) && !isObj(x)) return x;
          var res = isArr(x) ? [] : {};
          Object.keys(x).forEach(function (j) {
            if (j === '__proto__') return; var g0 = gap; if (per) gap = false;
            var y = put(x[j]); if (per && gap) { gap = g0; return; } if (per) gap = g0;   // a line with an empty cell: that line only
            if (isArr(res)) res.push(y); else res[j] = y;
          });
          if (per && !Object.keys(res).length) gap = true;
          return res; }, v = put(src.map[k], own(PER, k));
        if (!gap) it[k] = v;   // a part with an empty cell is left out whole (no "From  €", no link with no URL)
      });
      // v0.8.1.12 · a mapped photo may be { "photo": "set:{column}" } (people: "set:{column}"): written out from "photos" here
      if (it.img != null && photoRef(it.img)) { var pi = photo(cfg.photos, it.img, o.img || 'img', it.name, function (m) { LBW.drop(name + ': source row ' + at + ': ' + m); }); if (pi === undefined) delete it.img; else it.img = pi; }
      // "merge": true · the saved item with the same id gives the parts the map doesn't fill (a photo, a description, a
      // name by language when "name" isn't mapped). A mapped part comes only from the data: an emptied cell stays empty,
      // and a saved "until" never hides a live row. Never a saved status beside live data (v0.8.1.4).
      var sv = src.merge ? saved(id) : null;
      if (isObj(sv)) Object.keys(sv).forEach(function (k) { if (k !== 'id' && k !== 'until' && k !== 'status' && k !== '__proto__' && !own(src.map, k)) it[k] = sv[k]; });
      var miss = (o.need || []).filter(function (k) { return it[k] == null || it[k] === '' || (isArr(it[k]) && !it[k].length); })[0];
      if (miss) { LBW.drop(name + ': source row skipped (no ' + miss + ', ' + at + ')'); return; }
      if (it.until != null && LBW.day.read(it.until) == null) { LBW.drop(name + ': source row skipped (' + at + ': "until" is not D/M/YYYY)'); return; }
      if (o.table && !Object.keys(it).some(function (k) { return it[k] !== ''; })) return;
      if (ids) seen[id] = 1; out.push(it);
    });
    // "order": "items" · the saved items' order (an API that sorts its own way); rows that aren't saved go last, as they came
    if (src.order === 'items' && ids) { var pos = Object.create(null); (o.saved || []).forEach(function (s, i) { if (isObj(s)) pos[String(s.id)] = i; });
      out = out.map(function (it, i) { return [it, i]; }).sort(function (a, b) { var x = a[0].id in pos ? pos[a[0].id] : 1e9, y = b[0].id in pos ? pos[b[0].id] : 1e9; return x - y || a[1] - b[1]; }).map(function (q) { return q[0]; }); }
    return o.single ? out.slice(0, 1) : out;
  }

  // v0.9.5 · a chart's tick: one Intl.NumberFormat per language, kept (toLocaleString made one per tick: the same text, by spec)
  var NUMF = Object.create(null);
  function numFmt(l) { return NUMF[l] || (NUMF[l] = new Intl.NumberFormat(l, { maximumFractionDigits: 2 })); }

  /* v0.10 · calendar */
  // a calendar's days by day number: { p: cents, s: free | few | full | closed, left }. Rows from the config or a data message,
  // read strictly: a date that isn't one, a price that isn't a plain amount (189, 189.5, "189,50"), an unknown state or a
  // count that isn't a whole number skips the row (logged); "left" alone gives the state: 0 full, 1–3 few, more free
  var CALS = { free: 1, few: 1, full: 1, closed: 1 };
  function cents(x) {
    if (typeof x === 'number') return isFinite(x) && x >= 0 && x < 1e8 ? Math.round(x * 100) : null;
    var m = /^(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(String(x == null ? '' : x).trim()); return m ? +m[1] * 100 + (m[2] ? +(m[2] + '0').slice(0, 2) : 0) : null;
  }
  function calRow(r) {
    if (!isObj(r)) return null; var n = LBW.day.read(r.date), d = {}, st = String(r.state == null ? '' : r.state).trim().toLowerCase(); if (n == null) return null;
    if (r.price != null && r.price !== '') { d.p = cents(r.price); if (d.p == null) return null; }
    if (r.left != null && r.left !== '') { if (!/^\d{1,4}$/.test(String(r.left).trim())) return null; d.left = +r.left; }
    if (st) { if (!own(CALS, st)) return null; d.s = st; } else if (d.left != null) d.s = d.left === 0 ? 'full' : d.left <= 3 ? 'few' : 'free';
    return { n: n, d: d };
  }
  function calMap(rates, rows, name) {
    var m = Object.create(null);
    (rates || []).forEach(function (r) { var a = isObj(r) ? LBW.day.read(r.from) : null, b = isObj(r) ? LBW.day.read(r.to) : null, c = isObj(r) ? cents(r.price) : null;
      if (a == null || b == null || c == null || b < a || b - a > 800) { LBW.drop(name + ': rate skipped'); return; } for (var n = a; n <= b; n++) m[n] = { p: c }; });
    (rows || []).forEach(function (r, i) { var x = calRow(r); if (!x) { LBW.drop(name + ': day skipped (row ' + i + ')'); return; } m[x.n] = merge(m[x.n], x.d); });
    return m;
  }

  // ── one maker per type ───────────────────────────────────────────────────────────────────────────
  var MAKE = {
    cards: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'param', 'items', 'kicker', 'disclaimer', 'single', 'fallback', 'pointsCls', 'allowDup', 'lang', 'status']), r = reply(cfg, w.reply);
      if (w.item) { o.items = { _: w.item }; o.single = true; }
      // v0.8.1.5 · a status the tag names may bring its own "reply" and "links" (null or [] = none): they replace the card's
      var sItem = function (sk) { return sk && isObj(w.status) && isObj(w.status.items) && own(w.status.items, sk) ? w.status.items[sk] : null; };
      o.reply = function (id, it, ctx, sk) { var st = sItem(sk), rr = st && own(st, 'reply') ? reply(cfg, st.reply) : r; if (!rr) return null; var sc = plain({ id: id, title: it.title }); return [tpl(rr[0], sc), tpl(rr[1], sc), fieldsOf(rr[2], sc)]; };
      o.links = function (id, it, ctx, sk) { var st = sItem(sk); return actions(cfg, st && own(st, 'links') ? st.links || [] : w.links, '', { id: id, title: it.title }); };
      K.cards(name, o);
    },
    // v0.8.1.10 · a table: "items" by id (or "item"), each { title, cols: [[key, label, "end"?]], rows: [[…]] }. "pick" makes each
    // row a button: { "say": "Quiero la sesión de las {hora}", "fields": { "sesion": "{hora}" }, "label" } over the row's columns and {id}
    table: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'param', 'items', 'kicker', 'fold', 'same', 'single', 'fallback', 'allowDup', 'lang']), r = reply(cfg, w.reply);
      if (w.item) { o.items = { _: w.item }; o.single = true; }
      o.reply = function (id, t) { if (!r) return null; var sc = plain({ id: id, title: t.title }); return [tpl(r[0], sc), tpl(r[1], sc), fieldsOf(r[2], sc)]; };
      o.links = function (id, t) { return actions(cfg, w.links, '', { id: id, title: t.title }); };
      if (isObj(w.pick)) o.pick = { label: w.pick.label,
        say: function (row, id) { return tpl(w.pick.say, plain(merge(row, { id: id }))); },
        fields: w.pick.fields ? function (row, id) { return fieldsOf(w.pick.fields, plain(merge(row, { id: id }))); } : null };
      K.table(name, o);
    },
    form: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'preset', 'allowDup', 'collapse', 'density']), items = {};
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
      // v0.9.0 · "data": "key" reads LBW.data (a flow's Code block put it there) instead of a URL: no fetch, a short wait
      // v0.9.2 · "upgrade" (as on cards, v0.9.1): a Code block runs late, so the saved slides drawn after "wait" are replaced by
      // the live ones when the data lands within "upgrade" ms (20000 by default, 0 = never), unless the visitor already used the
      // carousel (a reply pressed; opening a photo doesn't count). With no saved items the skeleton waits that long instead.
      var has = isArr(w.items) && w.items.length > 0, up = src && src.data != null ? (src.upgrade == null ? 20000 : src.upgrade) : 0;
      var load = src && function () { if (src.data != null) return LBW.data.wait(src.data, has ? src.wait : Math.max(src.wait == null ? 1500 : src.wait, up)); var o = { maxAge: src.maxAge }; return src.csv ? LBW.csv(src.csv, o) : LBW.json(src.json, o); };
      var memo = null;   // the rows of the last answer read: one pass, and one log line per skipped row, per fetch
      function live(data) {   // throws when the answer isn't the list (a sign-in page, an error object): the saved items are drawn then
        if (memo && memo.data === data) return memo.rows;
        var out = mapRows(cfg, name, src, data, lang, { saved: w.items, need: ['name'], img: 'img' });
        memo = { data: data, rows: out };
        return out;
      }
      // fetched once when the chat loads; with a URL per language, only the default language's
      if (load && src.data == null && src.prefetch !== false && typeof fetch === 'function' && (!lang || lang === (cfg.defaultLang && (cfg.langs || []).indexOf(cfg.defaultLang) >= 0 ? cfg.defaultLang : (cfg.langs || [lang])[0]))) { try { load().then(null, function () {}); } catch (e) {} }
      K.carousel(name, merge(pick(w, ['cls', 'lang', 'allowDup', 'style']), { live: !!src && w.live !== false,   // v0.10: the "Live" chip on slides from the source; "style": "box" keeps the framed look
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
          return { later: load().then(live), then: mk, fallback: has ? function () { return mk(w.items); } : null,
            // after the fallback: the selection from the late data, or null to keep the saved slides (kit.js swaps them in)
            upgrade: up > 0 && has ? function (o) { return LBW.data.wait(src.data, up).then(function (d) {
              if (!o.isConnected) return null;
              if (H.usedByVisitor(o)) { LBW.drop(name + ': data "' + src.data + '" came late; the saved copy stays (already used)'); return null; }
              try { return mk(live(d)); } catch (e) { return null; }
            }); } : null };
        },
        slide: function (r) { return r; }
      }));
    },
    calc: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'cta', 'notes', 'allowDup', 'collapse', 'density']), items = {}, steppers = {};
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
      if (r) o.reply = function (id, it) { var sc = plain({ id: id, title: it.title }); return [tpl(r[0], sc), tpl(r[1], sc), fieldsOf(r[2], sc)]; };
      if (w.links) o.links = function () { return actions(cfg, w.links); };
      K.stats(name, o);
    },
    people: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'note', 'items', 'allowDup']), r = reply(cfg, w.reply), ids = Object.keys(w.items || {});   // v0.9.0: none saved when the people come from LBW.data
      // [[p:team who=ana,ben]] shows those; no `who` shows everyone; a `who` that names nobody known shows nothing
      if (w.filter) o.select = function (p) { var l = p.list(w.filter.param, ids, 4); return l.length ? l : p.has(w.filter.param) ? [] : ids; };
      if (r) o.reply = function (id, x) { var sc = plain({ id: id, name: x.name, role: x.role }); return [tpl(r[0], sc), tpl(r[1], sc), fieldsOf(r[2], sc)]; };
      K.people(name, o);
    },
    // v0.8.1.6 · rating: "send": { text, fields } over {value}, {label} (thumbs, or a scale's end), {band} and {max};
    // "bands": [[6, "detractor"], [8, "pasivo"], [10, "promotor"]] names the value's group (the first whose top it doesn't pass)
    rating: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'text', 'kind', 'min', 'max', 'labels', 'note', 'allowDup']), kind = w.kind || 'stars';
      var top = kind === 'thumbs' ? 1 : kind === 'stars' ? Math.max(3, Math.min(10, +w.max || 5)) : (w.max == null ? 10 : +w.max);
      o.say = function (v) {
        var band = ''; (w.bands || []).some(function (b) { if (v <= +b[0]) { band = b[1]; return true; } return false; });
        // {label}: a thumb's word (the kit's own Sí/No when no labels), or a scale's end label on its first and last value
        var lbs = w.labels || [], lo = kind === 'scale' ? (w.min == null ? 0 : +w.min) : 1, kw = (K.L[lang] || K.L.en);
        var label = kind === 'thumbs' ? (lbs[v] || (v ? kw.yes : kw.no)) : kind === 'scale' ? (v === lo ? lbs[0] || '' : v === top ? lbs[1] || '' : '') : '';
        var sc = plain({ value: String(v), label: label, band: band, max: String(top) });
        return [tpl(w.send.text, sc), fieldsOf(w.send.fields, sc) || {}];
      };
      K.rating(name, o);
    },
    /* v0.10 · calendar */
    // "rates": [{ from, to, price }] (a price for each day of a range; a later one wins), "days": [{ date, price, state, left }]
    // (one day; over the rates), "closed": { weekdays: [0–6], dates: ["24/12", "1/1/2027"] }, "unlisted": "closed" when the data
    // lists only the days that can be booked. Or "source": { "data" } (a data message's rows, mapped like a table's), with
    // rates/days as the saved copy. "send" over {from} {to} {day} {nights} {total} {price} {summary}; prices in units (189.5)
    calendar: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'mode', 'notice', 'horizon', 'months', 'money', 'priceFrom', 'collapse', 'allowDup']), D = LBW.day, src = w.source;
      if (isObj(w.nights)) { o.min = w.nights.min; o.max = w.nights.max; }
      if (isObj(w.closed)) { var wk = w.closed.weekdays || [], on = D.on(w.closed.dates || []); o.closed = function (n) { return wk.indexOf(D.parts(n).w) >= 0 || on(n); }; }
      var saved = w.rates || w.days ? { days: calMap(w.rates, w.days, name), unlisted: w.unlisted } : null;
      var live = function (data) { return { days: calMap(null, mapRows(cfg, name, merge(src, { map: merge({ date: '{date}', price: '{price}', state: '{state}', left: '{left}' }, src.map) }), data, lang, { table: true }), name), unlisted: w.unlisted }; };
      o.days = function () {
        if (!isObj(src) || src.data == null) return saved || { days: {}, unlisted: w.unlisted };
        var key = src.data, cur = LBW.data.get(key), up = src.upgrade == null ? 20000 : src.upgrade;
        if (cur !== undefined) { try { return live(cur); } catch (e) { LBW.drop(name + ': data "' + key + '": ' + e.message + ' (the saved copy)'); return saved; } }
        return { later: LBW.data.wait(key, saved ? src.wait : Math.max(src.wait == null ? 1500 : src.wait, up)).then(live), fallback: saved ? function () { return saved; } : null,
          upgrade: up > 0 && saved ? function (el) { return LBW.data.wait(key, up).then(function (d) {
            if (!el.isConnected) return null;
            if (H.usedByVisitor(el)) { LBW.drop(name + ': data "' + key + '" came late; the saved copy stays (already used)'); return null; }
            try { return live(d); } catch (e) { return null; } }); } : null };
      };
      o.send = function (sel, ctx) {
        var sc = { v: sel, items: {}, money: function (n) { return H.money(n, merge(w.money, n % 100 ? { nb: false, cents: true } : { nb: false })); }, lang: w.lang || ctx.lang };
        return [tpl(w.send.text, sc), fieldsOf(w.send.fields, sc) || {}];
      };
      K.calendar(name, o);
    },
    consent: function (cfg, name, w, lang) { K.consent(name, pick(w, ['cls', 'lang', 'icon', 'title', 'text', 'yes', 'no', 'link', 'allowDup'])); },
    slots: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'sep', 'h12', 'collapse', 'allowDup', 'ics', 'density']), D = LBW.day;
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
      // v0.10 · "style": "pass" (a ticket), "code": "{ref}" (a param or a sent value; empty → none), "countdown": false, and the
      // calendar file: the slots widget's "ics", or this one's ({ title, where, label }; false: none). Times as the slots draw them.
      o.style = w.style; o.countdown = w.countdown; o.sep = src.sep; o.h12 = src.h12; if (w.code != null) o.code = T(w.code);
      var ic = w.ics === false ? false : merge(isObj(src.ics) ? src.ics : null, isObj(w.ics) ? w.ics : null);
      o.ics = ic === false ? false : function (l, ctx) { var c = sc(l, ctx), e = {}; ['title', 'where', 'label', 'file'].forEach(function (k) { if (isStr(ic[k])) e[k] = tpl(ic[k], c); }); return e; };
      if (w.rows) o.rows = function (l, ctx) { var c = sc(l, ctx); return w.rows.map(function (r) { return [tpl(r[0], c), tpl(r[1], c)]; }); };
      if (w.steps) o.steps = function (l, ctx) { var c = sc(l, ctx); return w.steps.map(function (x) { return tpl(x, c); }); };
      if (w.actions) o.actions = function (l) { return actions(cfg, w.actions, l.text); };
      K.confirm(name, o);
    },
    review: function (cfg, name, w, lang) {
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'collapse', 'allowDup', 'density']), N = numbers(w), items = {}, d = reply(cfg, w.discard);
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
      var o = pick(w, ['cls', 'lang', 'kicker', 'title', 'param', 'items', 'rows', 'min', 'max', 'empty', 'note', 'same', 'primary', 'best', 'allowDup']);
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
        if (w.stack && series.some(function (se) { return se.values.some(function (n) { return n < 0; }); })) { LBW.drop('setup: ' + name + ': a stacked chart has a value below 0'); return null; }
        var spec = { type: w.kind || 'line', lang: lang, stack: !!w.stack, x: xs.map(function (x) { return x[1]; }), series: series, height: w.height, summary: tpl(w.summary, base),
          y: { ticks: y.ticks, format: function (v) { return y.money ? H.money(v, w.money) : numFmt(lang || 'en').format(Math.round(v * 100) / 100) + (y.suffix || ''); } } };   /* v0.8.1.12: the language's decimal mark («13,3 k» in Spanish) */
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
  var MAPS = { actions: 1, replies: 1, widgets: 1, own: 1, carriedBy: 1, titles: 1, tables: 1, fields: 1, state: 1, compute: 1, map: 1, week: 1, values: 1, params: 1 };
  var BYID = { cards: 1, table: 1, stats: 1, people: 1, chips: 1, compare: 1 }, CODE = /^[a-z]{2,3}$/;
  function langsOf(cfg) { return isObj(cfg) && isArr(cfg.langs) && cfg.langs.length && cfg.langs.every(isStr) ? cfg.langs : [isObj(cfg) && isStr(cfg.defaultLang) ? cfg.defaultLang : 'en']; }
  function dfltOf(cfg, langs) { return isObj(cfg) && isStr(cfg.defaultLang) && langs.indexOf(cfg.defaultLang) >= 0 ? cfg.defaultLang : langs[0]; }
  function isText(v) { return typeof v === 'string' || isArr(v); }
  // the copy of x for one language. L = { lang, langs, dflt }; rep collects [path, problem] when given (check)
  function loc(x, L, path, asMap, rep) {
    if (isArr(x)) { var fieldsAt = /\.(yes|no|reply|discard)$|^replies\.[^.\[]+$/.test(path) ? 2 : -1;   /* v0.8.1.5: a reply's fields are a map, even keyed "en" */ return x.map(function (y, i) { return loc(y, L, path + '[' + i + ']', i === fieldsAt, rep); }); }
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
  // v0.8.1.10 · "photos": a CDN's size folders, written once. { "h10": { "base": "https://cdn/gallery/",
  // "sizes": [["T2D3/", 495], ["T4D3/", 964], ["", 1440]], "ratio": [4, 3] } }. A slide's "img" (or a gallery photo) is then
  // "h10:01_room.jpg" or { "photo": "h10:01_room.jpg", "alt": … }: the kit writes src (the smallest), srcset (every size),
  // width and height (from ratio), and a gallery photo's "big" (the largest). say(widget, message) reports, for the checker.
  var REF = /^([a-z_][a-z0-9_]*):([^\s"'<>]+)$/i;
  function photoRef(x) { var s = isStr(x) ? x : isObj(x) && isStr(x.photo) ? x.photo : null, m = s && !/^https?:/i.test(s) ? REF.exec(s) : null; return m ? { cdn: m[1], file: m[2], o: isObj(x) ? x : {} } : null; }
  function photoSet(P, cdn) { var d = isObj(P) && own(P, cdn) ? P[cdn] : null; return d && isStr(d.base) && isArr(d.sizes) && d.sizes.length && d.sizes.every(function (z) { return isArr(z) && typeof z[0] === 'string' && typeof z[1] === 'number'; }) ? d : null; }
  // one photo: x itself when it is no reference, undefined when its set doesn't exist (say(message) is told), else the
  // written-out img. kind: 'img' (a slide), 'big' (a gallery photo), 'url' (a person's avatar: the smallest size, one URL)
  // v0.8.1.14 · a srcset as a page writes it ("a-380x282.jpg 380w, a-768x569.jpg 768w"), pasted from a WordPress page:
  // parsed into pairs; width and height come from the smallest file's "-WxH" suffix (exact, unlike a computed name)
  function srcsetOf(str) { var out = [], m, re = /(\S+)\s+(\d+)w/g; while ((m = re.exec(str))) out.push([m[1].replace(/^,/, ''), +m[2]]); out.sort(function (a, b) { return a[1] - b[1]; }); return out; }
  function pasted(x, kind, alt) {
    var zs = srcsetOf(x.srcset), o = {}; if (!zs.length) return undefined;
    Object.keys(x).forEach(function (k) { if (k !== 'srcset' && k !== '__proto__') o[k] = x[k]; });
    if (kind === 'url') return zs[0][0];
    o.srcset = zs; o.src = kind === 'big' ? zs[Math.floor(zs.length / 2)][0] : zs[0][0];
    if (kind === 'big') o.big = zs[zs.length - 1][0];
    else { var d = /-(\d+)x(\d+)\.[a-z0-9]+(?:\?.*)?$/i.exec(zs[0][0]); if (d && o.width == null) { o.width = +d[1]; o.height = +d[2]; } }
    if (o.alt == null && alt != null) o.alt = alt;
    return o;
  }
  function photo(P, x, kind, alt, say) {
    if (isObj(x) && isStr(x.srcset)) { var pz = pasted(x, kind, alt); if (pz === undefined) say('"srcset" holds no "url 480w" pairs'); return pz; }
    var r = photoRef(x); if (!r) return x;
    var d = photoSet(P, r.cdn); if (!d) { say('"' + r.cdn + ':" is not a set in "photos"'); return undefined; }
    var url = function (z) { return d.base + z[0] + r.file; }, zs = d.sizes, o = {};
    if (kind === 'url') return url(zs[0]);
    Object.keys(r.o).forEach(function (k) { if (k !== 'photo' && k !== '__proto__') o[k] = r.o[k]; });
    o.src = url(kind === 'big' ? zs[Math.floor(zs.length / 2)] : zs[0]); o.srcset = zs.map(function (z) { return [url(z), z[1]]; });
    if (kind === 'big') o.big = url(zs[zs.length - 1]);
    else if (isArr(d.ratio) && d.ratio[0] > 0 && d.ratio[1] > 0) { o.width = zs[0][1]; o.height = Math.round(zs[0][1] * d.ratio[1] / d.ratio[0]); }
    if (o.alt == null && alt != null) o.alt = alt;
    return o;
  }
  function photosIn(cfg, say) {
    var P = isObj(cfg) && isObj(cfg.photos) ? cfg.photos : null;
    if (!isObj(cfg) || !isObj(cfg.widgets)) return cfg;
    var out = merge(cfg, {}); out.widgets = {};
    function one(x, name, at, big, alt) { return photo(P, x, big === 'url' ? 'url' : big ? 'big' : 'img', alt, function (m) { m = at + ': ' + m; if (say) say(name, m); else LBW.drop('setup: ' + name + ': ' + m); }); }
    // defineProperty: a widget named "__proto__" stays a key (the checker reports it) instead of setting the prototype
    var put = function (name, v) { Object.defineProperty(out.widgets, name, { value: v, enumerable: true, writable: true, configurable: true }); };
    Object.keys(cfg.widgets).forEach(function (name) {
      var w = cfg.widgets[name];
      if (isObj(w) && w.type === 'people' && isObj(w.items)) {   // v0.8.1.12 · a person's img: one URL, the smallest size
        var ppl = {}; Object.keys(w.items).forEach(function (id) { var x = w.items[id]; if (!isObj(x) || x.img == null) { ppl[id] = x; return; } var c = merge(x, {}), u = one(x.img, name, id + '.img', 'url'); if (u === undefined) delete c.img; else c.img = u; ppl[id] = c; });
        put(name, merge(w, { items: ppl })); return;
      }
      // v0.10 · a card's or a compared item's "img", written out the same way as a slide's
      if (isObj(w) && (w.type === 'cards' || w.type === 'compare') && (isObj(w.items) || isObj(w.item))) {
        var byId = function (items, pre) { var r = {}; Object.keys(items).forEach(function (id) { if (id === '__proto__') return; var x = items[id]; if (!isObj(x) || x.img == null) { r[id] = x; return; }
          var c = merge(x, {}), im = one(x.img, name, pre + id + '.img', false, x.title || x.name); if (im === undefined) delete c.img; else c.img = im; r[id] = c; }); return r; };
        var cw = merge(w, {}); if (isObj(w.items)) cw.items = byId(w.items, ''); if (isObj(w.item)) cw.item = byId({ item: w.item }, '').item; put(name, cw); return;
      }
      if (!isObj(w) || w.type !== 'carousel' || !isArr(w.items)) { put(name, w); return; }
      put(name, merge(w, { items: w.items.map(function (it, i) {
        if (!isObj(it)) return it;
        var at = 'items[' + i + ']', c = merge(it, {});
        if (it.img != null) { var im = one(it.img, name, at + '.img', false, it.name); if (im === undefined) delete c.img; else c.img = im; }
        if (isObj(it.gallery) && isArr(it.gallery.photos)) c.gallery = merge(it.gallery, { photos: it.gallery.photos.map(function (p, j) { return one(p, name, at + '.gallery.photos[' + j + ']', true, it.gallery.title || it.name); }).filter(function (p) { return p !== undefined; }) });
        return c;
      }) }));
    });
    return out;
  }
  // ── params (v0.9.0): typed values a tag carries, for every type ──────────────────────────────────────────────────
  // "params": { "plazas": { "type": "int", "min": 0, "max": 99, "required": true }, "precio": { "type": "money", "max": 100000 },
  //             "fecha": { "type": "day" }, "zona": { "type": "one", "values": ["norte", "sur"], "labels": { … } }, "nota": { "type": "text", "max": 60 } }
  // A flow writes them from fields (@{plazas}), or the agent copies them from a source; they are facts to show, so they are
  // read strictly: a value that isn't one is never clamped or guessed. Missing or not valid → the "default", else nothing; a
  // "required" one that is missing or not valid → the widget draws nothing. In any text of the widget they are placeholders
  // ({plazas}, {precio:money}, {fecha:date}, {zona:label}); in a calc, review or chart the numbers are names for formulas.
  var PTYPES = ['one', 'list', 'int', 'num', 'money', 'text', 'day', 'time'], PNUM = { int: 1, num: 1, money: 1, day: 1, time: 1 };
  var PSKIP = { params: 1, compute: 1, tables: 1, state: 1, source: 1, type: 1 }, PSENT = { send: 1, say: 1, reply: 1, fields: 1, pick: 1, discard: 1, yes: 1, no: 1 };
  function dayAt(x) { return x === 'today' ? LBW.day.today() : LBW.day.read(x); }
  function pread(d, p, key) {   // the value of one param from the tag, or null when it isn't one of its type
    var raw = String(p.raw[key]).trim(), t = d.type, n, m;
    if (t === 'one') return p.one(key, d.values || []);
    if (t === 'list') { var l = p.list(key, d.values || [], d.max || 99); return l.length ? l : null; }
    if (t === 'text') { var x = p.text(key, d.max || 80).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(); return x || null; }
    if (t === 'day') { n = p.day(key); return n != null && (d.min == null || n >= dayAt(d.min)) && (d.max == null || n <= dayAt(d.max)) ? n : null; }
    if (t === 'time') return LBW.time.read(raw);
    if (t === 'money') {   // "34.99", "34,99", "34" (in the currency's units), or whole cents with "cents": true; no thousands separators
      m = d.cents ? /^(\d{1,12})$/.exec(raw) : /^(?:[€$£]\s?)?(\d{1,10})(?:[.,](\d{1,2}))?(?:\s?[€$£])?$/.exec(raw); if (!m) return null;
      n = d.cents ? +m[1] : +m[1] * 100 + (m[2] ? +(m[2] + '0').slice(0, 2) : 0);
    } else if (!(t === 'int' ? /^-?\d{1,12}$/ : /^-?\d{1,12}(?:[.,]\d{1,6})?$/).test(raw)) return null;
    else n = +raw.replace(',', '.');
    return isFinite(n) && n >= (d.min == null ? (t === 'money' ? 0 : -Infinity) : d.min) && n <= (d.max == null ? Infinity : d.max) ? n : null;
  }
  function pdefault(d) { var v = d['default']; return v == null ? null : d.type === 'day' ? dayAt(v) : d.type === 'time' ? LBW.time.read(v) : v; }
  function params(name, defs, p) {   // → { name: value } or null (a required one is missing or not valid)
    var out = {}, ok = true;
    Object.keys(defs).forEach(function (k) {
      if (!ok || k === '__proto__') return; var d = defs[k], key = d.param || k, v = null;
      if (p.has(key)) { v = pread(d, p, key); if (v == null) LBW.drop(name + ': bad value ' + key + '=' + String(p.raw[key]).slice(0, 40)); }
      if (v == null) v = pdefault(d);
      if (v == null && d.required) { LBW.drop(name + ': ' + key + ' is required'); ok = false; return; }
      if (v != null) out[k] = v;
    });
    return ok ? out : null;
  }
  // the widget with every param placeholder written out. A param with no value leaves its text empty, and a field it fills is
  // left out (never emptied in Landbot). In a URL a value is encoded; a value never brings a { } of its own.
  function withParams(w, defs, vals, lang) {
    var names = Object.keys(defs), items = {}, forms = {};
    names.forEach(function (k) { var lb = defs[k].labels; if (isObj(lb)) items[k] = Object.keys(lb).map(function (v) { return [v, lb[v]]; }); if (isObj(defs[k].forms)) forms[k] = defs[k].forms; });
    var sc = function (sent) { return { v: vals, items: items, forms: forms, money: function (n) { return H.money(n, merge(w.money, sent ? { nb: false } : null)); }, lang: w.lang || lang, sep: w.sep, h12: w.h12 }; };
    function str(x, sent) {
      var url = /^(https?:|tel:|mailto:)/i.test(x), empty = false;
      var r = x.replace(HOLE, function (m, body) {
        var y = SLOT.exec(body); if (!y || names.indexOf(y[1]) < 0) return m;
        if (!own(vals, y[1])) { empty = true; return ''; }
        var v = tpl(m, sc(sent)).replace(/[{}]/g, ''); return url ? encodeURIComponent(v) : v;
      });
      return [r, empty];
    }
    function walk(x, sent, fields) {
      if (typeof x === 'string') { var r = str(x, sent); return fields && r[1] && r[0] === '' ? undefined : r[0]; }
      if (isArr(x)) return x.map(function (y, i) { return walk(y, sent, i === 2 && isObj(y)); });
      if (!isObj(x)) return x;
      var o = {}; Object.keys(x).forEach(function (k) {
        // v0.9.5 · a class name is never a text: a param can't write one ("cls": "kit-{zona}" would let a tag add kit-ovl…)
        if (k === '__proto__') return; if (own(PSKIP, k) || k === 'cls' || /Cls$/.test(k)) { o[k] = x[k]; return; }
        // v0.9.4.2 · a row [label, value, key] or [label, value, key, text] whose key is a number param: while that number is 0
        // the row is left out, or its value becomes the text ("Completa"); a missing value keeps the row as written
        if (k === 'rows' && isArr(x[k]) && ['cards', 'contact', 'season'].indexOf(w.type) >= 0) {
          var rs = []; x[k].forEach(function (r) {
            if (!(isArr(r) && r.length >= 3 && isStr(r[2]) && own(defs, r[2]) && own(PNUM, defs[r[2]].type))) { rs.push(walk(r, sent, false)); return; }
            // v0.10 · a 5th element { "of": 12, "low": 3 } draws a meter from that number ("Completa" muted at 0; a null 4th leaves the row out)
            var mo = isObj(r[4]) && own(vals, r[2]) ? { n: vals[r[2]], of: walk(r[4].of, sent, false), low: r[4].low } : null;
            if (vals[r[2]] === 0) { if (r.length > 3 && r[3] != null) rs.push([walk(r[0], sent, false), walk(r[3], sent, false)].concat(mo ? [mo] : [])); return; }
            rs.push([walk(r[0], sent, false), walk(r[1], sent, false)].concat(mo ? [mo] : []));
          });
          o[k] = rs; return;
        }
        var v = walk(x[k], sent || own(PSENT, k), fields || k === 'fields'); if (v !== undefined) o[k] = v;
      });
      return o;
    }
    var out = walk(w, false, false);
    // the numbers are names in formulas: they join the tables (a calc, a review or a chart reads both)
    if (w.type === 'calc' || w.type === 'review' || w.type === 'chart') { var nums = {}; names.forEach(function (k) { if (own(PNUM, defs[k].type) && own(vals, k)) nums[k] = vals[k]; }); out.tables = merge(w.tables, nums); }
    return out;
  }

  // ── "source": { "data": "key" } for every type that keeps items (v0.9.0) ─────────────────────────────────────────
  // The rows come from LBW.data (a flow's Code block put them there); "items" (or "item") is the saved copy, drawn when the
  // data is missing after "wait" ms or unreadable. Already there when the tag is read: drawn at once; not yet: a skeleton,
  // then the data or the saved copy, which the data replaces if it lands within "upgrade" ms (v0.9.1: a Code block runs late).
  var NEEDS = { cards: ['title'], stats: ['stats'], people: ['name', 'role'], compare: ['name'], table: [] };
  function build(c, name, w, lang) {   // the maker's widget function for this copy of the widget
    var fn = null, real = LBW.widget;
    LBW.widget = function (n, f) { fn = f; return LBW; };
    try { MAKE[w.type](c, name, w, lang); } finally { LBW.widget = real; }
    return fn;
  }
  function transplant(o, el) {   // a card drawn late moves into the skeleton the tag already holds (its data-tag stays)
    var back = H.keepPlace(o);   // v0.9.5: focus inside the old card goes to its twin in the new one, never to <body>
    while (o.firstChild) o.removeChild(o.firstChild);
    o.className = el.className; while (el.firstChild) o.appendChild(el.firstChild); o.box = el.box || o.querySelector('.lbw-box');
    back();
  }
  var DMEMO = {};
  function liveW(c, name, w, lang, key, data) {   // the widget with the data's rows as its items; null: no row to draw
    var src = w.source, single = !!w.item && w.type !== 'table', mk = name + '|' + lang + '|' + key, m = DMEMO[mk];
    if (!(m && m.data === data && m.w === w)) {
      var saved = single ? [w.item] : isObj(w.items) ? Object.keys(w.items).map(function (id) { return merge(w.items[id], { id: id }); }) : [];
      var rows = mapRows(c, name, src, data, lang, { saved: saved, need: NEEDS[w.type], img: w.type === 'people' ? 'url' : 'img', single: single, table: w.type === 'table' });
      var out = null;
      if (w.type === 'table') { var cols = isObj(w.item) && isArr(w.item.cols) ? w.item.cols : [];
        if (rows.length) out = merge(w, { item: merge(w.item, { rows: rows.slice(0, src.max || 30).map(function (r) { return cols.map(function (cl) { return r[cl[0]] == null ? '' : String(r[cl[0]]); }); }) }) }); }
      else if (rows.length) {
        if (single) out = merge(w, { item: rows[0] });
        else { var by = {}; rows.forEach(function (r) { var x = merge(r, {}); delete x.id; Object.defineProperty(by, r.id, { value: x, enumerable: true, writable: true, configurable: true }); }); out = merge(w, { items: by }); delete out.item; }
      }
      m = DMEMO[mk] = { data: data, w: w, out: out };
    }
    return m.out;
  }
  function fromData(c, name, w, lang, p, ctx) {
    var key = w.source.data, has = w.item ? !(w.type === 'table' && !(isArr(w.item.rows) && w.item.rows.length)) : isObj(w.items) && Object.keys(w.items).length > 0;
    var saved = function () { return build(c, name, w, lang)(p, ctx); };
    var cur = LBW.data.get(key);
    if (cur !== undefined) {
      var lw; try { lw = liveW(c, name, w, lang, key, cur); } catch (e) { LBW.drop(name + ': data "' + key + '": ' + e.message + ' (the saved copy)'); return has ? saved() : null; }
      var now = lw ? build(c, name, lw, lang)(p, ctx) : null; if (now && w.live !== false) H.live(now, lang); return now;   // v0.10: drawn from the data
    }
    var o = U.loading(lang, 'kit-' + w.type), up = w.source.upgrade == null ? 20000 : w.source.upgrade;
    // v0.9.1 · measured live (13 Nov 2026): a flow Code block runs late, after every message up to the next block that
    // waits for the visitor (6.6–12.5 s after its own place), so the saved copy is usually drawn first. It is replaced by
    // the live rows when they land within "upgrade" ms (20000 by default, 0 = never), unless the visitor already used it.
    // With no saved copy the skeleton waits that long instead.
    var lateUp = function () {
      if (!(up > 0)) return;
      LBW.data.wait(key, up).then(function (d) {
        if (!o.isConnected) return;
        if (H.usedByVisitor(o)) { LBW.drop(name + ': data "' + key + '" came late; the saved copy stays (already used)'); return; }
        var lw; try { lw = liveW(c, name, w, lang, key, d); } catch (e) { return; }
        var el = lw && build(c, name, lw, lang)(p, ctx); if (!el) return;
        var q = H.wasQuieted(o);   // v0.9.3: the visitor wrote since: the live card comes in quiet, as the saved one was
        // v0.10: what changed flashes, focus and scroll stay, "Updated: …" is said once (v0.9.5), and the card says it is live
        H.liveSwap(o, function () { transplant(o, el); if (q) H.quietAgain(o); }, lang); if (w.live !== false) H.live(o, lang);
      }, function () {});
    };
    return LBW.later(o, LBW.data.wait(key, has ? w.source.wait : Math.max(w.source.wait == null ? 1500 : w.source.wait, up)).then(function (d) { return liveW(c, name, w, lang, key, d); }),
      function (lw) { var el = lw && build(c, name, lw, lang)(p, ctx); if (!el) return false; transplant(o, el); if (w.live !== false) H.live(o, lang); },
      has ? function () { var el = saved(); if (!el) throw new Error('nothing to show'); transplant(o, el); lateUp(); } : null);
  }
  // a widget with params or a data source is made again for each tag, from its copy in the tag's language
  function dyn(c, name, lang, p, ctx) {
    var w = c.widgets[name];
    if (isObj(w.params)) { var vals = params(name, w.params, p); if (!vals) return null; w = withParams(w, w.params, vals, lang);
      // "data": { "param": "src" } · the key is the value of a "one" param ([[p:tarifas src=tarifas_es]])
      if (isObj(w.source) && isObj(w.source.data)) { var dk = vals[w.source.data.param]; if (!isStr(dk)) return null; w = merge(w, { source: merge(w.source, { data: dk }) }); } }
    if (isObj(w.source) && w.source.data != null && w.type !== 'carousel' && w.type !== 'calendar') return fromData(c, name, w, lang, p, ctx);
    var e = build(c, name, w, lang)(p, ctx); if (e && w.live === true && !isObj(w.source)) H.live(e, lang);   // v0.10: a flow tag's live values, opt-in (an agent may write params from memory)
    return e;
  }
  function setup(cfg) {
    // the checker is a separate file (kit/setup-check.js): `npm run bot` runs it before a config is uploaded, and the
    // bundle a bot loads leaves it out. Without it a config is taken as checked, and a widget that fails is skipped.
    var errs = setup._check ? setup._check(cfg) : [], bad = [], made = [];
    cfg = photosIn(cfg);
    root.__kitSetupErrors = errs.map(function (e) { return e.message; });
    errs.forEach(function (e) { if (e.widget != null) bad.push(e.widget); LBW.drop('setup: ' + e.message); try { console.error('[kit] setup: ' + e.message); } catch (x) {} });
    if (errs.some(function (e) { return e.widget == null; })) return { ok: false, errors: root.__kitSetupErrors, widgets: made };
    var langs = langsOf(cfg), dflt = dfltOf(cfg, langs);
    LBW.init(merge(pick(cfg, ['prefix', 'langs', 'timeZone', 'maxPerMessage', 'links', 'labels', 'quietMs', 'maxWaitMs', 'reveal', 'motion']), { langs: langs, defaultLang: dflt }));   // the runtime's default must be the config's
    // v0.9.5 · the config is localized once per language, not once per widget and language (38 deep walks of the showcase's
    // config were most of its setup). A language's copy is made when the first widget needs it; if making it throws, it isn't
    // kept, so every widget reports that error as before. Makers only read their copy: each widget reads its own part
    var LOCS = Object.create(null), locOf = function (l) { return own(LOCS, l) ? LOCS[l] : (LOCS[l] = loc(cfg, { lang: l, langs: langs, dflt: dflt }, '', false, null)); };
    Object.keys(cfg.widgets).forEach(function (name) {
      if (bad.indexOf(name) >= 0) return;
      // a text may be { en: …, es: … }: the maker runs once per language on a copy with that language's texts, and the
      // widget registered under `name` picks the one for the tag's lang
      var fns = {}, cs = {}, opts, cur, real = LBW.widget, w0 = cfg.widgets[name];
      // v0.9.0 · params, or rows from LBW.data: made again for each tag (dyn) from its copy by language; every other widget is
      // made once, as before. A carousel reads its own source (its select() waits for the data).
      var isDyn = isObj(w0) && (isObj(w0.params) || (isObj(w0.source) && w0.source.data != null && w0.type !== 'carousel'));
      try {
        LBW.widget = function (n, fn, o) { fns[cur] = fn; opts = o || opts; return LBW; };
        try { langs.forEach(function (l) { cur = l; var c = locOf(l); if (isDyn) cs[l] = c; MAKE[c.widgets[name].type](c, name, c.widgets[name], l); }); }
        finally { LBW.widget = real; }
        // v0.9.5 · "flow": true | [keys]: the widget's tag comes from a flow message with field values (lbw.js LBW.widget)
        if (w0.flow === true || isArr(w0.flow)) opts = merge(opts, { flow: w0.flow });
        var fixed = w0.lang, pickL = function (ctx) { return isStr(fixed) && own(fns, fixed) ? fixed : own(fns, ctx.lang) ? ctx.lang : dflt; };   // a widget with its own `lang` always speaks it
        LBW.widget(name, isDyn ? function (p, ctx) { var l = pickL(ctx); return dyn(cs[l], name, l, p, ctx); } : function (p, ctx) { return (fns[isStr(fixed) && own(fns, fixed) ? fixed : ctx.lang] || fns[dflt])(p, ctx); }, opts);
        made.push(name);
      } catch (e) { root.__kitSetupErrors.push(name + ': ' + e.message); LBW.drop('setup: ' + name + ': ' + e.message); }
    });
    warmIntl(langs, cfg.timeZone);
    return { ok: !root.__kitSetupErrors.length, errors: root.__kitSetupErrors, widgets: made };
  }
  // v0.9.5 · the first Intl formatter of a page loads ICU's data for its language and time zone, and the first widget that
  // wrote a date, a time or a chart tick paid for it (LBW.day.today took 318 ms live). Made once while the chat is idle, the
  // same formatters are cheap when a widget needs them. Nothing is drawn; where there is no idle callback, nothing runs.
  function warmIntl(langs, tz) {
    if (typeof root.requestIdleCallback !== 'function' || typeof Intl !== 'object') return;
    root.requestIdleCallback(function () {
      try {
        var d = new Date();
        new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
        new Intl.DateTimeFormat('en-GB', { timeZone: tz || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
        langs.forEach(function (l) { d.toLocaleDateString(l, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }); numFmt(l).format(1.5); });
      } catch (e) {}
    }, { timeout: 3000 });
  }
  setup.types = Object.keys(MAKE);
  // for kit/setup-check.js
  setup._ = { own: own, pick: pick, isArr: isArr, isObj: isObj, isStr: isStr, isPair: isPair, WORD: WORD, CODE: CODE, HOLE: HOLE, SLOT: SLOT,
    compile: compile, loc: loc, PTYPES: PTYPES, PNUM: PNUM, PSKIP: PSKIP, NEEDS: NEEDS, photosIn: photosIn, srcsetOf: srcsetOf, photoRef: photoRef, photoSet: photoSet, langsOf: langsOf, dfltOf: dfltOf, resolve: resolve, reply: reply, timeOf: timeOf };
  K.setup = setup;
})(typeof window !== 'undefined' ? window : this);
