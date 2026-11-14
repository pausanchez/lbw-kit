/* host-v4.js · the one place lbw.js meets the Landbot v4 web chat
   Every hook the library reads in Landbot's DOM (data-lb-part, data-lb-author) and every Landbot global it talks to
   (the widget's sendMessage, window._landbot, the legacy Landbot.exec bridge) is here, and only here: if Landbot changes its
   web chat, this file is the fix (test/host.test.mjs keeps it that way; test/fixtures/host-v4/ holds the real DOM).
   Four parts: the hooks a bot message is found by, reading the chat, talking to Landbot, laying out the chat (screen mode,
   runtime/screen.js). All four go before lbw.js in every bundle. dist/fallback.min.js, which must work with no library and fit the Custom JS upload, carries only the first
   (scripts/build.mjs cuts this file at the "@@more" mark).
   It touches no page until called. lbw.js exposes it as LBW.host; for a page, only LBW.host.check() is meant to be called. */
(function (root) {
  if (root.LBW_HOST) return;
  root.LBW_HOST = { sel: { message: '[data-lb-part="message"]', text: '[data-lb-part="message-text"]', bot: '[data-lb-author="bot"]' } };
})(window);

/* @@more ── reading the chat ───────────────────────────────────────────────────────────────────── */
(function (root) {
  var H = root.LBW_HOST; if (!H || H.messages) return;
  var S = H.sel, MSG = S.message, TXT = S.text, WIN = S.window = '[data-lb-part="window"]',
      INP = S.input = '[data-lb-part="input-field"]', AUTHOR = 'data-lb-author';
  var BY = { bot: S.bot, user: S.user = '[data-lb-author="user"]' };
  function doc(r) { return r || document; }
  function list(r, s) { return doc(r).querySelectorAll(s); }
  function msgSel(who) { return MSG + (who ? BY[who] : ''); }

  // messages(root?, 'bot' | 'user'?): the chat's messages in document order (a NodeList)
  function messages(r, who) { return list(r, msgSel(who)); }
  // texts(root?, 'bot' | 'user'?, extra?): the text box of every message (extra: more selector on the box, ':not([data-lbw])')
  function texts(r, who, extra) { return list(r, msgSel(who) + ' ' + TXT + (extra || '')); }
  function isBot(el) { return !!el && el.getAttribute(AUTHOR) === 'bot'; }
  function isUser(el) { return !!el && el.getAttribute(AUTHOR) === 'user'; }
  // the message a node is in (the node itself when it is one), or null
  function messageOf(n) { return n && n.closest ? n.closest(MSG) : null; }
  // a message's text box (or the box itself), and its text
  function textBox(m) { return !m ? null : m.matches && m.matches(TXT) ? m : m.querySelector(TXT); }
  function textOf(m) { var b = textBox(m); return b ? b.textContent : ''; }
  function win(r) { return doc(r).querySelector(WIN); }
  function isWindow(el) { return !!el && !!el.matches && el.matches(WIN); }
  // the chat shows a typing indicator (role=status) while a reply is on its way
  function busy(r) { return !!doc(r).querySelector(WIN + ' [role="status"]'); }
  // v0.9.4.1 · the v4 chat's box is an <input> ("Type here…", measured live 13 Nov 2026), not a textarea; never one of our own
  // widgets' fields. v0.9.5 (security review) · only Landbot's own text box, the one in (or marked) [data-lb-part="input-field"]:
  // where lbw.js runs outside the chat, any other input (a newsletter form) would get the text and an Enter. null when none
  // (the v4 chat has none while it shows buttons)
  function input(r) {
    var box = null;
    [].some.call(list(r, INP + ' textarea, ' + INP + ' input, textarea' + INP + ', input' + INP), function (x) {
      if (x.closest('.lbw') || x.disabled || (x.tagName === 'INPUT' && !/^(text|search)?$/i.test(x.getAttribute('type') || ''))) return false; box = x; return true;
    });
    return box;
  }
  // observe(root, cb, skip?): cb(records, inChat) on every change under root; inChat is true when one of them is inside a
  // message and outside `skip` (the library's own widgets: '.lbw'). Returns the MutationObserver
  function observe(r, cb, skip) {
    var mo = new MutationObserver(function (recs) {
      cb(recs, recs.some(function (x) { var e = x.target.nodeType === 1 ? x.target : x.target.parentElement; return e && e.closest && e.closest(MSG) && !(skip && e.closest(skip)); }));
    });
    mo.observe(r || document.documentElement, { childList: true, subtree: true, characterData: true });
    return mo;
  }
  // check(root?) → { ok, missing: ['data-lb-part="message"', …], input: bool }: the hooks the library needs that the page
  // lacks. The text box is not required (none while the chat shows buttons): `input` only says if there is one now.
  // With no message on the page, author and text can't be judged, so only the message hook is reported
  function check(r) {
    var d = doc(r), miss = [], w = isWindow(d) ? d : win(d), ms = messages(d);
    if (!w) miss.push('data-lb-part="window"');
    if (!ms.length) miss.push('data-lb-part="message"');
    else {
      if (![].some.call(ms, isBot)) miss.push('data-lb-author="bot"');
      if (!d.querySelector(MSG + ' ' + TXT)) miss.push('data-lb-part="message-text"');
    }
    return { ok: !miss.length, missing: miss, input: !!input(d) };
  }

  // H.sel: the selectors, for a closest() that must skip the visitor's own messages (lbw.js rawSweep) and for fallback.js;
  // to query the chat, use the functions
  H.name = 'landbot-v4';
  H.messages = messages; H.texts = texts; H.isBot = isBot; H.isUser = isUser; H.messageOf = messageOf; H.textBox = textBox; H.textOf = textOf;
  H.window = win; H.isWindow = isWindow; H.busy = busy; H.input = input; H.observe = observe; H.check = check;
})(window);

