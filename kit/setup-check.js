/* kit/setup-check.js · the checker for a LBW.kit.setup config: every problem as a sentence, nothing drawn, never a throw.
   Load it after kit/setup.js where you write or test a config: `npm run check:config`, `npm run bot`, the mock, the tests
   and the lbw-kit.dev bundle have it. The bundle a bot loads (lbw-kit.min.js) leaves it out: a config is checked before
   it is uploaded, not in every visitor's browser.
     LBW.kit.setup.check(config) → [sentences]        with it loaded, setup() also skips the widgets it reports */
(function (root) {
  'use strict';
  var LBW = root.LBW; if (!LBW || !LBW.kit || !LBW.kit.setup || !LBW.kit.setup._) return;
  var K = LBW.kit, I = K.setup._, own = I.own, pick = I.pick, isArr = I.isArr, isObj = I.isObj, isStr = I.isStr, isPair = I.isPair, WORD = I.WORD, CODE = I.CODE,
      HOLE = I.HOLE, SLOT = I.SLOT, PTYPES = I.PTYPES, PNUM = I.PNUM, PSKIP = I.PSKIP, compile = I.compile, loc = I.loc, langsOf = I.langsOf, dfltOf = I.dfltOf, resolve = I.resolve, reply = I.reply, timeOf = I.timeOf;

  // v0.8.1.4 · the kit's icon and tone names, here too: the command-line checker runs without kit.js (scripts/lib.mjs).
  // test/status.test.mjs keeps them equal to LBW.kit.h.icons and LBW.kit.h.tones.
  var ICONS = 'check x info alert phone mail chat calendar clock pin external star user shield bell doc thumb'.split(' '), TONES = 'neutral ok info warn danger'.split(' ');
  K.setup._.icons = ICONS; K.setup._.tones = TONES;
  // ── checking a config: every problem as a sentence, nothing drawn, never a throw ─────────────────
  var TOP = '$schema version prefix langs defaultLang timeZone maxPerMessage links labels quietMs maxWaitMs reveal motion photos screen actions replies widgets'.split(' ');
  var KEYS = {
    cards: 'type cls param items item kicker disclaimer single fallback pointsCls allowDup lang reply links status params money source live',
    table: 'type cls param items item kicker fold pick same allowDup lang reply links fallback params money source live',
    form: 'type cls lang kicker title cta note preset steps summary fields allowDup collapse density params money',
    contact: 'type cls lang kicker title big rows hours note buttons buttonsWithSummary summary compact allowDup params money',
    chips: 'type cls lang max items own carriedBy crowd params money',
    carousel: 'type cls lang allowDup items source filter kicker title titles lead note reply links max params money live style',
    calc: 'type cls lang kicker title cta state controls tables compute money result send notes links allowDup collapse density params',
    stats: 'type cls lang allowDup items item reply links params money source live',
    people: 'type cls lang kicker title note allowDup items filter reply params money source live',
    consent: 'type cls lang icon title text yes no link allowDup params money',
    slots: 'type cls lang kicker title cta note sep h12 collapse density allowDup ics days weekly say params money',
    confirm: 'type cls lang allowDup form status title rows steps note actions params money style code ics countdown',
    review: 'type cls lang kicker title cta note collapse density allowDup state tables compute money lines total discard send params',
    chart: 'type cls lang kicker title sub note links allowDup kind stack height state tables compute money x series y mark summary params',
    compare: 'type cls lang kicker title titles param items rows min max empty note same primary allowDup params money source live best',
    season: 'type cls lang kicker ranges words rows note reply links allowDup params money',
    map: 'type cls lang kicker title note places image lines from directions sort max links allowDup params money',
    tracker: 'type cls lang kicker title note param default ref eta steps states links live allowDup params money',   // v0.10
    rating: 'type cls lang kicker title text kind min max labels bands send note allowDup params money'
  };
  var ITEM = { table: 'kicker title cols rows note source link meter'.split(' '), cards: 'kicker title who line points pointsCls pointsTitle rows note noteCls link status badge img price'.split(' '), stats: 'kicker title stats source'.split(' '), people: 'name role img note'.split(' '),
    slide: 'id img badge kicker name sub price save status desc reply link gallery until'.split(' '), compare: 'name values reply link img'.split(' ') };
  var NEED = { cards: [], table: [], form: ['steps', 'summary', 'cta'], contact: ['title'], chips: ['items'], carousel: [], calc: ['state', 'controls', 'result', 'send', 'cta'],
    stats: [], people: ['items'], consent: ['title', 'yes', 'no'], slots: ['cta', 'say'], confirm: ['form', 'title'], review: ['state', 'lines', 'send', 'cta'], chart: ['title', 'x', 'series'], compare: ['items', 'rows'], season: ['ranges'], rating: ['title', 'send'] };
  KEYS.calendar = 'type cls lang kicker title cta note mode nights notice horizon months rates days closed unlisted priceFrom source send collapse allowDup params money';   // v0.10
  NEED.calendar = ['cta', 'send'];
  NEED.map = ['places'];   // v0.10
  NEED.tracker = ['title', 'steps'];   // v0.10
  // the tables, for scripts/schema.mjs (the JSON Schema and the config types are generated from them)
  K.setup._.keys = { TOP: TOP, KEYS: KEYS, ITEM: ITEM, NEED: NEED };
  // an unknown key that is a typo of a known one (Levenshtein 2 at most; 1 for a key of 4 letters or fewer): '… Known: a, b. Did you mean "kicker"?'
  function lev(a, b) { var p = [], i, j, q, c; for (j = 0; j <= b.length; j++) p[j] = j; for (i = 1; i <= a.length; i++) { q = [i]; for (j = 1; j <= b.length; j++) { c = a[i - 1] === b[j - 1] ? 0 : 1; q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + c); } p = q; } return p[b.length]; }
  function near(k, known) { var best = null, bd = 3; k = String(k); known.forEach(function (x) { var d = lev(k.toLowerCase(), String(x).toLowerCase()); if (d < bd && d <= (k.length > 4 ? 2 : 1)) { bd = d; best = x; } }); return best == null ? '' : '. Did you mean "' + best + '"?'; }
  K.setup._.near = near;
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
      Object.keys(d).forEach(function (k) { if (['base', 'sizes', 'ratio'].indexOf(k) < 0) top(at + ': unknown key "' + k + '". Known: base, sizes, ratio' + near(k, ['base', 'sizes', 'ratio'])); });
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
    // v0.11 · setup() reads these raw, before any language is picked: one per language would pass here and break on the page
    if (cfg.prefix != null && !isStr(cfg.prefix)) top('"prefix" is one plain word for every language, not one per language');
    if (isObj(cfg.widgets)) Object.keys(cfg.widgets).forEach(function (n) { var w = cfg.widgets[n]; if (isObj(w) && w.type != null && !isStr(w.type)) out.push({ widget: n, message: n + ': "type" is one word for every language, not one per language' }); });
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
      var o = { widget: e.widget, message: all || langs.length < 2 ? e.message : '[' + langs[i] + '] ' + e.message }; if (e.screen) o.screen = true;
      out.push(o);
    }); });
    return out;
  }
  // screen mode ("screen", runtime/screen.js): → the step ids, or null. A problem here never stops the widgets (setup() makes the
  // bot a normal chat), so each is reported with `screen: true`
  var SCRK = ['on', 'header', 'bar', 'history', 'bleed'], SCRH = ['title', 'steps', 'progress'];
  function screenCheck(sc, say) {
    if (sc == null) return null;
    if (!isObj(sc)) { say('"screen" is { "on": true, "header": { "title": "…", "steps": [["id", "Label"], …] }, "bar": true, "history": "collapse" }'); return null; }
    Object.keys(sc).forEach(function (k) { if (SCRK.indexOf(k) < 0) say('screen: unknown key "' + k + '". Known: ' + SCRK.join(', ') + near(k, SCRK)); });
    if (sc.on !== true && sc.on !== false) say('screen.on is true (screen mode) or false');
    if (sc.bar != null && typeof sc.bar !== 'boolean') say('screen.bar is true or false: false, no bottom bar');
    if (sc.bleed != null && typeof sc.bleed !== 'boolean') say('screen.bleed is true (the screen without its card and bubble, filling the column) or false');
    if (sc.history != null && sc.history !== 'collapse' && sc.history !== 'keep') say('screen.history is "collapse" (earlier messages fold behind "View conversation") or "keep" (they stay)');
    var h = sc.header, ids = []; if (h == null) return ids;
    if (!isObj(h)) { say('screen.header is { "title": "…", "steps": [["id", "Label"], …], "progress": true }'); return ids; }
    Object.keys(h).forEach(function (k) { if (SCRH.indexOf(k) < 0) say('screen.header: unknown key "' + k + '". Known: ' + SCRH.join(', ') + near(k, SCRH)); });
    if (h.title != null && (typeof h.title !== 'string' || Array.from(h.title).length > 60)) say('screen.header.title is one line of text, 60 characters at most');
    if (h.progress != null && typeof h.progress !== 'boolean') say('screen.header.progress is true (a bar and "Step 2 of 4") or false (the steps by name)');
    if (h.steps == null) { if (h.progress) say('screen.header.progress needs "steps"'); return ids; }
    if (!isArr(h.steps) || h.steps.length < 2 || h.steps.length > 8) { say('screen.header.steps is a list of 2 to 8 [id, label]'); return ids; }
    h.steps.forEach(function (x, i) {
      var at = 'screen.header.steps[' + i + ']';
      if (!isPair(x) || x.length !== 2) say(at + ' is [id, label]');
      else if (!/^[a-z][a-z0-9_]{0,29}$/.test(x[0])) say(at + ': the id "' + x[0] + '" is a lower-case word (a tag writes it: step=' + String(x[0]).toLowerCase().replace(/[^a-z0-9_]/g, '') + ')');
      else if (ids.indexOf(x[0]) >= 0) say(at + ': the id "' + x[0] + '" is there twice');
      else { ids.push(x[0]); if (Array.from(x[1]).length > 30) say(at + ': the label is one or two words, 30 characters at most'); }
    });
    return ids;
  }
  function check1(cfg) {
    var errs = [], top = function (m) { errs.push({ widget: null, message: m }); };
    if (!isObj(cfg)) { top('the config is not an object'); return errs; }
    Object.keys(cfg).forEach(function (k) { if (TOP.indexOf(k) < 0) top('unknown key "' + k + '". Known: ' + TOP.join(', ') + near(k, TOP)); });
    if (!/^[a-z][a-z0-9_]*$/i.test(cfg.prefix || '')) top('"prefix" is missing or not a plain word');
    var links = isArr(cfg.links) ? cfg.links.filter(isStr) : [];
    if (cfg.links != null && !isArr(cfg.links)) top('"links" must be a list');
    if (cfg.reveal != null && cfg.reveal !== true && cfg.reveal !== false) top('"reveal" is true or false');
    if (cfg.motion != null && cfg.motion !== true && cfg.motion !== false) top('"motion" is true or false');   // v0.10: false, no animations in this bot
    var SCR = screenCheck(cfg.screen, function (m) { errs.push({ widget: null, screen: true, message: m }); });
    // v0.9.5 (security review) · an entry is an origin with a host, then an optional path, ending in "/". "https://" alone
    // let every site through. A host with an open redirector is listed by a path, never by its origin alone
    var REDIR = /^https?:\/\/((www\.)?google\.[a-z.]+|(www\.|l\.|lm\.|m\.)?facebook\.com|(www\.)?youtube\.com|t\.co|bit\.ly|(www\.)?linkedin\.com|l\.instagram\.com)\/$/i;
    links.forEach(function (l) {
      if (/^https?:/.test(l) && !/\/$/.test(l)) top('link "' + l + '" must end in "/"');
      else if (/^https?:/.test(l) && !/^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::\d{1,5})?\/[^\s"'<>\\?#]*$/i.test(l)) top('link "' + l + '" is not an origin: write the site\'s address with its host, e.g. "https://shop.example/"');
      else if (/^https?:/.test(l) && /(^|\/)(\.|%2e){1,2}(\/|$)|\/\/|%2f|%5c/i.test(l.replace(/^https?:\/\//, ''))) top('link "' + l + '" has a dot segment, a "//" or an encoded / in its path');
      else if (REDIR.test(l)) top('link "' + l + '" is a host with an open redirector: list it by a path (e.g. "https://www.google.com/maps/"), never by its origin alone');
      else if (!/^https?:/.test(l) && l !== 'tel:' && l !== 'mailto:') top('link "' + l + '" is not an entry: an https origin ending in "/", "tel:" or "mailto:"');
    });
    var linkOK = function (url) { return isStr(url) && (LBW.ui && LBW.ui.allowed ? LBW.ui.allowed(url, links) : false); };
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
      if (r.mail && !(typeof r.mail === 'string' && /^[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(r.mail))) say(where + ': "mail" is one plain address (a@b.co), with no subject or text');
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
      function only(o, known, where) { Object.keys(o).forEach(function (k) { if (known.indexOf(k) < 0) err(where + ': unknown key "' + k + '"' + (k === 'links' || k === 'buttons' ? ' (buttons go on the widget; an item has one "link": [label, url])' : '') + '. Known: ' + known.join(', ') + near(k, known)); }); }
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
      // v0.9.0 · params: typed values from the tag. Shape, bounds, tag keys that don't collide, and the format each placeholder needs
      function walkStr(x, at, fn) { if (typeof x === 'string') fn(x, at); else if (isArr(x)) x.forEach(function (y, i) { walkStr(y, at + '[' + i + ']', fn); }); else if (isObj(x)) Object.keys(x).forEach(function (k) { if (!own(PSKIP, k)) walkStr(x[k], at ? at + '.' + k : k, fn); }); }
      function paramsCheck(w) {
        var P = w.params; if (!isObj(P) || !Object.keys(P).length) { err('"params" is an object of typed values the tag carries: { "plazas": { "type": "int", "min": 0, "max": 99 } }'); return; }
        var read = ['lang'], keys = [], taken = [], RES = 'id ids lang title name role text value label band max i day from to names'.split(' ');
        if (['cards', 'table', 'stats'].indexOf(w.type) >= 0 && w.item == null) read.push(w.type === 'stats' ? 'id' : w.param || 'id');
        if (w.type === 'compare') read.push(w.param || 'ids'); if (w.type === 'carousel') read.push('ids');
        if (w.type === 'calendar') read.push('month', 'from', 'to');   // v0.10: the tag's preset
        [w.status, w.filter, w.preset].forEach(function (x) { if (isObj(x) && isStr(x.param || x.by)) read.push(x.param || x.by); });
        if (isObj(w.state)) Object.keys(w.state).forEach(function (k) { var d = w.state[k]; read.push(isObj(d) && isStr(d.param) ? d.param : k); taken.push(k); });
        ['tables', 'compute'].forEach(function (k) { if (isObj(w[k])) taken = taken.concat(Object.keys(w[k])); });
        if (isArr(w.steps)) w.steps.forEach(function (st) { if (isObj(st) && isStr(st.key)) taken.push(st.key); });
        [w.item].concat(isObj(w.items) && w.type === 'table' ? Object.keys(w.items).map(function (k) { return w.items[k]; }) : []).forEach(function (t) { if (w.type === 'table' && isObj(t) && isArr(t.cols)) t.cols.forEach(function (c) { if (isArr(c) && isStr(c[0])) taken.push(c[0]); }); });
        var day = function (x) { return x === 'today' || LBW.day.read(x) != null; }, whole = function (x) { return typeof x === 'number' && x % 1 === 0; };
        Object.keys(P).forEach(function (k) {
          var d = P[k], at = 'params.' + k;
          if (!WORD.test(k)) { err(at + ': a param\'s name is a lower-case word (a-z, 0-9, _), as it is a {placeholder}'); return; }
          if (RES.indexOf(k) >= 0) err(at + ': "' + k + '" is a name the kit already fills in texts ({' + k + '}); call it something else');
          if (taken.indexOf(k) >= 0) err(at + ' has the name of a state key, a table, a compute line, a form step or a column');
          if (!isObj(d) || PTYPES.indexOf(d.type) < 0) { err(at + '.type is one of ' + PTYPES.join(', ')); return; }
          var more = { one: 'values labels', list: 'values labels max', int: 'min max forms', num: 'min max', money: 'min max cents', text: 'max', day: 'min max', time: '' }[d.type];
          only(d, ['type', 'param', 'required', 'default'].concat(more ? more.split(' ') : []), at);
          var key = d.param == null ? k : d.param; if (d.param != null) param(d.param, at + '.param');
          if (read.indexOf(key) >= 0) err(at + ': the tag key "' + key + '" is already read by this widget' + (key === 'lang' ? ' (the language)' : ''));
          else if (keys.indexOf(key) >= 0) err(at + ': the tag key "' + key + '" is read by another param'); keys.push(key);
          if (d.required != null && d.required !== true) err(at + '.required is true or left out');
          if (d.required === true && d['default'] != null) err(at + ': "required" or a "default", not both (a required value that is missing draws nothing)');
          var dv = d['default'];
          if (d.type === 'one' || d.type === 'list') {
            if (!isArr(d.values) || !d.values.length || !d.values.every(function (v) { return isStr(v) && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(v); })) err(at + '.values is a list of lower-case words (a-z, 0-9, _ and -), the only values the tag may carry');
            else {
              if (d.labels != null) { if (!isObj(d.labels)) err(at + '.labels is { value: label }'); else { Object.keys(d.labels).forEach(function (v) { if (d.values.indexOf(v) < 0) err(at + '.labels.' + v + ' is not one of its values'); else if (typeof d.labels[v] !== 'string') err(at + '.labels.' + v + ' must be text'); }); d.values.forEach(function (v) { if (!own(d.labels, v)) err(at + '.labels has no label for "' + v + '"'); }); } }
              if (dv != null && (d.type === 'one' ? d.values.indexOf(dv) < 0 : !(isArr(dv) && dv.length && dv.every(function (v) { return d.values.indexOf(v) >= 0; })))) err(at + '.default is not ' + (d.type === 'one' ? 'one of its values' : 'a list of its values'));
            }
            if (d.type === 'list' && d.max != null && !(whole(d.max) && d.max >= 1)) err(at + '.max is how many values the tag may list: a whole number, 1 or more');
          }
          if (d.type === 'int' || d.type === 'num') {
            if (typeof d.min !== 'number' || typeof d.max !== 'number' || d.min > d.max) err(at + ' needs "min" and "max" (numbers, min first): a value outside them is not shown');
            else if (d.type === 'int' && !(whole(d.min) && whole(d.max))) err(at + ': "min" and "max" of an int are whole numbers');
            if (dv != null && (typeof dv !== 'number' || (d.type === 'int' && !whole(dv)) || dv < d.min || dv > d.max)) err(at + '.default is a number between min and max');
          }
          if (d.type === 'money') {
            if (!(whole(d.max) && d.max > 0)) err(at + '.max is the highest amount in cents (a whole number: 100000 is 1,000.00): a value above it is not shown');
            if (d.min != null && !(whole(d.min) && d.min >= 0 && (!whole(d.max) || d.min <= d.max))) err(at + '.min is the lowest amount in cents, 0 or more and not above max');
            if (d.cents != null && typeof d.cents !== 'boolean') err(at + '.cents is true (the tag carries whole cents, 3499) or left out (34.99)');
            if (dv != null && !(whole(dv) && dv >= (d.min || 0) && (!whole(d.max) || dv <= d.max))) err(at + '.default is an amount in cents between min and max');
          }
          if (d.type === 'text') { if (d.max != null && !(whole(d.max) && d.max >= 1 && d.max <= 300)) err(at + '.max is a whole number from 1 to 300 (80 by default)'); if (dv != null && typeof dv !== 'string') err(at + '.default must be text'); }
          if (d.type === 'day') {
            ['min', 'max', 'default'].forEach(function (x) { if (d[x] != null && !(isStr(d[x]) && day(d[x]))) err(at + '.' + x + ' is "today" or a date, D/M/YYYY'); });
            if ([d.min, d.max, dv].indexOf('today') >= 0 && !isStr(cfg.timeZone)) err(at + ': "today" needs "timeZone" in the config (the day ends where the client is)');
            if (isStr(d.min) && isStr(d.max) && d.min !== 'today' && d.max !== 'today' && LBW.day.read(d.min) > LBW.day.read(d.max)) err(at + ': "min" is after "max"');
          }
          if (d.type === 'time' && dv != null && LBW.time.read(dv) == null) err(at + '.default is a time, HH:MM');
          // v0.9.4.2 · forms: { zero, one, other } for {name:count}; {n} is the number
          if (d.forms != null) {
            if (!isObj(d.forms) || !isStr(d.forms.other)) err(at + '.forms is { "one": "{n} libre", "other": "{n} libres", "zero": "Completa" }: "other" is required, "one" and "zero" optional');
            else { only(d.forms, ['zero', 'one', 'other'], at + '.forms'); ['zero', 'one', 'other'].forEach(function (f) { if (d.forms[f] != null && typeof d.forms[f] !== 'string') err(at + '.forms.' + f + ' must be text'); else if (isStr(d.forms[f]) && /\{(?!n\})[^{}]*\}/.test(d.forms[f])) err(at + '.forms.' + f + ': the only placeholder a form takes is {n}'); }); }
          }
        });
        // every placeholder that names a param: the format its type needs
        walkStr(w, '', function (t, where) {
          t.replace(HOLE, function (m, body) {
            var x = SLOT.exec(body), d = x && own(P, x[1]) && isObj(P[x[1]]) ? P[x[1]] : null; if (!d) return m;
            var f = (x[2].match(/:(label|labels|money|date|dmy|time|count)\b/g) || []), ty = d.type, at = where + ': "' + m + '"';
            if (f.length > 1) err(at + ' has two formats: one of :label :labels :money :date :dmy :time :count (then :lower if wanted)');
            else if (f[0] === ':count') { if (ty !== 'int') err(at + ': :count is for an int param (its "forms")'); else if (!isObj(d.forms)) err(at + ' asks for a count, and params.' + x[1] + ' has no "forms"'); }
            else if (ty === 'money' && f[0] !== ':money') err(at + ' is an amount in cents: write {' + x[1] + ':money}');
            else if (ty === 'day' && f[0] !== ':date' && f[0] !== ':dmy') err(at + ' is a day: write {' + x[1] + ':date} or {' + x[1] + ':dmy}');
            else if (ty === 'time' && f[0] !== ':time') err(at + ' is a time: write {' + x[1] + ':time}');
            else if (f[0] && ['money', 'day', 'time'].indexOf(ty) < 0 && !((ty === 'one' || ty === 'list') && /^:labels?$/.test(f[0]))) err(at + ': "' + x[1] + '" is a ' + ty + ' param, which takes ' + (ty === 'one' || ty === 'list' ? 'no format or :label' : 'no format'));
            else if (/^:labels?$/.test(f[0] || '') && !isObj(d.labels)) err(at + ' asks for a label, and params.' + x[1] + ' has no "labels"');
            return m;
          });
        });
      }
      // v0.9.4.2 · rows [label, value, key] / [label, value, key, text]: the key a number param (the row goes or changes at 0)
      function keyedRows(w) {
        if (['cards', 'contact', 'season'].indexOf(w.type) < 0) return; var P = isObj(w.params) ? w.params : {};   // rows of [label, value]
        var look = function (x, at) {
          if (isArr(x)) return x.forEach(function (y, i) { look(y, at + '[' + i + ']'); }); if (!isObj(x)) return;
          Object.keys(x).forEach(function (k) {
            if (own(PSKIP, k) || k === 'result') return; var here = at ? at + '.' + k : k;
            if (k === 'rows' && isArr(x[k])) x[k].forEach(function (r, i) { if (!isArr(r) || r.length < 3) return; var ra = here + '[' + i + ']';
              // v0.10 · a meter: [label, value, { "of": 12 }] (fixed), or a 5th element after a number param's key and its text for 0
              if (isObj(r[2])) { if (w.type !== 'cards') err(ra + ': a meter row ([label, value, { "of": … }]) is drawn on cards only'); else if (r.length > 3) err(ra + ' is [label, value, { "of": 12 }]: a meter row with a fixed value has 3 elements'); else meterCheck(r[2], ra + '[2]', true); return; }
              if (r.length > 5) err(ra + ' is [label, value], [label, value, key], [label, value, key, text for 0] or [label, value, key, text for 0, { "of": max }]');
              else if (r.length === 5 && w.type !== 'cards') err(ra + '[4]: a meter is drawn on cards only');
              else if (!isStr(r[2]) || !own(P, r[2]) || !isObj(P[r[2]]) || !own(PNUM, P[r[2]].type) || P[r[2]].type === 'day' || P[r[2]].type === 'time') err(ra + '[2] "' + r[2] + '" is not a number param of this widget (int, num or money): the row is left out, or shows its 4th text, while that number is 0');
              else if (r.length >= 4 && typeof r[3] !== 'string' && !(r.length === 5 && r[3] === null)) err(ra + '[3] must be text: what the row says while ' + r[2] + ' is 0 ("Completa")' + (r.length === 5 ? ', or null to leave the row out' : ''));
              else if (r.length === 5) meterCheck(r[4], ra + '[4]', false); });
            else look(x[k], here);
          });
        };
        look(w, '');
      }
      // v0.10 · a meter { of, low } (and "full" on a fixed row): "of" is the capacity, a number over 0 or a "{placeholder}"
      function meterCheck(m, at, fixed) {
        if (!isObj(m)) { err(at + ' is a meter: { "of": 12 } (the capacity), with "low" (the count from which it reads low)'); return; }
        only(m, fixed ? ['of', 'low', 'full'] : ['of', 'low'], at);
        var of = typeof m.of === 'number' ? m.of : isStr(m.of) && !/\{/.test(m.of) ? +m.of : null;
        if (m.of == null) err(at + '.of is missing: the capacity the count is measured against, as 12');
        else if (!(typeof m.of === 'number' || isStr(m.of)) || (of != null && !(of > 0))) err(at + '.of is the capacity: a number over 0, or a "{placeholder}" that holds one');
        if (m.low != null && !(typeof m.low === 'number' && m.low >= 0)) err(at + '.low is a number, 0 or more: from that count down the meter reads low');
        else if (m.low != null && of != null && m.low >= of) err(at + '.low (' + m.low + ') must be under "of" (' + of + ')');
        if (m.full != null && typeof m.full !== 'string') err(at + '.full must be text: what a row at 0 says ("Completa")');
      }
      // the widget as the rest of the checks see it: each param placeholder filled with a sample value
      function sampled(x, P) {
        if (typeof x === 'string') return x.replace(HOLE, function (m, body) { var y = SLOT.exec(body); return y && own(P, y[1]) ? 'x' : m; });
        if (isArr(x)) return x.map(function (y) { return sampled(y, P); });
        if (!isObj(x)) return x;
        var o = {}; Object.keys(x).forEach(function (k) { if (k !== '__proto__') o[k] = own(PSKIP, k) ? x[k] : sampled(x[k], P); }); return o;
      }
      // v0.9.0 · "source": { "data": … }: a key of LBW.data, or { "param": a "one" param whose values are keys
      function dataCheck(sc, P) {
        if (sc.data == null) return;
        if (isStr(sc.data)) { if (!/^[a-z][a-z0-9_]{0,39}$/.test(sc.data)) err('source.data "' + sc.data + '" is a key of LBW.data: a lower-case word (a-z, 0-9, _), 40 at most'); }
        else if (isObj(sc.data) && isStr(sc.data.param) && Object.keys(sc.data).length === 1) {
          var d = isObj(P) && own(P, sc.data.param) ? P[sc.data.param] : null;
          if (!isObj(d) || d.type !== 'one') err('source.data.param "' + sc.data.param + '" names a param of type "one" (its values are the keys the tag may name)');
          else if (isArr(d.values) && d.values.some(function (v) { return !/^[a-z][a-z0-9_]{0,39}$/.test(v); })) err('params.' + sc.data.param + '.values are keys of LBW.data: lower-case words (a-z, 0-9, _), starting with a letter');
        } else err('source.data is a key of LBW.data ("tarifas"), or { "param": "src" } to let the tag name it');
        if (sc.wait != null && !(typeof sc.wait === 'number' && sc.wait >= 0 && sc.wait <= 8000)) err('source.wait is how long to wait for the data, in milliseconds: 0 to 8000 (1500 by default)');
        if (sc.upgrade != null && !(typeof sc.upgrade === 'number' && sc.upgrade >= 0 && sc.upgrade <= 60000)) err('source.upgrade is how long the saved copy may still be replaced by data that lands late, in milliseconds: 0 to 60000 (20000 by default; 0 = never)');
      }
      function itemSource(w, P) {
        var so = w.source, ty = w.type, single = w.item != null;
        if (!isObj(so)) { err('"source" is { "data": a key of LBW.data, "map": { part: "{column}" } }'); return; }
        only(so, ['data', 'wait', 'upgrade', 'path', 'id', 'map', 'merge', 'max'], 'source');
        if (so.data == null) err('source.data is missing: the key of LBW.data the rows are in (a flow\'s Code block puts them there)'); else dataCheck(so, P);
        if (so.path != null && !(isStr(so.path) && /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(so.path))) err('source.path is the dotted key of the list inside the data, as "data.items"');
        if (ty === 'table' && !isObj(w.item)) err('a table with a "source" is one table: give "item" (its title and cols); the data gives its rows');
        if (so.id != null && (single || ty === 'table')) err('source.id: ' + (ty === 'table' ? 'a table\'s rows' : 'a single card ("item")') + ' need no id column');
        else if (so.id != null && !(isStr(so.id) && /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(so.id))) err('source.id is the name of the id column');
        if (so.merge != null && so.merge !== true && so.merge !== false) err('source.merge is true or false');
        if (so.merge === true && (ty === 'table' || !(single || (isObj(w.items) && Object.keys(w.items).length)))) err('source.merge needs saved items ("items" or "item"): the saved one with the same id fills what a row lacks' + (ty === 'table' ? ' (a table\'s rows are not merged)' : ''));
        var top = ty === 'table' ? 30 : 5000;
        if (so.max != null && !(typeof so.max === 'number' && so.max % 1 === 0 && so.max >= 1 && so.max <= top)) err('source.max is how many rows are read: a whole number from 1 to ' + top);
        var mp = so.map; if (!isObj(mp)) { err('source.map is missing: { part: "{column}", … }'); return; }
        var COL = /\{[A-Za-z0-9_.]+(\|text)?\}/, has = function (x) { return COL.test(JSON.stringify(x)); };
        var cols = function (x, at) { walkStr(x, at, function (t, wh) { (t.match(/\{[^{}]*\}/g) || []).forEach(function (m) { if (!/^\{[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*(\|text)?\}$/.test(m)) err(wh + ': "' + m + '" is not a column name (letters, digits, _; dots for a nested key, as {title.rendered}; {key|text} reads HTML as text)'); }); }); };
        var txt = function (k) { if (mp[k] != null) { if (!isStr(mp[k])) err('source.map.' + k + ' must be text, as "{column}"'); else cols(mp[k], 'source.map.' + k); } };
        var pair = function (k, v, at) { if (!isPair(v)) err(at + ' is [text, text], as ["Precio", "{precio} €"]'); else cols(v, at); };
        var TEXT = { cards: 'kicker title who line note pointsTitle', stats: 'kicker title source', people: 'name role note img', compare: 'name', table: '' }[ty].split(' ').filter(Boolean);
        var LIST = { cards: ['points', 'rows', 'link', 'badge', 'status'], stats: ['stats'], people: [], compare: ['values', 'link'], table: [] }[ty];
        var tcols = ty === 'table' && isObj(w.item) && isArr(w.item.cols) ? w.item.cols.map(function (c) { return isArr(c) ? c[0] : null; }).filter(isStr) : [];
        if (own(mp, 'reply') || own(mp, 'fields')) err('source.map can\'t fill "reply" or "fields": a cell would become a sentence the visitor sends, or a value Landbot saves');
        only(mp, ty === 'table' ? tcols : TEXT.concat(LIST), 'source.map');
        (ty === 'table' ? tcols : TEXT).forEach(txt);
        if (mp.points != null) { if (!isArr(mp.points)) err('source.map.points is a list of texts'); else mp.points.forEach(function (x, i) { if (!isStr(x)) err('source.map.points[' + i + '] must be text'); else cols(x, 'source.map.points[' + i + ']'); }); }
        ['rows', 'stats'].forEach(function (k) { if (mp[k] != null) { if (!isArr(mp[k])) err('source.map.' + k + ' is a list of [label, "{column}"]'); else mp[k].forEach(function (x, i) { var at = 'source.map.' + k + '[' + i + ']';
          if (k === 'rows' && ty === 'cards' && isArr(x) && x.length === 3 && isObj(x[2])) { pair(k, x.slice(0, 2), at); meterCheck(x[2], at + '[2]', true); cols(x[2], at + '[2]'); return; }   // v0.10: [label, "{plazas}", { "of": "{aforo}" }]
          pair(k, x, at); }); } });
        if (mp.link != null) pair('link', mp.link, 'source.map.link');
        if (mp.badge != null && !isStr(mp.badge) && !(isObj(mp.badge) && isStr(mp.badge.text))) err('source.map.badge is "{column}" or { "text": "{column}", "tone": … }'); else if (mp.badge != null) cols(mp.badge, 'source.map.badge');
        if (mp.status != null) { if (!(isObj(mp.status) && isStr(mp.status.text))) err('source.map.status is { "text": "{column}", "tone": … }'); else { only(mp.status, ['text', 'tone'], 'source.map.status'); cols(mp.status, 'source.map.status'); } }
        if (mp.values != null) { var rk = isArr(w.rows) ? w.rows.map(function (r) { return isArr(r) ? r[0] : null; }) : []; if (!isObj(mp.values)) err('source.map.values is { row key: "{column}" }'); else Object.keys(mp.values).forEach(function (k) { if (rk.indexOf(k) < 0) err('source.map.values.' + k + ' is not one of the rows (' + rk.join(', ') + ')'); else if (!isStr(mp.values[k])) err('source.map.values.' + k + ' must be text'); else cols(mp.values[k], 'source.map.values.' + k); }); }
        if (!Object.keys(mp).some(function (k) { return has(mp[k]); })) err('source.map fills nothing from the data: name at least one column, as "{precio}"');
        (I.NEEDS[ty] || []).forEach(function (k) { if (!has(mp[k] == null ? '' : mp[k]) && so.merge !== true) err('source.map.' + k + ' must name a column, as "{' + k + '}" (a row without it is skipped), or leave it to the saved item with "merge": true'); });
      }
      function url(pair, where) { if (pair == null) return; if (!isPair(pair)) err(where + ' is [label, url]'); else if (!linkOK(pair[1])) err(where + ': "' + pair[1] + '" is not under any entry of "links"'); }
      // v0.10 · a card's or a compared item's photo and a card's price, as a slide's
      function imgOK(im, where) { if (im == null) return; if (!(isObj(im) && isStr(im.src))) err(where + ' is { "src": an https URL, "srcset", "alt" } (or a "photos" reference)'); else if (!linkOK(im.src)) err(where + '.src is not under any entry of "links"'); }
      function priceOK(pr, where) { if (pr == null) return; if (!(isObj(pr) && isStr(pr.now))) err(where + ' is { "now": text, "unit": text, "list": text }'); else { only(pr, ['now', 'unit', 'list'], where); strs(pr, ['unit', 'list'], where); } }

      try {
        if (!/^[a-z][a-z0-9_]*$/.test(name)) err('a widget name is lower-case letters, digits and _');
        if (!isObj(w) || !isStr(w.type) || !own(KEYS, w.type)) { err('unknown type "' + (isObj(w) ? w.type : w) + '". Known: ' + Object.keys(KEYS).join(', ') + (isObj(w) && isStr(w.type) ? near(w.type, Object.keys(KEYS)) : '')); return; }
        var known = KEYS[w.type].split(' ').concat('flow', 'screen', 'step');
        if (w.flow != null && w.flow !== true && !(isArr(w.flow) && w.flow.length && w.flow.every(function (k) { return isStr(k) && /^[a-z_][a-z0-9_]*$/.test(k); }))) err('"flow" is true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]');
        Object.keys(w).forEach(function (k) { if (known.indexOf(k) < 0) err('unknown option "' + k + '" for ' + w.type + '. Known: ' + known.join(', ') + near(k, known)); });
        // screen mode: "screen": false keeps a widget from becoming the screen; "step" is an id of "screen.header.steps"
        if (w.screen != null && typeof w.screen !== 'boolean') err('"screen" is true or false: false keeps this widget out of screen mode');
        if (w.step != null) { if (!SCR) err('"step" names a step of "screen.header.steps", and the config has none'); else if (SCR.indexOf(w.step) < 0) err('"step" "' + w.step + '" is not a step of "screen.header.steps". Known: ' + SCR.join(', ') + near(w.step, SCR)); }
        if (w.density != null && w.density !== 'compact' && w.density !== 'comfy') err('"density" is "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout)');   // v0.10
        NEED[w.type].forEach(function (k) { if (w[k] == null && !(k === 'items' && w.source != null)) err('missing "' + k + '"'); });
        var pdefs = isObj(w.params) ? w.params : {};
        keyedRows(w);   // v0.9.4.2
        // v0.10 · "live": the "Live" chip. On by default for rows from a source; true for a flow tag's params (opt-in)
        if (w.live != null && w.type !== 'tracker') { if (typeof w.live !== 'boolean') err('"live" is true or false: the "Live" chip beside the title'); else if (w.live && w.source == null && w.params == null) err('"live": true needs "params" (a flow tag\'s values) or a "source": fixed data isn\'t live'); }
        if (w.params != null) { paramsCheck(w); w = sampled(w, pdefs); }
        if (w.source != null && w.type !== 'carousel' && w.type !== 'calendar') itemSource(w, pdefs);
        // v0.9.0 · "money" formats {x:money} in every type (a money param): { cur, after, dec, th, cents, space }
        if (w.money != null && ['calc', 'review', 'chart'].indexOf(w.type) < 0) { if (!isObj(w.money)) err('"money" is { "cur": "€", "after": true, "dec": ",", "th": "." }'); else only(w.money, ['cur', 'after', 'dec', 'th', 'cents', 'space'], 'money'); }
        ['links', 'buttons', 'buttonsWithSummary', 'actions'].forEach(function (k) { list(w[k], k, function (a, at) { act(a, err, at, w.type === 'calc' && k === 'links'); }); });
        rep(w.reply, 'reply', { cards: ['id', 'title'], table: ['id', 'title'], stats: ['id', 'title'], people: ['id', 'name', 'role'] }[w.type] || null);
        strs(w, ['cls', 'lang', 'kicker', 'title', 'cta', 'note', 'text', 'big', 'sub', 'disclaimer', 'lead'], '');
        if (w.item != null && !isObj(w.item)) err('"item" must be an object');

        // v0.8.1.10 · a table: 2 to 5 columns [key, label, align], 1 to 30 rows of that many texts; "pick" over the column keys
        if (w.type === 'table') {
          if (!w.items && !w.item) err('missing "items" (or "item" for a single table)' + (w.source != null ? ': a table with a "source" is one table, its "item" (title and cols)' : ''));
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
            // v0.10 · "meter": { "col": a column with the count, "of": the capacity (a number or another column), "low", "full" }
            if (t.meter != null) { if (!isObj(t.meter) || !isStr(t.meter.col)) err(id + '.meter is { "col": "plazas", "of": 12 }: the column with the count, and the capacity (a number, or the column that holds it)');
              else { only(t.meter, ['col', 'of', 'low', 'full'], id + '.meter'); if (ks.indexOf(t.meter.col) < 0) err(id + '.meter.col "' + t.meter.col + '" is not one of the columns (' + ks.join(', ') + ')');
                else if (ks.indexOf(t.meter.col) === 0) err(id + '.meter.col: the first column names the row; the count goes in another one');
                if (isStr(t.meter.of) && ks.indexOf(t.meter.of) < 0 && !(+t.meter.of > 0)) err(id + '.meter.of "' + t.meter.of + '" is not a column, nor a number over 0');
                else meterCheck({ of: isStr(t.meter.of) && ks.indexOf(t.meter.of) >= 0 ? '{' + t.meter.of + '}' : t.meter.of, low: t.meter.low, full: t.meter.full }, id + '.meter', true); } }
            if (w.source != null && t.rows == null) return;   // v0.9.0: the rows come from the data (no saved copy)
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
          if (!w.items && !w.item && w.source == null) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var cs = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(cs).forEach(function (id) { var it = cs[id]; if (!isObj(it) || !isStr(it.title)) { err('card "' + id + '" has no "title"'); return; } strs(it, ['kicker', 'who', 'line', 'note', 'pointsTitle'], id); only(it, ITEM.cards, id); toned(it.status, id + '.status', true); toned(it.badge, id + '.badge', false); url(it.link, id + '.link'); pairs(it.rows, id + '.rows'); imgOK(it.img, id + '.img'); priceOK(it.price, id + '.price'); list(it.points, id + '.points', function (x, at) { if (!isStr(x)) err(at + ' must be text'); }); });
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
              only(sc, ['csv', 'json', 'data', 'wait', 'upgrade', 'path', 'id', 'map', 'merge', 'order', 'max', 'maxAge', 'prefetch'], 'source'); dataCheck(sc, w.params);
              if (sc.upgrade != null && sc.data == null) err('source.upgrade is for a carousel read from "data" (a flow\'s Code block, which runs late): a "csv" or "json" source is fetched when the chat loads, and has none');
              if (sc.order != null && (sc.order !== 'items' || !(isArr(w.items) && w.items.length))) err('source.order is "items": the slides follow the saved items\' order (it needs "items")');
              if (sc.merge != null && (sc.merge !== true && sc.merge !== false)) err('source.merge is true or false');
              if (sc.merge === true && !(isArr(w.items) && w.items.length)) err('source.merge needs "items": the saved item with the same id fills what a live row lacks');
              if ([sc.csv, sc.json, sc.data].filter(function (x) { return x != null; }).length !== 1) err('source needs one of "csv" or "json" (or "data", a key of LBW.data)');
              ['csv', 'json'].forEach(function (k) { if (sc[k] != null && (!isStr(sc[k]) || !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)[^\s"'<>]+$/.test(sc[k]))) err('source.' + k + ' must be an https URL (http://localhost is accepted, to try a map against a saved copy)'); });
              if (sc.path != null && ((sc.json == null && sc.data == null) || !isStr(sc.path))) err('source.path is the dotted key of the list inside a "json" answer (or the data)');
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
          if (w.style != null && w.style !== 'media' && w.style !== 'box') err('"style" is "media" (photos lead, no box: the default when a slide has a photo) or "box"');
        }

        if (w.type === 'calc' || w.type === 'review' || w.type === 'chart') {
          var st = isObj(w.state) ? w.state : {}, tb = isObj(w.tables) ? w.tables : {}, cp = isObj(w.compute) ? w.compute : {}, res = isObj(w.result) ? w.result : {}, snd = isObj(w.send) ? w.send : {};
          ['state', 'result', 'send'].forEach(function (k) { if (w[k] != null && !isObj(w[k])) err('"' + k + '" must be an object'); });
          ['tables', 'compute', 'money'].forEach(function (k) { if (w[k] != null && !isObj(w[k])) err('"' + k + '" must be an object'); });
          var skeys = Object.keys(st), nums = [], pickKeys = [], vals = skeys.slice();
          Object.keys(pdefs).forEach(function (k) { if (isObj(pdefs[k]) && own(PNUM, pdefs[k].type)) { vals.push(k); nums.push(k); } });   // v0.9.0: a number the tag carries
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

        // v0.10 · map: places with coordinates in range, a pin for each (an "at" on the image, lat/lng inside its bounds, or
        // lat/lng for the schematic), hours shaped as contact's, an image and a directions link the allow-list lets through
        if (w.type === 'map') {
          var pt = function (q) { return isArr(q) && q.length === 2 && typeof q[0] === 'number' && q[0] >= -90 && q[0] <= 90 && typeof q[1] === 'number' && q[1] >= -180 && q[1] <= 180; };
          var ll = function (o, at, need) {
            if (o.lat == null && o.lng == null) { if (need) err(at + ' needs "lat" and "lng" (' + need + ')'); return false; }
            if (typeof o.lat !== 'number' || !(o.lat >= -90 && o.lat <= 90)) err(at + '.lat is a number from -90 to 90 (north is +)');
            else if (typeof o.lng !== 'number' || !(o.lng >= -180 && o.lng <= 180)) err(at + '.lng is a number from -180 to 180 (east is +)');
            else return true; return false;
          };
          var mi = w.image, mref = I.photoRef(mi), mo = isObj(mi) ? mi : {}, mb = null;
          if (mi != null) {
            if (mref) { only(mo, ['photo', 'alt', 'bounds'], 'image'); var mset = I.photoSet(cfg.photos, mref.cdn); if (mset && !isArr(mset.ratio)) err('image: the photo set "' + mref.cdn + '" needs a "ratio": the pins are placed on the picture\'s shape'); }
            else if (!isObj(mi) || !isStr(mi.src)) err('"image" is { "src", "width", "height", "alt", "bounds" }, or "set:map.png" with "photos"');
            else {
              only(mi, ['src', 'srcset', 'width', 'height', 'alt', 'bounds'], 'image');
              if (!linkOK(mi.src)) err('image.src "' + mi.src + '" is not under any entry of "links"');
              list(mi.srcset, 'image.srcset', function (z, at) { if (!isArr(z) || !linkOK(z[0]) || !(z[1] > 0)) err(at + ' is [url under "links", width]'); });
              ['width', 'height'].forEach(function (k) { if (!(Number.isInteger(mi[k]) && mi[k] > 0)) err('image.' + k + ' is the picture\'s ' + k + ' in pixels: the pins are placed on its shape'); });
            }
            strs(mo, ['alt'], 'image');
            if (mo.bounds != null) { if (!isArr(mo.bounds) || mo.bounds.length !== 2 || !mo.bounds.every(pt) || !(mo.bounds[0][0] > mo.bounds[1][0]) || !(mo.bounds[1][1] > mo.bounds[0][1])) err('image.bounds is [[north, west], [south, east]]: the lat and lng of the picture\'s top-left and bottom-right corners'); else mb = mo.bounds; }
          }
          var MD = I.mapDir || {}, dr = w.directions, tp = null;
          if (dr != null) {
            if (isStr(dr) && own(MD, dr)) tp = MD[dr];
            else if (isObj(dr) && isStr(dr.url)) { only(dr, ['url', 'label'], 'directions'); strs(dr, ['label'], 'directions'); tp = dr.url;
              (dr.url.match(/\{[^}]*\}/g) || []).forEach(function (m) { if (['{lat}', '{lng}', '{q}', '{address}'].indexOf(m) < 0) err('directions.url: ' + m + ' is not one of {q} {lat} {lng} {address}'); });
              if (!/\{(q|lat|lng|address)\}/.test(dr.url)) err('directions.url names no place: put {q} (lat,lng, or the address) where the destination goes'); }
            else err('"directions" is ' + Object.keys(MD).join(', ') + ', or { "url": "https://…{q}…", "label" }');
            if (tp && !linkOK(tp.split('{')[0])) err('directions: "' + tp.split('{')[0] + '" is not under any entry of "links"' + (isStr(dr) ? ' (add "' + (/^https:\/\/[^/]+\/(maps\/)?/.exec(tp) || [''])[0] + '")' : ''));
          }
          var mseen = Object.create(null), hrsAt = false;
          if (!isArr(w.places) || !w.places.length || w.places.length > 20) err('"places" is a list of 1 to 20 places: [{ "id", "name", "address", "lat", "lng", "hours" }, …] (a tag shows 5 at most; "ids=a,b" picks them)');
          else w.places.forEach(function (x, i) {
            var at = 'places[' + i + ']'; if (!isObj(x)) { err(at + ' must be an object'); return; }
            only(x, ['id', 'name', 'kind', 'address', 'lat', 'lng', 'at', 'hours', 'status', 'distance', 'link'], at);
            if (!isStr(x.id) || !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(x.id) || /^(constructor|prototype)$/.test(x.id)) err(at + '.id is a lower-case word (a-z, 0-9, _ and -), 40 at most: the tag names it (id=…, ids=…)');
            else if (mseen[x.id]) err(at + '.id "' + x.id + '" is there twice'); else mseen[x.id] = 1;
            if (!isStr(x.name)) err(at + ' needs a "name"'); strs(x, ['name', 'kind', 'address', 'distance'], at);
            var g = mi == null ? ll(x, at, 'the schematic map is drawn from them; or give an "image"') : x.at == null && mb ? ll(x, at, 'inside image.bounds, or an "at" on the image') : ll(x, at, null);
            if (mi != null && x.at == null && !mb) err(at + ' needs "at": [x, y] in % of the image (or give image.bounds and its lat/lng)');
            if (x.at != null) { if (mi == null) err(at + '.at places a pin on the "image": with no image, the schematic is drawn from lat and lng');
              else if (!isArr(x.at) || x.at.length !== 2 || !x.at.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 100; })) err(at + '.at is [x, y] in % of the image, each 0 to 100, from its left and top edges'); }
            else if (g && mb && (x.lat > mb[0][0] || x.lat < mb[1][0] || x.lng < mb[0][1] || x.lng > mb[1][1])) err(at + ' is outside image.bounds: its pin would be off the picture');
            if (x.hours != null) { hrsAt = true; var h = x.hours, ha = at + '.hours';
              if (!isObj(h) || !isObj(h.week)) err(ha + ' needs "week": { "1": [[600, 840], [1020, 1200]], … } (0 = Sunday; minutes since midnight)');
              else { only(h, ['week', 'holidays', 'sep', 'h12', 'open', 'closed'], ha);
                Object.keys(h.week).forEach(function (k) { if (!/^[0-6]$/.test(k)) { err(ha + '.week.' + k + ': days are 0 (Sunday) to 6'); return; } var end = -1;
                  list(h.week[k], ha + '.week.' + k, function (r, a) { if (!isArr(r) || r.length !== 2 || !Number.isInteger(r[0]) || !Number.isInteger(r[1]) || r[0] < 0 || r[1] > 1440 || r[0] >= r[1]) err(a + ' is [open, close] in minutes since midnight, open first (10:00–14:00 is [600, 840]; midnight is 1440)'); else { if (r[0] < end) err(a + ' starts before the range above it ends: list the ranges in order, with no overlap'); end = r[1]; } }); });
                list(h.holidays, ha + '.holidays', function (v, a) { if (!/^\d{1,2}\/\d{1,2}(\/20\d\d)?$/.test(String(v))) err(a + ' is D/M or D/M/YYYY'); });
                if (h.h12 != null && typeof h.h12 !== 'boolean') err(ha + '.h12 is true or false'); strs(h, ['sep'], ha);
                text(h.open, ha + '.open', ['t']); text(h.closed, ha + '.closed', ['d', 't']); }
              if (x.status != null) err(at + ': "hours" or "status", not both (hours say open or closed by themselves)'); }
            toned(x.status, at + '.status', true); url(x.link, at + '.link');
            if (tp && /\{(q|address)\}/.test(tp) && !g && !isStr(x.address) && !/\{(lat|lng)\}/.test(tp)) err(at + ' has no lat/lng and no address: "directions" can\'t build its link');
            else if (tp && /\{(lat|lng)\}/.test(tp) && !g) err(at + ' has no lat/lng: directions.url needs them');
          });
          if (hrsAt && !isStr(cfg.timeZone)) err('"hours" need "timeZone" in the config: open now is the client\'s time');
          if (w.lines != null) {
            if (mi != null) err('"lines" draw the schematic map; with an "image" they are not drawn: leave them out');
            if (isArr(w.lines) && w.lines.length > 12) err('"lines" holds 12 at most: the schematic is a sketch, not a street map');
            list(w.lines, 'lines', function (l, at) { if (!isObj(l)) { err(at + ' is { "kind", "pts", "label" }'); return; } only(l, ['kind', 'pts', 'label'], at);
              if (['water', 'road', 'rail', 'park'].indexOf(l.kind) < 0) err(at + '.kind is water, road, rail or park');
              if (!isArr(l.pts) || l.pts.length < 2 || l.pts.length > 40 || !l.pts.every(pt)) err(at + '.pts is 2 to 40 points [lat, lng]'); strs(l, ['label'], at); });
          }
          if (w.from != null) { if (!isObj(w.from)) err('"from" is { "name", "lat", "lng" }: where distances are measured from'); else { only(w.from, ['name', 'lat', 'lng'], 'from'); ll(w.from, 'from', 'distances are measured from them'); strs(w.from, ['name'], 'from'); } }
          if (w.sort != null && w.sort !== 'distance') err('"sort" is "distance" or left out'); else if (w.sort != null && !isObj(w.from)) err('"sort": "distance" needs "from"');
          if (w.max != null && !(Number.isInteger(w.max) && w.max >= 1 && w.max <= 5)) err('"max" is a whole number from 1 to 5: the places one tag shows');
        }

        if (w.type === 'compare') {
          if (w.same != null && w.same !== 'fold' && w.same !== 'mute') err('"same" is "fold" (equal rows go in one line under the table) or "mute" (the default: drawn quieter)');
          var rk = [];
          list(w.rows, 'rows', function (r, at) { if (!isArr(r) || r.length > 4 || !isStr(r[0]) || !isStr(r[1]) || (r[2] != null && typeof r[2] !== 'string') || (r[3] != null && !isStr(r[3]))) err(at + ' is [key, label], [key, label, class] or [key, label, class, unit] (the class may be "")'); else rk.push(r[0]); });
          // v0.10 · "best": the column you recommend, "id" or { "id", "label" }
          var bid = isStr(w.best) ? w.best : isObj(w.best) ? w.best.id : null;
          if (w.best != null) { if (!isStr(bid)) err('"best" is an item id, or { "id": …, "label": text }'); else if (isObj(w.items) && !own(w.items, bid)) err('best "' + bid + '" is not one of the items'); if (isObj(w.best)) { only(w.best, ['id', 'label'], 'best'); strs(w.best, ['label'], 'best'); } }
          if (isArr(w.rows) && !w.rows.length) err('"rows" is empty');
          if (w.source != null && w.items == null) {}   // v0.9.0: the items come from the data (no saved copy)
          else if (!isObj(w.items) || Object.keys(w.items).length < 2) err('"items" must hold at least two items by id');
          else {
            Object.keys(w.items).forEach(function (id) {
              var it = w.items[id]; if (!isObj(it) || !isStr(it.name)) { err('"' + id + '" has no "name"'); return; }
              only(it, ITEM.compare, id); rep(it.reply, id + '.reply'); url(it.link, id + '.link'); imgOK(it.img, id + '.img');
              if (!isObj(it.values)) { err(id + '.values must be an object of text by row key'); return; }
              Object.keys(it.values).forEach(function (k) { if (rk.indexOf(k) < 0) err(id + '.values.' + k + ' is not one of the rows (' + rk.join(', ') + ')'); else if (typeof it.values[k] !== 'string' && typeof it.values[k] !== 'boolean') err(id + '.values.' + k + ' must be text, or true/false for ✓/✕ (format numbers and money yourself)'); });
            });
            rk.forEach(function (k) { if (!Object.keys(w.items).some(function (id) { return isObj(w.items[id]) && isObj(w.items[id].values) && w.items[id].values[k] != null; })) err('row "' + k + '" has no value in any item'); });
          }
          param(w.param, 'param');
          ['min', 'max'].forEach(function (k) { if (w[k] != null && !(Number.isInteger(w[k]) && w[k] >= 2 && w[k] <= 3)) err('"' + k + '" is 2 or 3'); });
          if (w.titles != null && (!isObj(w.titles) || Object.keys(w.titles).some(function (k) { return k !== '2' && k !== '3'; }))) err('"titles" is { "2": text, "3": text }'); else strs(w.titles, ['2', '3'], 'titles');
          if (w.empty != null && typeof w.empty !== 'string') err('"empty" must be text');
        }

        if (w.type === 'stats') {
          if (!w.items && !w.item && w.source == null) err('missing "items" (or "item" for a single card)');
          if (w.items != null && !isObj(w.items)) err('"items" must be an object of cards by id');
          var ss = isObj(w.item) ? { item: w.item } : isObj(w.items) ? w.items : {};
          Object.keys(ss).forEach(function (id) { var it = ss[id]; if (!isObj(it)) { err('"' + id + '" must be an object'); return; } strs(it, ['kicker', 'title', 'source'], id); only(it, ITEM.stats, id); pairs(it.stats, id + '.stats'); if (!isArr(it.stats) || it.stats.length < 2 || it.stats.length > 4) err(id + '.stats holds 2 to 4 [value, label]'); if (!isStr(it.source)) err(id + ' has no "source": say where and when the numbers were read'); });
          var sr = reply({ replies: reps }, w.reply); if (isPair(sr)) { text(sr[0], 'reply', ['id', 'title']); text(sr[1], 'reply', ['id', 'title']); }
        }

        if (w.type === 'people') {
          if (w.source != null && w.items == null) {}   // v0.9.0: the people come from the data (no saved copy)
          else if (!isObj(w.items) || !Object.keys(w.items).length) err('"items" must be an object of people by id');
          else Object.keys(w.items).forEach(function (id) { var x = w.items[id]; if (!isObj(x) || !isStr(x.name) || !isStr(x.role)) { err('"' + id + '" needs "name" and "role"'); return; } strs(x, ['note'], id); only(x, ITEM.people, id); if (x.img != null && !linkOK(x.img)) err(id + '.img is not under any entry of "links"'); });
          if (w.filter != null) { if (!isObj(w.filter) || !isStr(w.filter.param)) err('filter is { "param": the tag key that lists ids }'); else param(w.filter.param, 'filter.param'); }
          if (isObj(w.items) && Object.keys(w.items).length > 4 && w.filter == null) err('a people card shows 4 at most: add "filter": { "param": "who" } so the tag picks them');
          var pr = reply({ replies: reps }, w.reply); if (isPair(pr)) { text(pr[0], 'reply', ['id', 'name', 'role']); text(pr[1], 'reply', ['id', 'name', 'role']); }
        }

        if (w.type === 'tracker') {   // v0.10 · a step timeline: the current step is a key the tag carries
          var tk = [], TA = ['ref', 'step', 'label', 'title'], KW = /^[a-z][a-z0-9_]{0,39}$/;
          // a step's or a state's actions: as everywhere, and their replies may hold {ref} {step} {label} {title}
          var tacts = function (l, where) { list(l, where, function (a, at) { var r = resolve({ actions: acts }, a);
            if (r && isPair(r.reply)) { act(merge0(r, { reply: r.reply.slice(0, 2) }), err, at); fieldsCheck(r.reply[2], at + '.reply', err, TA); text(r.reply[0], at + '.reply', TA); text(r.reply[1], at + '.reply', TA); } else act(a, err, at); }); };
          var merge0 = function (x, y) { var o = {}; [x, y].forEach(function (z) { Object.keys(z).forEach(function (k) { o[k] = z[k]; }); }); return o; };
          var tone1 = function (s, at) { if (s.tone != null && TONES.indexOf(s.tone) < 0) err(at + '.tone "' + s.tone + '" is not a tone. Known: ' + TONES.join(', ')); };
          if (!isArr(w.steps) || w.steps.length < 2 || w.steps.length > 8) err('"steps" is 2 to 8 steps in order: [{ "key": "lista", "label": "Lista para recoger" }, …]');
          else w.steps.forEach(function (s, i) {
            var at = 'steps[' + i + ']';
            if (!isObj(s) || !KW.test(s.key || '')) { err(at + ' needs a "key": a lower-case word, the value the flow writes (estado=lista)'); return; }
            if (tk.indexOf(s.key) >= 0) err(at + ': the key "' + s.key + '" is there twice'); else tk.push(s.key);
            only(s, ['key', 'label', 'detail', 'time', 'tone', 'actions'], at); strs(s, ['label', 'detail', 'time'], at); tone1(s, at);
            if (!isStr(s.label)) err(at + ' needs a "label": the step\'s name ("Lista para recoger")');
            else if (Array.from(s.label).length > 40) err(at + '.label is a short name, 40 characters at most (' + Array.from(s.label).length + '): put the rest in "detail"');
            ['label', 'detail', 'time'].forEach(function (k) { if (typeof s[k] === 'string') text(s[k], at + '.' + k, []); });
            tacts(s.actions, at + '.actions');
          });
          var sk = tk.slice();
          list(w.states, 'states', function (s, at) {
            if (!isObj(s) || !KW.test(s.key || '')) { err(at + ' needs a "key": a lower-case word, the value the flow writes (estado=retraso)'); return; }
            if (sk.indexOf(s.key) >= 0) err(at + ': the key "' + s.key + '" is already a step or a state'); else sk.push(s.key);
            only(s, ['key', 'text', 'tone', 'at', 'end', 'actions'], at); tone1(s, at);
            if (!isStr(s.text)) err(at + ' needs a "text": what its status line says ("Retrasado: esperando una pieza")'); else text(s.text, at + '.text', []);
            if (s.end != null && s.end !== true) err(at + '.end is true (the state ends the tracking: cancelled, refused) or left out');
            if (s.at != null && tk.indexOf(s.at) < 0) err(at + '.at "' + s.at + '" is not a step. Known: ' + tk.join(', '));
            else if (s.at == null && s.end !== true) err(at + ' needs "at" (the step it holds up: a delay, in the warn tone) or "end": true (it ends the tracking: cancelled)');
            tacts(s.actions, at + '.actions');
          });
          param(w.param, 'param');
          if (w['default'] != null && sk.indexOf(w['default']) < 0) err('"default" "' + w['default'] + '" is not a step or a state. Known: ' + sk.join(', '));
          if (w.ref != null) { if (!isObj(w.ref) || !isStr(w.ref.param)) err('"ref" is { "param": the tag key of the order code, "label": "Orden" }: shown as the tag writes it, never invented'); else { only(w.ref, ['param', 'label'], 'ref'); param(w.ref.param, 'ref.param'); strs(w.ref, ['label'], 'ref'); } }
          if (w.eta != null) {
            if (!isObj(w.eta) || (w.eta.day == null && w.eta.time == null)) err('"eta" is { "day": a tag key, "time": a tag key, "text": "Lista {when}" }, with a day, a time or both');
            else { only(w.eta, ['day', 'time', 'text'], 'eta'); param(w.eta.day, 'eta.day'); param(w.eta.time, 'eta.time');
              if (w.eta.text != null) { text(w.eta.text, 'eta.text', ['when']); if (typeof w.eta.text === 'string' && w.eta.text.indexOf('{when}') < 0) err('eta.text needs {when}: the kit writes the day and the time there ("hoy a las 18:00")'); } }
          }
          // the tag keys it reads are different keys, and no param reads one of them
          var rk = ['lang', w.param || 'estado'];
          [isObj(w.ref) && w.ref.param, isObj(w.eta) && w.eta.day, isObj(w.eta) && w.eta.time].forEach(function (k) { if (!isStr(k)) return; if (rk.indexOf(k) >= 0) err('the tag key "' + k + '" is read twice: param, ref.param, eta.day, eta.time and lang are different keys'); rk.push(k); });
          Object.keys(pdefs).forEach(function (k) { var d = pdefs[k], key = isObj(d) && isStr(d.param) ? d.param : k; if (rk.indexOf(key) >= 0) err('params.' + k + ': the tag key "' + key + '" is already read by this tracker (its step, ref or eta)'); });
          if (w.live != null && !(typeof w.live === 'string' && KW.test(w.live))) err('"live" is a key of LBW.data (a data message [[lbw:data key=…]] that updates it): a lower-case word, 40 at most');
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
          if (kind !== 'form' && kind !== 'slots' && kind !== 'calendar') err('form "' + w.form + '" is not a form, a slots or a calendar widget (the ones that keep what they sent)');
          else {
            // v0.10 · a calendar keeps its stay: {day} (= {from}, the check-in) {to} (check-out) as days, {nights}, {total} {price} in cents
            var ck = kind === 'slots' ? ['day', 'from', 'to'] : kind === 'calendar' ? ['day', 'from', 'to', 'nights', 'total', 'price', 'summary'] : (isArr(sw.steps) ? sw.steps : []).map(function (x) { return isObj(x) ? x.key : null; }).filter(isStr);
            var C = function (t, where) { text(t, where, ck.concat(['text']), kind === 'form' ? ck : [], kind === 'calendar' ? ['total', 'price'] : [], kind === 'slots' ? ['day'] : kind === 'calendar' ? ['day', 'from', 'to'] : [], kind === 'slots' ? ['from', 'to'] : []); };
            if (!isStr(w.title)) err('"title" must be text'); else C(w.title, 'title');
            C(w.status, 'status'); C(w.note, 'note');
            list(w.rows, 'rows', function (x, at) { if (!isPair(x)) err(at + ' is [label, value]'); else { C(x[0], at); C(x[1], at); } });
            list(w.steps, 'steps', function (x, at) { if (!isStr(x)) err(at + ' must be text'); else C(x, at); });
            list(w.actions, 'actions', function (a, at) { var x = resolve({ actions: acts }, a); if (x) text(x.text, at + '.text', ['text']); });
            // v0.10 · the pass
            if (w.style != null && w.style !== 'pass' && w.style !== 'card') err('"style" is "pass" (a ticket) or "card" (the default)');
            if (w.countdown != null && typeof w.countdown !== 'boolean') err('"countdown" is true or false');
            if (w.code != null) { if (!isStr(w.code)) err('"code" is text, as "{ref}": a param or a value the ' + kind + ' sent (never invented)'); else C(w.code, 'code'); }
            if (w.ics != null && w.ics !== false) { if (!isObj(w.ics)) err('"ics" is { "title", "where", "label" } or false'); else { only(w.ics, ['title', 'where', 'label', 'file'], 'ics'); ['title', 'where', 'label'].forEach(function (k) { if (w.ics[k] != null) { if (!isStr(w.ics[k])) err('ics.' + k + ' must be text'); else C(w.ics[k], 'ics.' + k); } }); if (w.ics.file != null && !(isStr(w.ics.file) && /^[a-z0-9_-]{1,40}$/i.test(w.ics.file))) err('ics.file is a file name: letters, digits, - and _'); } }
          }
        }
        /* v0.10 · calendar */
        if (w.type === 'calendar') {
          var rg = w.mode !== 'single', DT = function (x) { return isStr(x) && LBW.day.read(x) != null; }, whole = function (x, a, b) { return Number.isInteger(x) && x >= a && x <= b; };
          var amount = function (x) { return typeof x === 'number' ? isFinite(x) && x >= 0 && x < 1e8 : /^\d{1,8}([.,]\d{1,2})?$/.test(String(x)); }, priced = false;
          if (w.mode != null && w.mode !== 'range' && w.mode !== 'single') err('"mode" is "range" (check-in and check-out, the default) or "single" (one day)');
          if (w.nights != null) {
            if (!rg) err('"nights" is for a range: a single day has no nights');
            else if (!isObj(w.nights)) err('"nights" is { "min": 2, "max": 14 }: the shortest and the longest stay');
            else { only(w.nights, ['min', 'max'], 'nights'); ['min', 'max'].forEach(function (k) { if (w.nights[k] != null && !whole(w.nights[k], 1, 365)) err('nights.' + k + ' is a whole number of nights, 1 to 365'); });
              if (whole(w.nights.min, 1, 365) && whole(w.nights.max, 1, 365) && w.nights.min > w.nights.max) err('nights: "min" (' + w.nights.min + ') is more than "max" (' + w.nights.max + ')'); }
          }
          if (w.notice != null && !whole(w.notice, 0, 365)) err('"notice" is how many days from today can\'t be picked yet: a whole number, 0 (today can) to 365');
          if (w.horizon != null && !whole(w.horizon, 1, 730)) err('"horizon" is how many days ahead can be picked: a whole number, 1 to 730 (365 by default)');
          if (w.months != null && w.months !== 1 && w.months !== 2) err('"months" is 1 or 2 (2: a second month beside the first where the card is wide)');
          if (w.unlisted != null && w.unlisted !== 'free' && w.unlisted !== 'closed') err('"unlisted" is "free" (a day with no data can be picked, the default) or "closed" (only the days the data lists)');
          if (w.priceFrom != null && typeof w.priceFrom !== 'boolean') err('"priceFrom" is true (the total reads "from 654 €") or left out');
          list(w.rates, 'rates', function (r, at) {
            if (!isObj(r)) { err(at + ' is { "from": "1/12/2026", "to": "31/12/2026", "price": 189 }'); return; } only(r, ['from', 'to', 'price'], at);
            if (!DT(r.from) || !DT(r.to)) err(at + ': "from" and "to" are dates, D/M/YYYY');
            else if (LBW.day.read(r.to) < LBW.day.read(r.from)) err(at + ': "to" is before "from"');
            else if (LBW.day.read(r.to) - LBW.day.read(r.from) > 800) err(at + ': a rate covers 800 days at most');
            if (!amount(r.price)) err(at + '.price is a plain amount per night, as 189 or 189.5 (no currency, no thousands separator)'); else priced = true;
          });
          var seenD = {};
          list(w.days, 'days', function (d, at) {
            if (!isObj(d)) { err(at + ' is { "date": "21/11/2026", "price": 189, "state": "few", "left": 2 }'); return; } only(d, ['date', 'price', 'state', 'left'], at);
            if (!DT(d.date)) err(at + '.date is a date, D/M/YYYY'); else { var dn = LBW.day.read(d.date); if (seenD[dn] != null) err(at + ': ' + d.date + ' is already in days[' + seenD[dn] + ']'); else seenD[dn] = at.replace(/^days\[|\]$/g, ''); }
            if (d.price != null) { if (!amount(d.price)) err(at + '.price is a plain amount, as 189 or 189.5 (no currency, no thousands separator)'); else priced = true; }
            if (d.state != null && ['free', 'few', 'full', 'closed'].indexOf(d.state) < 0) err(at + '.state is free, few, full or closed');
            if (d.left != null && !whole(d.left, 0, 9999)) err(at + '.left is how many are left: a whole number, 0 or more');
            if (d.price == null && d.state == null && d.left == null) err(at + ' says nothing about the day: give "price", "state" or "left"');
          });
          if (w.closed != null) {
            if (!isObj(w.closed)) err('"closed" is { "weekdays": [1], "dates": ["24/12", "1/1/2027"] } (0 = Sunday)');
            else { only(w.closed, ['weekdays', 'dates'], 'closed');
              list(w.closed.weekdays, 'closed.weekdays', function (x, at) { if (!whole(x, 0, 6)) err(at + ' is a weekday, 0 (Sunday) to 6'); });
              list(w.closed.dates, 'closed.dates', function (x, at) { var dmm = /^(\d{1,2})\/(\d{1,2})$/.exec(typeof x === 'string' ? x : ''); if (!(dmm ? +dmm[1] >= 1 && +dmm[1] <= 31 && +dmm[2] >= 1 && +dmm[2] <= 12 : DT(x))) err(at + ' is D/M (every year) or D/M/YYYY'); }); }
          }
          var so = w.source;
          if (so != null) {
            if (!isObj(so)) err('"source" is { "data": a key of LBW.data, "map": { "date": "{fecha}", "price": "{precio}", "state": "{estado}", "left": "{quedan}" } }');
            else { only(so, ['data', 'wait', 'upgrade', 'path', 'map', 'max'], 'source'); priced = true;
              if (so.data == null) err('source.data is missing: the key of the data message that brings the days'); else dataCheck(so, pdefs);
              if (so.path != null && !(isStr(so.path) && /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(so.path))) err('source.path is the dotted key of the list inside the data, as "temporada.dias"');
              if (so.max != null && !whole(so.max, 1, 2000)) err('source.max is how many rows are read: a whole number from 1 to 2000');
              if (so.map != null) { if (!isObj(so.map)) err('source.map is { "date": "{fecha}", "price": "{precio}", "state": "{estado}", "left": "{quedan}" }');
                else { only(so.map, ['date', 'price', 'state', 'left'], 'source.map'); Object.keys(so.map).forEach(function (k) { if (!(isStr(so.map[k]) && /^\{[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*\}$/.test(so.map[k]))) err('source.map.' + k + ' is one column, as "{' + k + '}"'); }); } }
            }
          }
          if (priced && w.money == null) err('prices need "money", the way to write them: { "cur": "€", "after": true, "dec": ",", "th": "." }');
          if (w.unlisted === 'closed' && w.rates == null && w.days == null && so == null) err('"unlisted": "closed" with no "rates", "days" or "source": every day would be closed');
          if (isObj(w.params)) ['nights', 'total', 'price', 'summary', 'month'].forEach(function (k) { if (own(w.params, k)) err('params.' + k + ': "' + k + '" is a name the calendar already fills; call it something else'); });
          var CK = rg ? ['from', 'to', 'day', 'nights', 'total', 'summary'] : ['from', 'day', 'price', 'summary'], CM = rg ? ['total'] : ['price'], CD = rg ? ['from', 'to', 'day'] : ['from', 'day'];
          var CT = function (t, where) { text(t, where, CK, [], CM, CD); if (typeof t === 'string') t.replace(HOLE, function (m, b) { var x = SLOT.exec(b); if (x && CM.indexOf(x[1]) >= 0 && !/:money\b/.test(x[2])) err(where + ': "' + m + '" is an amount in cents: write {' + x[1] + ':money}'); return m; }); };
          if (!isObj(w.send) || !isStr(w.send.text)) err('"send" is { "text": "Quiero reservar del {from:dmy} al {to:dmy}", "fields": { "llegada": "{from:dmy}" } }');
          else { only(w.send, ['text', 'fields'], 'send'); CT(w.send.text, 'send.text');
            if (w.send.fields == null) err('send.fields is required: dates that aren\'t saved can\'t be used by the flow');
            else { fieldsCheck(w.send.fields, 'send.fields', err, CK); if (isObj(w.send.fields)) Object.keys(w.send.fields).forEach(function (k) { var fv = w.send.fields[k]; if (typeof fv === 'string' && (fv.match(/\{([A-Za-z_]\w*)/g) || []).every(function (h) { return CK.indexOf(h.slice(1)) >= 0; })) CT(fv, 'send.fields.' + k); }); } }
        }
      } catch (e) { err('could not be checked (' + e.message + ')'); }
    });
    return errs;
  }

  K.setup._check = check;
  K.setup.check = function (cfg) { return check(cfg).map(function (e) { return e.message; }); };
})(typeof window !== 'undefined' ? window : this);
