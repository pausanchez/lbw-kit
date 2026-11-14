/* lbw fallback · paste it inline in Custom JS, after the <script src> and the setup script (npm run bot does).
   When the runtime is not READY (LBW.ready, v0.9.5) it removes every [[…]] tag from the bot's messages, so a visitor reads the
   text without widgets and never a raw tag. It draws nothing.
   - The library never loaded (the host is down, the page's CSP blocked it): at once. On a v4 page the blocking <script src>
     has already loaded or failed when this inline script runs, so there is nothing to wait for.
   - The library loaded but isn't ready (a config script that doesn't parse, so init() never ran): after window.LBW_FALLBACK_MS
     (1500 ms), the time the runtime gets to finish its first scan.
   A message left empty (it was only tags) is hidden, not left as an empty bubble. The class lbw-off on <html> ends the
   guard CSS's hiding of bot text. It stops as soon as the runtime is ready.
   It finds the chat's messages by the selectors of runtime/host-v4.js (LBW_HOST.sel), whose first part dist/fallback.min.js
   carries with it. */
(function (w, d) {
  var S = w.LBW_HOST && w.LBW_HOST.sel,
      MEDIA = 'img,svg,picture,video,audio,canvas,iframe,embed,object,input,select,textarea,button,a[href],hr', mo = null, on = false;
  function ready() { return !!(w.LBW && w.LBW.ready); }
  // v0.9.5 · what /`?\[\[[^\]]*\]\]`?|`?\[\[[^\]]*$/g removed, found in one pass: the regex (and /\s+$/) went quadratic
  // on a long hostile message ('[[a' × 33,000 then ']x' took 3 s)
  function strip(s) {
    var out = '', from = 0, j = -1, c = -1, a, z;
    while ((j = s.indexOf('[[', j + 1)) >= 0) {
      if (j < from) continue;
      if (c !== -2 && c < j + 2) { c = s.indexOf(']', j + 2); if (c < 0) c = -2; }   // the first ']' after it
      a = j > from && s.charAt(j - 1) === '`' ? j - 1 : j;
      if (c === -2) return out + s.slice(from, a);
      if (s.charAt(c + 1) === ']') { z = s.charAt(c + 2) === '`' ? c + 3 : c + 2; out += s.slice(from, a); from = z; j = z - 1; }
    }
    return out + s.slice(from);
  }
  function clean() {
    if (ready()) { if (mo) mo.disconnect(); mo = null; return; }
    [].forEach.call(d.querySelectorAll(S.message + S.bot + ' ' + S.text), function (box) {
      if (box.textContent.indexOf('[[') < 0) return;
      var walker = d.createTreeWalker(box, 4), n, v, e;
      // written only when it changed: writing a text node wakes the observer, and a '[[' it can't remove ('[[a]x') looped
      while ((n = walker.nextNode())) if (n.nodeValue.indexOf('[[') >= 0) { v = strip(n.nodeValue); e = v.length; while (e && /\s/.test(v.charAt(e - 1))) e--; if (e !== n.nodeValue.length) n.nodeValue = v.slice(0, e); }
      if (!box.textContent.trim() && !box.querySelector(MEDIA)) { var m = box.closest(S.message); if (m && m.style.display !== 'none') { m.style.display = 'none'; m.setAttribute('data-lbw-empty', '1'); } }
    });
  }
  function go() {
    if (on || ready()) return; on = true;
    mo = new MutationObserver(clean); mo.observe(d.documentElement, { childList: true, subtree: true, characterData: true });
    clean(); d.documentElement.classList.add('lbw-off');
  }
  if (ready() || !S) return;
  if (!w.LBW) return go();
  var t0 = Date.now(), wait = w.LBW_FALLBACK_MS == null ? 1500 : w.LBW_FALLBACK_MS;
  (function poll() { if (ready()) return; if (Date.now() - t0 >= wait) return go(); setTimeout(poll, 100); })();
})(window, document);
