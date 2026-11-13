/* kit/setup-check.js · the checker for a LBW.kit.setup config: every problem as a sentence, nothing drawn, never a throw.
   Load it after kit/setup.js where you write or test a config: `npm run check:config`, `npm run bot`, the mock, the tests
   and the lbw-kit.dev bundle have it. The bundle a bot loads (lbw-kit.min.js) leaves it out: a config is checked before
   it is uploaded, not in every visitor's browser.
     LBW.kit.setup.check(config) → [sentences]        with it loaded, setup() also skips the widgets it reports */
(function (root) {
  'use strict';
  var LBW = root.LBW; if (!LBW || !LBW.kit || !LBW.kit.setup || !LBW.kit.setup._) return;
  var K = LBW.kit, I = K.setup._, own = I.own, pick = I.pick, isArr = I.isArr, isObj = I.isObj, isStr = I.isStr, isPair = I.isPair, WORD = I.WORD, CODE = I.CODE,
      HOLE = I.HOLE, SLOT = I.SLOT, compile = I.compile, loc = I.loc, langsOf = I.langsOf, dfltOf = I.dfltOf, resolve = I.resolve, reply = I.reply, timeOf = I.timeOf;

  // v0.8.1.4 · the kit's icon and tone names, here too: the command-line checker runs without kit.js (scripts/lib.mjs).
  // test/status.test.mjs keeps them equal to LBW.kit.h.icons and LBW.kit.h.tones.
  var ICONS = 'check x info alert phone mail chat calendar clock pin external star user shield bell doc thumb'.split(' '), TONES = 'neutral ok info warn danger'.split(' ');
  K.setup._.icons = ICONS; K.setup._.tones = TONES;
  // ── checking a config: every problem as a sentence, nothing drawn, never a throw ─────────────────
  var TOP = '$schema version prefix langs defaultLang timeZone maxPerMessage links labels quietMs maxWaitMs reveal photos actions replies widgets'.split(' ');
  var KEYS = {
    cards: 'type cls param items item kicker disclaimer single fallback pointsCls allowDup lang reply links status',
    table: 'type cls param items item kicker fold pick same allowDup lang reply links fallback',
    form: 'type cls lang kicker title cta note preset steps summary fields allowDup collapse',
    contact: 'type cls lang kicker title big rows hours note buttons buttonsWithSummary summary compact allowDup',
    chips: 'type cls lang max items own carriedBy crowd',
    carousel: 'type cls lang allowDup items source filter kicker title titles lead note reply links max',
    calc: 'type cls lang kicker title cta state controls tables compute money result send notes links allowDup collapse',
    stats: 'type cls lang allowDup items item reply links',
    people: 'type cls lang kicker title note allowDup items filter reply',
    consent: 'type cls lang icon title text yes no link allowDup',
    slots: 'type cls lang kicker title cta note sep h12 collapse allowDup ics days weekly say',
    confirm: 'type cls lang allowDup form status title rows steps note actions',
    review: 'type cls lang kicker title cta note collapse allowDup state tables compute money lines total discard send',
    chart: 'type cls lang kicker title sub note links allowDup kind stack height state tables compute money x series y mark summary',
    compare: 'type cls lang kicker title titles param items rows min max empty note same primary allowDup',
    season: 'type cls lang kicker ranges words rows note reply links allowDup',
    rating: 'type cls lang kicker title text kind min max labels bands send note allowDup'
  };
  var ITEM = { table: 'kicker title cols rows note source link'.split(' '), cards: 'kicker title who line points pointsCls pointsTitle rows note noteCls link status badge'.split(' '), stats: 'kicker title stats source'.split(' '), people: 'name role img note'.split(' '),
    slide: 'id img badge kicker name sub price save status desc reply link gallery until'.split(' '), compare: 'name values reply link'.split(' ') };
  var NEED = { cards: [], table: [], form: ['steps', 'summary', 'cta'], contact: ['title'], chips: ['items'], carousel: [], calc: ['state', 'controls', 'result', 'send', 'cta'],
    stats: [], people: ['items'], consent: ['title', 'yes', 'no'], slots: ['cta', 'say'], confirm: ['form', 'title'], review: ['state', 'lines', 'send', 'cta'], chart: ['title', 'x', 'series'], compare: ['items', 'rows'], season: ['ranges'], rating: ['title', 'send'] };
  // check every language's copy; a problem that every language has is reported once, the others with their language
  // v0.8.1.10 · the photo sets: a base under "links", sizes as [folder, width] going up, an optional ratio [w, h]
  function photoSets(cfg, top) {
    var P = cfg.photos; if (P == null) return;
    if (!isObj(P)) { top('"photos" is an object of sets: { "name": { "base": "https://…/", "sizes": [["folder/", 495], …], "ratio": [4, 3] } }'); return; }
    var links = isArr(cfg.links) ? cfg.links.filter(isStr) : [];
    Object.keys(P).forEach(function (n) {
      var d = P[n], at = 'photos.' + n;
      if (!/^[a-z_][a-z0-9_]*$/i.test(n)) top(at + ': a set\'s name is a plain word (it starts a photo: "' + n + ':file.jpg")');
      if (!isObj(d)) { top(at + ' must be an object with "base" and "sizes"'); return; }
      Object.keys(d).forEach(function (k) { if (['base', 'sizes', 'ratio'].indexOf(k) < 0) top(at + ': unknown key "' + k + '". Known: base, sizes, ratio'); });
      if (!isStr(d.base) || !/^https:\/\/[^\s"'<>]+\/$/.test(d.base)) top(at + '.base is an https address ending in "/"');
      else if (!links.some(function (o) { return /^https:/.test(o) && d.base.indexOf(o) === 0; })) top(at + '.base "' + d.base + '" is not under any entry of "links"');
      if (!isArr(d.sizes) || !d.sizes.length) top(at + '.sizes is a list of [folder, width], smallest first: [["T2D3/", 495], ["", 1440]]');
      else d.sizes.forEach(function (z, i) {
        if (!isArr(z) || z.length !== 2 || typeof z[0] !== 'string' || !(Number.isInteger(z[1]) && z[1] > 0)) top(at + '.sizes[' + i + '] is [folder, width]: a text ("" for none) and a whole number of pixels');
        else if (/[\s"'<>]/.test(z[0]) || /^\//.test(z[0])) top(at + '.sizes[' + i + ']: the folder "' + z[0] + '" has a space, a quote or a leading "/"');
        else if (i && isArr(d.sizes[i - 1]) && !(z[1] > d.sizes[i - 1][1])) top(at + '.sizes: the widths go up (' + d.sizes[i - 1][1] + ', then ' + z[1] + ')');
      });
      if (d.ratio != null && !(isArr(d.ratio) && d.ratio.length === 2 && d.ratio.every(function (x) { return typeof x === 'number' && x > 0; }))) top(at + '.ratio is [width, height], such as [4, 3]');
    });
  }
  function check(cfg) {
    if (!isObj(cfg)) return check1(cfg);
    var pre = [];
    photoSets(cfg, function (m) { pre.push({ widget: null, message: m }); });
    cfg = I.photosIn(cfg, function (w, m) { pre.push({ widget: w, message: w + ': ' + m }); });
    if (pre.length) return pre.concat(check0(cfg).filter(function (e) { return !pre.some(function (p) { return p.message === e.message; }); }));
    return check0(cfg);
  }
  function check0(cfg) {
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
    if (cfg.reveal != null && cfg.reveal !== true && cfg.reveal !== false) top('"reveal" is true or false');
    links.forEach(function (l) { if (/^https?:/.test(l) && !/\/$/.test(l)) top('link "' + l + '" must end in "/"'); });
    var linkOK = function (url) { return isStr(url) && !/[\s"'<>]/.test(url) && links.some(function (o) { return /^https?:/.test(o) && url.indexOf(/\/$/.test(o) ? o : o + '/') === 0; }); };
    ['actions', 'replies'].forEach(function (k) { if (cfg[k] != null && !isObj(cfg[k])) top('"' + k + '" must be an object'); });
    if (cfg.timeZone != null) { try { new Intl.DateTimeFormat('en', { timeZone: cfg.timeZone }); } catch (e) { top('timeZone "' + cfg.timeZone + '" is not a time zone (write it like Europe/Madrid)'); } }
    ['langs', 'defaultLang'].forEach(function (k) { var v = cfg[k]; if (v != null && !(k === 'langs' ? isArr(v) && v.length && v.every(isStr) : isStr(v))) top('"' + k + '" must be ' + (k === 'langs' ? 'a list of language codes' : 'a language code')); });
    var acts = isObj(cfg.actions) ? cfg.actions : {}, reps = isObj(cfg.replies) ? cfg.replies : {};

    // v0.8.1.5 · the fields a reply writes in Landbot: { field: value }, names as Landbot takes them (a-z, 0-9, _), values text
    // keys: the placeholders its values may hold ({id}, {title}…); null: none (those widgets save their values as written)
    function fieldsCheck(f, where, say, keys) {
      if (f == null) return; if (!isObj(f) || !Object.keys(f).length) { say(where + ': the third element is the fields it saves, { "field": "value" }'); return; }
      Object.keys(f).forEach(function (k) {
        if (!/^[a-z0-9_]{1,100}$/.test(k)) say(where + ': field "' + k + '" must be a Landbot field name (a-z, 0-9, _)');
        else if (['id', 'uuid', 'date_registred'].indexOf(k) >= 0) say(where + ': field "' + k + '" is Landbot\'s own and can\'t be written');
        if (typeof f[k] !== 'string' && typeof f[k] !== 'number' && typeof f[k] !== 'boolean') say(where + ': the value of "' + k + '" must be text');
        else String(f[k]).replace(/\{([A-Za-z0-9_]*)[^}]*\}/g, function (m, n) { if (!keys || keys.indexOf(n) < 0) say(where + ': "' + k + '" holds ' + m + (keys ? ', which isn\'t one of ' + keys.map(function (x) { return '{' + x + '}'; }).join(' ') : ': this widget saves its values as written, with no placeholders')); return m; });
      });
    }
    // an action, by name or written out: one kind, a label, and a link the allow-list lets through
    function act(a, say, where, templated) {
      var use = typeof a === 'string' ? a : isObj(a) ? a.use : null;
      if (use != null && !own(acts, use)) { say(where + ': action "' + use + '" is not in "actions"'); return; }
      var r = resolve({ actions: acts }, a); if (!r) { say(where + ': an action is a name or an object'); return; }
      var kinds = ['tel', 'wa', 'link', 'reply', 'mail'].filter(function (k) { return r[k] != null; });
      if (kinds.length !== 1) { say(where + ': an action needs one of tel, wa, link, reply, mail'); return; }
      // v0.8.1.4 · "icon" names one of the kit's icons; "danger" is true or left out
      if (r.icon != null && ICONS.indexOf(r.icon) < 0) say(where + ': icon "' + r.icon + '" is not one of the kit\'s icons. Known: ' + ICONS.join(', '));
      if (r.danger != null && typeof r.danger !== 'boolean') say(where + ': "danger" is true or false');
      if (r.danger === true && r.primary) say(where + ': "danger" and "primary" together: the primary is the card\'s one main action, never a destructive one');
      if (r.reply) { if (!isPair(r.reply)) say(where + ': "reply" is [label, sentence] or [label, sentence, { field: value }]'); else fieldsCheck(r.reply[2], where + '.reply', say, ['text', 'id', 'title']); return; }
      if (!isStr(r.label)) say(where + ': the action has no "label"');
      if (r.tel && links.indexOf('tel:') < 0) say(where + ': a tel action needs "tel:" in "links"');
      if (r.wa && !linkOK('https://wa.me/')) say(where + ': a wa action needs "https://wa.me/" in "links"');
      if (r.link && !linkOK(templated ? String(r.link).split('{')[0] : r.link)) say(where + ': "' + r.link + '" is not under any entry of "links"');
      if (r.link && !templated && /[{}]/.test(String(r.link))) say(where + ': a link can only hold a {placeholder} in a calc\'s "links"');
      if (r.mail && links.indexOf('mailto:') < 0) say(where + ': a mail action needs "mailto:" in "links"');
      if (r.mail && !(typeof r.mail === 'string' && /^[^@\s?\/,;]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(r.mail))) say(where + ': "mail" is one plain address (a@b.co), with no subject or text');
    }
    Object.keys(acts).forEach(function (k) { act(acts[k], top, 'actions.' + k); });
    Object.keys(reps).forEach(function (k) { if (!isPair(reps[k])) top('replies.' + k + ' is [label, sentence]'); else fieldsCheck(reps[k][2], 'replies.' + k, top, ['id', 'title', 'name', 'role']); });
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
      // v0.8.1.10 · a form's options: [key, label] or [key, label, desc], the desc one short line
      function opts(l, where) { list(l, where, function (x, at) { if (!isPair(x) || x.length > 3) err(at + ' is [key, label] or [key, label, desc]'); else if (x.length === 3) desc(x[2], at + '[2]'); }); }
      function desc(d, where) { if (typeof d !== 'string' || !d.trim()) err(where + ': a desc is one line of text'); else if (Array.from(d).length > 80) err(where + ': a desc is one short line, 80 characters at most (' + Array.from(d).length + ')'); }
      function rep(r, where, keys) { if (r == null) return; if (typeof r === 'string') { if (!own(reps, r)) err(where + ': reply "' + r + '" is not in "replies"'); } else if (!isPair(r)) err(where + ' is a name in "replies" or [label, sentence]'); else fieldsCheck(r[2], where, err, keys || null); }
      function param(v, where) { if (v != null && !WORD.test(v)) err(where + ' "' + v + '" must be lower-case (a tag\'s keys are read lower-cased)'); }
      // v0.8.1.4 · a status ({ text, tone }) or a badge ('text' or { text, tone }); the tone one of LBW.kit.h.tones
      function slideStatus(v, where) { if (v == null) return; if (!isObj(v) || !isStr(v.text)) { err(where + ' is { "text": "…", "tone": "…" } (or "ok": true)'); return; } only(v, ['text', 'tone', 'ok'], where); if (v.tone != null && TONES.indexOf(v.tone) < 0) err(where + '.tone "' + v.tone + '" is not a tone. Known: ' + TONES.join(', ')); }
      function toned(v, where, needObj) {
        if (v == null) return; if (!needObj && isStr(v)) return;
        if (!isObj(v) || !isStr(v.text)) { err(where + ' is ' + (needObj ? '' : '"text" or ') + '{ "text": "…", "tone": "' + TONES.join('|') + '" }'); return; }
        only(v, ['text', 'tone'], where);
        if (v.tone != null && TONES.indexOf(v.tone) < 0) err(where + '.tone "' + v.tone + '" is not a tone. Known: ' + TONES.join(', '));
      }
      function url(pair, where) { if (pair == null) return; if (!isPair(pair)) err(where + ' is [label, url]'); else if (!linkOK(pair[1])) err(where + ': "' + pair[1] + '" is not under any entry of "links"'); }

      try {
        if (!/^[a-z][a-z0-9_]*$/.test(name)) err('a widget name is lower-case letters, digits and _');
        if (!isObj(w) || !isStr(w.type) || !own(KEYS, w.type)) { err('unknown type "' + (isObj(w) ? w.type : w) + '". Known: ' + Object.keys(KEYS).join(', ')); return; }
        var known = KEYS[w.type].split(' ');
        Object.keys(w).forEach(function (k) { if (known.indexOf(k) < 0) err('unknown option "' + k + '" for ' + w.type + '. Known: ' + known.join(', ')); });
        NEED[w.type].forEach(function (k) { if (w[k] == null) err('missing "' + k + '"'); });
        ['links', 'buttons', 'buttonsWithSummary', 'actions'].forEach(function (k) { list(w[k], k, function (a, at) { act(a, err, at, w.type === 'calc' && k === 'links'); }); });
        rep(w.reply, 'reply', { cards: ['id', 'title'], table: ['id', 'title'], stats: ['id', 'title'], people: ['id', 'name', 'role'] }[w.type] || null);
        strs(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'text', 'big', 'sub', 'disclaimer', 'lead'], '');
        if (w.item != null && !isObj(w.item)) err('"item" must be an object');

        // v0.8.1.10 · a table: 2 to 5 columns [key, label, align], 1 to 30 rows of that many texts; "pick" over the column keys
        if (w.type === 'table') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single table)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of tables by id');
          var ts = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {}, ckeys = null;
          Object.keys(ts).forEach(function (id) {
            var t = ts[id]; if (!isObj(t) || !isStr(t.title)) { err('table "' + id + '" has no "title"'); return; }
            only(t, ITEM.table, id); strs(t, ['kicker', 'note', 'source'], id); url(t.link, id + '.link');
            if (!isArr(t.cols) || t.cols.length < 2 || t.cols.length > 5) { err(id + '.cols holds 2 to 5 columns, [key, label] or [key, label, "end"] (a phone shows about 3; more scroll sideways)'); return; }
            var ks = [];
            t.cols.forEach(function (c, i) {
              if (!isArr(c) || c.length < 2 || c.length > 3 || !isStr(c[0]) || typeof c[1] !== 'string') { err(id + '.cols[' + i + '] is [key, label] or [key, label, align]'); return; }
              if (!WORD.test(c[0])) err(id + '.cols[' + i + ']: the key "' + c[0] + '" is a plain lower-case word (it is a {placeholder} in "pick")');
              if (ks.indexOf(c[0]) >= 0) err(id + '.cols: the key "' + c[0] + '" is there twice'); ks.push(c[0]);
              if (c[2] != null && ['start', 'end'].indexOf(c[2]) < 0) err(id + '.cols[' + i + ']: align is "start" or "end" (numbers)');
            });
            if (ckeys && ckeys.join() !== ks.join() && isObj(w.pick)) err(id + '.cols: with "pick", every table has the same column keys (' + ckeys.join(', ') + ')'); if (!ckeys) ckeys = ks;
            if (!isArr(t.rows) || !t.rows.length || t.rows.length > 30) err(id + '.rows holds 1 to 30 rows (more is a page, not a card: link it)');
            else t.rows.forEach(function (r, i) {
              if (!isArr(r) || r.length !== t.cols.length) err(id + '.rows[' + i + '] has ' + (isArr(r) ? r.length : 0) + ' values for ' + t.cols.length + ' columns');
              else r.forEach(function (v, j) { if (typeof v !== 'string' && typeof v !== 'number') err(id + '.rows[' + i + '][' + j + '] must be text (format numbers and money yourself)'); });
            });
          });
          param(w.param, 'param'); if (w.fallback != null && !own(ts, w.fallback)) err('fallback "' + w.fallback + '" is not one of the items');
          if (w.fold != null && !(Number.isInteger(w.fold) && w.fold >= 3)) err('"fold" is a whole number, 3 or more: the rows shown before "See all"');
          if (w.same != null && w.same !== false) err('"same" is false (keep a column that says the same in every row) or left out');
          if (w.pick != null) {
            if (!isObj(w.pick) || !isStr(w.pick.say)) err('"pick" is { "say": "…{column}…", "fields": { "field": "{column}" }, "label" }: each row becomes a button');
            else { only(w.pick, ['say', 'fields', 'label'], 'pick'); var pk = (ckeys || []).concat(['id']); text(w.pick.say, 'pick.say', pk, [], []); strs(w.pick, ['label'], 'pick');
              if (w.pick.fields == null) err('pick.fields is missing: a row that is chosen should be saved in Landbot, { "field": "{column}" }');
              else if (!isObj(w.pick.fields) || !Object.keys(w.pick.fields).length) err('pick.fields is { "field": "{column}" }, saved in Landbot with the sentence');
              else fieldsCheck(w.pick.fields, 'pick.fields', err, pk); }
          }
        }

        if (w.type === 'cards') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var cs = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(cs).forEach(function (id) { var it = cs[id]; if (!isObj(it) || !isStr(it.title)) { err('card "' + id + '" has no "title"'); return; } strs(it, ['kicker', 'who', 'line', 'note', 'pointsTitle'], id); only(it, ITEM.cards, id); toned(it.status, id + '.status', true); toned(it.badge, id + '.badge', false); url(it.link, id + '.link'); pairs(it.rows, id + '.rows'); list(it.points, id + '.points', function (x, at) { if (!isStr(x)) err(at + ' must be text'); }); });
          param(w.param, 'param'); if (w.fallback != null && !own(cs, w.fallback)) err('fallback "' + w.fallback + '" is not one of the items');
          // v0.8.1.4 · "status": { param, items: { key: { text, tone } } }: a status the tag names from a closed list (a flow's @{field})
          if (w.status != null) { if (!isObj(w.status) || !isObj(w.status.items) || !Object.keys(w.status.items).length) err('"status" is { "param": "…", "items": { key: { "text", "tone" } } }'); else { if (!isStr(w.status.param)) err('status.param names the tag\'s key, as "estado"'); param(w.status.param, 'status.param'); if (w.status.param === (w.param || 'id')) err('status.param must differ from the card\'s own param'); only(w.status, ['param', 'items'], 'status'); Object.keys(w.status.items).forEach(function (k) { var si = w.status.items[k]; if (!WORD.test(k)) err('status.items key "' + k + '" must be a plain word (a-z, 0-9, _)');
            // v0.8.1.5 · its own reply and links replace the card's while that status shows
            var sv = isObj(si) ? pick(si, ['text', 'tone']) : si; toned(sv, 'status.items.' + k, true);
            if (isObj(si)) { only(si, ['text', 'tone', 'reply', 'links'], 'status.items.' + k); if (si.reply != null) { rep(si.reply, 'status.items.' + k + '.reply', ['id', 'title']); var sr = reply({ replies: reps }, si.reply); if (isPair(sr)) { text(sr[0], 'status.items.' + k + '.reply', ['id', 'title'], [], []); text(sr[1], 'status.items.' + k + '.reply', ['id', 'title'], [], []); } } if (si.links != null) list(si.links, 'status.items.' + k + '.links', function (x, at) { act(x, err, at); }); } }); } }
          var r = reply({ replies: reps }, w.reply); if (isPair(r)) { text(r[0], 'reply', ['id', 'title'], [], []); text(r[1], 'reply', ['id', 'title'], [], []); }
        }

        if (w.type === 'form') {
          var keys = [], picks = [];
          list(w.steps, 'steps', function (st, at) {
            if (!isObj(st)) { err(at + ' must be an object'); return; }
            if (!isStr(st.key)) { err('step ' + keys.length + ' has no "key"'); return; }
            if (st.key === 'text') err('a step can\'t be called "text": {text} is the sentence the form sends');
            strs(st, ['title', 'ask'], st.key);
            if (isArr(st.items)) opts(st.items, st.key + '.items');
            else if (isObj(st.items)) {
              if (keys.indexOf(st.items.by) < 0) err(st.key + '.items.by "' + st.items.by + '" is not an earlier step');
              if (!isObj(st.items.map)) err(st.key + '.items.map must be an object'); else Object.keys(st.items.map).forEach(function (k) { opts(st.items.map[k], st.key + '.items.map.' + k); });
              opts(st.items['else'], st.key + '.items.else');
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
          if (!isObj(w.items)) err('"items" must be an object of [label, sentence] by key'); else Object.keys(w.items).forEach(function (k) {
            var c = w.items[k], at = 'items.' + k;
            if (isObj(c)) { only(c, ['label', 'say', 'desc', 'fields'], at); if (!isStr(c.label) || !isStr(c.say)) err(at + ' needs "label" and "say" (the sentence it sends)'); if (c.desc != null) desc(c.desc, at + '.desc'); if (c.fields != null && (!isObj(c.fields) || !Object.keys(c.fields).length)) err(at + '.fields is { "field": "value" }, saved in Landbot with the sentence'); else fieldsCheck(c.fields, at + '.fields', err, null); }
            else if (!isPair(c) || c.length > 2) err(at + ' is [label, sentence] or { "label", "say", "desc", "fields" }');
          });
          if (w.max != null && !(Number.isInteger(w.max) && w.max >= 1)) err('"max" must be a whole number, 1 or more');
          if (w.crowd != null && !(typeof w.crowd === 'number' && w.crowd >= 0 && w.crowd % 1 === 0)) err('"crowd" is a whole number: with that many actions already under the message\'s cards the chips stay out (2 by default, 0 = never)');
          if (w.own != null && !isObj(w.own)) err('"own" must be an object');
          if (w.carriedBy != null && !isObj(w.carriedBy)) err('"carriedBy" must be an object'); else Object.keys(w.carriedBy || {}).forEach(function (k) { if (!isArr(w.carriedBy[k])) err('carriedBy.' + k + ' must be a list of widget names'); });
        }

        if (w.type === 'carousel') {
          var n = list(w.items, 'items', function (it, at) { if (!isObj(it) || !isStr(it.name)) { err(at + ' has no "name"'); return; } only(it, ITEM.slide.concat(isObj(w.filter) && isStr(w.filter.by) ? [w.filter.by] : []), at); strs(it, ['kicker', 'sub', 'desc', 'badge', 'save'], at); url(it.link, at + '.link'); if (it.until != null && LBW.day.read(it.until) == null) err(at + '.until is a date, D/M/YYYY'); if (it.until != null && !isStr(cfg.timeZone)) err(at + '.until needs "timeZone" in the config (the day ends where the client is, not where the visitor is)'); if (it.img != null && !(isObj(it.img) && linkOK(it.img.src))) err(at + '.img.src is not under any entry of "links"'); rep(it.reply, at + '.reply'); slideStatus(it.status, at + '.status'); }).length;
          if (isArr(w.items) && !n) err('"items" is empty');
          if (w.items == null && w.source == null) err('missing "items" (or a "source" to read them live)');
          if (w.source != null) {
            var sc = w.source, slideKeys = ITEM.slide.concat(isObj(w.filter) && isStr(w.filter.by) ? [w.filter.by] : []);
            if (!isObj(sc)) err('"source" is { "csv" | "json": an https URL, "id": the id column, "map": { "name": "{column}", … } }');
            else {
              only(sc, ['csv', 'json', 'path', 'id', 'map', 'merge', 'order', 'max', 'maxAge', 'prefetch'], 'source');
              if (sc.order != null && (sc.order !== 'items' || !(isArr(w.items) && w.items.length))) err('source.order is "items": the slides follow the saved items\' order (it needs "items")');
              if (sc.merge != null && (sc.merge !== true && sc.merge !== false)) err('source.merge is true or false');
              if (sc.merge === true && !(isArr(w.items) && w.items.length)) err('source.merge needs "items": the saved item with the same id fills what a live row lacks');
              if ((sc.csv == null) === (sc.json == null)) err('source needs one of "csv" or "json"');
              ['csv', 'json'].forEach(function (k) { if (sc[k] != null && (!isStr(sc[k]) || !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)[^\s"'<>]+$/.test(sc[k]))) err('source.' + k + ' must be an https URL (http://localhost is accepted, to try a map against a saved copy)'); });
              if (sc.path != null && (sc.json == null || !isStr(sc.path))) err('source.path is the dotted key of the list inside a "json" answer');
              if (sc.id != null && (!isStr(sc.id) || !(sc.csv != null ? /^[a-z0-9_]+$/ : /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/).test(sc.id))) err('source.id is the name of the id column' + (sc.csv != null ? ' (lower-case: a CSV\'s headers are read lower-cased)' : ''));
              if (sc.max != null && !(typeof sc.max === 'number' && sc.max % 1 === 0 && sc.max >= 1 && sc.max <= 5000)) err('source.max is how many rows are read: a whole number from 1 to 5000');
              if (sc.maxAge != null && !(typeof sc.maxAge === 'number' && sc.maxAge >= 10000)) err('source.maxAge is in milliseconds, 10000 at least (60000 by default)');
              var cols = [], lowOnly = sc.csv != null, col = function (x, at) {   // every "{column}" in the map, and its shape
                if (isStr(x)) { (x.match(/\{[^{}]*\}/g) || []).forEach(function (m) { var c = m.slice(1, -1).replace(/\|text$/, ''); cols.push(c);
                  if (lowOnly ? !/^[A-Za-z0-9_]+$/.test(c) : !/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(c)) err(at + ': "' + m + '" is not a column name (letters, digits, _' + (lowOnly ? '' : '; dots for a nested JSON key, as {title.rendered}; {key|text} reads HTML as text') + ')');
                  else if (lowOnly && c !== c.toLowerCase()) err(at + ': "' + m + '" must be lower-case (a CSV\'s headers are read lower-cased)'); }); return true; }
                return false; };
              if (isStr(sc.id) && lowOnly && sc.id !== sc.id.toLowerCase()) err('source.id "' + sc.id + '" must be lower-case (a CSV\'s headers are read lower-cased)');
              if (!isObj(sc.map)) err('source.map is missing: { "name": "{column}", … }');
              else {
                var mp = sc.map, fkey = isObj(w.filter) && isStr(w.filter.by) ? w.filter.by : null, TEXT = ['name', 'kicker', 'sub', 'desc', 'badge', 'save', 'until'].concat(fkey ? [fkey] : []);
                only(mp, TEXT.concat(['price', 'img', 'link']), 'source.map');
                if (own(mp, 'reply')) err('source.map can\'t fill "reply": a cell would become a sentence the visitor sends');
                TEXT.forEach(function (k) { if (mp[k] != null && !col(mp[k], 'source.map.' + k)) err('source.map.' + k + ' must be text, as "{column}"'); });
                if (mp.name == null && sc.merge === true) { if (isArr(w.items) && !w.items.every(function (it) { return isObj(it) && it.name != null; })) err('source.map has no "name": with merge every saved item needs one'); }
                else if (!isStr(mp.name) || !/\{[A-Za-z0-9_.]+(\|text)?\}/.test(mp.name)) err('source.map.name must name a column, as "{name}" (or leave it out with "merge": true, and the saved item names the slide)');
                if (!Object.keys(mp).some(function (k) { return JSON.stringify(mp[k]).indexOf('{') >= 0 && /\{[A-Za-z0-9_.]+(\|text)?\}/.test(JSON.stringify(mp[k])); })) err('source.map fills nothing from the file: name at least one column, as "{url}"');
                if (fkey && !(isStr(mp[fkey]) && /\{[A-Za-z0-9_.]+(\|text)?\}/.test(mp[fkey]))) err('source.map.' + fkey + ' is missing: the filter reads it from a column, as "{' + fkey + '}"');
                if (mp.until != null && !isStr(cfg.timeZone)) err('source.map.until needs "timeZone" in the config (the day ends where the client is)');
                if (mp.link != null) { if (!isPair(mp.link)) err('source.map.link is [label, "{column}"]'); else { col(mp.link[0], 'source.map.link'); col(mp.link[1], 'source.map.link'); } }
                // v0.8.1.12 · { "photo": "set:{column}", "alt" }: the set is fixed, the file name comes from the row
                if (mp.img != null && isObj(mp.img) && mp.img.photo != null) { only(mp.img, ['photo', 'alt'], 'source.map.img'); var pm = isStr(mp.img.photo) ? /^([a-z_][a-z0-9_]*):(.+)$/i.exec(mp.img.photo) : null;
                  if (!pm) err('source.map.img.photo is "set:{column}", a set of "photos" then the column that holds the file name');
                  else { if (!(isObj(cfg.photos) && own(cfg.photos, pm[1]))) err('source.map.img.photo: "' + pm[1] + ':" is not a set in "photos"'); if (/[{}]/.test(pm[1])) err('source.map.img.photo: the set is fixed, only the file name may be a {column}'); col(pm[2], 'source.map.img.photo'); }
                  if (mp.img.alt != null && !col(mp.img.alt, 'source.map.img.alt')) err('source.map.img.alt must be text'); }
                else if (mp.img != null) { if (!(isObj(mp.img) && isStr(mp.img.src))) err('source.map.img is { "src": "{column}", "alt": text } or { "photo": "set:{column}", "alt": text }'); else { only(mp.img, ['src', 'alt', 'width', 'height'], 'source.map.img'); col(mp.img.src, 'source.map.img.src'); if (mp.img.alt != null && !col(mp.img.alt, 'source.map.img.alt')) err('source.map.img.alt must be text'); } }
                if (mp.price != null) { if (!(isObj(mp.price) && isStr(mp.price.now))) err('source.map.price is { "now": "{column}", "unit": text, "list": text }'); else { only(mp.price, ['now', 'unit', 'list'], 'source.map.price'); ['now', 'unit', 'list'].forEach(function (k) { if (mp.price[k] != null && !col(mp.price[k], 'source.map.price.' + k)) err('source.map.price.' + k + ' must be text'); }); } }
              }
              if (isObj(w.filter) && isStr(w.filter.by) && !(isArr(w.filter.values) && w.filter.values.length && w.filter.values.every(isStr))) err('with a "source", filter.values lists the values the tag may carry (the rows aren\'t known yet)');
            }
          }
          if (w.filter != null) { if (!isObj(w.filter) || !isStr(w.filter.by)) err('filter is { "by": a key of the items, "param": the tag key }'); else param(w.filter.param || w.filter.by, 'filter.param'); if ((w.filter.param || w.filter.by) === 'ids') err('filter.param can\'t be "ids": a carousel reads ids= as the slides to show'); }
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
            if (d['default'] == null && !(d.values != null && d.required === true)) err('state.' + k + ' has no "default" (a list of values may say "required": true instead: a tag without it then draws nothing)');
            if (d.required != null && (d.required !== true || d.values == null || w.type !== 'calc')) err('state.' + k + '.required is true, on a list of values, in a calc');
            if (d.labels != null) { if (!isObj(d.labels) || !isArr(d.values) || w.type !== 'calc') err('state.' + k + '.labels is { value: label } for a calc\'s list of values'); else { Object.keys(d.labels).forEach(function (v) { if (d.values.indexOf(v) < 0) err('state.' + k + '.labels.' + v + ' is not one of its values'); else if (typeof d.labels[v] !== 'string') err('state.' + k + '.labels.' + v + ' must be text'); }); d.values.forEach(function (v) { if (!own(d.labels, v)) err('state.' + k + '.labels has no label for "' + v + '"'); }); pickKeys.push(k); } }
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
          list(res.rows, 'result.rows', function (x, at) { if (!isPair(x)) err(at + ' is [label, value]'); else { T(x[0], at); T(x[1], at); if (x[2] != null && nums.indexOf(x[2]) < 0) err(at + '[2] "' + x[2] + '" is not a number of the state or compute (the row is left out while it is 0)'); } });
          if (w.type === 'calc') { T(w.title, 'title'); T(w.kicker, 'kicker'); list(w.links, 'links', function (a, at) { var x = resolve({ actions: acts }, a); if (x) { T(x.link, at + '.link'); T(x.label, at + '.label'); } }); }
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
            if (w.stack != null && w.stack !== true && w.stack !== false) err('"stack" is true or false');
            if (w.stack === true) {   // v0.8.1.12 · bars piled per point: 2 to 4 series, none below 0
              if (w.kind !== 'bar') err('"stack" is for "kind": "bar"');
              if (isArr(w.series) && (ns < 2 || ns > 4)) err('a stacked chart holds 2 to 4 series');
              (isArr(w.series) ? w.series : []).forEach(function (se, k) { if (isObj(se) && isArr(se.values) && se.values.some(function (n) { return typeof n === 'number' && n < 0; })) err('series[' + k + '].values: a stacked chart has no value below 0'); });
            } else if (isArr(w.series) && (ns < 1 || ns > 2)) err('"series" holds one or two series (three or four: "stack": true, with "kind": "bar")');
            if (w.y != null && !isObj(w.y)) err('"y" must be an object'); else if (isObj(w.y)) { if (w.y.ticks != null && !(Number.isInteger(w.y.ticks) && w.y.ticks >= 1 && w.y.ticks <= 10)) err('y.ticks is a whole number from 1 to 10'); strs(w.y, ['suffix'], 'y'); }
            if (w.height != null && !(typeof w.height === 'number' && w.height >= 100 && w.height <= 400)) err('"height" is a number from 100 to 400');
            if (w.mark != null) { if (!isObj(w.mark) || w.mark.at == null) err('mark is { "at": a point of x (a number or a formula), "label" }'); else if (typeof w.mark.at === 'string') formula(w.mark.at, 'mark.at', []); else if (!Number.isInteger(w.mark.at) || w.mark.at < 0 || (points != null && w.mark.at >= points)) err('mark.at is the position of a point of x, from 0' + (points != null ? ' to ' + (points - 1) : '') + ' (or a formula that gives it)'); strs(w.mark, ['label'], 'mark'); }
            T(w.summary, 'summary');
            ['title', 'sub', 'note'].forEach(function (k) { if (w[k] != null && typeof w[k] !== 'string') err('"' + k + '" must be text'); });
          }
        }

        if (w.type === 'season') {
          if (!isStr(cfg.timeZone)) err('a season card needs "timeZone" in the config ("today" is the client\'s day)');
          var nr = list(w.ranges, 'ranges', function (r, at) { if (!isArr(r) || r.length !== 2 || LBW.day.read(r[0]) == null || LBW.day.read(r[1]) == null) err(at + ' is [first open day, last open day], each D/M/YYYY'); else if (LBW.day.read(r[1]) < LBW.day.read(r[0])) err(at + ': the last day is before the first'); }).length;
          if (isArr(w.ranges) && !nr) err('"ranges" is empty');
          if (w.words != null) { if (!isObj(w.words)) err('"words" must be an object'); else { only(w.words, ['open', 'closed', 'until', 'opens', 'in', 'closes', 'unknown', 'day', 'days'], 'words'); if (isStr(w.words.days) && w.words.days.indexOf('{n}') < 0) err('words.days needs "{n}", as "{n} days"'); strs(w.words, Object.keys(w.words), 'words'); } }
          list(w.rows, 'rows', function (r, at) { if (!isArr(r) || r.length < 2 || !isStr(r[0]) || !isStr(r[1])) err(at + ' is [label, value]'); });
          strs(w, ['kicker', 'note']);
        }

        if (w.type === 'compare') {
          if (w.same != null && w.same !== 'fold' && w.same !== 'mute') err('"same" is "fold" (equal rows go in one line under the table) or "mute" (the default: drawn quieter)');
          var rk = [];
          list(w.rows, 'rows', function (r, at) { if (!isArr(r) || !isStr(r[0]) || !isStr(r[1]) || (r[2] != null && !isStr(r[2]))) err(at + ' is [key, label] or [key, label, class]'); else rk.push(r[0]); });
          if (isArr(w.rows) && !w.rows.length) err('"rows" is empty');
          if (!isObj(w.items) || Object.keys(w.items).length < 2) err('"items" must hold at least two items by id');
          else {
            Object.keys(w.items).forEach(function (id) {
              var it = w.items[id]; if (!isObj(it) || !isStr(it.name)) { err('"' + id + '" has no "name"'); return; }
              only(it, ITEM.compare, id); rep(it.reply, id + '.reply'); url(it.link, id + '.link');
              if (!isObj(it.values)) { err(id + '.values must be an object of text by row key'); return; }
              Object.keys(it.values).forEach(function (k) { if (rk.indexOf(k) < 0) err(id + '.values.' + k + ' is not one of the rows (' + rk.join(', ') + ')'); else if (typeof it.values[k] !== 'string') err(id + '.values.' + k + ' must be text (format numbers and money yourself)'); });
            });
            rk.forEach(function (k) { if (!Object.keys(w.items).some(function (id) { return isObj(w.items[id]) && isObj(w.items[id].values) && w.items[id].values[k] != null; })) err('row "' + k + '" has no value in any item'); });
          }
          param(w.param, 'param');
          ['min', 'max'].forEach(function (k) { if (w[k] != null && !(Number.isInteger(w[k]) && w[k] >= 2 && w[k] <= 3)) err('"' + k + '" is 2 or 3'); });
          if (w.titles != null && (!isObj(w.titles) || Object.keys(w.titles).some(function (k) { return k !== '2' && k !== '3'; }))) err('"titles" is { "2": text, "3": text }'); else strs(w.titles, ['2', '3'], 'titles');
          if (w.empty != null && typeof w.empty !== 'string') err('"empty" must be text');
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

        if (w.type === 'rating') {   // v0.8.1.6
          var kd = w.kind == null ? 'stars' : w.kind;
          if (['thumbs', 'stars', 'scale'].indexOf(kd) < 0) err('"kind" is thumbs, stars or scale');
          ['min', 'max'].forEach(function (k) { if (w[k] != null && !(typeof w[k] === 'number' && w[k] === Math.floor(w[k]))) err('"' + k + '" must be a whole number'); });
          if (kd === 'thumbs' && (w.min != null || w.max != null)) err('a thumbs rating has no "min" or "max": it is 1 (up) or 0 (down)');
          if (kd === 'stars' && (w.min != null || (w.max != null && (w.max < 3 || w.max > 10)))) err('stars go from 1 to "max", 3 to 10 (5 by default); no "min"');
          var smin = w.min == null ? 0 : w.min, smax = w.max == null ? 10 : w.max;
          if (kd === 'scale' && !(smax > smin && smax - smin <= 10)) err('a scale holds 2 to 11 values (min ' + smin + ', max ' + smax + ')');
          if (w.labels != null && !(isArr(w.labels) && w.labels.length === 2 && w.labels.every(function (x) { return typeof x === 'string'; }))) err('"labels" is [' + (kd === 'thumbs' ? 'no, yes' : 'low end, high end') + ']');
          if (kd === 'stars' && w.labels != null) err('stars have no "labels"');
          if (w.bands != null) { var prev = -Infinity; list(w.bands, 'bands', function (b, at) { if (!(isArr(b) && b.length === 2 && typeof b[0] === 'number' && isStr(b[1]))) { err(at + ' is [top value, name]'); return; } if (b[0] <= prev) err(at + ': bands go up'); prev = b[0]; }); }
          // {label} only where it has words: thumbs, or a scale with labels (its ends); {band} only with bands that cover the range
          var keysR = ['value', 'max'].concat(kd === 'thumbs' || (kd === 'scale' && w.labels != null) ? ['label'] : [], w.bands != null ? ['band'] : []);
          if (isArr(w.bands) && w.bands.length) { var lastTop = (w.bands[w.bands.length - 1] || [])[0], rmax = kd === 'thumbs' ? 1 : kd === 'stars' ? (w.max || 5) : smax, rmin = kd === 'thumbs' ? 0 : kd === 'stars' ? 1 : smin;
            if (typeof lastTop === 'number' && lastTop < rmax) err('bands: the last top (' + lastTop + ') is below the highest value (' + rmax + '): values above it would have no {band}');
            if (typeof (w.bands[0] || [])[0] === 'number' && w.bands[0][0] < rmin) err('bands: the first top (' + w.bands[0][0] + ') is below the lowest value (' + rmin + ')'); }
          if (!isObj(w.send) || !isStr(w.send.text)) err('"send" is { "text": "…{value}…", "fields": { field: "{value}" } }');
          else { text(w.send.text, 'send.text', keysR, [], []); only(w.send, ['text', 'fields'], 'send'); if (w.send.fields != null) fieldsCheck(w.send.fields, 'send.fields', err, keysR); if (w.send.fields == null) err('send.fields is missing: a rating that saves nothing in Landbot is only a picture'); }
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

  K.setup._check = check;
  K.setup.check = function (cfg) { return check(cfg).map(function (e) { return e.message; }); };
})(typeof window !== 'undefined' ? window : this);
