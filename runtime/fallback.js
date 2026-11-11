/* lbw fallback · for bots that load the library from a URL. Paste it inline in Custom JS, after the <script src>.
   If the library has not loaded after 4 s (the host is down, or the page's CSP blocked it), it removes every [[…]] tag
   from the bot's messages, so a visitor reads the text without widgets and never a raw tag. It draws nothing.
   window.LBW_FALLBACK_MS changes the wait. */
(function (w, d) {
  setTimeout(function () {
    if (w.LBW) return;
    var re = /`?\[\[[^\]]*\]\]`?|`?\[\[[^\]]*$/g;
    function clean() {
      [].forEach.call(d.querySelectorAll('[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]'), function (box) {
        if (box.textContent.indexOf('[[') < 0) return;
        var walker = d.createTreeWalker(box, 4), n;
        while ((n = walker.nextNode())) if (n.nodeValue.indexOf('[[') >= 0) n.nodeValue = n.nodeValue.replace(re, '').replace(/\s+$/, '');
      });
    }
    new MutationObserver(clean).observe(d.documentElement, { childList: true, subtree: true, characterData: true });
    clean();
  }, w.LBW_FALLBACK_MS || 4000);
})(window, document);