/* ── talking to Landbot ──────────────────────────────────────────────────────────────────────── */
(function (root) {
  var H = root.LBW_HOST; if (!H || H.send) return;
  // v4 widget API first (dev.landbot.io/sdks/widgets/api/widget#sendmessage): the bot's Custom JS hands the runtime the
  // widget instance, `LBW.landbot(this)` at its TOP level (inside a callback `this` is something else). Its sendMessage
  // returns a Promise and takes the fields as custom_data in the same message. Then window._landbot (the share page), then
  // the legacy bridge inside the chat iframe (Landbot.exec, logs a deprecation warning: fields queued with
  // 'landbot-custom-data', then the message), then typing into the text box. Each message goes out once: a way is left
  // for the next only when it throws or its Promise rejects. Measured live (13 Nov 2026, docs/07): `this` is the widget on the
  // share page (=== window._landbot) and in a Livechat embed (the host's myLandbot); custom_data wrote the field; the
  // Promise resolves to undefined; Landbot.exec still works but logs two console.error lines per click.
  // o: { widget: the instance LBW.landbot() took, or null; drop: the library's drop(reason) }
  function widget() { return root._landbot; }   // the share page's widget
  function store(fields, o) {   // fields with no message: queued, saved with the next one
    var lb = root._landbot, bound = o && o.widget;
    try { if (bound && typeof bound.setCustomData === 'function') { bound.setCustomData(fields); return true; } } catch (e) {}
    try { if (root.Landbot && typeof root.Landbot.exec === 'function') { root.Landbot.exec('landbot-custom-data', fields); return true; } } catch (e) {}
    try { if (lb && typeof lb.setCustomData === 'function') { lb.setCustomData(fields); return true; } } catch (e) {}
    if (o && o.drop) o.drop('no way to store fields'); return false;
  }
  // v0.9.5 · a send can fail: offline, sendMessage rejected for the network (measured live: "Failed to fetch", then the
  // legacy bridge failed the same way and the click was lost with its card locked). send() reports back through cb(ok):
  // a network failure stops at once (no deprecated Landbot.exec after it), and so does "no way to send".
  function offline() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
  function netErr(e) { return offline() || !!(e && (e.name === 'TypeError' || e instanceof TypeError) && /failed to fetch|networkerror|network error|load failed|network request failed/i.test(e.message || '')); }
  function send(text, fields, cb, o) {
    cb = cb || function () {}; o = o || {};
    var drop = o.drop || function () {}, bound = o.widget || null;
    if (offline()) { drop('not sent (offline): ' + text); return cb(false); }
    var lb = root._landbot, ways = [], msg = { type: 'text', message: text };
    if (fields) msg.custom_data = fields;
    if (bound) ways.push(['widget', bound]);
    if (lb && lb !== bound && typeof lb.sendMessage === 'function') ways.push(['_landbot', lb]);
    function next(i) {
      if (i >= ways.length) return legacy(text, fields, cb, o);
      var r;
      try { r = ways[i][1].sendMessage(msg); } catch (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + e.message + ')'); return netErr(e) ? cb(false) : next(i + 1); }
      if (r && typeof r.then === 'function') r.then(function () { cb(true); }, function (e) { drop('send failed (' + ways[i][0] + '): ' + text + ' (' + (e && e.message || e) + ')'); if (netErr(e)) cb(false); else next(i + 1); });
      else cb(true);
    }
    next(0);
  }
  function legacy(text, fields, cb, o) {
    var L = root.Landbot, drop = o.drop || function () {};
    if (L && typeof L.exec === 'function') {
      try { if (fields) L.exec('landbot-custom-data', fields); L.exec('landbot-msg-send', { type: 'text', message: text }); return cb(true); } catch (e) {}
    } else if (fields) store(fields, o);
    // last resort: type it into Landbot's own text box. No such box: nothing is typed, and the send is dropped and logged
    var box = H.input();
    if (!box) { drop('no way to send: ' + text); return cb(false); }
    Object.getOwnPropertyDescriptor((box.tagName === 'INPUT' ? HTMLInputElement : HTMLTextAreaElement).prototype, 'value').set.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    cb(true);
  }

  H.widget = widget; H.send = send; H.store = store;
})(window);

