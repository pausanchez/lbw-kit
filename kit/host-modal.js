/* kit/host-modal.js v0.3 · the HOST PAGE side of a page-level modal (10 Nov 2026).
   Put it on the page that embeds the Landbot Livechat, after the embed script. It is NOT part of custom_js.

   Measured on the v4 Livechat (landbot-3.0.0.js, 10 Nov 2026): the chat iframe has NO src. It is an about:blank frame
   the embed writes into, so it is SAME-ORIGIN with this page (e.origin === location.origin), and a flow Code block runs
   in that frame's window, next to the widgets (not in this window).
   Senders: a widget or a Code block in the chat frame → window.parent.postMessage({ type: 'lbw:modal', kind: 'gallery', … }, '*')
   → arrives with e.source === the Livechat iframe's contentWindow. A script of this page may also post to itself
   (e.source === window). Anything else is ignored. Every photo URL must start with one of `photos` below, and text is set with textContent.

   LBWHostModal({ photos: ['https://cdn.client.example/'], chat: [location.origin] (the origins a chat frame may have; default this page's),
                  lang: { close: 'Fermer', prev: 'Précédente', next: 'Suivante' }, onOpen, onClose })
   The modal is a native <dialog> opened with showModal(): it sits in the top layer, above the Livechat's
   z-index 2147483000, traps focus, closes on Esc, and gives focus back to what had it (the chat iframe).
   The page behind it doesn't scroll (html overflow hidden while open). Events go to window.__lbwHostModal. */
