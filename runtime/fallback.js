/* lbw fallback · paste it inline in Custom JS, after the <script src> and the setup script (npm run bot does).
   When the runtime is not READY (LBW.ready, v0.9.5) it removes every [[…]] tag from the bot's messages, so a visitor reads the
   text without widgets and never a raw tag. It draws nothing.
   - The library never loaded (the host is down, the page's CSP blocked it): at once. On a v4 page the blocking <script src>
     has already loaded or failed when this inline script runs, so there is nothing to wait for.
   - The library loaded but isn't ready (a config script that doesn't parse, so init() never ran): after window.LBW_FALLBACK_MS
     (1500 ms), the time the runtime gets to finish its first scan.
   A message left empty (it was only tags) is hidden, not left as an empty bubble. The class lbw-off on <html> ends the
   guard CSS's hiding of bot text. It stops as soon as the runtime is ready. */
(function (w, d) {
  var BOX = '[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]',
      MEDIA = 'img,svg,picture,video,audio,canvas,iframe,embed,object,input,select,textarea,button,a[href],hr',
      re = /`?\[\[[^\]]*\]\]`?|`?\[\[[^\]]*$/g, mo = null, on = false;
  function ready() { return !!(w.LBW && w.LBW.ready); }
  function clean() {
    if (ready()) { if (mo) mo.disconnect(); mo = null; return; }
    [].forEach.call(d.querySelectorAll(BOX), function (box) {
      if (box.textContent.indexOf('[[') < 0) return;
      var walker = d.createTreeWalker(box, 4), n;
      while ((n = walker.nextNode())) if (n.nodeValue.indexOf('[[') >= 0) n.nodeValue = n.nodeValue.replace(re, '').replace(/\s+$/, '');
      if (!box.textContent.trim() && !box.querySelector(MEDIA)) { var m = box.closest('[data-lb-part="message"]'); if (m) { m.style.display = 'none'; m.setAttribute('data-lbw-empty', '1'); } }
    });
  }
  function go() {
    if (on || ready()) return; on = true;
    mo = new MutationObserver(clean); mo.observe(d.documentElement, { childList: true, subtree: true, characterData: true });
    clean(); d.documentElement.classList.add('lbw-off');
  }
  if (ready()) return;
  if (!w.LBW) return go();
  var t0 = Date.now(), wait = w.LBW_FALLBACK_MS == null ? 1500 : w.LBW_FALLBACK_MS;
  (function poll() { if (ready()) return; if (Date.now() - t0 >= wait) return go(); setTimeout(poll, 100); })();
})(window, document);