/* ── laying out the chat (screen mode, runtime/screen.js) ──────────────────────────────────────── */
// The chat as one screen at a time: runtime/screen.js decides, these do. Nothing here runs until screen mode is on, and
// nothing is removed from Landbot's tree: rows are only marked (data-lbw-past, hidden by lbw.css while the window is in
// 'collapse' mode), and the two slots are our own elements beside the message column, never inside Landbot's header or
// around its text box.
(function (root) {
  var H = root.LBW_HOST; if (!H || !H.messages || H.column) return;
  var MSG = H.sel.message, SLOT = 'data-lbw-slot', PAST = 'data-lbw-past', MODE = 'data-lbw-screen', CUR = 'data-lbw-cur', CHROME = 'data-lbw-chrome',
      ASIDE = 'data-lbw-aside', HEAD = '[data-lb-part="message-header"]';
  // column(root?): the window's child that holds the messages (v4: the scrolling column between the header and the text
  // box), or null with no window or no message in it
  function column(r) {
    var w = H.window(r), m = H.messages(r)[0], e = m;
    if (!w || !m || !w.contains(m)) return null;
    while (e && e.parentElement !== w) e = e.parentElement;
    return e || null;
  }
  // rowOf(node, root?): the outermost element that holds this message and no other (v4 wraps each message in a row of its
  // list), never the column itself; null for a node in no message
  function rowOf(n, r) {
    var e = H.messageOf(n), col = column(r); if (!e) return null;
    for (var p = e.parentElement; p && p !== col && !H.isWindow(p) && p.querySelectorAll(MSG).length === 1; p = p.parentElement) e = p;
    return e;
  }
  // slot('head' | 'bar', root?): our own element in the window, right before ('head') or right after ('bar') the column;
  // made on first use, and put back in place if the chat moved things. null with no column
  function slot(name, r) {
    var w = H.window(r), col = column(r), s = null; if (!w || !col) return null;
    [].some.call(w.children, function (x) { if (x.getAttribute(SLOT) === name) { s = x; return true; } return false; });
    if (!s) { s = document.createElement('div'); s.setAttribute(SLOT, name); }
    if (name === 'head' ? s.nextSibling !== col : s.previousSibling !== col) w.insertBefore(s, name === 'head' ? col : col.nextSibling);
    return s;
  }
  // collapse(from, root?): every message row before the row of `from` is marked past, the others unmarked (null: none).
  // Returns how many are past. Marked rows stay in the DOM
  function collapse(from, r) {
    var ms = H.messages(r), f = from ? H.messageOf(from) : null, at = f ? [].indexOf.call(ms, f) : -1, n = 0;
    [].forEach.call(ms, function (m, i) {
      var row = rowOf(m, r); if (!row) return;
      if (i < at) { n++; if (!row.hasAttribute(PAST)) row.setAttribute(PAST, ''); } else if (row.hasAttribute(PAST)) row.removeAttribute(PAST);
    });
    return n;
  }
  // scroller(node): the element that scrolls the chat around a node (the nearest ancestor with overflow-y auto or scroll), else
  // the page's own scrolling element
  function scroller(n) {
    for (var e = n && n.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      var cs = root.getComputedStyle ? root.getComputedStyle(e) : null; if (cs && /(auto|scroll)/.test(cs.overflowY)) return e;
    }
    return document.scrollingElement || document.documentElement;
  }
  // present(from, to, kindOf, root?): the "bleed" marks for the messages from `from` to `to` (the current screen's turn): each
  // row data-lbw-cur; the elements between a message and its text box (the bubble's chrome) data-lbw-chrome, the text box
  // itself data-lbw-chrome = kindOf(message) ('title' or 'intro'); the message's header (avatar, author) data-lbw-aside.
  // Every other message loses those marks. null: no marks anywhere. lbw.css styles them; nothing moves
  function present(from, to, kindOf, r) {
    var ms = H.messages(r), a = from ? [].indexOf.call(ms, H.messageOf(from)) : -1, b = to ? [].indexOf.call(ms, H.messageOf(to)) : -1;
    [].forEach.call(doc(r).querySelectorAll('[' + CUR + '], [' + CHROME + '], [' + ASIDE + ']'), function (x) { x.removeAttribute(CUR); x.removeAttribute(CHROME); x.removeAttribute(ASIDE); });
    if (a < 0 || b < a) return 0;
    for (var i = a; i <= b; i++) {
      var m = ms[i], row = rowOf(m, r), t = H.textBox(m), hd = m.querySelector(HEAD);
      if (row) row.setAttribute(CUR, '');
      if (t) { t.setAttribute(CHROME, (kindOf && kindOf(m)) || 'intro'); for (var e = t.parentElement; e && e !== m; e = e.parentElement) e.setAttribute(CHROME, ''); }
      if (hd) hd.setAttribute(ASIDE, '');
    }
    return b - a + 1;
  }
  function doc(r) { return r || document; }
  // layout(mode, root?): marks the window 'collapse' (earlier rows hidden), 'open' (shown again) or 'keep' (never hidden);
  // a falsy mode takes every mark and slot away: a normal chat again. false with no window
  function layout(mode, r) {
    var w = H.window(r); if (!w) return false;
    if (mode) { if (w.getAttribute(MODE) !== mode) w.setAttribute(MODE, mode); return true; }
    w.removeAttribute(MODE);
    [].slice.call(w.querySelectorAll('[' + SLOT + ']')).forEach(function (x) { x.remove(); });
    collapse(null, r); present(null, null, null, r); return true;
  }
  H.column = column; H.rowOf = rowOf; H.slot = slot; H.collapse = collapse; H.layout = layout; H.scroller = scroller; H.present = present;
})(window);
