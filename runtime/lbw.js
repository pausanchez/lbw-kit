/* lbw.js · Landbot AI Widgets runtime · v0.9.2
   Turns tags that an AI agent (or a flow message) writes at the end of a bot message, e.g. [[shop:card id=boots lang=en]],
   into interactive widgets inside the Landbot v4 web chat. Distilled from four production experiments (retos 16-19).
   You write: your data, your labels and one function per widget. The runtime does the rest:
   - finds bot messages, parses tags (tolerant), removes them from the text, renders the widgets, keeps `data-tag`
   - validates every value against closed lists (helpers on `p`), and logs what it drops in window.__lbwDropped
   - quick replies: posts a message AS THE VISITOR, queued until the chat is quiet (never above a reply still arriving)
   - fields: writes Landbot fields (custom_data) with that message; reads fields a flow interpolated into a tag
   - one-shot chip groups that go quiet once the visitor writes again
   Load it in the bot's Custom JS before your widgets:  <script>…lbw.js…</script><script>…your widgets…</script>
   Text is always set with textContent; links only to origins you allow. */
(function (root) {
  if (root.LBW) return;
  var cfg = { prefix: 'w', langs: ['en'], defaultLang: 'en', maxPerMessage: 3, links: [], quietMs: 1500, maxWaitMs: 20000, labels: {} };
  var W = {}, last = {}, lock = 0, quietSince = Date.now(), started = false;
  var log = function (k, v) { (root[k] = root[k] || []).push(v); };
  // LBW.on('render' | 'say' | 'drop', fn): what was drawn, what the visitor sent through a widget, what was thrown away.
  // For counting views and clicks; a listener that throws is ignored.
  var subs = {};
  function emit(name, data) { (subs[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); }
  function drop(what) { log('__lbwDropped', what); emit('drop', what); }

  // ── DOM helpers: text only ───────────────────────────────────────────────────────────────────
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function allowed(url) {   // http(s) entries are origins ending in '/': 'https://shop.example' alone would also match 'https://shop.example.evil.com'
    if (typeof url !== 'string' || /[\s"'<>]/.test(url)) return false;
    if (/^tel:/i.test(url)) return cfg.links.indexOf('tel:') >= 0 && /^tel:\+?\d{6,15}$/.test(url);
    if (/^mailto:/i.test(url)) return cfg.links.indexOf('mailto:') >= 0 && /^mailto:[^@?\/]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(url);
    return cfg.links.some(function (o) { if (!/^https?:/.test(o)) return false; o = /\/$/.test(o) ? o : o + '/'; return url.indexOf(o) === 0; });
  }
  function link(text, href, cls) {
    if (!allowed(href)) { drop('link not allowed: ' + href); return null; }
    var a = el('a', 'lbw-pill' + (cls ? ' ' + cls : ''), text); a.href = href;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  // a Call button from a phone number as people write it ('06 52 64 45 30', '55 9088 6500', '+34 972 …'). With `cc` a number
  // without '+' becomes international: a trunk 0 is dropped (France '06…' → +336…), a number with no trunk prefix gets +cc
  // (Mexico '55 9088 6500' → +525590886500), and one that already starts with cc and has 11+ digits only gets the '+'
  function tel(text, phone, cls, cc) {
    var d = String(phone || '').replace(/[^\d+]/g, ''); cc = cc ? String(cc).replace(/\D/g, '') : '';
    if (cc && d && d.charAt(0) !== '+') d = /^0/.test(d) ? '+' + cc + d.slice(1) : d.indexOf(cc) === 0 && d.length >= 11 ? '+' + d : '+' + cc + d;
    return link(text, 'tel:' + d, cls);
  }
  function btn(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  // ui.img(src, cls, { srcset: [[url, 360], [url, 640]], sizes: '(max-width: 480px) 90vw, 420px', width, height, alt })
  // every URL, srcset included, must be in `links`; a refused or broken image hides its frame, never a broken icon
  function img(src, cls, o) {
    o = o || {};
    var f = el('div', 'lbw-img' + (cls ? ' ' + cls : ''));
    if (window.__lbwNoImg === true) { f.classList.add('is-empty'); return f; }   // a mock pin (&noimg=1): layout shots without loading the client's photos
    if (!allowed(src)) { drop('image not allowed: ' + src); f.classList.add('is-empty'); return f; }
    var i = el('img'); i.src = src; i.alt = o.alt || ''; i.loading = 'lazy'; i.decoding = 'async';
    if (o.srcset) {
      var set = o.srcset.filter(function (x) { var ok = allowed(x[0]) && +x[1] > 0; if (!ok) drop('image not allowed: ' + x[0]); return ok; });
      if (set.length) { i.srcset = set.map(function (x) { return x[0] + ' ' + (+x[1]) + 'w'; }).join(', '); i.sizes = o.sizes || '(max-width: 480px) 90vw, 640px'; }
    }
    if (o.width && o.height) { i.width = o.width; i.height = o.height; }
    i.addEventListener('error', function () { i.remove(); f.classList.add('is-empty'); }); f.appendChild(i); return f;
  }
  function card(lang, cls) { var o = el('div', 'lbw' + (cls ? ' ' + cls : '')), b = el('div', 'lbw-box'); o.setAttribute('lang', lang); o.appendChild(b); o.box = b; return o; }
  function head(box, kicker, title, aside) {
    var h = el('div', 'lbw-head'), l = el('div');
    if (kicker) l.appendChild(el('div', 'lbw-kicker', kicker));
    l.appendChild(el('div', 'lbw-title', title)); h.appendChild(l); if (aside) h.appendChild(aside); box.appendChild(h); return h;
  }
  function row(parent, items, cls) { var r = el('div', 'lbw-actions' + (cls ? ' ' + cls : '')); items.forEach(function (a) { if (a) r.appendChild(a); }); parent.appendChild(r); return r; }
  function rows(box, pairs) {   // [[label, value], …]: null values skipped
    var dl = el('dl', 'lbw-rows');
    pairs.forEach(function (p) { if (p && p[1] != null && p[1] !== '') { var r = el('div'), v = String(p[1]), dd = el('dd'); r.appendChild(el('dt', null, p[0]));
      var at = /^[^\s@]+@[^\s@]+$/.test(v) ? v.indexOf('@') + 1 : -1;   // v0.8.1.7: an email address may break after its @, not mid-word
      if (at > 0) { dd.appendChild(document.createTextNode(v.slice(0, at))); dd.appendChild(document.createElement('wbr')); dd.appendChild(document.createTextNode(v.slice(at))); } else dd.textContent = v;
      r.appendChild(dd); dl.appendChild(r); } });
    box.appendChild(dl); return dl;
  }

  // ── talking back: post as the visitor, optionally writing fields ───────────────────────────────
  // v4 widget API first (dev.landbot.io/sdks/widgets/api/widget#sendmessage): the bot's Custom JS hands the runtime the
  // widget instance, `LBW.landbot(this)` at its TOP level (inside a callback `this` is something else). Its sendMessage
  // returns a Promise and takes the fields as custom_data in the same message. Then window._landbot (the share page), then
  // the legacy bridge inside the chat iframe (Landbot.exec, logs a deprecation warning: fields queued with
  // 'landbot-custom-data', then the message), then typing into the text box. Each message goes out once: a way is left
  // for the next only when it throws or its Promise rejects. Measured live (13 Nov 2026, docs/07): `this` is the widget on the
  // share page (=== window._landbot) and in a Livechat embed (the host's myLandbot); custom_data wrote the field; the
  // Promise resolves to undefined; Landbot.exec still works but logs two console.error lines per click.
  var bound = null;
  function bind(w) {
    if (!w || w === root) return false;   // a plain <script> (the mock): `this` is the window, nothing to bind
    if (typeof w.sendMessage !== 'function') { drop('LBW.landbot: not a widget (no sendMessage)'); return false; }
    bound = w; return true;
  }
  function setData(fields) {   // fields with no message: queued, saved with the next one
    var lb = root._landbot;
    try { if (bound && typeof bound.setCustomData === 'function') { bound.setCustomData(fields); return true; } } catch (e) {}
    try { if (root.Landbot && typeof root.Landbot.exec === 'function') { root.Landbot.exec('landbot-custom-data', fields); return true; } } catch (e) {}
    try { if (lb && typeof lb.setCustomData === 'function') { lb.setCustomData(fields); return true; } } catch (e) {}
    drop('no way to store fields'); return false;
  }
  function store(fields) { log('__lbwStored', fields); return setData(fields); }
  function post(text, fields) {
    if (fields) log('__lbwStored', fields);
    log('__lbwSent', text); emit('say', { text: text, fields: fields || null });
    var lb = root._landbot, ways = [], msg = { type: 'text', message: text };
    if (fields) msg.custom_data = fields;
    if (bound) ways.push(['widget', bound]);
    if (lb && lb !== bound && typeof lb.sendMessage === 'function') ways.push(['_landbot', lb]);
    function next(i) {
      if (i >= ways.length) return legacy(text, fields);
      var r;
      try { r = ways[i][1].sendMessage(msg); } catch (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + e.message + ')'); return next(i + 1); }
      if (r && typeof r.then === 'function') r.then(null, function (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + (e && e.message || e) + ')'); next(i + 1); });
    }
    next(0);
  }
  function legacy(text, fields) {
    var L = root.Landbot;
    if (L && typeof L.exec === 'function') {
      try { if (fields) L.exec('landbot-custom-data', fields); L.exec('landbot-msg-send', { type: 'text', message: text }); return; } catch (e) {}
    } else if (fields) setData(fields);
    var box = document.querySelector('[data-lb-part="input-field"] textarea, textarea');   // last resort: type it
    if (!box) { drop('no way to send: ' + text); return; }
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }
  function quiet() { return !document.querySelector('[data-lb-part="window"] [role="status"]') && Date.now() - quietSince > cfg.quietMs; }
  // say(): one send per 1.2 s (double clicks), queued until the chat is quiet: a click while the agent's reply is still
  // arriving otherwise lands ABOVE that reply. Returns true when accepted (mark the control as sent right away).
  // Sends that wait go out in the order they were clicked: one queue, one timer (two waits on their own timers could swap).
  var queue = [];
  function pump() {
    if (!queue.length) return;
    if (quiet() || Date.now() - queue[0].t0 > cfg.maxWaitMs) { var q = queue.shift(); try { post(q.text, q.fields); } catch (e) { drop('send failed: ' + q.text + ' (' + e.message + ')'); } if (!queue.length) return; }
    setTimeout(pump, 250);
  }
  function say(text, fields) {
    if (!text || Date.now() - lock < 1200) return false; lock = Date.now();
    queue.push({ text: text, fields: fields, t0: Date.now() }); if (queue.length === 1) pump();
    return true;
  }
  // a button that says `text` (and writes `fields`) when clicked; `label` may be shorter than what it sends
  function reply(label, text, opts) {
    opts = opts || {};
    var b = btn(label, 'lbw-pill lbw-reply' + (opts.primary ? ' is-primary' : '') + (opts.cls ? ' ' + opts.cls : ''));
    b.setAttribute('data-say', text); if (opts.fields) b.setAttribute('data-store', JSON.stringify(opts.fields));
    b.addEventListener('click', function () {
      if (b.disabled) return;
      if (say(text, opts.fields)) { b.classList.add('is-sent'); var g = b.closest('.lbw-once'); if (g) done(g); if (opts.onSent) opts.onSent(b); }
    });
    return b;
  }
  function done(g) { g.classList.add('is-done'); [].forEach.call(g.querySelectorAll('button'), function (x) { x.disabled = true; }); }
  // a one-shot group: after one click (or once the visitor writes something else) every button in it is disabled
  function once(cls) { return el('div', 'lbw-once' + (cls ? ' ' + cls : '')); }
  // a multi-select: toggles + a CTA. Nothing is sent until the CTA; then send(keys) returns [text, fields] and both go
  // out together. multi([['vegan','Vegan'], …], 'Continue', function (keys) { return ['I eat: …', { diet: keys.join(',') }]; })
  function multi(items, ctaLabel, send, pre) {
    var g = once('lbw-chips lbw-multi'), cta = btn(ctaLabel, 'lbw-pill is-primary');
    function picked() { return [].filter.call(g.querySelectorAll('.lbw-tog'), function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-k'); }); }
    function sync() { var n = picked().length; cta.disabled = !n; cta.textContent = ctaLabel + (n ? ' · ' + n : ''); }
    items.forEach(function (it) {
      var b = btn(it[1], 'lbw-tog'); b.setAttribute('data-k', it[0]); b.setAttribute('aria-pressed', pre && pre.indexOf(it[0]) >= 0 ? 'true' : 'false');
      b.addEventListener('click', function () { if (g.classList.contains('is-done')) return; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); sync(); });
      g.appendChild(b);
    });
    cta.addEventListener('click', function () {
      var ks = picked(); if (!ks.length) return;
      var out = send(ks); cta.setAttribute('data-say', out[0]);
      if (say(out[0], out[1])) { cta.classList.add('is-sent'); done(g); }
    });
    g.appendChild(cta); sync(); return g;
  }
  // a form that sends ONCE (v0.4). Controls change f.state and call
  // f.update(); nothing goes out until the CTA. ready(state) returns true, or the CTA's label while it can't send yet.
  // var f = LBW.ui.form('np-plan', { state: { a: 1, day: null }, cta: 'Check my visit',
  //   ready: function (s) { return s.day != null || 'Pick a day'; }, change: function (s) { …redraw a total… },
  //   send: function (s) { return ['My visit: …', { visit_day: LBW.day.str(s.day) }]; } });
  // f.add(LBW.ui.stepper('Adults', f.state.a, { min: 0, max: 20, change: function (v) { f.state.a = v; f.update(); } }));
  function form(cls, o) {
    var g = once('lbw-form' + (cls ? ' ' + cls : '')), cta = btn(o.cta, 'lbw-pill is-primary lbw-cta'), f = { el: g, state: o.state || {}, cta: cta };
    f.add = function (node) { if (node) g.insertBefore(node, cta); return node; };
    f.update = function () {
      if (g.classList.contains('is-done')) return;
      var r = o.ready ? o.ready(f.state) : true; cta.disabled = r !== true; cta.textContent = r === true || typeof r !== 'string' ? o.cta : r;
      if (o.change) try { o.change(f.state); } catch (e) { drop('form change: ' + e.message); }
    };
    cta.addEventListener('click', function () {
      if (cta.disabled || g.classList.contains('is-done')) return;
      var out = o.send(f.state); if (!out || !out[0]) return;
      cta.setAttribute('data-say', out[0]);
      if (say(out[0], out[1])) { cta.classList.add('is-sent'); done(g); if (o.sent) o.sent(f.state); }
    });
    g.appendChild(cta); setTimeout(f.update, 0); return f;
  }
  // a − n + counter in [min, max] by `step` (default 1), shown through `format` (default the bare number): money is
  // stepper('Monto', 2000, { min: 100, max: 8000, step: 100, format: function (v) { return '$' + v.toLocaleString('es-MX'); } })
  // goes quiet with its form. aria-labels from opts.less / opts.more; the shown text is also the output's aria-label
  function stepper(label, val, o) {
    o = o || {}; var min = o.min == null ? 0 : o.min, max = o.max == null ? 20 : o.max, step = o.step > 0 ? o.step : 1;
    var w = el('div', 'lbw-step'), tx = el('div', 'lbw-step-l'); tx.appendChild(el('span', null, label)); if (o.hint) tx.appendChild(el('span', 'lbw-muted', o.hint)); w.appendChild(tx);
    var minus = btn('−', 'lbw-step-b'), num = el('output', 'lbw-step-n'), plus = btn('+', 'lbw-step-b');
    minus.setAttribute('aria-label', (o.less || '−') + ' · ' + label); plus.setAttribute('aria-label', (o.more || '+') + ' · ' + label);
    function set(v, quietly) {
      v = Math.max(min, Math.min(max, min + Math.round((v - min) / step) * step)); w.value = val = +v.toFixed(6);
      var shown = o.format ? String(o.format(val)) : String(val); num.textContent = shown; num.setAttribute('aria-label', label + ': ' + shown);
      minus.disabled = val <= min; plus.disabled = val >= max; if (!quietly && o.change) o.change(val);
    }
    w.set = function (v) { set(v); };   // presets ("$2,000", "$5,000") call it
    minus.addEventListener('click', function () { if (!w.closest('.is-done')) set(val - step); });
    plus.addEventListener('click', function () { if (!w.closest('.is-done')) set(val + step); });
    w.appendChild(minus); w.appendChild(num); w.appendChild(plus); set(val == null ? min : val, true); return w;
  }

  // ── parameters: everything from a tag is untrusted text ────────────────────────────────────────
  // A field that a flow interpolated but was never set arrives as '@{name}' / '@name' / '', and Landbot's default name
  // is 'Visitor #537058751': all of these read as missing.
  function missing(v) { v = String(v == null ? '' : v).trim(); return !v || /^@\{?[a-z0-9_]+\}?$/i.test(v) || /^Visitor[ ,]#\d+$/i.test(v); }
  function Params(raw) { this.raw = raw; }
  Params.prototype = {
    has: function (k) { return !missing(this.raw[k]); },
    // known values only, each once; splits on , + ; | & and spaces (the agent once wrote 'scaling+business')
    list: function (k, allowedList, max) {
      if (!this.has(k)) return [];
      var seen = {}, norm = function (x) { return String(x).trim().toLowerCase().replace(/-/g, '_'); }, ok = {};
      allowedList.forEach(function (a) { ok[norm(a)] = a; });   // 'sea-fast' and 'Sea_Fast' both read as the listed id
      return String(this.raw[k]).split(/[,\s+;|&]+/).map(norm)
        .filter(function (x) { if (!x || seen[x]) return false; if (!ok[x]) { drop('unknown value ' + k + '=' + x); return false; } return (seen[x] = true); })
        .map(function (x) { return ok[x]; }).slice(0, max || 99);
    },
    one: function (k, allowedList) { return this.list(k, allowedList, 1)[0] || null; },
    // a number in [lo, hi]; missing, unreadable or below lo → the default (never the minimum); above hi → capped
    // opts.int: whole numbers only (2.5 → default); opts.reject: above hi → default instead of capped (use it for values
    // read back from fields: a booking for 40 must not show as 12). parseFloat is lenient: '4 people' reads 4
    num: function (k, lo, hi, dflt, opts) {
      opts = opts || {};
      if (!this.has(k)) return dflt;
      var n = parseFloat(String(this.raw[k]).replace(',', '.'));
      if (!isFinite(n) || n < lo || (opts.int && n !== Math.round(n)) || (opts.reject && n > hi)) { drop('bad number ' + k + '=' + this.raw[k]); return dflt; }
      return Math.min(hi, n);
    },
    // free text from a field or the model: shown as text only, trimmed, no brackets
    text: function (k, max) { return this.has(k) ? String(this.raw[k]).replace(/[<>\[\]{}]/g, '').trim().slice(0, max || 80) : ''; },
    // a date written D/M/YYYY or YYYYMMDD; null when not a real date
    date: function (k) {
      if (!this.has(k)) return null; var s = String(this.raw[k]), m = /^(\d\d?)\/(\d\d?)\/(20\d\d)$/.exec(s), y, mo, d;
      if (m) { y = +m[3]; mo = +m[2]; d = +m[1]; } else if ((m = /^(20\d\d)(\d\d)(\d\d)$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; } else return null;
      var t = new Date(y, mo - 1, d); return t.getMonth() === mo - 1 ? t : null;
    },
    // a whole day as a UTC day number (LBW.day): D/M/YYYY (also - or .), YYYY-MM-DD or YYYYMMDD; null when not a real day.
    // Prefer it to date(): day numbers never shift with the visitor's time zone, and compare with LBW.day.today(tz)
    day: function (k) { return this.has(k) ? dayRead(this.raw[k]) : null; }
  };
  // ── whole days as UTC day numbers: no time zone, no daylight saving, plain arithmetic (n + 7, n - 5) ──
  function dayNum(y, m, d) { return Math.floor(Date.UTC(y, m - 1, d) / 864e5); }
  function dayParts(n) { var t = new Date(n * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() }; }
  function dayRead(s) {
    s = String(s == null ? '' : s).trim(); var m, y, mo, d;
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d\d)$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = /^(20\d\d)-?(\d\d)-?(\d\d)$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
    var n = dayNum(y, mo, d), p = dayParts(n); return p.m === mo && p.d === d ? n : null;
  }
  // "today" where the CLIENT is (an IANA zone such as 'Europe/Madrid'), not on the visitor's clock;
  // window.__lbwToday = 'D/M/YYYY' pins it in tests
  function dayToday(tz) {
    var pin = root.__lbwToday && dayRead(root.__lbwToday); if (pin) return pin;
    try {
      var f = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz || cfg.timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).forEach(function (x) { f[x.type] = x.value; });
      return dayNum(+f.year, +f.month, +f.day);
    } catch (e) { var t = new Date(); return dayNum(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
  }
  // LBW.day.format(n, 'es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) → "sábado, 21 de noviembre de 2026"
  function dayFormat(n, lang, o) { try { return new Date(n * 864e5).toLocaleDateString(lang, Object.assign({ timeZone: 'UTC' }, o || { day: 'numeric', month: 'long', year: 'numeric' })); } catch (e) { var p = dayParts(n); return p.d + '/' + p.m + '/' + p.y; } }
  function dayStr(n) { var p = dayParts(n); return p.d + '/' + p.m + '/' + p.y; }
  // Easter Sunday of year y as a day number (Meeus/Jones/Butcher): Good Friday is easter(y) - 2, Easter Monday + 1
  function dayEaster(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
        h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    return dayNum(y, Math.floor((h + l - 7 * m + 114) / 31), (h + l - 7 * m + 114) % 31 + 1);
  }
  // which of its weekday in the month n is: 1 for the first Sunday, …, 5. Last one: dayParts(n + 7).m !== dayParts(n).m
  function dayNth(n) { return Math.ceil(dayParts(n).d / 7); }
  // the first day from n (included) for which test(n) is true, within max days (default 400); null if none
  function dayNext(n, test, max) { for (var k = 0; k <= (max || 400); k++) if (test(n + k)) return n + k; return null; }
  // 'D/M' (or D/M/YYYY) list → a test: LBW.day.on(['1/1', '25/12'])(n). Year-less entries match every year
  function dayOn(list) {
    var dm = {}, full = {};
    (list || []).forEach(function (s) { var x = dayRead(s); if (x != null) full[x] = 1; else { var m = /^(\d{1,2})[\/.\-](\d{1,2})$/.exec(String(s).trim()); if (m) dm[+m[1] + '/' + +m[2]] = 1; } });
    return function (n) { var p = dayParts(n); return !!(full[n] || dm[p.d + '/' + p.m]); };
  }

  // ── time of day as minutes since midnight (v0.4): days say WHICH day, minutes say WHEN in it ───
  // LBW.time.now(tz) where the client is; window.__lbwNow = 'HH:MM' pins it in tests (with __lbwToday for the day)
  function timeNow(tz) {
    var pin = root.__lbwNow != null ? timeRead(root.__lbwNow) : null; if (pin != null) return pin;
    try {
      var f = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz || cfg.timeZone || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { f[x.type] = x.value; });
      return (+f.hour % 24) * 60 + +f.minute;
    } catch (e) { var t = new Date(); return t.getHours() * 60 + t.getMinutes(); }
  }
  // '10:30', '10.30', '10h30', '1030', '10' → 630; '24:00' → 1440 (a closing time); anything else → null
  function timeRead(s) {
    var m = /^(\d{1,2})(?:[:.h]?(\d\d))?h?$/i.exec(String(s == null ? '' : s).trim()); if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0; return h < 24 && mi < 60 || h === 24 && !mi ? h * 60 + mi : null;
  }
  // 630 → '10:30'; sep '.' for Catalan ('10.30'); { h12: true } → '10:30 am'
  function timeFmt(m, sep, o) {
    m = Math.round(m); if (m !== 1440) m = ((m % 1440) + 1440) % 1440;   // 1440 stays '24:00' (a closing time)
    var h = Math.floor(m / 60), mi = m % 60, z = (mi < 10 ? '0' : '') + mi;
    if (o && o.h12) return ((h % 12) || 12) + (sep || ':') + z + (h < 12 ? ' am' : ' pm');
    return h + (sep || ':') + z;
  }
  // ranges are [[open, close], …] in minutes, e.g. [[600, 840], [960, 1140]] for 10:00–14:00 · 16:00–19:00
  // LBW.time.state(ranges, m) → { open: true, until: 840 } | { open: false, next: 960 } (later today) | { open: false, next: null }
  function timeState(ranges, m) {
    var rs = (ranges || []).slice().sort(function (a, b) { return a[0] - b[0]; });
    for (var i = 0; i < rs.length; i++) { if (m >= rs[i][0] && m < rs[i][1]) return { open: true, until: rs[i][1] }; if (m < rs[i][0]) return { open: false, next: rs[i][0] }; }
    return { open: false, next: null };
  }
  // the next opening from (day n, minute m): hoursOf(n) returns that day's ranges ([] when closed). → { n, m } or null
  function timeNextOpen(hoursOf, n, m, max) {
    for (var k = 0; k <= (max || 14); k++) { var rs = hoursOf(n + k) || [], s = timeState(rs, k ? -1 : m); if (s.open && !k) return { n: n, m: m, now: true }; if (s.next != null) return { n: n + k, m: s.next }; }
    return null;
  }

  // ── calendar links (v0.4): an event is { title, day, end (day, optional), from, to (minutes, optional), where, url, tz } ─
  function stamp(n, m) { var p = dayParts(n), z = function (x) { return (x < 10 ? '0' : '') + x; }; return p.y + z(p.m) + z(p.d) + (m == null ? '' : 'T' + z(Math.floor(m / 60)) + z(m % 60) + '00'); }
  // Google Calendar's template URL. Add 'https://calendar.google.com/' to links; ' is encoded (links refuse it)
  function gcal(e) {
    var enc = function (x) { return encodeURIComponent(String(x || '')).replace(/'/g, '%27'); };
    var dates = e.from != null && e.to != null ? stamp(e.day, e.from) + '/' + stamp(e.day, e.to) : stamp(e.day) + '/' + stamp((e.end || e.day) + 1);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(e.title) + '&dates=' + dates +
      '&ctz=' + enc(e.tz || cfg.timeZone || '') + (e.where ? '&location=' + enc(e.where) : '') + (e.url ? '&details=' + enc(e.url) : '');
  }
  function icsText(e) {
    var esc = function (s) { return String(s || '').replace(/[\\,;]/g, function (c) { return '\\' + c; }).replace(/\r?\n/g, ' '); }, tz = e.tz || cfg.timeZone;
    var dt = e.from != null && e.to != null
      ? (tz ? ['DTSTART;TZID=' + tz + ':' + stamp(e.day, e.from), 'DTEND;TZID=' + tz + ':' + stamp(e.day, e.to)] : ['DTSTART:' + stamp(e.day, e.from), 'DTEND:' + stamp(e.day, e.to)])
      : ['DTSTART;VALUE=DATE:' + stamp(e.day), 'DTEND;VALUE=DATE:' + stamp((e.end || e.day) + 1)];
    var now = new Date(), utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lbw.js//AI Widgets//EN', 'BEGIN:VEVENT', 'UID:' + stamp(e.day) + '-' + Math.random().toString(36).slice(2) + '@lbw', 'DTSTAMP:' + utc]
      .concat(dt, ['SUMMARY:' + esc(e.title)], e.where ? ['LOCATION:' + esc(e.where)] : [], e.url && allowed(e.url) ? ['URL:' + e.url] : [], ['END:VEVENT', 'END:VCALENDAR']).join('\r\n');
  }
  // a button that downloads the event as an .ics file (a Blob: a data:/blob: href can't be a checked link)
  function ics(label, e, cls) {
    var b = btn(label, 'lbw-pill lbw-ics' + (cls ? ' ' + cls : ''));
    b.addEventListener('click', function () {
      try {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([icsText(e)], { type: 'text/calendar' }));
        a.download = (e.file || 'event-' + stamp(e.day)) + '.ics'; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); b.classList.add('is-sent');
      } catch (x) { drop('ics failed: ' + x.message); }
    });
    return b;
  }
  function parse(attrs) {
    // values are separated by '|' when the tag has one (a value may then hold spaces: names from fields),
    // otherwise by spaces; a loose token with no '=' is glued to the previous value with a comma
    var p = {}, s = String(attrs || '').trim(), parts = s.indexOf('|') >= 0 ? s.split('|') : s.split(/\s+/), lastKey = null;
    parts.forEach(function (kv) {
      kv = kv.trim(); var i = kv.indexOf('='), k = i > 0 ? kv.slice(0, i).trim().toLowerCase() : '';
      if (/^[a-z_][a-z0-9_]*$/.test(k)) { lastKey = k; p[k] = kv.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
      else if (lastKey && kv) p[lastKey] += ',' + kv.replace(/^,|,$/g, '');
    });
    return p;
  }

  // ── scanning bot messages ────────────────────────────────────────────────────────────────────
  function tagRe() { return new RegExp('`?\\[\\[\\s*' + cfg.prefix + ':([a-z][a-z0-9_]*)\\s*([^\\]]*?)\\s*\\]\\]`?', 'gi'); }
  function render(name, attrs, tag, hostMsg, tags, others) {
    var raw = parse(attrs), p = new Params(raw), rl = String(raw.lang || '').toLowerCase(), base = rl.split(/[-_]/)[0],
        lang = cfg.langs.indexOf(rl) >= 0 ? rl : cfg.langs.indexOf(base) >= 0 ? base : cfg.defaultLang;   // 'es-ES' and 'es_ES' read as 'es'
    name = String(name).toLowerCase();
    var def = W[name]; if (!def) return { why: 'unknown widget' };
    var L = (cfg.labels && cfg.labels[lang]) || {};
    var ctx = { lang: lang, L: L, tag: tag, message: hostMsg, prev: prevUser(hostMsg), tags: tags || [], others: (others || []).slice() };
    // tags: the widget names of every tag in this message; others: the widgets already drawn from it (a chips tag written
    // last sees the cards before it, e.g. to drop a chip whose data-say a card already offers)
    var w = null;
    try { w = def.render(p, ctx); } catch (e) { return { why: 'error: ' + e.message }; }
    if (!w) return { why: 'widget returned null' };
    w.setAttribute('data-tag', tag); w.setAttribute('data-widget', name); if (def.last) w.setAttribute('data-last', '1');
    return { w: w };
  }
  // ── async widgets: render() must answer at once, so it returns a skeleton and fills it later ──────
  // var o = LBW.ui.loading(ctx.lang, 'np-card');
  // LBW.later(o, LBW.csv(URL), function (rows) { …fill o.box…; return false to remove the widget (unknown id) },
  //           function () { …optional: a fallback when the data can't be read; without it the widget is removed… });
  // return o;
  function loading(lang, cls) { var o = card(lang, cls), s = el('div', 'lbw-skel'); o.classList.add('is-loading'); o.setAttribute('aria-busy', 'true'); o.box.appendChild(s); return o; }
  function later(o, promise, fill, fallback) {
    function settle() { o.classList.remove('is-loading'); o.removeAttribute('aria-busy'); var s = o.querySelector('.lbw-skel'); if (s) s.remove(); }
    function gone(why) { drop((o.getAttribute('data-tag') || 'widget') + ' (' + why + ')'); o.remove(); }
    Promise.resolve(promise).then(function (data) {
      var hostMsg = o.closest && o.closest('[data-lb-part="message"]'), near = null; try { var sc1 = hostMsg && scroller(hostMsg); near = sc1 ? atEnd(sc1, 240, null) : null; } catch (e) {}
      settle(); var r; try { r = fill(data); } catch (e) { return gone('error: ' + e.message); }
      if (r !== false && hostMsg) reveal(hostMsg, near);   // a card that grew from its skeleton
      if (r === false) gone('nothing to show');
    }, function (e) {
      settle(); if (fallback) { try { o.box.textContent = ''; fallback(e); drop((o.getAttribute('data-tag') || 'widget') + ' (data unavailable: fallback)'); return; } catch (x) {} }
      gone('data unavailable: ' + (e && e.message));
    });
    return o;
  }
  // ── CSV (a Google Sheet published as CSV): RFC 4180, rows as objects keyed by the lower-cased header ──
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    var head = (rows.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
    return rows.filter(function (r) { return r.join('').trim(); }).map(function (r) { var o = {}; head.forEach(function (h, k) { o[h] = (r[k] || '').trim(); }); return o; });
  }
  // LBW.csv(url, { maxAge: 60000 }) → Promise of rows. One fetch per URL per page view, refreshed after maxAge;
  // a failed fetch is not cached (the next widget retries) and a stale copy is served when a refresh fails.
  // Call it once at load (prefetch) so the first widget doesn't wait the ~2 s Google takes.
  var csvCache = {};
  function cached(kind, url, o, read) {
    var key = kind + ' ' + url, c = csvCache[key], age = (o && o.maxAge) || 60000;
    if (c && (c.busy || Date.now() - c.t < age)) return c.p;
    var p = new Promise(function (res, rej) {   // a fetch that never settles would leave a skeleton forever: give up after 8 s
      var t = setTimeout(function () { rej(new Error('timeout')); }, (o && o.timeout) || 8000);
      fetch(url, { cache: 'no-store', credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (x) { clearTimeout(t); res(x); }, function (e) { clearTimeout(t); rej(e); });
    })
      .then(function (t) { csvCache[key].busy = false; return read(t); })
      .catch(function (e) { drop(kind + ' failed: ' + url + ' (' + e.message + ')'); if (c && c.ok) { csvCache[key] = c; return c.p; } delete csvCache[key]; throw e; });
    csvCache[key] = { t: Date.now(), p: p, busy: true };
    p.then(function () { if (csvCache[key]) csvCache[key].ok = true; }, function () {});
    return p;
  }
  function csv(url, o) { return cached('csv', url, o, parseCSV); }
  // LBW.json(url, { maxAge }) → Promise of the parsed JSON, cached like csv. The endpoint must answer CORS.
  function json(url, o) { return cached('json', url, o, function (t) { return JSON.parse(t); }); }
  // LBW.page(url, { maxAge }) → Promise of a parsed, INERT Document (DOMParser: no script runs, no image loads) for reading
  // a client's own page that answers CORS (check: curl -sI -H 'Origin: https://landbot.online' URL). The URL must be in links.
  // Read it with querySelector and textContent only; never move its nodes into the chat. Pages over 1 MB are cut.
  function page(url, o) {
    if (!allowed(url)) { drop('page not allowed: ' + url); return Promise.reject(new Error('not allowed')); }
    return cached('page', url, o, function (t) { return new DOMParser().parseFromString(String(t).slice(0, 1e6), 'text/html'); });
  }
  // ── LBW.data (v0.9.0): data the flow hands to the widgets, by name ──────────────────────────────────
  // A flow Code block runs in the chat's own window (docs/13 §2c), late: after every message up to the next block that waits
  // for the visitor (measured live, 13 Nov 2026). It calls LBW.data.put('tarifas', x),
  // x an object, a list or a JSON text (a webhook's answer kept in a field). A kit widget with "source": { "data": "tarifas" }
  // then draws from it. What is put here is untrusted data: a JSON copy is kept (500 KB at most), never code, in memory only.
  // put(key, x) → true | false (unreadable: logged, and widgets waiting on it draw their saved copy) · get(key) → the copy |
  // undefined · wait(key, ms) → a Promise of the copy, rejected when it was unreadable or after ms (1500) · clear(key)
  var dataBox = Object.create(null), dataWaits = Object.create(null), DATA_KEY = /^[a-z][a-z0-9_]{0,39}$/;
  // v0.9.0 · measured live (13 Nov 2026): an object a Webhook block saved reaches @{field} as a Python repr, never JSON:
  // {'id': 1, 'tags': ['a'], 'ok': False, 'n': None}, with "double quotes" around a text that has an apostrophe.
  // This reads exactly that grammar (dicts, lists, tuples, quoted texts with Python escapes, numbers, True/False/None) and
  // nothing else: no names, no calls, no eval. Throws on anything outside it.
  function pyRead(s) {
    var i = 0, n = s.length, depth = 0;
    function ws() { while (i < n && /\s/.test(s[i])) i++; }
    function fail() { throw new Error('not a Python value at ' + i); }
    function str() {
      var q = s[i++], out = '';
      while (i < n && s[i] !== q) {
        var c = s[i++];
        if (c !== '\\') { out += c; continue; }
        var e = s[i++], m;
        if (e === 'n') out += '\n'; else if (e === 't') out += '\t'; else if (e === 'r') out += '\r';
        else if (e === 'x' && (m = /^[0-9a-fA-F]{2}/.exec(s.slice(i, i + 2)))) { out += String.fromCharCode(parseInt(m[0], 16)); i += 2; }
        else if (e === 'u' && (m = /^[0-9a-fA-F]{4}/.exec(s.slice(i, i + 4)))) { out += String.fromCharCode(parseInt(m[0], 16)); i += 4; }
        else if (e === 'U' && (m = /^[0-9a-fA-F]{8}/.exec(s.slice(i, i + 8)))) { var cp = parseInt(m[0], 16); if (cp > 0x10FFFF) fail(); out += String.fromCodePoint(cp); i += 8; }
        else if (e === '\\' || e === "'" || e === '"') out += e;
        else fail();
      }
      if (s[i++] !== q) fail(); return out;
    }
    function seq(close) {
      var a = []; if (++depth > 40) fail(); ws();
      if (s[i] === close) { i++; depth--; return a; }
      for (;;) { a.push(val()); ws(); if (s[i] === ',') { i++; ws(); if (s[i] === close) { i++; break; } continue; } if (s[i] === close) { i++; break; } fail(); }
      depth--; return a;
    }
    function val() {
      ws(); var c = s[i], m;
      if (c === '{') {
        i++; var o = {}; if (++depth > 40) fail(); ws();
        if (s[i] === '}') { i++; depth--; return o; }
        for (;;) {
          ws(); if (s[i] !== "'" && s[i] !== '"') fail(); var k = str(); ws(); if (s[i++] !== ':') fail();
          var v = val(); if (k !== '__proto__') o[k] = v; ws();
          if (s[i] === ',') { i++; ws(); if (s[i] === '}') { i++; break; } continue; }
          if (s[i] === '}') { i++; break; } fail();
        }
        depth--; return o;
      }
      if (c === '[') { i++; return seq(']'); }
      if (c === '(') { i++; return seq(')'); }
      if (c === "'" || c === '"') return str();
      if ((m = /^(True|False|None)\b/.exec(s.slice(i, i + 6)))) { i += m[1].length; return m[1] === 'True' ? true : m[1] === 'False' ? false : null; }
      if ((m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i, i + 40)))) { i += m[0].length; return +m[0]; }
      fail();
    }
    var v = val(); ws(); if (i !== n) fail(); return v;
  }
  function dataPut(key, x) {
    key = String(key == null ? '' : key); if (!DATA_KEY.test(key)) { drop('data: bad key "' + key.slice(0, 40) + '"'); return false; }
    var s, v, why = null;
    try {
      s = typeof x === 'string' ? x : JSON.stringify(x);
      if (typeof s !== 'string') why = 'not JSON'; else if (s.length > 5e5) why = 'over 500 KB';
      else {
        try { v = JSON.parse(s); if (typeof v === 'string' && /^\s*[\[{]/.test(v)) v = JSON.parse(v); }   // a JSON text written as a JSON string
        catch (je) { v = pyRead(s); }   // v0.9.0: a webhook object as @{field} (a Python repr)
        if (!v || typeof v !== 'object') why = 'not an object or a list';
      }
    } catch (e) { why = 'not JSON or a Python repr'; }
    dataBox[key] = why ? { bad: why } : { v: v }; if (why) drop('data: "' + key + '" is unreadable (' + why + ')');
    (dataWaits[key] || []).splice(0).forEach(function (f) { f(); });
    return !why;
  }
  function dataGet(key) { var r = dataBox[String(key)]; return r && !r.bad ? r.v : undefined; }
  function dataWait(key, ms) {
    key = String(key);
    return new Promise(function (res, rej) {
      var t = 0, go = function () { var r = dataBox[key]; if (!r) return false; clearTimeout(t); if (r.bad) rej(new Error('data "' + key + '" is unreadable')); else res(r.v); return true; };
      if (go()) return;
      var l = dataWaits[key] = dataWaits[key] || []; l.push(go);
      t = setTimeout(function () { var i = l.indexOf(go); if (i >= 0) l.splice(i, 1); rej(new Error('no data "' + key + '"')); }, ms == null ? 1500 : ms);
    });
  }
  function prevUser(hostMsg) {   // the visitor's last message before this bot message (to drop a chip that repeats it)
    var t = '';
    [].forEach.call(document.querySelectorAll('[data-lb-part="message"][data-lb-author="user"]'), function (u) {
      if (hostMsg && (u.compareDocumentPosition(hostMsg) & Node.DOCUMENT_POSITION_FOLLOWING)) t = u.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
    });
    return t;
  }
  // v0.8.1.1 · the chat scrolls to the end when a message arrives, and the cards are added after that: a tall card (a
  // finder, a compare table) landed below the fold, with only its first lines in view. Once the cards of the LAST message
  // are in, the chat's scroller is moved so the reply starts at the top when it is taller than the window, or ends at the
  // bottom when it fits. Only when the visitor was at the end of the chat (someone who scrolled up to read is left
  // alone), measured after forms have drawn, and again when a card that loads its data grows. reveal: false turns it off.
  function scroller(host) {
    var sc = host && host.parentNode;
    while (sc && sc !== document.body && sc.nodeType === 1) { var cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 1) return sc; sc = sc.parentNode; }
    return null;   // the page itself scrolling (a mock, a full-page embed) is left alone
  }
  function atEnd(sc, slack, host) { return !!sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight - (host ? host.offsetHeight : 0) <= (slack || 96); }
  var HOLD = null;   // the reveal in progress: { host, touched }
  function reveal(host, was) {
    if (cfg.reveal === false || !host || typeof requestAnimationFrame !== 'function') return;
    if (host.__lbwTouched) return;                                        // the visitor already took over this reply
    // the visitor wasn't at the end: don't move them. Two cases still count as "at the end": a reply that is still being
    // placed, and a tall reply left where we put it (nobody scrolled up since: its end is below the fold by design)
    var kept = HOLD && !HOLD.touched && (!HOLD.done || (HOLD.sc && HOLD.endTop != null && HOLD.sc.scrollTop >= HOLD.endTop - 2));
    if (was === false && !kept) return;
    if (HOLD && HOLD.host === host && !HOLD.done) return;                 // already being held (a card that filled later)
    if (HOLD && HOLD.end) HOLD.end();
    // v0.8.1.2 · one scroll was not enough on a live chat: the chat goes to the end again when the reply changes after it
    // is drawn (a form's first result, photos loading, the chat's own late scroll). For 2.5 s the reply is put back each
    // time it or the scroller moves away, at once (no animation: a smooth one loses the race), and the visitor's first
    // touch, wheel, press or key ends it for good.
    var sc = null, ro = null, timers = [], t0 = Date.now(), raf = 0, upT = 0, lastTop = null, me = { host: host, touched: false, done: false };
    var EV = ['wheel', 'touchstart', 'pointerdown'];
    function end(ev) {
      if (me.done) return; me.done = true; if (ev && ev.type) { me.touched = true; host.__lbwTouched = true; }
      if (upT) clearTimeout(upT); me.sc = sc; me.endTop = sc ? sc.scrollTop : null;
      timers.forEach(clearTimeout); if (ro) { try { ro.disconnect(); } catch (e) {} }
      if (sc) { EV.forEach(function (n) { sc.removeEventListener(n, end); }); sc.removeEventListener('scroll', later); }
      document.removeEventListener('keydown', end, true);
    }
    // a scroll toward the END is the chat's own (it is undone); a scroll toward the start that we didn't make is the visitor's,
    // whatever made it (a scrollbar, a key the page didn't report): it ends the hold
    // (it must still be above after 150 ms: a chat that jumps to the top and then to the end isn't the visitor)
    function later() {
      if (me.done) return;
      if (lastTop != null && sc && sc.scrollTop < lastTop - 0.5) { if (!upT) { var from = sc.scrollTop; upT = setTimeout(function () { upT = 0; if (me.done) return; if (sc.scrollTop < lastTop - 0.5 && sc.scrollTop <= from + 0.5) end({ type: 'scroll' }); else place(); }, 150); } return; }   // still above AND not on its way back down (a tween that overshoots)
      if (upT) return;
      if (raf) return; raf = requestAnimationFrame(function () { raf = 0; place(); });
    }
    function place() {
      if (me.done || upT) return;                                         // not while an upward move is being judged
      try {
        var all = document.querySelectorAll('[data-lb-part="message"]'); if (!all.length || all[all.length - 1] !== host) return end();
        if (!sc) { sc = scroller(host); if (!sc) return; EV.forEach(function (n) { sc.addEventListener(n, end, { passive: true }); }); sc.addEventListener('scroll', later, { passive: true }); document.addEventListener('keydown', end, true); }
        var a = host.getBoundingClientRect(), b = sc.getBoundingClientRect();
        var tall = a.height > b.height - 16, aim = a.top;
        // v0.8.1.14 · a reply that fits, but not together with the visitor's question: aligned to the bottom, the question went
        // under the header (Callan live critique: a compare and a contact card, question top at −36 and −21 px). Placed like a
        // tall reply, question first, when its start is close above (it was the turn's own question)
        if (!tall) { for (var qj = all.length - 2; qj >= 0; qj--) { if (all[qj].getAttribute('data-lb-author') === 'user') { var qq = all[qj].getBoundingClientRect(); if (a.bottom - qq.top > b.height - 16 && a.top - qq.top < 220) tall = true; break; } } }
        // v0.8.1.3 · keep the visitor's own question in view above a tall reply when 160 px of the reply still fit under it
        // v0.8.1.9 · the message before this one, from the document's list: live, Landbot's messages are not siblings (the
        // sibling walk found nothing, so the question stayed 64–114 px above the window on every tall reply, critique 0.8.1.3)
        if (tall) { var q = null; for (var qi = all.length - 2; qi >= 0; qi--) { if (all[qi].getAttribute('data-lb-author') === 'user') { q = all[qi]; break; } }   // past a reply split into several bubbles
          if (q && q.getAttribute('data-lb-author') === 'user') { var qr = q.getBoundingClientRect(); if (a.top - qr.top + 160 <= b.height - 8 && a.top - qr.top < 220) aim = qr.top; } }
        var to = Math.max(0, Math.round(tall ? sc.scrollTop + (aim - b.top) - 8 : sc.scrollTop + (a.bottom - b.bottom) + 12));
        var off = tall ? Math.abs(aim - b.top - 8) : (a.bottom > b.bottom + 1 || a.top < b.top - 1 ? 1e3 : 0);
        if (off < 2 || Math.abs(to - sc.scrollTop) < 1) { if (lastTop == null) lastTop = sc.scrollTop; return; }   // where it should be (or as far as the scroller goes)
        try { sc.scrollTo({ top: to, behavior: 'instant' }); } catch (e) { sc.scrollTop = to; }
        lastTop = sc.scrollTop;
      } catch (e) {}
    }
    me.end = end; HOLD = me;
    setTimeout(function () { requestAnimationFrame(place); }, 0);        // after a form's first update (it runs on a 0 ms timer)
    [350, 800, 1400, 2100].forEach(function (ms) { timers.push(setTimeout(place, ms)); });
    timers.push(setTimeout(end, 2500));
    if (typeof ResizeObserver === 'function') { try { ro = new ResizeObserver(function () { if (Date.now() - t0 > 60) place(); }); ro.observe(host); } catch (e) { ro = null; } }
  }
  // v0.8.1.3 · a phone number in a bot bubble broke over two lines ("+34 977 38 16 / 41"): kept on one line. Only once the
  // bubble's text has stopped changing for quietMs (the chat may still be writing into that very text node), only on
  // phone-shaped runs (an optional +code, then 2–4 digit groups, 9 to 15 digits in all), never inside links, code or a
  // widget. The text it saw is remembered: if the chat redraws the bubble, it is done again.
  var TEL = /(?:\(?\+\d{1,3}\)?[\s.\-\xa0]?)?\d{2,4}(?:[\s.\-\xa0]\d{2,4}){2,5}(?!\d)/g, telSeen = typeof WeakMap === 'function' ? new WeakMap() : null, telT = 0;
  function keepTel() {
    if (!telSeen) return;
    var now = Date.now(), wait = false;
    [].forEach.call(document.querySelectorAll('[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]'), function (box) {
      var txt = box.textContent; if (box.getAttribute('data-lbw-tel') === String(txt.length) + ':' + txt.slice(-24)) return;   // done for this text
      if (txt.indexOf('[[') >= 0 || !/\d[\d \xa0.\-]{7,}\d/.test(txt)) return;
      var seen = telSeen.get(box);
      if (!seen || seen.txt !== txt) { telSeen.set(box, { txt: txt, t: now }); wait = true; return; }   // still changing, or first look
      if (now - seen.t < cfg.quietMs) { wait = true; return; }
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), list = [], n; while ((n = walker.nextNode())) list.push(n);
      list.forEach(function (t) {
        if (t.parentNode.closest && t.parentNode.closest('a,code,pre,.lbw,[data-lbw-nowrap]')) return;
        var f = document.createDocumentFragment(), last = 0, v = t.nodeValue; TEL.lastIndex = 0;
        v.replace(TEL, function (m, at) { var d = m.replace(/\D/g, '').length; if (d < 9 || d > 15 || (at > 0 && /\d/.test(v[at - 1]))) return m;
          f.appendChild(document.createTextNode(v.slice(last, at))); var sp = el('span', null, m); sp.style.whiteSpace = 'nowrap'; sp.setAttribute('data-lbw-nowrap', ''); f.appendChild(sp); last = at + m.length; return m; });
        if (!last) return; f.appendChild(document.createTextNode(v.slice(last))); t.parentNode.replaceChild(f, t);
      });
      box.setAttribute('data-lbw-tel', String(txt.length) + ':' + txt.slice(-24));
    });
    if (wait && !telT) telT = setTimeout(function () { telT = 0; try { keepTel(); } catch (e) {} }, cfg.quietMs + 60);
  }
  function scan() {
    try { scanTags(); } finally { try { keepTel(); } catch (e) {} }   // phones after the tags: never inside one
  }
  function scanTags() {
    var re = tagRe(), sel = '[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]:not([data-lbw])', passWas;
    [].forEach.call(document.querySelectorAll(sel), function (box) {
      if (box.textContent.indexOf('[[') < 0) return;
      box.setAttribute('data-lbw', '1');
      var host = box.closest('[data-lb-part="message"]') || box, made = [], late = [], held = [];
      var names = []; box.textContent.replace(re, function (m, name) { names.push(String(name).toLowerCase()); return m; });
      function swap(s) {
        return s.replace(re, function (m, name, attrs) {
                  if (made.length + late.length >= cfg.maxPerMessage) { drop(m + ' (over the limit)'); return ''; }
                  // a widget registered as `last` (chips) is drawn after every other one, wherever its tag was written: it
                  // must see the cards of the whole message (to leave out what they already offer)
                  var d = W[String(name).toLowerCase()]; if (d && d.last) { late.push([name, attrs, m]); return ''; }
                  var r = render(name, attrs, m, host, names, made); if (r.w) made.push(r.w); else drop(m + ' (' + r.why + ')'); return '';
                })
                .replace(new RegExp('\\[\\[[^\\]]*\\]\\]|`?\\[\\[\\s*' + cfg.prefix + ':[^\\]]*$', 'gi'), function (m) { drop(m); return ''; })
                .replace(/(^|\s)\|?[a-z_][a-z0-9_]*=[^\s\]]*(\|[a-z_][a-z0-9_]*=[^\]]*)*\]\]/gi, function (m, pre) { drop('tail of a broken tag: ' + m); return pre; });
      }
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), texts = [], n;
      while ((n = walker.nextNode())) texts.push(n);
      // the chat renders Markdown: a tag can be split over several text nodes (a *bold* name in a value). Then the whole
      // text is re-read and the box keeps plain text
      var split = texts.some(function (t) { return t.nodeValue.lastIndexOf('[[') > t.nodeValue.lastIndexOf(']]'); });
      if (split) box.textContent = swap(box.textContent).trim();
      else texts.forEach(function (t) { if (t.nodeValue.indexOf('[[') >= 0) { t.nodeValue = swap(t.nodeValue).replace(/\s+$/, ''); held.push(t); } });
      late.forEach(function (x) { var r = render(x[0], x[1], x[2], host, names, made); if (r.w) made.push(r.w); else drop(x[2] + ' (' + r.why + ')'); });
      // v0.8.1 · what the tags leave behind: the chat's Markdown puts a tag written on its own line in its own <p>, which
      // stays as a blank last line; a message that was only tags stays as an empty bubble. Only what HELD a tag is
      // touched: an element left with no text and no media goes, with the ancestors it empties. Nothing else in the
      // message is removed (an <hr>, an image, an empty cell, a space between two words are the author's).
      var MEDIA = 'img,svg,picture,video,audio,canvas,iframe,embed,object,input,select,textarea,button,a[href],hr';
      var hollow = function (e) { return !e.textContent.trim() && !e.matches(MEDIA) && !e.querySelector(MEDIA); };
      held.forEach(function (t) {
        var e = t.parentNode; if (t.nodeValue.trim() || !e || e === box) return;
        while (e && e !== box && box.contains(e) && hollow(e)) { var up = e.parentNode; e.remove(); e = up; }
      });
      if (held.length || split) {   // line breaks and spaces left at the very end, where the tags were
        for (var tail = box.lastChild; tail && ((tail.nodeType === 3 && !tail.nodeValue.trim()) || tail.nodeName === 'BR'); tail = box.lastChild) tail.remove();
        if (box.lastChild && box.lastChild.nodeType === 3) box.lastChild.nodeValue = box.lastChild.nodeValue.replace(/\s+$/, '');
      }
      if (made.length && !box.textContent.trim() && !box.querySelector(MEDIA)) { var top = box; while (top.parentNode && top.parentNode !== host && top.parentNode.children.length === 1) top = top.parentNode; top.setAttribute('data-lbw-empty', '1'); host.classList.add('lbw-only'); }
      made.sort(function (a, b) { return (a.getAttribute('data-last') ? 1 : 0) - (b.getAttribute('data-last') ? 1 : 0); });
      // measured once per pass, before any card adds height: on a chat that loads with its history every message is
      // scanned in one go, and only the last one is revealed. The message's own text doesn't count against "at the end"
      // (a chat that scrolls a frame late, or smoothly, hasn't reached the end yet when the text is already in).
      if (passWas === undefined) passWas = (function () { try { var ms = document.querySelectorAll('[data-lb-part="message"]'), lastM = ms[ms.length - 1], sc0 = lastM && scroller(lastM); return sc0 ? atEnd(sc0, 96, lastM) : null; } catch (e) { return null; } })();
      var wasAtEnd = passWas;
      made.forEach(function (w) { host.appendChild(w); emit('render', { widget: w.getAttribute('data-widget'), tag: w.getAttribute('data-tag'), lang: w.getAttribute('lang'), el: w, message: host }); });
      if (made.length) host.classList.add('has-lbw');
      if (made.length) reveal(host, wasAtEnd);
    });
    // one-shot groups nobody used go quiet once the visitor has written after them
    var all = document.querySelectorAll('[data-lb-part="message"]'), lastU = -1;
    [].forEach.call(all, function (m, i) { if (m.getAttribute('data-lb-author') === 'user') lastU = i; });
    [].forEach.call(all, function (m, i) { if (i < lastU) [].forEach.call(m.querySelectorAll('.lbw-once:not(.is-done)'), function (g) { g.classList.add('is-stale'); done(g); var w = g.closest('.lbw'); if (w && !w.querySelector('.is-sent')) w.classList.add('is-spent'); }); });   // v0.8.1.9: is-spent: nothing was sent from this card
  }
  function start() {
    if (started) return; started = true;
    new MutationObserver(function (list) {
      // the chat is busy while any message outside our widgets changes (the agent's reply arriving)
      if (list.some(function (r) { var x = r.target.nodeType === 1 ? r.target : r.target.parentElement; return x && x.closest && x.closest('[data-lb-part="message"]') && !x.closest('.lbw'); })) quietSince = Date.now();
      scan();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    setTimeout(scan, 0);   // after the current script: init() runs before the widgets are registered
  }

  root.LBW = {
    version: '0.9.2',
    // LBW.init({ prefix, langs, defaultLang, labels: {en:{…}}, links: ['https://shop.example/', 'tel:', 'mailto:', 'https://calendar.google.com/'], maxPerMessage, quietMs, timeZone: 'Europe/Madrid' })
    init: function (o) { for (var k in o) cfg[k] = o[k]; start(); return root.LBW; },
    // LBW.landbot(this) at the top level of the bot's Custom JS: messages go through the v4 widget's sendMessage. true if taken
    landbot: bind,
    // LBW.on('render', function (e) { e.widget, e.tag, e.lang, e.el, e.message }) · 'say' → { text, fields } · 'drop' → the reason
    on: function (name, fn) { if (typeof fn === 'function') (subs[name] = subs[name] || []).push(fn); return root.LBW; },
    // LBW.widget('card', function (p, ctx) { …return an element or null… }, { last: true })
    widget: function (name, fn, opts) { W[String(name).toLowerCase()] = { render: fn, last: !!(opts && opts.last) }; return root.LBW; },
    ui: { el: el, link: link, tel: tel, btn: btn, img: img, loading: loading, card: card, head: head, row: row, rows: rows, reply: reply, once: once, multi: multi, done: done, form: form, stepper: stepper, ics: ics },
    day: { num: dayNum, parts: dayParts, read: dayRead, today: dayToday, format: dayFormat, str: dayStr, easter: dayEaster, nth: dayNth, next: dayNext, on: dayOn },
    time: { now: timeNow, read: timeRead, format: timeFmt, state: timeState, nextOpen: timeNextOpen },
    cal: { google: gcal, ics: icsText },
    later: later, csv: csv, json: json, page: page, parseCSV: parseCSV, say: say, store: store, drop: drop, missing: missing, parse: parse, scan: scan
  };
  root.LBW.data = { put: dataPut, get: dataGet, wait: dataWait, clear: function (key) { delete dataBox[String(key)]; } };   // v0.9.0, above
})(window);
