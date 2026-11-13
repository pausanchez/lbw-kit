/* lbw.js · Landbot AI Widgets runtime · v0.9.4.2
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
  var W = Object.create(null), last = {}, lock = 0, quietSince = Date.now(), started = false;
  var log = function (k, v) { (root[k] = root[k] || []).push(v); };
  // LBW.on('render' | 'say' | 'drop' | 'data', fn): what was drawn, what the visitor sent through a widget, what was thrown
  // away, what a flow's data message handed over ({ key, via: 'event' | 'dom', ok, length, at }, v0.9.5).
  // For counting views and clicks; a listener that throws is ignored.
  var subs = {};
  function emit(name, data) { (subs[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); }
  function drop(what) { log('__lbwDropped', what); emit('drop', what); }

  // ── DOM helpers: text only ───────────────────────────────────────────────────────────────────
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // http(s) entries are origins ending in '/': 'https://shop.example' alone would also match 'https://shop.example.evil.com'.
  // v0.9.5 (security review) · an entry needs a host ('https://' alone let every site through), then an optional path. A
  // path entry ('https://www.google.com/maps/') can't be left by a dot segment (.., %2e%2e), a '//' or an encoded / or \
  // (the browser resolves them after this check). Never a backslash, quote, space, control character or <>, nor over 2,048
  // characters. mailto: one plain address (no %40, ',', ';' or ?cc=). It guards origins: a host with an open redirector
  // (google.com/url, l.facebook.com) lets any site through, so list such a host by a path, never by its origin alone.
  var ORIGIN = /^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::\d{1,5})?\//i;
  function allowed(url, links) {   // links: the config's by default (the checker passes its own)
    links = links || cfg.links;
    if (typeof url !== 'string' || url.length > 2048 || /[\s"'<>\\\u0000-\u001f\u007f]/.test(url)) return false;
    if (/^tel:/i.test(url)) return links.indexOf('tel:') >= 0 && /^tel:\+?\d{6,15}$/.test(url);
    if (/^mailto:/i.test(url)) return links.indexOf('mailto:') >= 0 && /^mailto:[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url);
    return links.some(function (o) {
      if (typeof o !== 'string' || !/^https?:/.test(o)) return false; o = /\/$/.test(o) ? o : o + '/';
      var at = ORIGIN.exec(o); if (!at || url.indexOf(o) !== 0) return false;
      return o.length === at[0].length || !/(^|\/)(\.|%2e){1,2}(\/|$)|\/\/|%2f|%5c/i.test(url.slice(at[0].length - 1).split(/[?#]/)[0]);
    });
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
  // v0.9.5 · the title is a level-3 heading (no visual change): a screen-reader user jumps card to card in a long chat
  function head(box, kicker, title, aside) {
    var h = el('div', 'lbw-head'), l = el('div'), t = el('div', 'lbw-title', title);
    if (kicker) l.appendChild(el('div', 'lbw-kicker', kicker));
    if (title) { t.setAttribute('role', 'heading'); t.setAttribute('aria-level', '3'); }
    l.appendChild(t); h.appendChild(l); if (aside) h.appendChild(aside); box.appendChild(h); return h;
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
    bound = w; hookEvents(w); return true;   // v0.9.5: its new_message carries data messages raw (scanData)
  }
  function setData(fields) {   // fields with no message: queued, saved with the next one
    var lb = root._landbot;
    try { if (bound && typeof bound.setCustomData === 'function') { bound.setCustomData(fields); return true; } } catch (e) {}
    try { if (root.Landbot && typeof root.Landbot.exec === 'function') { root.Landbot.exec('landbot-custom-data', fields); return true; } } catch (e) {}
    try { if (lb && typeof lb.setCustomData === 'function') { lb.setCustomData(fields); return true; } } catch (e) {}
    drop('no way to store fields'); return false;
  }
  function store(fields) { log('__lbwStored', fields); return setData(fields); }
  // v0.9.5 · a send can fail: offline, sendMessage rejected for the network (measured live: "Failed to fetch", then the
  // legacy bridge failed the same way and the click was lost with its card locked). post() reports back through cb(ok):
  // a network failure stops at once (no deprecated Landbot.exec after it), and so does "no way to send".
  function offline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
  function netErr(e) { return offline() || !!(e && (e.name === 'TypeError' || e instanceof TypeError) && /failed to fetch|networkerror|network error|load failed|network request failed/i.test(e.message || '')); }
  function post(text, fields, cb) {
    cb = cb || function () {};
    if (offline()) { drop('not sent (offline): ' + text); return cb(false); }
    var lb = root._landbot, ways = [], msg = { type: 'text', message: text };
    if (fields) msg.custom_data = fields;
    if (bound) ways.push(['widget', bound]);
    if (lb && lb !== bound && typeof lb.sendMessage === 'function') ways.push(['_landbot', lb]);
    function next(i) {
      if (i >= ways.length) return legacy(text, fields, cb);
      var r;
      try { r = ways[i][1].sendMessage(msg); } catch (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + e.message + ')'); return netErr(e) ? cb(false) : next(i + 1); }
      if (r && typeof r.then === 'function') r.then(function () { cb(true); }, function (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + (e && e.message || e) + ')'); if (netErr(e)) cb(false); else next(i + 1); });
      else cb(true);
    }
    next(0);
  }
  function legacy(text, fields, cb) {
    var L = root.Landbot;
    if (L && typeof L.exec === 'function') {
      try { if (fields) L.exec('landbot-custom-data', fields); L.exec('landbot-msg-send', { type: 'text', message: text }); return cb(true); } catch (e) {}
    } else if (fields) setData(fields);
    // last resort: type it. v0.9.4.1 · the v4 chat's box is an <input> ("Type here…", measured live 13 Nov 2026), not a
    // textarea; never one of our own widgets' fields. v0.9.5 (security review) · only Landbot's own text box, the one in (or
    // marked) [data-lb-part="input-field"]: where lbw.js runs outside the chat, any other input (a newsletter form) would get
    // the text and an Enter. No such box: nothing is typed, and the send is dropped and logged
    var box = null, F = '[data-lb-part="input-field"]';
    [].some.call(document.querySelectorAll(F + ' textarea, ' + F + ' input, textarea' + F + ', input' + F), function (x) {
      if (x.closest('.lbw') || x.disabled || (x.tagName === 'INPUT' && !/^(text|search)?$/i.test(x.getAttribute('type') || ''))) return false; box = x; return true;
    });
    if (!box) { drop('no way to send: ' + text); return cb(false); }
    Object.getOwnPropertyDescriptor((box.tagName === 'INPUT' ? HTMLInputElement : HTMLTextAreaElement).prototype, 'value').set.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    cb(true);
  }
  function quiet() { return !document.querySelector('[data-lb-part="window"] [role="status"]') && Date.now() - quietSince > cfg.quietMs; }
  // say(): one send per 1.2 s (double clicks), queued until the chat is quiet: a click while the agent's reply is still
  // arriving otherwise lands ABOVE that reply. Returns true when accepted (mark the control as sent right away).
  // Sends that wait go out in the order they were clicked: one queue, one timer (two waits on their own timers could swap).
  // v0.9.5 · each send is a job: queued → sending → sent | failed. A failed job is never sent twice: it goes out again only
  // from the failed state (the `online` event, or the visitor's tap on "Retry"), and a new click in its group cancels it.
  var queue = [], unsent = [];
  function pump() {
    if (!queue.length) return;
    if (quiet() || Date.now() - queue[0].t0 > cfg.maxWaitMs) {
      var q = queue.shift(); q.state = 'sending';
      if (!q.tries++) { if (q.fields) log('__lbwStored', q.fields); log('__lbwSent', q.text); emit('say', { text: q.text, fields: q.fields || null }); }
      try { post(q.text, q.fields, function (ok) { settled(q, ok); }); } catch (e) { drop('send failed: ' + q.text + ' (' + e.message + ')'); settled(q, false); }
      if (!queue.length) return;
    }
    setTimeout(pump, 250);
  }
  function settled(q, ok) {
    if (q.state !== 'sending') return;   // a way that answers twice
    if (ok) { q.state = 'sent'; if (q.ui) clearUnsent(q.ui); return; }
    q.state = 'failed'; unsent.push(q); emit('unsent', { text: q.text, fields: q.fields || null });
    if (q.ui) unmark(q);
  }
  function enqueue(text, fields, ui) {
    if (!text || Date.now() - lock < 1200) return null; lock = Date.now();
    var q = { text: text, fields: fields, t0: Date.now(), state: 'queued', tries: 0, ui: ui || null };
    queue.push(q); return q;
  }
  function go(q) { if (queue[0] === q && queue.length === 1) pump(); }   // the first in line starts the timer (else it is running)
  function say(text, fields) { var q = enqueue(text, fields, null); if (q) go(q); return !!q; }
  function forget(q) { var i = unsent.indexOf(q); if (i >= 0) unsent.splice(i, 1); }
  // the visitor moved on: the control is gone, its group went quiet, or the scan took its "Retry" line away (they wrote after it)
  function stale(ui) { return !ui.ctl.isConnected || !!(ui.g && ui.g.classList.contains('is-stale')) || !!(ui.line && !ui.line.isConnected); }
  function retry(q) {
    if (!q || q.state !== 'failed') return false;
    forget(q);
    if (q.ui && stale(q.ui)) { q.state = 'cancelled'; clearUnsent(q.ui); return false; }
    q.state = 'queued'; q.t0 = lock = Date.now();
    if (q.ui) mark(q.ui);
    queue.push(q); go(q);
    return true;
  }
  if (root.addEventListener) root.addEventListener('online', function () { unsent.slice().forEach(retry); });
  // the control that sent: marked at once (as before), unmarked when its job fails, marked again when it is retried
  function mark(ui) {
    var c = ui.ctl, g = ui.g; clearUnsent(ui);
    c.classList.add('is-sent');
    if (g) { if (!g.classList.contains('is-done')) ui.was = [].filter.call(g.querySelectorAll('button'), function (x) { return x.disabled; }); done(g); }
    if (ui.after) ui.after(c);
  }
  var UNSENT = { en: ['Not sent.', 'Retry'], es: ['No se ha enviado.', 'Reintentar'], ca: ['No s\'ha enviat.', 'Torna-ho a provar'], fr: ['Non envoyé.', 'Réessayer'],
    de: ['Nicht gesendet.', 'Erneut senden'], it: ['Non inviato.', 'Riprova'], pt: ['Não enviado.', 'Tentar de novo'] };
  function unmark(q) {
    var ui = q.ui, c = ui.ctl, g = ui.g;
    c.classList.remove('is-sent');
    if (stale(ui)) { forget(q); q.state = 'cancelled'; return; }   // the visitor already moved on: no retry offered
    if (g) { g.classList.remove('is-done'); [].forEach.call(g.querySelectorAll('button'), function (x) { x.disabled = (ui.was || []).indexOf(x) >= 0; if (x.getAttribute('aria-disabled') === 'true' && !x.disabled) x.removeAttribute('aria-disabled'); }); }   // done() leaves the pressed one aria-disabled (a11y)
    c.classList.add('is-unsent');
    // the card's language: cfg.labels[lang].unsent / .retry override the built-in words
    var host = c.closest('[lang]'), lang = String((host && host.getAttribute('lang')) || cfg.defaultLang).toLowerCase(), base = lang.split(/[-_]/)[0];
    var mine = (cfg.labels && (cfg.labels[lang] || cfg.labels[base])) || {}, std = UNSENT[base] || UNSENT.en;
    var line = el('div', 'lbw-unsent'), r = btn(mine.retry || std[1], 'lbw-pill lbw-retry');
    line.setAttribute('role', 'alert'); line.appendChild(el('span', null, mine.unsent || std[0])); line.appendChild(r);
    r.addEventListener('click', function () { retry(q); });
    (g || c).insertAdjacentElement('afterend', line); ui.line = line;
    try { c.dispatchEvent(new CustomEvent('lbw-unsent', { bubbles: true, detail: { text: q.text } })); } catch (e) {}   // a card that changed itself on send undoes it (kit)
  }
  function clearUnsent(ui) { ui.ctl.classList.remove('is-unsent'); if (ui.line) { ui.line.remove(); ui.line = null; } }
  // a widget's control sends: a failed job of the same control and text is retried (never a second message); any other
  // click in its group cancels the failed one and sends what was clicked now
  function sendFrom(ctl, g, text, fields, after) {
    var holder = g || ctl, old = holder.__lbwJob;
    if (old && old.state === 'failed') { if (old.ui.ctl === ctl && old.text === text) return retry(old); forget(old); old.state = 'cancelled'; clearUnsent(old.ui); }
    var ui = { ctl: ctl, g: g, after: after }, q = enqueue(text, fields, ui); if (!q) return false;
    holder.__lbwJob = q; mark(ui); go(q); return true;   // marked before it can fail (a send may settle at once)
  }
  // ── v0.9.5 · accessibility: one polite live region per chat, and focus that never falls to <body> ──────────
  // LBW.announce(text, lang, key): a short line for screen readers (a new card's title, a total, "Updated"), never a whole
  // card. Lines that arrive together are said together, at most 3, one batch a second; a line with the same `key` replaces
  // the one still waiting (a stepper pressed five times says its last value). The region is created on first use, at the
  // end of <body> (outside every widget and the chat's own tree), and carries the line's lang. Logged in window.__lbwAnnounced (tests).
  var live = null, liveQ = [], liveT = 0, liveLast = 0;
  function liveEl() {
    if (live && live.isConnected) return live;
    // aria-live without role=status: say() reads a [role=status] in the chat window as "a reply is arriving"
    live = el('div', 'lbw-live'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    var s = live.style; s.position = 'absolute'; s.width = s.height = '1px'; s.overflow = 'hidden'; s.clipPath = 'inset(50%)'; s.whiteSpace = 'nowrap'; s.margin = '-1px'; s.padding = '0'; s.border = '0';
    (document.body || document.documentElement).appendChild(live); return live;   // the page's, never inside the chat's own (React) tree
  }
  function liveFlush() {
    liveT = 0; var q = liveQ.splice(0, 3); if (!q.length) return;
    var r = liveEl(), text = q.map(function (x) { return x.text; }).join('. ');
    if (q[0].lang) r.setAttribute('lang', q[0].lang); else r.removeAttribute('lang');
    r.textContent = ''; liveLast = Date.now(); log('__lbwAnnounced', text);
    setTimeout(function () { r.textContent = text; }, 40);   // emptied first: the same words again are still said
    if (liveQ.length) liveT = setTimeout(liveFlush, 1000);
  }
  function announce(text, lang, key) {
    text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 160); if (!text) return false;
    liveQ = liveQ.filter(function (x) { return x.text !== text && !(key && x.key === key); }); liveQ.push({ text: text, lang: lang || '', key: key || '' });
    if (!liveT) liveT = setTimeout(liveFlush, Math.max(cfg.liveMs == null ? 350 : cfg.liveMs, liveLast + 1000 - Date.now()));
    return true;
  }
  function langOf(n) { var w = n && n.closest && n.closest('[lang]'); return w ? w.getAttribute('lang') : ''; }
  // "Kicker: Title" of a widget, or '' (chips and cards without a title say nothing)
  function titleOf(w) {
    var t = w && w.querySelector && w.querySelector('.lbw-title, [role="heading"]'); if (!t || !t.textContent.trim()) return '';
    var k = w.querySelector('.lbw-kicker'); return (k && k.textContent.trim() ? k.textContent.trim() + ': ' : '') + t.textContent.trim();
  }
  function announceCard(w) { var t = titleOf(w); return t ? announce(t, w.getAttribute('lang'), 'card:' + t) : false; }
  // a new widget is announced by its title, only in the newest message (a chat loading its history says one line);
  // a skeleton says nothing until it has content (later() announces it then)
  (subs.render = subs.render || []).push(function (e) {
    var all = document.querySelectorAll('[data-lb-part="message"]');
    if (e.el.classList.contains('is-loading') || (all.length && all[all.length - 1] !== e.message)) return;
    announceCard(e.el);
  });
  // what can hold focus right now (no layout in tests: hidden is judged by attributes and the folded card's rule)
  function canFocus(x, w) {
    if (!x || !x.isConnected || x.disabled || x.hidden || x.closest('[hidden], [inert]')) return false;
    if (w && w.classList.contains('is-collapsed') && !x.closest('.kit-sentline')) return false;
    return x.tabIndex >= 0 || x.getAttribute('tabindex') === '-1';
  }
  function focusIn(x) { try { x.focus({ preventScroll: true }); } catch (e) { try { x.focus(); } catch (e2) {} } return document.activeElement === x; }
  // focus left the widget's pressed control (disabled, folded away, redrawn): put it on the most useful thing in the same widget.
  // The folded card's Show toggle, the sent answer, the group, then the card's title (focusable by script only)
  function rescue(w, g) {
    var a = document.activeElement; if (a && a !== document.body && a.isConnected && canFocus(a, w)) return a;
    var c = [w.querySelector('.kit-sentline button'), g && g.querySelector('.is-sent'), w.querySelector('.is-sent'), g && g.getAttribute('tabindex') === '-1' ? g : null];
    for (var i = 0; i < c.length; i++) if (canFocus(c[i], w) && focusIn(c[i])) return c[i];
    var t = w.querySelector('.lbw-title, [role="heading"]') || w.querySelector('.lbw-box') || w;
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    focusIn(t); return t;
  }
  // a button that says `text` (and writes `fields`) when clicked; `label` may be shorter than what it sends
  function reply(label, text, opts) {
    opts = opts || {};
    var b = btn(label, 'lbw-pill lbw-reply' + (opts.primary ? ' is-primary' : '') + (opts.cls ? ' ' + opts.cls : ''));
    b.setAttribute('data-say', text); if (opts.fields) b.setAttribute('data-store', JSON.stringify(opts.fields));
    b.addEventListener('click', function () {
      if (b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      sendFrom(b, b.closest('.lbw-once'), text, opts.fields, opts.onSent);
    });
    return b;
  }
  // v0.9.5 · the sent answer stays focusable (aria-disabled, not disabled): a keyboard or screen-reader user keeps their
  // place and hears what they chose; the other buttons are disabled. If focus was inside, it is rescued once the click's
  // handlers have run (after a form folds), so it never falls to <body>.
  function done(g) {
    var a = document.activeElement, had = !!(a && g.contains(a));
    g.classList.add('is-done');
    [].forEach.call(g.querySelectorAll('button'), function (x) { if (x.classList.contains('is-sent')) { x.disabled = false; x.setAttribute('aria-disabled', 'true'); } else x.disabled = true; });
    if (had) Promise.resolve().then(function () { var w = g.closest('.lbw') || g; if (w.isConnected) rescue(w, g); });
  }
  // a one-shot group: after one click (or once the visitor writes something else) every button in it is disabled
  function once(cls) { return el('div', 'lbw-once' + (cls ? ' ' + cls : '')); }
  // a multi-select: toggles + a CTA. Nothing is sent until the CTA; then send(keys) returns [text, fields] and both go
  // out together. multi([['vegan','Vegan'], …], 'Continue', function (keys) { return ['I eat: …', { diet: keys.join(',') }]; })
  // v0.9.5: `label` (5th) names the group for screen readers
  function multi(items, ctaLabel, send, pre, label) {
    var g = once('lbw-chips lbw-multi'), cta = btn(ctaLabel, 'lbw-pill is-primary');
    g.setAttribute('role', 'group'); if (label) g.setAttribute('aria-label', label);
    function picked() { return [].filter.call(g.querySelectorAll('.lbw-tog'), function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-k'); }); }
    function sync() { var n = picked().length; cta.disabled = !n; cta.textContent = ctaLabel + (n ? ' · ' + n : ''); }
    items.forEach(function (it) {
      var b = btn(it[1], 'lbw-tog'); b.setAttribute('data-k', it[0]); b.setAttribute('aria-pressed', pre && pre.indexOf(it[0]) >= 0 ? 'true' : 'false');
      b.addEventListener('click', function () { if (g.classList.contains('is-done')) return; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); sync(); });
      g.appendChild(b);
    });
    cta.addEventListener('click', function () {
      var ks = picked(); if (!ks.length || g.classList.contains('is-done')) return;
      var out = send(ks); cta.setAttribute('data-say', out[0]);
      sendFrom(cta, g, out[0], out[1]);
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
    // v0.9.5 · not ready: aria-disabled, not disabled. The CTA stays in the Tab order and its label says what is missing
    // ("↑ Pick a day"); pressing it says that line and takes focus to the first group with no answer
    f.update = function () {
      if (g.classList.contains('is-done')) return;
      var r = o.ready ? o.ready(f.state) : true; cta.disabled = false; if (r === true) cta.removeAttribute('aria-disabled'); else cta.setAttribute('aria-disabled', 'true');
      cta.textContent = r === true || typeof r !== 'string' ? o.cta : r;
      if (o.change) try { o.change(f.state); } catch (e) { drop('form change: ' + e.message); }
    };
    function missingGroup() {
      var gs = g.querySelectorAll('[role="radiogroup"], [role="group"]');
      for (var i = 0; i < gs.length; i++) if (!gs[i].querySelector('[aria-checked="true"], [aria-pressed="true"]')) {
        var t = gs[i].querySelector('[tabindex="0"]:not(:disabled)') || gs[i].querySelector('button:not(:disabled)'); if (t) return t;
      }
      return null;
    }
    cta.addEventListener('click', function () {
      if (g.classList.contains('is-done')) return;
      if (cta.getAttribute('aria-disabled') === 'true') { announce(cta.textContent, langOf(g), 'cta'); var m = missingGroup(); if (m) focusIn(m); return; }
      if (cta.disabled) return;
      var out = o.send(f.state); if (!out || !out[0]) return;
      cta.setAttribute('data-say', out[0]);
      sendFrom(cta, g, out[0], out[1], o.sent ? function () { o.sent(f.state); } : null);
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
    // v0.9.5 · a change the visitor made is announced ("Nights: 4"; a total that follows it is said with it), and the
    // button that reaches its end hands focus to the other one instead of dropping it to <body>
    function set(v, quietly) {
      v = Math.max(min, Math.min(max, min + Math.round((v - min) / step) * step)); w.value = val = +v.toFixed(6);
      var shown = o.format ? String(o.format(val)) : String(val); num.textContent = shown; num.setAttribute('aria-label', label + ': ' + shown);
      var a = document.activeElement;
      minus.disabled = val <= min; plus.disabled = val >= max;
      if (a === minus && minus.disabled && !plus.disabled) focusIn(plus); else if (a === plus && plus.disabled && !minus.disabled) focusIn(minus);
      if (!quietly) announce(label + ': ' + shown, langOf(w), 'step:' + label);
      if (!quietly && o.change) o.change(val);
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
  var PROTO = /^(__proto__|constructor|prototype)$/;
  function Params(raw) { this.raw = raw; }
  Params.prototype = {
    has: function (k) { return !missing(this.raw[k]); },
    // known values only, each once; splits on , + ; | & and spaces (the agent once wrote 'scaling+business')
    list: function (k, allowedList, max) {
      if (!this.has(k)) return [];
      // v0.9.5 · maps with no prototype, and the names an object inherits refused on purpose: 'constructor' or '__proto__'
      // used to fail only because {} already "had" them, and a widget may look the id up in a plain object of its own
      var seen = Object.create(null), norm = function (x) { return String(x).trim().toLowerCase().replace(/-/g, '_'); }, ok = Object.create(null);
      allowedList.forEach(function (a) { ok[norm(a)] = a; });   // 'sea-fast' and 'Sea_Fast' both read as the listed id
      return String(this.raw[k]).split(/[,\s+;|&]+/).map(norm)
        .filter(function (x) { if (!x || seen[x]) return false; if (!ok[x] || PROTO.test(x)) { drop('unknown value ' + k + '=' + x); return false; } return (seen[x] = true); })
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
  function parse(attrs) { return parseTag(attrs).p; }
  function parseTag(attrs) {   // → { p: { key: value }, dup: the first key written twice, or null }
    // values are separated by '|' when the tag has one (a value may then hold spaces: names from fields),
    // otherwise by spaces; a loose token with no '=' is glued to the previous value with a comma
    var p = {}, dup = null, s = String(attrs || '').trim(), parts = s.indexOf('|') >= 0 ? s.split('|') : s.split(/\s+/), lastKey = null;
    parts.forEach(function (kv) {
      kv = kv.trim(); var i = kv.indexOf('='), k = i > 0 ? kv.slice(0, i).trim().toLowerCase() : '';
      if (/^[a-z_][a-z0-9_]*$/.test(k)) { if (!dup && Object.prototype.hasOwnProperty.call(p, k)) dup = k; lastKey = k; p[k] = kv.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
      else if (lastKey && kv) p[lastKey] += ',' + kv.replace(/^,|,$/g, '');
    });
    return { p: p, dup: dup };
  }

  // ── scanning bot messages ────────────────────────────────────────────────────────────────────
  // v0.9.5 (security review) · the tags are found by hand, in time linear in the text. The regexes they replace, with the
  // same reading (`?\[\[\s*PREFIX:(name)\s*([^\]]*?)\s*\]\]`? for a tag; \[\[[^\]]*\]\] and an unclosed `?\[\[\s*PREFIX:…
  // at the end for what is removed; the tail a `]]` in a value leaves), backtracked: a 150-character message froze the tab.
  // ']' after `from`, remembered: the scans only move forward, so each character is looked at a bounded number of times
  function brackets(s) { var at = -1, was = -1; return function (from) { if (at === -2) return -1; if (at < from || from < was) { at = s.indexOf(']', from); if (at < 0) { at = -2; return -1; } } was = from; return at; }; }
  var NAME = /[a-z][a-z0-9_]*/iy, WS = /\s/;
  function rtrim(s) { var e = s.length; while (e > 0 && WS.test(s.charAt(e - 1))) e--; return s.slice(0, e); }   // /\s+$/ is quadratic on a long run of spaces
  function headAt(s, j, bare) {   // `[[ PREFIX:name` at j → the index after the name (bare: after the ':'), or -1
    var k = j + 2, pre = String(cfg.prefix); while (k < s.length && WS.test(s.charAt(k))) k++;
    if (s.substr(k, pre.length).toLowerCase() !== pre.toLowerCase() || s.charAt(k + pre.length) !== ':') return -1;
    if (bare) return k + pre.length + 1;
    NAME.lastIndex = k + pre.length + 1; return NAME.exec(s) ? NAME.lastIndex : -1;
  }
  // each(whole tag, name, attrs) → its replacement; → the text with every tag replaced
  function eachTag(s, each) {
    var out = '', from = 0, j = -1, br = brackets(s);
    while ((j = s.indexOf('[[', j + 1)) >= 0) {
      if (j < from) continue;
      var e = headAt(s, j); if (e < 0) continue;
      var c = br(e); if (c < 0) break; if (s.charAt(c + 1) !== ']') continue;
      var a = j > from && s.charAt(j - 1) === '`' ? j - 1 : j, z = s.charAt(c + 2) === '`' ? c + 3 : c + 2, at = headAt(s, j, true);
      out += s.slice(from, a) + each(s.slice(a, z), s.slice(at, e), s.slice(e, c).trim()); from = z; j = z - 1;
    }
    return out + s.slice(from);
  }
  // what is left that looks like a tag: any [[…]] (no ']' inside), and an unclosed `[[PREFIX:… that runs to the end
  function eachRest(s, each) {
    var out = '', from = 0, j = -1, br = brackets(s);
    while ((j = s.indexOf('[[', j + 1)) >= 0) {
      if (j < from) continue;
      var c = br(j + 2), open = c < 0 && headAt(s, j, true) >= 0;
      if (open && j > from && s.charAt(j - 1) === '`') return out + s.slice(from, j - 1) + each(s.slice(j - 1));
      if (c >= 0 && s.charAt(c + 1) === ']') { out += s.slice(from, j) + each(s.slice(j, c + 2)); from = c + 2; j = from - 1; continue; }
      if (open) return out + s.slice(from, j) + each(s.slice(j));
    }
    return out + s.slice(from);
  }
  // the tail of a tag a `]]` in a value closed early: ' |people=2|lang=en]]' (a word that starts key=, up to an orphan ]]).
  // Read as /(^|\s)\|?[a-z_][a-z0-9_]*=[^\s\]]*(\|[a-z_][a-z0-9_]*=[^\]]*)*\]\]/gi was, one word at a time
  var KEYAT = /^\|?[a-z_][a-z0-9_]*=/i, KEYIN = /\|[a-z_][a-z0-9_]*=/i;
  function eachTail(s, each) {
    var out = '', from = 0, b = -1, seg = 0;
    while ((b = s.indexOf(']', b + 1)) >= 0) {
      var a = seg; seg = b + 1; if (s.charAt(b + 1) !== ']' || b < from) continue;
      // the words of s[a, b): the first that starts after a space (or at 0) and reads as the tail of a tag
      for (var st = a, hit = -1; st < b; ) {
        var w = st; while (w < b && !WS.test(s.charAt(w))) w++;   // the word is s[st, w)
        if ((st === 0 || WS.test(s.charAt(st - 1))) && st < w) { var word = s.slice(st, w), m = KEYAT.exec(word); if (m && (w === b || KEYIN.test(word.slice(m[0].length)))) { hit = st; break; } }
        st = w + 1;
      }
      if (hit < 0) continue;
      var pre = hit > 0 ? s.charAt(hit - 1) : '', at = hit - pre.length;
      out += s.slice(from, at) + each(s.slice(at, b + 2), pre); from = b + 2; seg = from; b = from - 1;
    }
    return out + s.slice(from);
  }
  function render(name, attrs, tag, hostMsg, tags, others) {
    var pt = parseTag(attrs), raw = pt.p, p = new Params(raw), rl = String(raw.lang || '').toLowerCase(), base = rl.split(/[-_]/)[0],
        lang = cfg.langs.indexOf(rl) >= 0 ? rl : cfg.langs.indexOf(base) >= 0 ? base : cfg.defaultLang;   // 'es-ES' and 'es_ES' read as 'es'
    name = String(name).toLowerCase();
    var def = W[name]; if (!def) return { why: 'unknown widget' };
    // v0.9.5 · a value holding '[[' is a tag that swallowed another (unclosed, or text a field brought in): nothing drawn.
    // A widget fed by a flow ({ flow: true | [keys] }) also refuses a key written twice, and a key outside its list
    if (attrs.indexOf('[[') >= 0) return { why: 'a value holds [[' };
    if (def.flow && pt.dup) return { why: 'flow tag: key "' + pt.dup + '" written twice' };
    if (def.flow && def.flow.length) for (var fk in raw) if (Object.prototype.hasOwnProperty.call(raw, fk) && def.flow.indexOf(fk) < 0) return { why: 'flow tag: key "' + fk + '" is not one it takes' };
    var L = (cfg.labels && cfg.labels[lang]) || {};
    var ctx = { lang: lang, L: L, tag: tag, message: hostMsg, prev: prevUser(hostMsg), tags: tags || [], others: (others || []).slice() };
    // tags: the widget names of every tag in this message; others: the widgets already drawn from it (a chips tag written
    // last sees the cards before it, e.g. to drop a chip whose data-say a card already offers)
    var w = null;
    try { w = def.render(p, ctx); } catch (e) { return { why: 'error: ' + e.message }; }
    if (!w) return { why: 'widget returned null' };
    // v0.9.5 · a string or a fragment threw below, outside any try, and left the whole message raw for good
    if (w.nodeType !== 1 || typeof w.setAttribute !== 'function') return { why: 'widget returned ' + (w.nodeType === 11 ? 'a fragment' : typeof w) + ', not an element' };
    try { w.setAttribute('data-tag', tag); w.setAttribute('data-widget', name); if (def.last) w.setAttribute('data-last', '1'); } catch (e) { return { why: 'error: ' + e.message }; }
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
      if (r === false) gone('nothing to show'); else announceCard(o);   // v0.9.5: the skeleton became a card: say its title
    }, function (e) {
      settle(); if (fallback) { try { o.box.textContent = ''; fallback(e); drop((o.getAttribute('data-tag') || 'widget') + ' (data unavailable: fallback)'); announceCard(o); return; } catch (x) {} }
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
  // v0.9.5: the flow hands it as TEXT, a Message block `[[lbw:data key=tarifas]] @{tarifas}` (scanData, below), which the
  // runtime reads and puts here. The v0.9.0 way, a Code block calling LBW.data.put('tarifas', String.raw`@{tarifas}`), is
  // deprecated: Landbot pastes the field into the script, so the API's text can run as code; and it runs late. put(key, x):
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
      if (typeof s !== 'string') why = 'not JSON'; else if (s.length > 5e5) why = 'over 500 KB'; else if (!s.trim()) why = 'empty';
      else {
        try { v = JSON.parse(s); if (typeof v === 'string' && /^\s*[\[{]/.test(v)) v = JSON.parse(v); }   // a JSON text written as a JSON string
        catch (je) { v = pyRead(s); }   // v0.9.0: a webhook object as @{field} (a Python repr)
        if (!v || typeof v !== 'object') why = 'not an object or a list';
      }
    } catch (e) { why = 'not JSON or a Python repr'; }
    return dataSet(key, why, v);
  }
  function dataSet(key, why, v) {
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
  // ── v0.9.5 · data as TEXT in a flow Message block, never as code ──────────────────────────────────────
  // A Message block whose text STARTS with the reserved marker:   [[lbw:data key=tours]] @{tours}
  // Everything after the marker is the value (JSON or the Python repr Landbot writes for a Webhook object; a `]]` or a
  // tag inside it is data too). The runtime reads it, calls LBW.data.put, and hides that bubble. Never run, never drawn.
  // Replaces the v0.9.0 recipe `LBW.data.put('k', String.raw`@{k}`)` in a Code block, where a backtick or `${` in the API's
  // text ran as code in the chat's window (a stored XSS on the client's site in a Livechat, security review finding 1).
  // Read from the raw message first: the v4 widget's `new_message` event (LBW.landbot(this) hooks it) carries the text
  // as the flow wrote it, before the chat's Markdown can eat a `_`, a `*` or a backslash, and it fires when the messages
  // ARRIVE, before the chat shows them one by one (measured live, docs/21 §2). Only bot messages count: a visitor
  // typing the marker is ignored. Without the event (a chat with history after a reload, a page with no LBW.landbot(this)),
  // the bubble's text is read from the DOM, and refused when the Markdown visibly changed it (emphasis, code, a list).
  var DATA_MARK = /^\s*\[\[\s*lbw:data\s+key=([A-Za-z0-9_]{1,40})\s*\]\]\s*([\s\S]*)$/i, MD = 'em,strong,b,i,del,s,code,pre,li,h1,h2,h3,h4,h5,h6,blockquote';
  var dataEv = Object.create(null), dataDom = Object.create(null), dataTs = Object.create(null), hooked = [], evOn = false;
  function dataIn(key, value, via) {
    var ok = dataPut(key, value);
    var e = { key: key, via: via, ok: ok, length: value.length, at: Date.now() }; log('__lbwDataIn', e); emit('data', e);
    return ok;
  }
  function onMessage(m) {   // the v4 widget's new_message: one raw message, as the flow wrote it
    if (!m || m.author_type !== 'bot' || typeof m.message !== 'string' || m.message.indexOf('lbw:data') < 0) return;
    var x = DATA_MARK.exec(m.message); if (!x) return;
    dataEv[x[1]] = (dataEv[x[1]] || 0) + 1;
    // messages can reach the chat out of order (measured live: a run's 2nd data message came 1.3 s before its 1st; the chat
    // still shows them in order). For one key the message the flow sent last wins, by Landbot's own timestamp
    var ts = +m.timestamp; if (ts && dataTs[x[1]] > ts) { drop('data: "' + x[1] + '" older than the one already read (kept the newer)'); return; }
    if (ts) dataTs[x[1]] = ts; dataIn(x[1], x[2], 'event');
  }
  function hookEvents(w) {
    try {
      if (!w || hooked.indexOf(w) >= 0 || !w.core || !w.core.events || typeof w.core.events.on !== 'function') return false;
      w.core.events.on('new_message', function (m) { try { onMessage(m); } catch (e) {} });
      hooked.push(w); evOn = true; return true;
    } catch (e) { return false; }
  }
  // the v4 chat wraps each message in a box of its own inside a flex column with a 16 px gap: a hidden message left its
  // empty box, and the gap around it (64 px of blank for 4 data messages, measured live). A box whose children are all
  // hidden is hidden too, checked again on every pass (at first the box also holds the chat's "Thinking…")
  function hideUp(h) {
    for (var e = h, p = e.parentElement; p && p !== document.body && !p.matches('[data-lb-part="window"]'); e = p, p = p.parentElement) {
      if (p.style.display === 'none') continue;
      if (![].every.call(p.children, function (c) { return c.style.display === 'none'; })) return;
      p.style.display = 'none'; p.setAttribute('data-lbw-data-box', '');
    }
  }
  function scanData() {
    if (!evOn) hookEvents(root._landbot);   // the share page's widget, when the Custom JS didn't hand it over
    [].forEach.call(document.querySelectorAll('[data-lbw-data]'), hideUp);
    [].forEach.call(document.querySelectorAll('[data-lb-part="message"] [data-lb-part="message-text"]:not([data-lbw])'), function (box) {
      var t = box.textContent; if (t.indexOf('lbw:data') < 0) return;
      var x = DATA_MARK.exec(t); if (!x) return;
      var host = box.closest('[data-lb-part="message"]') || box, key = x[1];
      box.setAttribute('data-lbw', 'data');   // never scanned for tags: a tag inside the data is data
      if (host.getAttribute('data-lb-author') !== 'bot') return;   // a visitor who typed the marker: shown as written, never read
      host.style.display = 'none'; host.setAttribute('aria-hidden', 'true'); host.setAttribute('data-lbw-data', key); hideUp(host);
      var n = dataDom[key] = (dataDom[key] || 0) + 1;
      function fromDom() {
        if ((dataEv[key] || 0) >= n) return;   // the event already read this one, from the raw text
        if (box.querySelector(MD)) { if (DATA_KEY.test(key)) dataSet(key, 'the chat\'s Markdown changed it: hand the widget over with LBW.landbot(this)'); log('__lbwDataIn', { key: key, via: 'dom', ok: false, at: Date.now() }); return; }
        dataIn(key, box.textContent.replace(DATA_MARK, '$2'), 'dom');
      }
      if (evOn && (dataEv[key] || 0) < n) setTimeout(fromDom, 1500); else fromDom();   // the event may still be on its way
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
    try { scanData(); } catch (e) {}   // v0.9.5: data messages first, hidden and never read as tags
    try { scanTags(); } finally { try { keepTel(); } catch (e) {} try { watchRaw(); } catch (e) {} }   // phones after the tags: never inside one
  }
  // v0.9.5 · what the scan left: any [[prefix: still in a text node of the page once the chat has been still for rawMs
  // (1.5 s; 6 s at most while it keeps changing). It is the early warning that Landbot changed its DOM (a renamed
  // data-lb-part or data-lb-author, an author set late, text re-rendered into a bubble already done): logged in
  // __lbwDropped as "raw tag left: …" (and LBW.on('drop')), then removed from the text (cfg.stripRaw: false keeps it).
  // Not looked at: the widgets, the visitor's own messages, code, inputs.
  var rawT = 0, rawFirst = 0, rawSeen = typeof WeakMap === 'function' ? new WeakMap() : null;
  function watchRaw() {
    var now = Date.now(); if (!rawFirst) rawFirst = now;
    if (rawT) clearTimeout(rawT);
    var ms = cfg.rawMs == null ? 1500 : cfg.rawMs;
    rawT = setTimeout(function () { rawT = 0; rawFirst = 0; try { rawSweep(); } catch (e) {} }, Math.max(0, Math.min(ms, rawFirst + 6000 - now)));
  }
  // linear, as in fallback.js (v0.9.5 security pass): the regex forms went quadratic on a long hostile text
  function stripTxt(s) {
    var out = '', from = 0, j = -1, c = -1, a, z;
    while ((j = s.indexOf('[[', j + 1)) >= 0) {
      if (j < from) continue;
      if (c !== -2 && c < j + 2) { c = s.indexOf(']', j + 2); if (c < 0) c = -2; }
      a = j > from && s.charAt(j - 1) === '`' ? j - 1 : j;
      if (c === -2) return out + s.slice(from, a);
      if (s.charAt(c + 1) === ']') { z = s.charAt(c + 2) === '`' ? c + 3 : c + 2; out += s.slice(from, a); from = z; j = z - 1; }
    }
    return out + s.slice(from);
  }
  function trimEnd(v) { var e = v.length; while (e && /\s/.test(v.charAt(e - 1))) e--; return v.slice(0, e); }
  function rawAt(v) {   // the first "[[ prefix:" in v, or null
    var pre = String(cfg.prefix || '').toLowerCase() + ':', i = -1, k;
    while ((i = v.indexOf('[[', i + 1)) >= 0) { k = i + 2; while (k < v.length && /\s/.test(v.charAt(k))) k++; if (v.substr(k, pre.length).toLowerCase() === pre) return v.slice(i, i + 120); }
    return null;
  }
  function strip(box) {   // what fallback.js does: every [[…]] out of the text, nothing else touched
    var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n, v;
    while ((n = walker.nextNode())) if (n.nodeValue.indexOf('[[') >= 0 && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('.lbw'))) { v = trimEnd(stripTxt(n.nodeValue)); if (v !== n.nodeValue) n.nodeValue = v; }
  }
  function rawSweep() {
    var b = document.body; if (!b || b.textContent.indexOf('[[') < 0) return;
    var walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), found = [], n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf('[[') < 0 || rawAt(n.nodeValue) == null) continue;
      var pe = n.parentNode; if (!pe || !pe.closest || pe.closest('.lbw, [data-lb-author="user"], script, style, noscript, code, pre, textarea, template')) continue;
      found.push(n);
    }
    found.forEach(function (t) {
      var v = t.nodeValue; if (!rawSeen || rawSeen.get(t) !== v) drop('raw tag left: ' + (rawAt(v) || ''));
      if (cfg.stripRaw === false) { if (rawSeen) rawSeen.set(t, v); return; }
      var w2 = trimEnd(stripTxt(v)); if (w2 !== v) t.nodeValue = w2;
    });
  }
  function scanTags() {
    var sel = '[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]:not([data-lbw])', passWas;
    [].forEach.call(document.querySelectorAll(sel), function (box) {
      if (box.textContent.indexOf('[[') < 0) return;
      box.setAttribute('data-lbw', '1');
      // v0.9.5 · one message at a time: an exception anywhere in it (a widget, the DOM) no longer leaves it raw, and
      // never stops the messages after it. Its tags are removed and logged; the widgets it already drew stay
      try { one(box); } catch (e) { drop('message failed: ' + (e && e.message) + ' (its tags removed)'); strip(box); }
    });
    function one(box) {
      var host = box.closest('[data-lb-part="message"]') || box, made = [], late = [], held = [];
      var whole = box.textContent, names = [], left = eachTag(whole, function (m, name) { names.push(String(name).toLowerCase()); return ''; });
      // v0.9.5 (security review) · a widget fed by a flow (LBW.widget(name, fn, { flow: true })) is written by a flow message
      // that holds that one tag, with field values in it. A value someone else wrote (a review, a sheet cell) can close the tag
      // with ']]' and open another, or break it with a lone ']'. So a message that holds a flow widget's tag, read or not
      // (its '[[PREFIX:name' still there), must be exactly that one tag: anything else ([[, ]] left over, a second tag) draws
      // nothing, and the text from its first '[[' on is cut (it may hold the injected words)
      var flowNames = names.slice();
      for (var j0 = left.indexOf('[['); j0 >= 0; j0 = left.indexOf('[[', j0 + 1)) { var e0 = headAt(left, j0); if (e0 > 0) flowNames.push(left.slice(headAt(left, j0, true), e0).toLowerCase()); }
      if (flowNames.some(function (x) { return W[x] && W[x].flow; }) && (names.length !== 1 || left.indexOf('[[') >= 0 || left.indexOf(']]') >= 0)) {
        drop('flow message tampered: ' + whole.slice(whole.indexOf('[[')).slice(0, 300));
        box.textContent = rtrim(whole.slice(0, whole.indexOf('[[')).replace(/`$/, '')); return;
      }
      function swap(s) {
        var t = eachTag(s, function (m, name, attrs) {
                  if (made.length + late.length >= cfg.maxPerMessage) { drop(m + ' (over the limit)'); return ''; }
                  // a widget registered as `last` (chips) is drawn after every other one, wherever its tag was written: it
                  // must see the cards of the whole message (to leave out what they already offer)
                  var d = W[String(name).toLowerCase()]; if (d && d.last) { late.push([name, attrs, m]); return ''; }
                  var r = render(name, attrs, m, host, names, made); if (r.w) made.push(r.w); else drop(m + ' (' + r.why + ')'); return '';
                });
        t = eachRest(t, function (m) { drop(m); return ''; });
        return eachTail(t, function (m, pre) { drop('tail of a broken tag: ' + m); return pre; });
      }
      var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), texts = [], n;
      while ((n = walker.nextNode())) texts.push(n);
      // the chat renders Markdown: a tag can be split over several text nodes (a *bold* name in a value). Then the whole
      // text is re-read and the box keeps plain text
      var split = texts.some(function (t) { return t.nodeValue.lastIndexOf('[[') > t.nodeValue.lastIndexOf(']]'); });
      if (split) box.textContent = swap(box.textContent).trim();
      else texts.forEach(function (t) { if (t.nodeValue.indexOf('[[') >= 0) { t.nodeValue = rtrim(swap(t.nodeValue)); held.push(t); } });
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
        if (box.lastChild && box.lastChild.nodeType === 3) box.lastChild.nodeValue = rtrim(box.lastChild.nodeValue);
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
    }
    // one-shot groups nobody used go quiet once the visitor has written after them
    var all = document.querySelectorAll('[data-lb-part="message"]'), lastU = -1;
    [].forEach.call(all, function (m, i) { if (m.getAttribute('data-lb-author') === 'user') lastU = i; });
    [].forEach.call(all, function (m, i) { if (i < lastU) [].forEach.call(m.querySelectorAll('.lbw-unsent'), function (x) { x.remove(); }); });   // v0.9.5: the visitor moved on
    [].forEach.call(all, function (m, i) { if (i < lastU) [].forEach.call(m.querySelectorAll('.lbw-once:not(.is-done)'), function (g) { g.classList.add('is-stale'); done(g); var w = g.closest('.lbw'); if (w && !w.querySelector('.is-sent')) w.classList.add('is-spent'); }); });   // v0.8.1.9: is-spent: nothing was sent from this card
  }
  function start() {
    if (started) return; started = true;
    new MutationObserver(function (list) {
      // the chat is busy while any message outside our widgets changes (the agent's reply arriving)
      if (list.some(function (r) { var x = r.target.nodeType === 1 ? r.target : r.target.parentElement; return x && x.closest && x.closest('[data-lb-part="message"]') && !x.closest('.lbw'); })) quietSince = Date.now();
      scan();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // after the current script: init() runs before the widgets are registered. v0.9.5 · then the runtime is READY: LBW.ready
    // and the class lbw-ready on <html>, which ends the guard CSS's hiding of bot text (dist/guard.min.css) and stops
    // fallback.js. LBW.on('ready') is told once
    setTimeout(function () { try { scan(); } finally { root.LBW.ready = true; try { document.documentElement.classList.add('lbw-ready'); } catch (e) {} emit('ready', { version: root.LBW.version }); } }, 0);
  }

  root.LBW = {
    version: '0.9.4.2',
    ready: false,   // v0.9.5: true once init() ran and the first scan is done
    // LBW.init({ prefix, langs, defaultLang, labels: {en:{…}}, links: ['https://shop.example/', 'tel:', 'mailto:', 'https://calendar.google.com/'], maxPerMessage, quietMs, timeZone: 'Europe/Madrid' })
    init: function (o) { for (var k in o) cfg[k] = o[k]; start(); return root.LBW; },
    // LBW.landbot(this) at the top level of the bot's Custom JS: messages go through the v4 widget's sendMessage. true if taken
    landbot: bind,
    // LBW.on('render', function (e) { e.widget, e.tag, e.lang, e.el, e.message }) · 'say' → { text, fields } · 'drop' → the reason
    // · 'unsent' → { text, fields } (v0.9.5: every way failed; the control offers Retry) · 'ready' → { version }
    on: function (name, fn) { if (typeof fn === 'function') (subs[name] = subs[name] || []).push(fn); return root.LBW; },
    // LBW.widget('card', function (p, ctx) { …return an element or null… }, { last: true })
    // v0.9.5 · { flow: true } for a widget a flow message writes with field values in it ([[p:review texto=@{review}|lang=@{lang}]]):
    // that message must hold its one tag and nothing else that looks like a tag, and a key written twice drops the tag.
    // { flow: ['texto', 'lang'] } also drops a tag with any other key. A name a tag can't write (or __proto__) is refused
    widget: function (name, fn, opts) {
      name = String(name).toLowerCase(); if (!/^[a-z][a-z0-9_]*$/.test(name) || typeof fn !== 'function') { drop('LBW.widget: refused "' + name + '"'); return root.LBW; }
      var fl = opts && opts.flow; W[name] = { render: fn, last: !!(opts && opts.last), flow: Array.isArray(fl) ? fl.map(function (k) { return String(k).toLowerCase(); }) : fl ? true : false }; return root.LBW;
    },
    ui: { el: el, allowed: allowed, link: link, tel: tel, btn: btn, img: img, loading: loading, card: card, head: head, row: row, rows: rows, reply: reply, once: once, multi: multi, done: done, form: form, stepper: stepper, ics: ics,
          announce: announce, announceCard: announceCard, titleOf: titleOf, rescue: rescue },   // v0.9.5
    // LBW.announce(text, lang, key): one short line in the chat's polite live region (v0.9.5)
    announce: announce,
    day: { num: dayNum, parts: dayParts, read: dayRead, today: dayToday, format: dayFormat, str: dayStr, easter: dayEaster, nth: dayNth, next: dayNext, on: dayOn },
    time: { now: timeNow, read: timeRead, format: timeFmt, state: timeState, nextOpen: timeNextOpen },
    cal: { google: gcal, ics: icsText },
    later: later, csv: csv, json: json, page: page, parseCSV: parseCSV, say: say, store: store, drop: drop, missing: missing, parse: parse, scan: scan
  };
  root.LBW.data = { put: dataPut, get: dataGet, wait: dataWait, clear: function (key) { delete dataBox[String(key)]; } };   // v0.9.0, above
})(window);
