/* screen.js · screen mode: the chat as an app, one screen at a time (prototype on lbw.js v0.12.0)
   With "screen": { "on": true, … } in a kit config (or LBW.screen.start(config) by hand), the newest bot message that draws
   a widget becomes the current screen: the messages before its turn fold away (still in the DOM, behind "View
   conversation"), an app header shows the steps with the current one, and the widget's primary action is mirrored in a
   bottom bar while the original is scrolled out of view. Off, this file only defines LBW.screen: no listener, no cost.
   - Landbot's DOM only through the host adapter (runtime/host-v4.js: column, rowOf, slot, collapse, layout).
   - The step comes from the config (the widget's "step") or from the tag (step=when, or step=2), checked against the
     config's closed list: anything else is logged and ignored.
   - An agent's free text between screens is a normal bubble under the current screen: only what came before the screen's
     turn is folded, so no reply is ever hidden, and the next widget simply becomes the next screen. The text box is never
     touched, and focus never leaves it.
   - If the host check fails (a renamed hook) or the config is wrong, it stays a normal chat and says why in __lbwDropped. */
(function (root) {
  var LBW = root.LBW; if (!LBW || LBW.screen) return;
  var H = LBW.host, D = document, own = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  // [View conversation, Step {n} of {m}, done, Steps], in the kit's languages
  var T = { en: ['View conversation', 'Step {n} of {m}', 'done', 'Steps'], es: ['Ver conversación', 'Paso {n} de {m}', 'hecho', 'Pasos'],
    ca: ['Veure la conversa', 'Pas {n} de {m}', 'fet', 'Passos'], fr: ['Voir la conversation', 'Étape {n} sur {m}', 'terminée', 'Étapes'],
    de: ['Unterhaltung anzeigen', 'Schritt {n} von {m}', 'erledigt', 'Schritte'], it: ['Vedi la conversazione', 'Passo {n} di {m}', 'fatto', 'Passi'],
    pt: ['Ver a conversa', 'Passo {n} de {m}', 'feito', 'Passos'] };
  var ID = /^[a-z][a-z0-9_]{0,29}$/, TAG = /^`?\[\[\s*[a-z][\w]*\s*:\s*[a-z][\w]*([\s\S]*?)\]\]`?$/i;
  var C = null, W = {}, dflt = 'en', STEPS = [], on = false, dead = false, seen = false, open = false, cur = null, mo = null, io = null;

  function el(tag, cls, text) { return LBW.ui.el(tag, cls, text); }
  function tx(v, lang) { if (v == null) return ''; if (typeof v !== 'object') return String(v); var k = own(v, lang) ? lang : own(v, dflt) ? dflt : Object.keys(v)[0]; return k == null ? '' : String(v[k]); }
  function words(lang) { var b = String(lang || '').split(/[-_]/)[0]; return T[b] || T[String(dflt).split(/[-_]/)[0]] || T.en; }
  function idx(ms, m) { return [].indexOf.call(ms, m); }
  function stepAt(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i][0] === id) return i; return -1; }
  function mode() { return C.history === 'keep' ? 'keep' : open ? 'open' : 'collapse'; }

  // what the runtime can't draw from: a wrong config is a normal chat (the checker says the same before upload)
  function bad(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return 'the config is not an object';
    var h = c.header, s = h && h.steps, ids = {};
    if (h != null && (typeof h !== 'object' || Array.isArray(h))) return 'header is not an object';
    if (s != null) {
      if (!Array.isArray(s) || s.length < 2 || s.length > 8) return 'header.steps is 2 to 8 [id, label]';
      for (var i = 0; i < s.length; i++) { if (!Array.isArray(s[i]) || !ID.test(s[i][0]) || ids[s[i][0]]) return 'header.steps[' + i + '] is [id, label], with a new lower-case id'; ids[s[i][0]] = 1; }
    }
    if (c.history != null && c.history !== 'collapse' && c.history !== 'keep') return 'history is "collapse" or "keep"';
    return '';
  }
  // LBW.screen.start(config, { lang: the default language, widgets: { name: { screen: false, step: 'when' } } }) → true when on
  function start(c, o) {
    if (on || dead || !c || c.on !== true) return false;
    var why = bad(c); if (why) { dead = true; LBW.drop('screen: ' + why + ' (a normal chat)'); return false; }
    o = o || {}; C = c; W = o.widgets || {}; dflt = o.lang || dflt;
    STEPS = ((c.header && c.header.steps) || []).map(function (x) { return [x[0], x[1]]; });
    on = true;
    LBW.on('render', function (e) { if (!on) return; try { onRender(e); } catch (x) { quit('error: ' + (x && x.message)); } });
    return true;
  }
  function quit(why) {
    if (cur && cur.w) cur.w.classList.remove('is-screen');
    on = false; dead = true; cur = null; unwatch();
    try { H.layout(null); } catch (e) {}
    LBW.drop('screen: ' + why + ' (a normal chat)');
  }

  // the step a tag names (step=when or step=2), else the widget's own "step", else none (the header keeps the last one)
  function stepOf(tag, wc) {
    var m = TAG.exec(String(tag || '')), v = null;
    if (m) { try { v = LBW.parse(m[1]).step; } catch (e) {} }
    if (v != null && !LBW.missing(v)) {
      var s = String(v).trim().toLowerCase(), n = /^\d{1,2}$/.test(s) ? +s : 0;
      if (n >= 1 && n <= STEPS.length) return STEPS[n - 1][0];
      if (stepAt(s) >= 0) return s;
      LBW.drop('screen: unknown step "' + s.slice(0, 40) + '" in ' + String(tag).slice(0, 80));
    }
    return typeof wc.step === 'string' && stepAt(wc.step) >= 0 ? wc.step : null;
  }
  function onRender(e) {
    var wc = own(W, e.widget) ? W[e.widget] : {}; if (wc.screen === false) return;
    var m = e.message, ms = H.messages(), i = idx(ms, m); if (i < 0) return;
    if (cur && cur.msg !== m && i < idx(ms, cur.msg)) return;   // an older message (a chat loading its history) never takes over
    if (!seen) {
      seen = true; var r = H.check();
      if (!r.ok || !H.column()) return quit('host changed: ' + (r.missing.join(', ') || 'no message column'));
    }
    var st = stepOf(e.tag, wc);
    if (cur && cur.msg === m) { if (cur.step == null && st != null) { cur.step = st; head(); } return; }   // the screen's second widget
    show(m, e.el, st, e.lang, i === ms.length - 1);
  }
  // the turn the screen belongs to: the bot messages right before it (the agent's text split into bubbles), back to the
  // visitor's last message, the previous screen or any message with a widget
  function turnOf(m, prev) {
    var ms = H.messages(), t = m;
    for (var j = idx(ms, m) - 1; j >= 0; j--) { var x = ms[j]; if (H.isUser(x) || x === prev || x.classList.contains('has-lbw')) break; t = x; }
    return t;
  }
  function show(m, w, st, lang, newest) {
    var was = cur, a = D.activeElement, turn = turnOf(m, was && was.msg);
    if (was && was.w) was.w.classList.remove('is-screen');
    w.classList.add('is-screen');   // lbw.js: the current screen stays live when the visitor types a question on it
    cur = { msg: m, w: w, turn: turn, step: st != null ? st : was ? was.step : null, lang: lang || dflt, widget: w.getAttribute('data-widget'), past: 0 };
    open = false;
    H.layout(mode());
    cur.past = H.collapse(C.history === 'keep' ? null : turn);
    head(); bar(w);
    if (!newest) return;   // history drawn at load: no move, no word
    if (LBW.motion()) enter(turn, m);
    if (takes(a, was)) focusTo(w);
    var s = stepText(); if (s) LBW.announce(s, cur.lang, 'screen');
  }
  // focus moves to the new screen when it was in the chat (the screen just folded away, a widget, the header): never on the
  // first screen (the page just loaded), never from the chat's text box (the visitor is typing), never from the host page
  function takes(a, was) {
    if (!was) return false;
    if (!a || a === D.body || a === D.documentElement || !a.isConnected) return true;
    var w = H.window(); if (!w || !w.contains(a)) return false;
    return !(a.isContentEditable || (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('.lbw')));
  }
  function focusTo(w) {
    var t = w.querySelector('.lbw-title, [role="heading"]') || w.querySelector('.lbw-box') || w;
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    try { t.focus({ preventScroll: true }); } catch (e) { try { t.focus(); } catch (e2) {} }
  }
  // the new screen's rows rise in (only under the motion gate; html.lbw-motion carries the animation, so a hidden tab or
  // reduced motion draws them at once)
  function enter(turn, m) {
    var ms = H.messages(), rows = [];
    for (var i = idx(ms, turn); i >= 0 && i <= idx(ms, m); i++) { var r = H.rowOf(ms[i]); if (r) { r.setAttribute('data-lbw-in', ''); rows.push(r); } }
    setTimeout(function () { rows.forEach(function (r) { r.removeAttribute('data-lbw-in'); }); }, 900);
  }
  function stepText() {
    var k = cur ? stepAt(cur.step) : -1; if (k < 0) return '';
    return words(cur.lang)[1].replace('{n}', k + 1).replace('{m}', STEPS.length) + ': ' + tx(STEPS[k][1], cur.lang);
  }

  // ── the header: the title, "View conversation" and the steps ─────────────────────────────────────
  function head() {
    var s = H.slot('head'); if (!s || !cur) return;
    var lang = cur.lang, t = words(lang), h = C.header || {}, title = tx(h.title, lang), top = s.firstChild;
    s.className = 'lbw-scr-head'; s.setAttribute('lang', lang);
    if (!top) {
      top = s.appendChild(el('div', 'lbw-scr-top')); top.appendChild(el('p', 'lbw-scr-title'));
      if (C.history !== 'keep') { var b = top.appendChild(LBW.ui.btn('', 'lbw-scr-hist')); b.addEventListener('click', function () { history(!open); }); }
    }
    var ti = top.firstChild, hb = top.querySelector('.lbw-scr-hist');
    ti.textContent = title; ti.hidden = !title;
    if (hb) {
      hb.textContent = t[0]; var ch = hb.appendChild(el('span', 'lbw-scr-chev', open ? ' ▴' : ' ▾')); ch.setAttribute('aria-hidden', 'true');
      hb.setAttribute('aria-expanded', String(open)); hb.hidden = !cur.past;
    }
    var old = s.querySelector('.lbw-scr-steps, .lbw-scr-prog'); if (old) old.remove();
    var k = stepAt(cur.step), n = STEPS.length; if (!n) return;
    if (h.progress) {
      if (k < 0) return;
      var pg = s.appendChild(el('div', 'lbw-scr-prog')), tr = el('div', 'lbw-scr-track'), f = tr.appendChild(el('i'));
      pg.appendChild(el('p', null, stepText())); tr.setAttribute('aria-hidden', 'true'); f.style.width = Math.round((k + 1) / n * 100) + '%'; pg.appendChild(tr);
      return;
    }
    var ol = s.appendChild(el('ol', 'lbw-scr-steps' + (n > 4 ? ' is-many' : '')));
    ol.setAttribute('aria-label', t[3]);
    STEPS.forEach(function (x, j) {
      var li = ol.appendChild(el('li', j < k ? 'is-done' : j === k ? 'is-cur' : null)), l = li.appendChild(el('span', 'lbw-scr-l'));
      if (j < k) { var ck = l.appendChild(el('span', 'lbw-scr-ck', '✓ ')); ck.setAttribute('aria-hidden', 'true'); }
      l.appendChild(D.createTextNode(tx(x[1], lang)));
      if (j < k) l.appendChild(el('span', 'lbw-scr-sr', ', ' + t[2]));
      if (j === k) li.setAttribute('aria-current', 'step');
    });
  }

  // ── the bottom bar: the screen's primary action, mirrored ───────────────────────────────────────
  // Mirrored, not moved: the original stays where the kit put it (its group, its sent state, its receipt and the focus rescue
  // all need it there), and stays the one keyboard and screen-reader users reach. The bar is a pointer shortcut for when the
  // original is scrolled out of view: aria-hidden, out of the tab order, and a press is the original's click
  function primary(w) {
    var c = w.querySelectorAll('.lbw-cta, .lbw-final .is-primary, .lbw-pill.is-primary');
    for (var i = 0; i < c.length; i++) if (!c[i].closest('.is-folded, [hidden]') && c[i].tagName === 'BUTTON') return c[i];
    return null;
  }
  function unwatch() { if (mo) { mo.disconnect(); mo = null; } if (io) { io.disconnect(); io = null; } }
  function bar(w) {
    unwatch();
    var s = H.slot('bar'); if (!s) return;
    s.className = 'lbw-scr-bar'; s.setAttribute('aria-hidden', 'true'); s.setAttribute('lang', cur.lang); s.textContent = '';
    var o = C.bar === false ? null : primary(w); if (!o) { s.hidden = true; return; }
    var sum = s.appendChild(el('span', 'lbw-scr-sum')), b = s.appendChild(LBW.ui.btn('', 'lbw-pill is-primary lbw-scr-go')), away = typeof root.IntersectionObserver !== 'function';
    b.tabIndex = -1;
    b.addEventListener('click', function () { if (o.isConnected && !o.disabled) o.click(); });
    function sync() {
      var job = w.getAttribute('data-lbw-job') || '', tot = w.querySelector('.kit-total strong, .kit-rtotal strong, .kit-cal-sum');
      b.textContent = o.textContent.trim();
      sum.textContent = tot ? tot.textContent.trim() : '';
      // shown once the action is ready (a not-ready CTA says what is missing in the card itself) and out of view
      s.hidden = !away || o.getAttribute('aria-disabled') === 'true' || !o.isConnected || o.disabled || o.classList.contains('is-sent') || w.classList.contains('is-finished') || /^(queued|sending|sent)$/.test(job) || !!o.closest('.is-folded, [hidden]');
    }
    mo = new MutationObserver(sync); mo.observe(w, { subtree: true, childList: true, attributes: true, characterData: true });
    if (!away) { io = new root.IntersectionObserver(function (es) { away = !es[es.length - 1].isIntersecting; sync(); }, { threshold: 0.9 }); io.observe(o); }
    sync();
  }

  // ── the public API ──────────────────────────────────────────────────────────────────────────────
  // LBW.screen.history(open): shows the earlier messages (true) or folds them again (false); → the state, or false off
  function history(v) {
    if (!on || !cur || C.history === 'keep') return false;
    open = !!v; H.layout(mode()); head();
    var ms = H.messages(), k = idx(ms, open ? cur.turn : cur.msg), r = H.rowOf(open ? ms[k - 1] : cur.turn);
    if (r && r.scrollIntoView) { try { r.scrollIntoView({ block: open ? 'nearest' : 'start' }); } catch (e) {} }
    return open;
  }
  // LBW.screen.state() → { step, index, of, widget, open, past } for the current screen, or null (off, or no screen yet)
  function state() {
    if (!on || !cur) return null;
    return { step: cur.step, index: stepAt(cur.step), of: STEPS.length, widget: cur.widget, open: open, past: cur.past };
  }
  LBW.screen = { start: start, state: state, history: history };
})(window);