(function (root) {
  'use strict';
  function LBWHostModal(o) {
    o = o || {}; var T = o.lang || {}, d = document, log = root.__lbwHostModal = root.__lbwHostModal || [];
    // v0.9.5 (security review) · each base ends in '/' like lbw.js's links ('https://cdn.client.example' alone also let
    // 'https://cdn.client.example.evil.com/' through) and needs a host; a path after it can't climb out with .., %2e%2e or //
    var bases = (o.photos || []).filter(function (p) { return typeof p === 'string'; }).map(function (p) { return /\/$/.test(p) ? p : p + '/'; })
      .filter(function (p) { return /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::\d{1,5})?\//i.test(p); });
    var ok = function (u) { return typeof u === 'string' && u.length <= 2048 && !/["'<>\s\\\u0000-\u001f\u007f]/.test(u) && bases.some(function (p) {
      return u.indexOf(p) === 0 && !/(^|\/)(\.|%2e){1,2}(\/|$)|\/\/|%2f|%5c/i.test(('/' + u.slice(p.length)).split(/[?#]/)[0]); }); };
    // the chat frame's origin: the Livechat's about:blank frame has this page's (measured, 10 Nov 2026). Required now: an
    // iframe that merely had "landbot" in its src (an ad, ?ref=landbot) could open the dialog
    var chatOrigins = o.chat || [root.location.origin];
    var dlg = d.createElement('dialog'); dlg.className = 'lbw-hm'; dlg.setAttribute('aria-label', '');
    dlg.innerHTML = '<div class="lbw-hm-top"><span class="lbw-hm-cap"></span><button type="button" class="lbw-hm-x">×</button></div>' +
      '<div class="lbw-hm-stage"><img alt=""></div><button type="button" class="lbw-hm-nav is-prev">‹</button><button type="button" class="lbw-hm-nav is-next">›</button>';
    d.body.appendChild(dlg);
    var cap = dlg.querySelector('.lbw-hm-cap'), img = dlg.querySelector('img'), x = dlg.querySelector('.lbw-hm-x'),
        prev = dlg.querySelector('.is-prev'), next = dlg.querySelector('.is-next'), cur = { photos: [], i: 0, title: '' }, back = null, htmlOv = '';
    x.setAttribute('aria-label', T.close || 'Close'); prev.setAttribute('aria-label', T.prev || 'Previous'); next.setAttribute('aria-label', T.next || 'Next');
    function show() { img.src = cur.photos[cur.i]; img.alt = cur.title; cap.textContent = (cur.title ? cur.title + ' · ' : '') + (cur.i + 1) + ' / ' + cur.photos.length;
      prev.disabled = cur.i === 0; next.disabled = cur.i === cur.photos.length - 1; prev.hidden = next.hidden = cur.photos.length < 2; }
    function open(m, from) {
      var photos = (m.photos || []).filter(ok).slice(0, 30); if (!photos.length) { log.push({ ev: 'refused', from: from, t: Date.now() }); return; }
      cur = { photos: photos, i: Math.max(0, Math.min(+m.start || 0, photos.length - 1)), title: String(m.title || '').slice(0, 120) };
      dlg.setAttribute('aria-label', cur.title); show(); back = d.activeElement;
      if (!dlg.open) { htmlOv = d.documentElement.style.overflow; d.documentElement.style.overflow = 'hidden'; dlg.showModal(); }
      x.focus(); log.push({ ev: 'open', from: from, n: photos.length, t: Date.now() }); if (o.onOpen) o.onOpen(cur, from);
    }
    dlg.addEventListener('close', function () { d.documentElement.style.overflow = htmlOv; log.push({ ev: 'close', t: Date.now(), focusBack: back && back.tagName });
      if (back && back.focus) try { back.focus(); } catch (e) {} if (o.onClose) o.onClose(); });
    x.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // the backdrop
    prev.addEventListener('click', function () { if (cur.i > 0) { cur.i--; show(); } });
    next.addEventListener('click', function () { if (cur.i < cur.photos.length - 1) { cur.i++; show(); } });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') prev.click(); if (e.key === 'ArrowRight') next.click();
      if (e.key === 'Tab') {   // a native modal <dialog> let 1 Tab in 4 out to <body>: keep it inside
        var f = [x, prev, next].filter(function (b) { return !b.disabled && !b.hidden; }), a = f.indexOf(d.activeElement);
        if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    root.addEventListener('message', function (e) {
      var m = e.data; if (!m || typeof m !== 'object' || m.type !== 'lbw:modal' || m.kind !== 'gallery') return;
      // the sender must BE a Landbot chat frame (in the embed's containers, or served by Landbot) and have a chat origin
      var frames = [].slice.call(d.querySelectorAll('.LandbotLivechat iframe, .LandbotPopup iframe, iframe[src]')).filter(function (f) {
        return f.closest('.LandbotLivechat, .LandbotPopup') || /^https:\/\/([a-z0-9-]+\.)*landbot\.(io|online)\//i.test(f.getAttribute('src') || ''); });
      var fromChat = !!e.source && frames.some(function (f) { return f.contentWindow === e.source; }) && chatOrigins.indexOf(e.origin) >= 0;
      var fromCode = e.source === root && e.origin === root.location.origin;
      if (!fromChat && !fromCode) { log.push({ ev: 'ignored', origin: e.origin, t: Date.now() }); return; }
      open(m, fromChat ? 'chat' : 'code');
    });
    return { open: function (m) { open(m, 'api'); }, close: function () { dlg.close(); }, el: dlg };
  }
  root.LBWHostModal = LBWHostModal;
})(window);
/* CSS for the host page (copy it into the page). `inset: 0; margin: auto` matter: a host CSS reset left the dialog at x = 0:
.lbw-hm { position: fixed; inset: 0; margin: auto; width: min(1100px, 100vw); height: min(820px, 100dvh); max-width: 100vw; max-height: 100dvh; padding: 0; border: 0; border-radius: 12px; background: #121416; color: #fff; overflow: hidden; }
.lbw-hm[open] { display: grid; grid-template-rows: auto 1fr; }
.lbw-hm::backdrop { background: rgba(0,0,0,.7); }
.lbw-hm-top { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px 18px; font: 14px/20px system-ui, sans-serif; }
.lbw-hm-cap { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lbw-hm-x, .lbw-hm-nav { width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; font-size: 26px; cursor: pointer; }
.lbw-hm-stage { min-height: 0; display: flex; align-items: center; justify-content: center; }
.lbw-hm-stage img { max-width: 100%; max-height: 100%; object-fit: contain; }
.lbw-hm-nav { position: absolute; top: 50%; transform: translateY(-50%); } .lbw-hm-nav.is-prev { left: 10px; } .lbw-hm-nav.is-next { right: 10px; }
.lbw-hm-nav:disabled { opacity: .3; }
@media (max-width: 480px) { .lbw-hm { border-radius: 0; width: 100vw; height: 100dvh; } }
*/
