/* lbw fallback · for bots that load the library from a URL. Paste it inline in Custom JS, after the <script src>.
   If the library has not loaded after 4 s (the host is down, or the page's CSP blocked it), it removes every [[…]] tag
   from the bot's messages, so a visitor reads the text without widgets and never a raw tag. It draws nothing.
   window.LBW_FALLBACK_MS changes the wait. */
(function (w, d) {
  setTimeout(function () {
    if (w.LBW) return;
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
      [].forEach.call(d.querySelectorAll('[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]'), function (box) {
        if (box.textContent.indexOf('[[') < 0) return;
        var walker = d.createTreeWalker(box, 4), n, v, e;
        // written only when it changed: writing a text node wakes the observer, and a '[[' it can't remove ('[[a]x') looped
        while ((n = walker.nextNode())) if (n.nodeValue.indexOf('[[') >= 0) { v = strip(n.nodeValue); e = v.length; while (e && /\s/.test(v.charAt(e - 1))) e--; if (e !== n.nodeValue.length) n.nodeValue = v.slice(0, e); }
      });
    }
    new MutationObserver(clean).observe(d.documentElement, { childList: true, subtree: true, characterData: true });
    clean();
  }, w.LBW_FALLBACK_MS || 4000);
})(window, document);
