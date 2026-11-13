/* AI Widgets kit v0.9.4.2 · on lbw.js v0.9.4.2 · the widgets every url-to-demo build rewrote, written once with options. Load it after lbw.js and before the
   client's widgets.js: custom_js = <script>lbw.js</script><script>kit.js</script><script>widgets.js</script>.

   Each maker registers a widget under the name you give it, from data you pass. Nothing here holds client facts.
     LBW.kit.cards(name, cfg)    one item from a table: a service, an area, an FAQ answer, a help topic   [[p:faq id=x]]
     LBW.kit.form(name, cfg)     a form that sends once: picks (one or many, steps that depend on others)  [[p:plan kind=x]]
                                 → a summary sentence + Landbot fields; kept in LBW.kit.last[name]
     LBW.kit.contact(name, cfg)  the handover: channels, open now in their time zone, the last form summary with Copy,
                                 and a compact redraw after the first full card                          [[p:contact]]
     LBW.kit.chips(name, cfg)    2–3 next questions, last; never what was just asked or what a card in the reply carries
     LBW.kit.carousel(name, cfg) 2–6 items as slides: photo, name, price, status, a quick reply, a link        [[p:products cat=x]]
     LBW.kit.calc(name, cfg)     a live result from steppers and picks (a total, a due date), sent once      [[p:sim amount=150]]
   v0.5, the lead-gen set (ChatKit's gallery, rebuilt our way): slots (book a time), confirm (the done card), review
     (a quote line by line, Confirm/Discard), chart (an SVG from your numbers), stats (trust numbers), people (who calls),
     consent (yes/no before data). See docs/19.
   Every kit widget draws nothing when the same widget is already in the message (the models' most repeated slip),
   unless cfg.allowDup. Every text the visitor sees comes from cfg or LBW.kit.L[lang]: add a language there, once.
   Helpers for your own widgets: LBW.kit.h (note, list, label, dup, choice, multiChoice, copyBox, status, wa, money, total;
   v0.8.1.4: statusHead, badge, icon, withIcon, icons, tones).
   v0.4: dev mode (?kitdev=1) checks cfg and the complexity budget; LBW.kit.describe(prefix) lists every kit tag and mock
   cases; a form or calc folds to one line after it sends (cfg.collapse: false keeps it open).
   Classes are kit-*, styled by kit.css from the --lbw-* tokens: theme it like lbw.css, never per demo. */
(function (root) {
  'use strict';
  var LBW = root.LBW; if (!LBW) return;
  var U = LBW.ui, el = U.el, D = LBW.day, T = LBW.time;

  // ── the visitor-facing words the kit owns (everything else comes from cfg) ─────────────────────────
  var L = {
    en: { copy: 'Copy', copied: 'Copied ✓', select: 'Select the text and copy it', summary: 'Your summary',
          open: 'Open now · until {t}', closed: 'Closed now · opens {d} at {t}', closedLong: 'Closed now', today: 'today', tomorrow: 'tomorrow',
          days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], localTime: 'Local time: {t}', sent: 'Sent', show: 'Show', hide: 'Hide', busy: 'Busy', pick: 'Pick a time', confirm: 'Confirm', yes: 'Yes', no: 'No',
          close: 'Close', prev: 'Previous photo', next: 'Next photo', photos: 'Photos', enlarge: 'Enlarge on the page', cSame: 'The same in all:', cSame2: 'The same in both:',
          sOpen: 'Open today', sClosed: 'Closed today', sUntil: 'Open until', sOpens: 'Opens', sIn: 'Opens in', sCloses: 'Season', sDay: '1 day', sDays: '{n} days', sUnknown: 'The next dates aren’t published yet.' , rateOf: '{n} of {max}', tMore: 'See all {n} rows', tLess: 'See fewer', tPick: 'Choose', tPicked: 'Chosen', tTotal: 'Total' },
    es: { copy: 'Copiar', copied: 'Copiado ✓', select: 'Selecciona el texto y cópialo', summary: 'Tu resumen',
          open: 'Abierto ahora · hasta las {t}', closed: 'Cerrado ahora · abre {d} a las {t}', closedLong: 'Cerrado ahora', today: 'hoy', tomorrow: 'mañana',
          days: ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'], localTime: 'Hora local: {t}', sent: 'Enviado', show: 'Ver', hide: 'Ocultar', busy: 'Ocupado', pick: 'Elige una hora', confirm: 'Confirmar', yes: 'Sí', no: 'No',
          close: 'Cerrar', prev: 'Foto anterior', next: 'Foto siguiente', photos: 'Fotos', enlarge: 'Ampliar en la página', cSame: 'Igual en todas:', cSame2: 'Igual en las dos:',
          sOpen: 'Abierto hoy', sClosed: 'Cerrado hoy', sUntil: 'Abierto hasta', sOpens: 'Abre', sIn: 'Abre en', sCloses: 'Temporada', sDay: '1 día', sDays: '{n} días', sUnknown: 'Las próximas fechas aún no están publicadas.' , rateOf: '{n} de {max}', tMore: 'Ver las {n} filas', tLess: 'Ver menos', tPick: 'Elegir', tPicked: 'Elegido', tTotal: 'Total' },
    it: { copy: 'Copia', copied: 'Copiato ✓', select: 'Seleziona il testo e copialo', summary: 'Il tuo riepilogo',
          open: 'Aperto ora · fino alle {t}', closed: 'Chiuso ora · apre {d} alle {t}', closedLong: 'Chiuso ora', today: 'oggi', tomorrow: 'domani',
          days: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'], localTime: 'Ora locale: {t}', sent: 'Inviato', show: 'Mostra', hide: 'Nascondi', busy: 'Occupato', pick: 'Scegli un orario', confirm: 'Conferma', yes: 'Sì', no: 'No',
          close: 'Chiudi', prev: 'Foto precedente', next: 'Foto successiva', photos: 'Foto', enlarge: 'Ingrandisci nella pagina', cSame: 'Uguale in tutte:', cSame2: 'Uguale in entrambe:',
          sOpen: 'Aperto oggi', sClosed: 'Chiuso oggi', sUntil: 'Aperto fino a', sOpens: 'Apre', sIn: 'Apre tra', sCloses: 'Stagione', sDay: '1 giorno', sDays: '{n} giorni', sUnknown: 'Le prossime date non sono ancora pubblicate.' , rateOf: '{n} su {max}', tMore: 'Vedi tutte le {n} righe', tLess: 'Vedi meno', tPick: 'Scegli', tPicked: 'Scelto', tTotal: 'Totale' },
    de: { copy: 'Kopieren', copied: 'Kopiert ✓', select: 'Text markieren und kopieren', summary: 'Deine Zusammenfassung',
          open: 'Jetzt geöffnet · bis {t} Uhr', closed: 'Jetzt geschlossen · öffnet {d} um {t} Uhr', closedLong: 'Jetzt geschlossen', today: 'heute', tomorrow: 'morgen',
          days: ['am Sonntag', 'am Montag', 'am Dienstag', 'am Mittwoch', 'am Donnerstag', 'am Freitag', 'am Samstag'], localTime: 'Ortszeit: {t}', sent: 'Gesendet', show: 'Anzeigen', hide: 'Ausblenden', busy: 'Belegt', pick: 'Uhrzeit wählen', confirm: 'Bestätigen', yes: 'Ja', no: 'Nein',
          close: 'Schließen', prev: 'Vorheriges Foto', next: 'Nächstes Foto', photos: 'Fotos', enlarge: 'Auf der Seite vergrößern', cSame: 'Bei allen gleich:', cSame2: 'Bei beiden gleich:',
          sOpen: 'Heute geöffnet', sClosed: 'Heute geschlossen', sUntil: 'Geöffnet bis', sOpens: 'Öffnet', sIn: 'Öffnet in', sCloses: 'Saison', sDay: '1 Tag', sDays: '{n} Tagen', sUnknown: 'Die nächsten Termine sind noch nicht veröffentlicht.' , rateOf: '{n} von {max}', tMore: 'Alle {n} Zeilen anzeigen', tLess: 'Weniger anzeigen', tPick: 'Wählen', tPicked: 'Gewählt', tTotal: 'Gesamt' },
    fr: { copy: 'Copier', copied: 'Copié ✓', select: 'Sélectionnez le texte et copiez-le', summary: 'Votre résumé',
          open: 'Ouvert · jusqu’à {t}', closed: 'Fermé · ouvre {d} à {t}', closedLong: 'Fermé', today: 'aujourd’hui', tomorrow: 'demain',
          days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], localTime: 'Heure locale : {t}', sent: 'Envoyé', show: 'Voir', hide: 'Masquer', busy: 'Occupé', pick: 'Choisissez une heure', confirm: 'Confirmer', yes: 'Oui', no: 'Non',
          close: 'Fermer', prev: 'Photo précédente', next: 'Photo suivante', photos: 'Photos', enlarge: 'Agrandir sur la page', cSame: 'Identique pour toutes :', cSame2: 'Identique pour les deux :',
          sOpen: 'Ouvert aujourd’hui', sClosed: 'Fermé aujourd’hui', sUntil: 'Ouvert jusqu’au', sOpens: 'Ouverture', sIn: 'Ouvre dans', sCloses: 'Saison', sDay: '1 jour', sDays: '{n} jours', sUnknown: 'Les prochaines dates ne sont pas encore publiées.' , rateOf: '{n} sur {max}', tMore: 'Voir les {n} lignes', tLess: 'Voir moins', tPick: 'Choisir', tPicked: 'Choisi', tTotal: 'Total' },
    ca: { copy: 'Copia', copied: 'Copiat ✓', select: 'Selecciona el text i copia’l', summary: 'El teu resum',
          open: 'Obert ara · fins a les {t}', closed: 'Tancat ara · obre {d} a les {t}', closedLong: 'Tancat ara', today: 'avui', tomorrow: 'demà',
          days: ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'], localTime: 'Hora local: {t}', sent: 'Enviat', show: 'Mostra', hide: 'Amaga', busy: 'Ocupat', pick: 'Tria una hora', confirm: 'Confirma', yes: 'Sí', no: 'No',
          close: 'Tanca', prev: 'Foto anterior', next: 'Foto següent', photos: 'Fotos', enlarge: 'Amplia a la pàgina', cSame: 'Igual a totes:', cSame2: 'Igual a les dues:',
          sOpen: 'Obert avui', sClosed: 'Tancat avui', sUntil: 'Obert fins al', sOpens: 'Obre', sIn: 'Obre d’aquí a', sCloses: 'Temporada', sDay: '1 dia', sDays: '{n} dies', sUnknown: 'Les properes dates encara no estan publicades.' , rateOf: '{n} de {max}', tMore: 'Veure les {n} files', tLess: 'Veure’n menys', tPick: 'Tria', tPicked: 'Triat', tTotal: 'Total' }
  };
  function words(lang) { return L[lang] || L.en; }
  function fill(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] == null ? '' : o[k]; }); }
  function langOf(cfg, ctx) { return cfg.lang || ctx.lang; }
  function val(v, a, b, c) { return typeof v === 'function' ? v(a, b, c) : v; }   // a cfg value or a function of (params, ctx, …)

  // ── dev mode (v0.4, from ChatKit's "invented props are silently ignored"): ?kitdev=1 or window.__kitDev = true ──────
  // Warns once per problem in console.warn and window.__kitWarnings: an unknown option in a maker's cfg (a typo), a missing
  // required one, a card or slide with no title or name, and text over the complexity budget (docs/05): titles 40, lines 100.
  var DEV = false; try { DEV = !!root.__kitDev || /[?&]kitdev=1(&|$)/.test((root.location && root.location.search) || ''); } catch (e) {}
  var BUDGET = { title: 40, line: 100 };
  function warn(where, msg) {
    if (!DEV) return; var m = where + ': ' + msg, ws = root.__kitWarnings = root.__kitWarnings || [];
    if (ws.indexOf(m) < 0) { ws.push(m); try { console.warn('[kit] ' + m); } catch (e) {} }
  }
  function budget(where, kind, t) { if (DEV && t != null && String(t).length > BUDGET[kind]) warn(where, kind + ' over ' + BUDGET[kind] + ' characters (' + String(t).length + '): "' + String(t).slice(0, 48) + '…"'); }
  var OPTS = {
    cards: 'cls param items kicker reply links disclaimer lang single fallback pointsCls allowDup status',
    table: 'cls param items kicker reply links fold pick same lang single fallback allowDup',
    form: 'cls lang kicker title cta note preset steps summary fields sent allowDup collapse',
    contact: 'cls lang kicker title big rows topic hours note buttons summary compact allowDup',
    chips: 'cls lang max items own carriedBy',
    carousel: 'cls lang select slide allowDup',
    calc: 'cls lang kicker title state cta controls result ready send notes links sent allowDup collapse',
    slots: 'cls lang kicker title days cta say ics note sep h12 allowDup collapse sent',
    confirm: 'cls lang form status title rows steps note actions allowDup',
    review: 'cls lang kicker title state lines total cta discard send ready note allowDup collapse sent',
    chart: 'cls lang kicker title sub data note links allowDup',
    stats: 'cls lang items single reply links allowDup',
    people: 'cls lang kicker title items select reply note allowDup',
    consent: 'cls lang icon title text yes no link allowDup',
    compare: 'cls lang kicker title param items rows min max empty note allowDup same primary',
    season: 'cls lang kicker ranges words rows note reply links allowDup',   // v0.8.1.4: missing since 0.8.1, so dev mode threw and the season card drew nothing
    rating: 'cls lang kicker title text kind min max labels say note allowDup'
  };
  function checkCfg(maker, name, cfg, required) {
    if (!DEV) return; var ok = OPTS[maker].split(' '), where = maker + "('" + name + "')";
    Object.keys(cfg).forEach(function (k) { if (ok.indexOf(k) < 0) warn(where, 'unknown option "' + k + '" (ignored). Known: ' + ok.join(', ')); });
    (required || []).forEach(function (k) { if (cfg[k] == null) warn(where, 'missing "' + k + '"'); });
  }
  // what every kit widget accepts, for the instructions and the mock (v0.4: the schema ChatKit keeps per widget, from the
  // makers' own cfg): LBW.kit.describe('dl') → { tags: ['[[dl:area id=concursal|laboral…]]  (cards)', …],
  // cases: [['area-concursal', '[[dl:area id=concursal]]'], …, ['area-attack', '[[dl:area id=<b>x]]']] } (build-mock.py's cases.json shape)
  var REG = [];
  function register(maker, name, param, keys) { REG = REG.filter(function (r) { return r.name !== name; }); REG.push({ maker: maker, name: name, param: param, keys: keys || null }); }
  function describe(prefix) {
    prefix = prefix || 'p'; var tags = [], cases = [];
    REG.forEach(function (r) {
      var t = '[[' + prefix + ':' + r.name;
      if (r.param && r.keys) { tags.push(t + ' ' + r.param + '=' + r.keys.join('|') + ']]  (' + r.maker + ')');
        r.keys.forEach(function (k) { cases.push([r.name + '-' + k, t + ' ' + r.param + '=' + k + ']]']); });
        cases.push([r.name + '-attack', t + ' ' + r.param + '=<b>x]]']); }
      else { tags.push(t + ']]  (' + r.maker + (r.param ? ', params read in ' + r.param : '') + ')'); cases.push([r.name, t + ']]']); }
    });
    return { tags: tags, cases: cases };
  }
  // fold a form or calc to one line once it has sent (v0.4, ChatKit's `collapsed`): "Sent · <the sentence> · Show".
  // The rest stays in the card; Show/Hide toggles it. cfg.collapse: false keeps it open.
  function fold(o, text, lang, extras) {
    var w = words(lang), line = el('div', 'kit-sentline'), t = U.btn(w.show, 'kit-sent-toggle');
    line.appendChild(el('span', 'kit-sent-l', w.sent)); line.appendChild(el('span', 'kit-sent-t', text));
    (extras || []).forEach(function (x) { if (x) line.appendChild(x); });
    t.setAttribute('aria-expanded', 'false'); line.appendChild(t);
    t.addEventListener('click', function () { var c = o.classList.toggle('is-collapsed'); t.setAttribute('aria-expanded', c ? 'false' : 'true'); t.textContent = c ? w.show : w.hide; });
    o.box.insertBefore(line, o.box.firstChild); o.classList.add('is-collapsed');
  }

  // ── helpers (also for the client's own widgets) ─────────────────────────────────────────────────
  function note(box, t, cls) { if (!t) return null; var p = el('p', 'kit-note' + (cls ? ' ' + cls : ''), t); box.appendChild(p); return p; }
  function list(box, items, cls) {   // cls: 'is-check' | 'is-dot' | 'is-steps' (numbered)
    if (!items || !items.length) return null;
    var l = el(cls === 'is-steps' ? 'ol' : 'ul', 'kit-facts' + (cls ? ' ' + cls : '')); items.forEach(function (t) { l.appendChild(el('li', null, t)); }); box.appendChild(l); return l;
  }
  function label(arr, k) { for (var i = 0; i < (arr || []).length; i++) if (arr[i][0] === k) return arr[i][1]; return ''; }
  function dup(ctx, cls) { return (ctx.others || []).some(function (w) { return w.classList.contains(cls); }); }
  // v0.8.1.10 · an option may say what it means under its label: [key, label, desc] in a form, { label, say, desc } in
  // chips. A group with one such option becomes a list (one per row, label then a muted line); the others stay as they are.
  function described(b, label, desc) {
    if (!desc) return b;
    b.textContent = ''; b.appendChild(el('span', 'kit-opt-l', label)); b.appendChild(el('span', 'kit-opt-d', desc)); b.classList.add('has-desc');
    return b;
  }
  function listy(g, items, at) { if (items.some(function (it) { return !!at(it); })) g.classList.add('is-list'); return g; }
  function choice(title, items, cur, pick) {   // one of [[key, label], …]; returns the block
    var w = el('div', 'kit-q'); if (title) w.appendChild(el('p', 'kit-ql', title)); var g = listy(el('div', 'lbw-chips'), items, function (it) { return it[2]; });
    items.forEach(function (it) {
      var b = described(U.btn(it[1], 'lbw-tog'), it[1], it[2]); b.setAttribute('data-k', it[0]); b.setAttribute('aria-pressed', it[0] === cur ? 'true' : 'false');
      b.addEventListener('click', function () { if (b.closest('.is-done')) return; [].forEach.call(g.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); pick(it[0]); });
      g.appendChild(b);
    });
    w.appendChild(g); return w;
  }
  function multiChoice(title, items, cur, pick, none) {   // any of them; the `none` key clears the rest and the rest clear it
    var w = el('div', 'kit-q'); if (title) w.appendChild(el('p', 'kit-ql', title)); var g = listy(el('div', 'lbw-chips'), items, function (it) { return it[2]; }); cur = cur || [];
    function keys() { return [].filter.call(g.children, function (x) { return x.getAttribute('aria-pressed') === 'true'; }).map(function (x) { return x.getAttribute('data-k'); }); }
    items.forEach(function (it) {
      var b = described(U.btn(it[1], 'lbw-tog'), it[1], it[2]); b.setAttribute('data-k', it[0]); b.setAttribute('aria-pressed', cur.indexOf(it[0]) >= 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (b.closest('.is-done')) return;
        var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on && none) [].forEach.call(g.children, function (x) { if (x !== b && (it[0] === none || x.getAttribute('data-k') === none)) x.setAttribute('aria-pressed', 'false'); });
        pick(keys());
      });
      g.appendChild(b);
    });
    w.appendChild(g); return w;
  }
  // a read-only box with the text + a Copy button that always ends in a message: clipboard → execCommand → "select it"
  // (a summary in a textarea isn't textContent: battery.js reads form values)
  function copyBox(box, text, lang, o) {
    o = o || {}; var w = words(lang);
    var ta = el('textarea', 'kit-copytext'); ta.value = text; ta.readOnly = true; ta.rows = o.rows || 3; ta.tabIndex = -1; ta.setAttribute('aria-label', o.aria || w.summary); box.appendChild(ta);
    var btn = U.btn(o.copy || w.copy, 'lbw-pill'), msg = el('span', 'kit-copymsg'); msg.setAttribute('aria-live', 'polite');
    var fb = function () { ta.focus(); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} msg.textContent = ok ? w.copied : w.select; };
    btn.addEventListener('click', function () { try { if (navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(text).then(function () { msg.textContent = w.copied; }, fb); else fb(); } catch (e) { fb(); } });
    return { ta: ta, btn: btn, msg: msg };
  }
  // open now, from a week of ranges in minutes: week[0..6] (0 = Sunday) = [[540, 1110], …]; holiday(n) → true closes a day.
  // The time zone is LBW.init's timeZone. → { open, text, node }
  function status(hours, lang) {
    var w = words(lang), n = D.today(), m = T.now(), sep = hours.sep, f = { h12: hours.h12 };
    var of = function (d) { return hours.holiday && hours.holiday(d) ? [] : (hours.week[D.parts(d).w] || []); }, s = T.state(of(n), m), text;
    if (s.open) text = fill(hours.open || w.open, { t: T.format(s.until, sep, f) });
    else { var nx = T.nextOpen(of, n, m, 7); text = nx ? fill(hours.closed || w.closed, { d: nx.n === n ? w.today : nx.n === n + 1 ? w.tomorrow : w.days[D.parts(nx.n).w], t: T.format(nx.m, sep, f) }) : w.closedLong; }
    // v0.8.1.4 · the status line every card uses (statusHead): ✓ open, ⓘ closed. It was a green dot of its own (critique M9:
    // two patterns for one idea, and the state told by colour alone). .kit-status stays on it for themes that styled it.
    var node = statusLine({ text: text, tone: s.open ? 'ok' : 'info' }, 'kit-status' + (s.open ? ' is-open' : ''));
    return { open: s.open, text: text, node: node, now: T.format(m, sep, f) };
  }
  // ── v0.8.1.4 · icons, badges and one status pattern (ideas from ChatKit's Icon and Badge, Chat SDK's emoji and danger
  // style, Persona's status badge; drawn our way: inline SVG built with createElementNS, no markup string, no font) ──
  // 24×24 strokes in currentColor, so an icon takes the colour of the text or button it sits in. Decorative only:
  // aria-hidden, the label beside it says what it means.
  var CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z';
  var ICONS = {
    check: ['M5 12.5l4.5 4.5L19 7.5'], x: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'], info: [CIRCLE, 'M12 11v5', 'M12 7.6v.01'], alert: ['M12 3.5L2.5 20h19z', 'M12 10v4.5', 'M12 17.4v.01'],
    phone: ['M5 4h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6 6l1.5-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z'],
    mail: ['M3.5 6h17v12h-17z', 'M3.5 7l8.5 6.5L20.5 7'], chat: ['M4 5h16v11H9l-5 4z'], calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3.5v4', 'M16 3.5v4'],
    clock: [CIRCLE, 'M12 7.5V12l3 2'], pin: ['M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z', 'M12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4z'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5.5H4.5V6H10'], star: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z'],
    user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'], shield: ['M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z'],
    bell: ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20.5a2 2 0 0 0 4 0'], doc: ['M6 3.5h8l4 4v13H6z', 'M14 3.5v4h4', 'M9 12.5h6', 'M9 16h6'],
    thumb: ['M7.5 10.5v9.5h-3.5v-9.5z', 'M7.5 10.5l3.6-6.5c1.5 0 2.6 1.1 2.3 2.6l-.7 3.4h5.1a2 2 0 0 1 2 2.4l-1.3 5.9a2 2 0 0 1-2 1.7h-9']   // v0.8.1.6 (down: the same, turned)
  };
  // bare marks for inside a filled circle (a status line): an outlined info or alert icon there read as a blob at 12 px
  var MARKS = { i: ['M12 10.5v6', 'M12 7.2v.01'], bang: ['M12 6.5v7', 'M12 17v.01'] };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function icon(name, cls) {
    var paths = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : Object.prototype.hasOwnProperty.call(MARKS, name) ? MARKS[name] : null;
    if (!paths) { warn('icon', 'unknown icon "' + name + '". Known: ' + Object.keys(ICONS).join(', ')); return null; }
    var s = el('span', 'kit-ico' + (cls ? ' ' + cls : '')), g = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('aria-hidden', 'true'); g.setAttribute('viewBox', '0 0 24 24'); g.setAttribute('focusable', 'false');
    paths.forEach(function (d) { var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); g.appendChild(p); });
    s.appendChild(g); return s;
  }
  function withIcon(node, name) { var i = node && name ? icon(name) : null; if (i) { node.insertBefore(i, node.firstChild); node.classList.add('has-ico'); } return node; }
  // tones: the same five words everywhere (a badge, a status line, a slide's status). Unknown → neutral (a badge) or ok.
  var TONES = ['neutral', 'ok', 'info', 'warn', 'danger'];
  function tone(t, dflt) { return TONES.indexOf(t) >= 0 ? t : dflt; }
  // a small label in a tone: badge('New', 'info') → <span class="kit-tag is-info">New</span>. Text only; colour is never the
  // only signal (the words say it).
  function badge(text, t) { if (!text) return null; return el('span', 'kit-tag is-' + tone(t, 'neutral'), text); }
  // { text, tone } | 'text' → a badge, for JSON items
  function badgeOf(b) { return !b ? null : typeof b === 'string' ? badge(b) : badge(b.text, b.tone); }
  // a WhatsApp link with prefilled text ('…' is encoded: lbw refuses a ' anywhere in a URL)
  function wa(labelText, phone, text, cls) { return U.link(labelText, 'https://wa.me/' + String(phone).replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text).replace(/'/g, '%27') : ''), cls); }
  function buttons(list) { return (list || []).filter(Boolean); }

  // ── cards: one item from a table ────────────────────────────────────────────────────────────────
  // cfg = { cls, param: 'id', items: { id: item }, kicker, reply(id, item, ctx) → [label, say] | null, links(id, item, ctx) → [el…],
  //         disclaimer, lang, single: true (no id: draws items._),
  //         fallback: 'id' (v0.3: an UNSET id, a flow's @{field}, draws that item instead of nothing; an unknown id still draws nothing) }
  // item = { kicker, title, who, line, points: [], pointsCls: 'is-check', rows: [[label, value]], note, noteCls, link: [label, url] }
  function cards(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), param = cfg.param || 'id', ids = Object.keys(cfg.items || {});
    checkCfg('cards', name, cfg, ['items']);
    if (DEV) ids.forEach(function (id) { var it = cfg.items[id], wh = "cards('" + name + "') " + id;
      if (!it || !it.title) warn(wh, 'no title'); else budget(wh, 'title', it.title);
      budget(wh, 'line', it.line); budget(wh, 'line', it.who); budget(wh, 'line', it.note); (it.points || []).forEach(function (x) { budget(wh, 'line', x); }); });
    register('cards', name, cfg.single ? null : param, cfg.single ? null : ids);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var id = cfg.single ? '_' : p.one(param, ids);
      if (!id && cfg.fallback && !p.has(param) && cfg.items[cfg.fallback]) id = cfg.fallback;   // unset only (a flow's @{field}); an unknown id still draws nothing
      if (!id || !cfg.items[id]) return null;
      var it = cfg.items[id], lang = langOf(cfg, ctx), o = U.card(lang, 'kit-card ' + cls);
      // v0.8.1.4 · a status line under the head: the item's own, or one the tag names from a closed list
      // (cfg.status = { param: 'estado', items: { key: { text, tone } } }: a flow message writes [[p:card id=x estado=@{estado}]];
      // an unset field or an unknown key draws the item's own status, or none)
      var sk = cfg.status && cfg.status.param ? p.one(cfg.status.param, Object.keys(cfg.status.items || {})) : null;
      U.head(o.box, it.kicker || val(cfg.kicker, id, it) || '', it.title, badgeOf(it.badge));
      statusHead(o.box, sk ? cfg.status.items[sk] : it.status);   // under the title, as on every card (v0.8.1.4 critique)
      if (it.who) o.box.appendChild(el('p', 'kit-who', it.who));
      if (it.line) o.box.appendChild(el('p', 'kit-line', it.line));
      if (it.rows) U.rows(o.box, it.rows).classList.add('kit-lines');
      if (it.pointsTitle) o.box.appendChild(el('p', 'kit-ql', it.pointsTitle));
      list(o.box, it.points, it.pointsCls || cfg.pointsCls);
      note(o.box, it.note, it.noteCls || 'is-safe');
      note(o.box, cfg.disclaimer, 'is-muted');
      // v0.8.1.5 · the status key (sk) reaches reply and links: a card that says "ready to collect" offers to collect, not to book
      var acts = [], r = cfg.reply && cfg.reply(id, it, ctx, sk);
      if (r) { var g = U.once('kit-actions'); g.appendChild(U.reply(r[0], r[1], { primary: true, fields: r[2] })); acts.push(g); }
      if (it.link) acts.push(U.link(it.link[0], it.link[1]));
      acts = acts.concat(buttons(cfg.links && cfg.links(id, it, ctx, sk)));
      if (acts.length) U.row(o, acts);
      return o;
    });
  }

  // ── table: a price list, a timetable, opening hours by season (v0.8.1.10) ─────────────────────────
  // cfg = { cls, lang, param: 'id', items: { id: table }, kicker, fold: 8, single, fallback, allowDup,
  //         reply(id, t, ctx) → [label, say, fields] | null, links(id, t, ctx) → [el…],
  //         pick: { say(row, id) → text, fields(row, id) → {…}, label } (each row becomes a button that sends and saves) }
  // table = { kicker, title, cols: [[key, label, align]], rows: [[value, …]], note, source, link: [label, url] }
  // align: 'start' (default) or 'end' (numbers: right, tabular). Real <table> markup; columns squeeze first (the first one
  // wraps), and only what still doesn't fit scrolls inside the card, the first column held. Rows past `fold` wait behind one button.
  function table(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), param = cfg.param || 'id', ids = Object.keys(cfg.items || {}), fold = cfg.fold == null ? 8 : cfg.fold;
    checkCfg('table', name, cfg, ['items']);
    if (DEV) ids.forEach(function (id) { var t = cfg.items[id], wh = "table('" + name + "') " + id;
      if (!t || !t.title) warn(wh, 'no title'); else budget(wh, 'title', t.title);
      if (t && t.cols && t.cols.length > 4) warn(wh, t.cols.length + ' columns: the first column wraps or the table scrolls; check it at 375 px');
      (t && t.rows || []).forEach(function (r, i) { if (t.cols && r.length !== t.cols.length) warn(wh, 'row ' + i + ' has ' + r.length + ' values for ' + t.cols.length + ' columns'); }); });
    register('table', name, cfg.single ? null : param, cfg.single ? null : ids);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var id = cfg.single ? '_' : p.one(param, ids);
      if (!id && cfg.fallback && !p.has(param) && cfg.items[cfg.fallback]) id = cfg.fallback;
      if (!id || !cfg.items[id]) return null;
      var t = cfg.items[id], cols = t.cols || [], rows = t.rows || [], lang = langOf(cfg, ctx), w = words(lang), o = U.card(lang, 'kit-table ' + cls);
      U.head(o.box, t.kicker || val(cfg.kicker, id, t) || '', t.title);
      var wrap = el('div', 'kit-tbl-wrap'), tb = el('table', 'kit-tbl' + (cfg.pick ? ' is-pick' : '')), head = el('thead'), hr = el('tr'), body = el('tbody');
      // a keyboard stop and a region only when it scrolls (critique 0.8.1.11: an empty tab stop otherwise)
      var scrolls = function () { var on = wrap.scrollWidth > wrap.clientWidth + 1; if (on) { wrap.setAttribute('tabindex', '0'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', t.title || ''); } else { wrap.removeAttribute('tabindex'); wrap.removeAttribute('role'); wrap.removeAttribute('aria-label'); } };
      if (root.ResizeObserver) new root.ResizeObserver(scrolls).observe(wrap); else setTimeout(scrolls, 0);
      var cap = el('caption', 'kit-sr', t.title || ''); tb.appendChild(cap);
      // v0.8.1.13 · a column with no value in any row is left out (Callan: the online timetable's empty "Rate"); pick still reads it
      var shown = cols.map(function (c, j) { return rows.some(function (r) { return r[j] != null && String(r[j]).trim() !== ''; }); });
      // v0.8.1.14 · a column that says the same in every row (3 rows or more, not the first) leaves the table for one line
      // above it, "Días: L/X o M/J" (Callan: the days on every timetable row squeezed the times into two lines)
      var same = [];
      if (rows.length >= 3 && cfg.same !== false) cols.forEach(function (c, j) { if (!j || !shown[j]) return; var v = rows[0][j] == null ? '' : String(rows[0][j]); if (v.trim() && rows.every(function (r) { return String(r[j] == null ? '' : r[j]) === v; }) && shown.filter(Boolean).length > 2) { same.push(c[1] + ': ' + v); shown[j] = false; } });
      cols.forEach(function (c, j) { if (!shown[j]) return; var th = el('th', c[2] === 'end' ? 'is-end' : '', c[1]); th.setAttribute('scope', 'col'); hr.appendChild(th); });
      if (cfg.pick) { var thp = el('th', 'kit-tbl-act', ''); thp.appendChild(el('span', 'kit-sr', cfg.pick.label || w.tPick)); hr.appendChild(thp); }
      head.appendChild(hr); tb.appendChild(head); tb.appendChild(body);
      var g = cfg.pick ? U.once('kit-tbl-once') : null, more = null;
      rows.forEach(function (r, i) {
        var tr = el('tr', i >= fold && rows.length > fold + 1 ? 'is-folded' : '');
        var first = true; cols.forEach(function (c, j) { if (!shown[j]) return; var td = el(first ? 'th' : 'td', c[2] === 'end' ? 'is-end' : '', r[j] == null ? '' : String(r[j])); if (first) td.setAttribute('scope', 'row'); first = false; tr.appendChild(td); });
        if (cfg.pick) {
          var row = {}; cols.forEach(function (c, j) { row[c[0]] = r[j] == null ? '' : String(r[j]); });
          var say = cfg.pick.say(row, id); var td2 = el('td', 'kit-tbl-act');
          // the verb on a bordered button, not a bare ›: in a chat › reads as "open details" (critique 0.8.1.11). Its label
          // names the whole row ("Elegir: Hora 12:00, Plazas 4, Precio 14 €"); once sent it says it was chosen.
          var whole = cols.filter(function (c, j) { return shown[j]; }).map(function (c) { var j = cols.indexOf(c); return c[1] + ' ' + (r[j] == null ? '' : r[j]); }).join(', ');
          if (say) { var b = U.reply(cfg.pick.label || w.tPick, say, { fields: cfg.pick.fields ? cfg.pick.fields(row, id) : undefined, cls: 'kit-tbl-b', onSent: function (x) {
              var t2 = x.closest('tr'); if (t2) t2.classList.add('is-picked');
              x.textContent = ''; x.setAttribute('aria-label', w.tPicked + ': ' + x.getAttribute('data-row'));   /* v0.8.1.14: only the ✓ (CSS) — a wider "✓ Elegido" overflowed the table and the held first column covered the next one (Callan live) */ x.setAttribute('aria-pressed', 'true');
              tb.classList.add('is-open'); if (more) more.hidden = true;   // the chosen row never folds away, and nothing is left to unfold
            } });
            b.setAttribute('data-row', whole); b.setAttribute('aria-label', (cfg.pick.label || w.tPick) + ': ' + whole); td2.appendChild(b); }
          tr.appendChild(td2);
        }
        body.appendChild(tr);
      });
      wrap.appendChild(tb);
      if (same.length) o.box.appendChild(el('p', 'kit-tbl-same', same.join(' · ')));
      if (g) { g.appendChild(wrap); o.box.appendChild(g); } else o.box.appendChild(wrap);
      var hidden = rows.length > fold + 1 ? rows.length - fold : 0;   // never fold a single row: showing it costs what the button costs
      if (hidden) {
        more = U.btn(fill(w.tMore, { n: rows.length }), 'kit-tbl-more'); more.setAttribute('aria-expanded', 'false');
        more.addEventListener('click', function () { var open = tb.classList.toggle('is-open'); more.setAttribute('aria-expanded', open ? 'true' : 'false'); more.textContent = open ? w.tLess : fill(w.tMore, { n: rows.length }); });
        o.box.appendChild(more);
      }
      note(o.box, t.note, 'is-muted');
      if (t.source) o.box.appendChild(el('p', 'kit-stat-src', t.source));
      var acts = [], rr = cfg.reply && cfg.reply(id, t, ctx);
      if (rr) { var ga = U.once('kit-actions'); ga.appendChild(U.reply(rr[0], rr[1], { primary: true, fields: rr[2] })); acts.push(ga); }
      if (t.link) acts.push(U.link(t.link[0], t.link[1]));
      acts = acts.concat(buttons(cfg.links && cfg.links(id, t, ctx)));
      if (acts.length) U.row(o, acts);
      return o;
    });
  }

  // ── form: picks that send once ──────────────────────────────────────────────────────────────────
  // cfg = { cls, lang, kicker, title, cta, note, preset: { param: 'tema', step: 't' },
  //         steps: [{ key, title, items: [[k, label]] | function (state) → items, multi: true, none: 'none', ask: 'CTA text while missing', optional: true }],
  //         summary(state) → the sentence the visitor sends, fields(state) → { landbot_field: value }, sent(state) }
  // A step whose items is a function is redrawn (and reset) when an earlier answer changes. The last summary is kept in
  // LBW.kit.last[name] = { state, text } for the widget that answers it (contact's summary, or your own).
  var last = {};
  function form(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('form', name, cfg, ['steps', 'summary', 'cta']); budget("form('" + name + "')", 'title', cfg.title);
    (cfg.steps || []).forEach(function (st, i) { if (!st.key) warn("form('" + name + "') step " + i, 'no key'); if (!st.items) warn("form('" + name + "') step " + (st.key || i), 'no items'); });
    var pre = cfg.preset && (cfg.steps || []).filter(function (s) { return s.key === cfg.preset.step; })[0];
    register('form', name, cfg.preset ? cfg.preset.param : null, pre && Array.isArray(pre.items) ? pre.items.map(function (x) { return x[0]; }) : null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-formcard ' + cls), state = {}, pend = null;
      cfg.steps.forEach(function (s) { state[s.key] = s.multi ? [] : null; });
      if (cfg.preset) { var first = cfg.steps.filter(function (s) { return s.key === cfg.preset.step; })[0]; if (first) state[first.key] = p.one(cfg.preset.param, (val(first.items, state) || []).map(function (x) { return x[0]; })); }
      var f = U.form('kit-form', {
        state: state, cta: cfg.cta,
        ready: function (s) {
          for (var i = 0; i < cfg.steps.length; i++) { var st = cfg.steps[i], v = s[st.key]; if (!st.optional && (v == null || (st.multi && !v.length))) return st.ask || st.title || cfg.cta; }
          return true;
        },
        send: function (s) {
          var copy = JSON.parse(JSON.stringify(s)), text = cfg.summary(copy);
          pend = { state: copy, text: text };
          return [text, cfg.fields ? cfg.fields(copy) : {}];
        },
        sent: function (s) { if (pend) last[name] = pend; if (cfg.collapse !== false && pend) fold(o, pend.text, lang); if (cfg.sent) cfg.sent(s); }
      });
      if (cfg.title) U.head(o.box, cfg.kicker || '', cfg.title);
      o.box.appendChild(f.el);
      var slots = cfg.steps.map(function () { return f.add(el('div', 'kit-step')); });   // was 'kit-slot', the time button's class: every form step drew as a bordered box (v0.8.1)
      function draw(i) {
        var st = cfg.steps[i], slot = slots[i]; slot.textContent = '';
        var items = val(st.items, f.state); if (!items || !items.length) return;
        var pick = function (v) {
          var changed = JSON.stringify(f.state[st.key]) !== JSON.stringify(v); f.state[st.key] = v;
          if (changed) for (var j = i + 1; j < cfg.steps.length; j++) if (typeof cfg.steps[j].items === 'function') { f.state[cfg.steps[j].key] = cfg.steps[j].multi ? [] : null; draw(j); }
          f.update();
        };
        slot.appendChild(st.multi ? multiChoice(st.title, items, f.state[st.key], pick, st.none) : choice(st.title, items, f.state[st.key], pick));
        f.el.classList.toggle('has-list', !!f.el.querySelector('.lbw-chips.is-list'));   // v0.8.1.10: the plain steps then draw as a grid that matches
      }
      cfg.steps.forEach(function (s, i) { draw(i); });
      note(o.box, cfg.note, 'is-safe');
      return o;
    });
  }

  // ── contact: the handover ───────────────────────────────────────────────────────────────────────
  // cfg = { cls, lang, kicker, title: string | fn(p, ctx, topic), big, rows: [[label, value]] | fn(p, ctx, topic),
  //         topic: { param: 'tema', keys: [...] }   (a topic the tag or the last form names, passed to every fn),
  //         hours: { week, holiday, sep, h12, open, closed, showNow: true }, note, buttons: fn(p, ctx, topic, summary) → [el…],
  //         summary: { form: 'consulta', match(topic, last) → bool, text(last) → string, actions(text, topic, last) → [el…], flag(last) → string },
  //         compact: { label, buttons: fn(p, ctx, topic) → [el…], ask: /number|phone|…/i,
  //                    unless: fn(p, ctx, topic) → true draws the full card anyway (v0.3: a contact for one listing) } }
  function contact(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('contact', name, cfg, ['title']); if (typeof cfg.title === 'string') budget("contact('" + name + "')", 'title', cfg.title);
    if (cfg.compact && !cfg.compact.buttons) warn("contact('" + name + "')", 'compact has no buttons');
    register('contact', name, cfg.topic ? cfg.topic.param : null, cfg.topic ? cfg.topic.keys : null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var lang = langOf(cfg, ctx), sm = cfg.summary, ls = sm && last[sm.form];
      var topic = cfg.topic ? (p.one(cfg.topic.param, cfg.topic.keys) || (ls && sm.topicOf ? sm.topicOf(ls) : '') || '') : '';
      // a redraw after the first full card is one compact row (measured: 48 of 103 simulated turns redrew the full
      // card), unless the visitor asked for the channels again or this message already holds a full one
      // A summary not shown yet always gets the full card (kit example: the plan was sent, and the next contact came compact).
      var full = document.querySelector('.' + cls + ':not(.is-compact)'), pending = ls && !ls.shown && (!sm.match || sm.match(topic, ls));
      if (cfg.compact && full && !pending && !(cfg.compact.unless && cfg.compact.unless(p, ctx, topic)) && !(cfg.compact.ask || /(^|[^a-z\u00c0-\u024f])(number|phone|call|whatsapp|address|email|hours|open|where|contact|teléfono|telefono|dirección|horario|correo|llamar|téléphone|numéro|adresse|horaires|appeler|joindre|agence|indirizzo|orari|chiamare|telefon|anrufen|erreichen|telèfon|adreça|horari|horaris|trucar|correu)(?![a-z\u00c0-\u024f])/i).test(ctx.prev || '')) {
        var c = U.card(lang, 'kit-contact ' + cls + ' is-compact'); c.box.appendChild(el('span', 'kit-compact', cfg.compact.label));
        U.row(c.box, buttons(cfg.compact.buttons(p, ctx, topic))); return c;
      }
      var o = U.card(lang, 'kit-contact ' + cls);
      U.head(o.box, cfg.kicker || '', val(cfg.title, p, ctx, topic));
      var withSummary = ls && (!sm.match || sm.match(topic, ls));
      if (withSummary) {
        ls.shown = true;
        var text = sm.text ? sm.text(ls) : ls.text, cb = copyBox(o.box, text, lang, { rows: sm.rows, copy: sm.copy });
        U.row(o.box, buttons((sm.actions ? sm.actions(text, topic, ls) : []).concat([cb.btn, cb.msg])));
        if (sm.flag) note(o.box, sm.flag(ls), 'is-flag');
      }
      if (cfg.hours) { var st = status(cfg.hours, lang); o.box.appendChild(st.node); if (cfg.hours.showNow !== false) note(o.box, fill(words(lang).localTime, { t: st.now }), 'is-muted'); }
      if (cfg.big) o.box.appendChild(el('p', 'kit-big', /^[+\d][\d\s().\-]{6,22}$/.test(cfg.big) ? cfg.big.replace(/ /g, '\u00a0') : cfg.big));   // a phone: no-break spaces
      var rows = val(cfg.rows, p, ctx, topic); if (rows && rows.length) U.rows(o.box, rows).classList.add('kit-lines');
      note(o.box, val(cfg.note, p, ctx, topic), 'is-muted');
      var bs = buttons(cfg.buttons && cfg.buttons(p, ctx, topic, withSummary)); if (bs.length) U.row(o, bs);
      return o;
    });
  }

  // ── season: open or closed today, by date ranges (v0.8.1; two demos wrote it by hand) ───────
  // cfg = { cls, lang, kicker, ranges: [['19/3/2027', '1/11/2027'], …] (D/M/YYYY, first and last open day),
  //         words: { open, closed, until, opens, in, closes, unknown, day, days ('{n} days') } (the kit's own by language when left out),
  //         rows: [[label, value]] (extra, under the dates), note, reply: [label, say], links: [el…] | fn(ctx) }
  // The config needs timeZone: "today" is the client's day. An unreadable range is left out and logged.
  function season(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), D = LBW.day;
    checkCfg('season', name, cfg, ['ranges']); register('season', name, null, null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var lang = langOf(cfg, ctx), W = words(lang), cw = cfg.words || {}, n = D.today(), cur = null, next = null;
      var rs = (cfg.ranges || []).map(function (x) { var a = D.read(x[0]), b = D.read(x[1]); if (a == null || b == null || b < a) { warn("season('" + name + "')", 'a range is not [D/M/YYYY, D/M/YYYY]'); return null; } return [a, b]; }).filter(Boolean).sort(function (x, y) { return x[0] - y[0]; })
        .reduce(function (acc, x) { var l = acc[acc.length - 1]; if (l && x[0] <= l[1] + 1) l[1] = Math.max(l[1], x[1]); else acc.push(x.slice()); return acc; }, []);   // ranges that overlap or touch are one season
      rs.forEach(function (x) { if (n >= x[0] && n <= x[1]) cur = x; else if (x[0] > n && !next) next = x; });
      var fmt = function (d) { return D.format(d, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
      var days = function (k) { return k === 1 ? (cw.day || W.sDay) : (cw.days || W.sDays).replace('{n}', k); };
      var o = U.card(lang, 'kit-card kit-season ' + cls + (cur ? ' is-open' : ' is-closed'));
      U.head(o.box, cfg.kicker || '', cur ? (cw.open || W.sOpen) : (cw.closed || W.sClosed));
      statusHead(o.box, { tone: cur ? 'ok' : 'info', text: cur ? (cw.until || W.sUntil) + ' ' + fmt(cur[1]) : next ? (cw.opens || W.sOpens) + ' ' + fmt(next[0]) : (cw.unknown || W.sUnknown) });
      var rows = [];
      // closed: the days left, then the whole next season ("Closes …" or "Until …" under "Closed today" read as a contradiction)
      var short = function (d) { return D.format(d, lang, { day: 'numeric', month: 'short', year: 'numeric' }); };
      if (!cur && next) rows.push([cw['in'] || W.sIn, days(next[0] - n)], [cw.closes || W.sCloses, short(next[0]) + ' – ' + short(next[1])]);
      rows = rows.concat(cfg.rows || []); if (rows.length) U.rows(o.box, rows).classList.add('kit-lines');
      note(o.box, cfg.note, 'is-muted');
      var acts = []; if (cfg.reply) { var g = U.once('kit-actions'); g.appendChild(U.reply(cfg.reply[0], cfg.reply[1], { primary: true, fields: cfg.reply[2] })); acts.push(g); }
      acts = acts.concat(buttons(val(cfg.links, ctx))); if (acts.length) U.row(o, acts);
      return o;
    });
  }

  // ── chips: next questions, last ─────────────────────────────────────────────────────────────────
  // cfg = { cls, lang, max: 3, crowd: 2, items: { key: [label, say] }, own: { key: 'widget' } (skip when that widget is in the reply),
  //         carriedBy: { key: ['widget', …] } (skip when a card in the reply has the same button) }
  function chips(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), keys = Object.keys(cfg.items);
    // v0.8.1.10 · a chip is [label, sentence] or { label, say, desc, fields }: fields are saved in Landbot with the sentence
    var chip = function (k) { var v = cfg.items[k]; return Array.isArray(v) ? { label: v[0], say: v[1] } : v || {}; };
    checkCfg('chips', name, cfg, ['items']); register('chips', name, 'q', keys);
    if (DEV) keys.forEach(function (k) { budget("chips('" + name + "') " + k, 'title', chip(k).label); });
    LBW.widget(name, function (p, ctx) {
      var g = U.once('lbw-chips'), tags = ctx.tags || [];
      var norm = function (x) { return String(x || '').replace(/[\s\u00a0]+/g, ' ').replace(/^[¿¡\s]+|[.!?…\s]+$/g, '').trim().toLowerCase(); }, offered = {};
      (ctx.others || []).forEach(function (w) { [].forEach.call(w.querySelectorAll('[data-say]'), function (b) { var k = norm(b.getAttribute('data-say')); if (k) offered[k] = 1; }); });
      // v0.8.1.2 · a card with two actions of its own (a reply and a link) plus a row of chips was three rows of buttons in
      // three styles. With `crowd` actions or more already under the message's cards (2 by default; 0 = never), chips stay out.
      var crowd = cfg.crowd == null ? 2 : cfg.crowd, acts = 0;
      (ctx.others || []).forEach(function (w) { [].forEach.call(w.querySelectorAll('.lbw-actions .lbw-pill'), function (b) { if (!b.closest('.lbw-slide') && !b.closest('.lbw-form')) acts++; }); });
      if (crowd && acts >= crowd) return null;
      var shown = [];
      p.list('q', keys, cfg.max || 3).forEach(function (k) {
        var c = chip(k); if (!c.say || String(c.say).toLowerCase() === ctx.prev) return;
        if (cfg.own && cfg.own[k] && tags.indexOf(cfg.own[k]) >= 0) return;
        if (cfg.carriedBy && (cfg.carriedBy[k] || []).some(function (w) { return tags.indexOf(w) >= 0; })) return;
        if (offered[norm(c.say)]) return;   // v0.8.1: a card in this message already has a button that sends this sentence
        g.appendChild(described(U.reply(c.label, c.say, c.fields ? { fields: c.fields } : null), c.label, c.desc)); shown.push(c);
      });
      listy(g, shown, function (c) { return c.desc; });
      if (!g.children.length) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-chips ' + cls); o.box.appendChild(g); return o;
    }, { last: true });
  }

  // ── carousel: 2–6 items from your data, one slide each (v0.2) ──
  // cfg = { cls, lang, select(p, ctx) → { items, kicker, title, lead, note, reply: [label, say], links: [el…] } | null,
  //         slide(item, ctx) → slide | null }
  // slide = { id, img: { src, srcset, sizes, width, height, alt, cls }, badge, kicker, name, sub, price: { now, unit, list },
  //           save, status: { text, ok }, desc, reply: [label, say, fields], link: [label, url] }   (every key optional but name)
  // Prices arrive formatted (LBW.kit.h.money): the kit never does arithmetic on your data.
  function slideEl(s) {
    var sl = el('article', 'lbw-slide kit-slide'); sl.setAttribute('role', 'listitem'); if (s.id) sl.setAttribute('data-id', s.id);
    // v0.8.1.7 · a slide's photo is drawn ~70 % of a phone's width, ~300 px on a wide column: ask for that, not the 90vw default
    if (s.img) { var io = s.img.sizes ? s.img : Object.assign({}, s.img, { sizes: '(max-width: 480px) 65vw, 300px' });   /* v0.8.1.8: 65vw keeps a 2× phone on a ~500 px copy (72vw sent it to the ~960 px one: 4× the bytes, H10 live) */ var im = U.img(s.img.src, 'kit-img' + (s.img.cls ? ' ' + s.img.cls : ''), io); if (s.badge) im.appendChild(el('span', 'kit-badge', s.badge)); sl.appendChild(im);
      if (s.gallery && s.gallery.photos && s.gallery.photos.length) zoomable(im, s.gallery, s.name); }   // v0.3: the photo opens LBW.kit.h.lightbox
    var b = el('div', 'lbw-slide-body'); sl.appendChild(b);
    if (s.kicker) b.appendChild(el('div', 'kit-slide-kicker', s.kicker));
    b.appendChild(el('div', 'lbw-name', s.name));
    if (s.sub) b.appendChild(el('div', 'lbw-muted kit-sub', s.sub));
    if (s.price) { var pr = el('div', 'kit-price'); pr.appendChild(el('strong', null, s.price.now)); if (s.price.unit) pr.appendChild(el('span', 'kit-unit', s.price.unit)); if (s.price.list) pr.appendChild(el('s', 'kit-list', s.price.list)); b.appendChild(pr); }
    if (s.save) b.appendChild(el('div', 'kit-save', s.save));
    if (s.status) { var stt = tone(s.status.tone, s.status.ok ? 'ok' : ''); var sd = el('div', 'kit-stock' + (stt ? ' is-' + stt : ''), s.status.text); if (stt && stt !== 'neutral') withIcon(sd, { ok: 'check', info: 'info', warn: 'alert', danger: 'x' }[stt]); b.appendChild(sd); }   // v0.8.1.4: a tone, or ok: true as before
    if (s.desc) b.appendChild(el('p', 'kit-desc', s.desc));
    var acts = []; if (s.reply) acts.push(U.reply(s.reply[0], s.reply[1], { primary: true, fields: s.reply[2] })); if (s.link) acts.push(U.link(s.link[0], s.link[1]));
    if (acts.length) U.row(b, acts);
    return sl;
  }
  function carousel(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('carousel', name, cfg, ['select', 'slide']); register('carousel', name, 'select()', null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var sel = cfg.select(p, ctx); if (!sel) return null;
      var lang = langOf(cfg, ctx), o;
      function fill(o, sel) {   // → false when there is nothing to show
        if (!sel || !sel.items || !sel.items.length) return false;
        var st = el('div', 'lbw-strip'); st.tabIndex = 0; st.setAttribute('role', 'list');
        sel.items.forEach(function (x, i) { var s = cfg.slide(x, ctx), wh = "carousel('" + name + "') slide " + i;
          if (s && s.gallery && !s.gallery.lang) s = Object.assign({}, s, { gallery: Object.assign({}, s.gallery, { lang: lang }) });   // v0.8.1.7: the lightbox and its label speak the card's language
          if (!s || !s.name) { warn(wh, 'no name: the slide was left out'); return; }
          budget(wh, 'title', s.name); budget(wh, 'line', s.desc); st.appendChild(slideEl(s)); });
        if (!st.children.length) return false;
        U.head(o.box, sel.kicker || '', sel.title || '');
        note(o.box, sel.lead); o.box.appendChild(st); note(o.box, sel.note);
        // v0.8.1.1 · "1 / 6": the cut slide says "swipe", the count says how far. It follows the strip.
        var total = st.children.length, hd = o.box.querySelector('.lbw-head');
        if (total > 1 && hd) {
          var cnt = el('span', 'kit-count', ''); cnt.setAttribute('aria-hidden', 'true'); hd.appendChild(cnt);
          var count = function () {   // the slides fully in view: "1 / 6" on a phone, "1–2 / 4" on a wide column; nothing when all fit
            if (st.scrollWidth <= st.clientWidth + 2) { cnt.textContent = ''; return; }
            var b = st.getBoundingClientRect(), a = -1, z = -1, best = 0, bi = 0;
            [].forEach.call(st.children, function (c, i) { var r = c.getBoundingClientRect(), ov = Math.min(r.right, b.right) - Math.max(r.left, b.left);
              if (ov > best) { best = ov; bi = i; } if (r.left >= b.left - 2 && r.right <= b.right + 2) { if (a < 0) a = i; z = i; } });
            if (a < 0) a = z = bi;
            cnt.textContent = (a === z ? (a + 1) : (a + 1) + '–' + (z + 1)) + ' / ' + total;
          };
          cnt.textContent = '1 / ' + total;
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(count);
          var tick = null; st.addEventListener('scroll', function () { if (tick) return; tick = setTimeout(function () { tick = null; count(); }, 80); }, { passive: true });
        }
        var acts = []; if (sel.reply) { var g = U.once('kit-actions'); g.appendChild(U.reply(sel.reply[0], sel.reply[1], { primary: true, fields: sel.reply[2] })); acts.push(g); }
        acts = acts.concat(buttons(sel.links)); if (acts.length) U.row(o, acts);
        return true;
      }
      // v0.7.6 · live data: select() may answer { later: a promise, then(data) → the selection, fallback() → a selection from
      // the snapshot }. The card is a skeleton until the data comes; with no data and no fallback it removes itself.
      if (sel.later) {
        o = U.loading(lang, 'kit-carousel ' + cls);
        return LBW.later(o, sel.later, function (d) { return fill(o, sel.then(d)); },
          sel.fallback ? function () { if (!fill(o, sel.fallback())) throw new Error('nothing to show');
            // v0.9.2 · upgrade(o) → a promise of the selection from data that came late (null: keep these slides). Drawn on a
            // fresh card and moved in: the strip starts again at the first slide, the tag's attributes stay.
            if (sel.upgrade) sel.upgrade(o).then(function (s2) { var n = U.card(lang, 'kit-carousel ' + cls); if (!s2 || !fill(n, s2)) return;
              var q = wasQuieted(o);   // v0.9.3: the conversation moved on: the live slides come in quiet too
              while (o.firstChild) o.removeChild(o.firstChild); o.className = n.className; while (n.firstChild) o.appendChild(n.firstChild); o.box = n.box;
              if (q) quietAgain(o); o.setAttribute('data-lbw-upgraded', '1'); }, function () {}); } : null);
      }
      o = U.card(lang, 'kit-carousel ' + cls);
      return fill(o, sel) ? o : null;
    });
  }

  // ── calc: a live result from steppers and picks, sent once (v0.2) ──
  // cfg = { cls, lang, kicker, title: string | fn(p, ctx, state), state(p, ctx) → the start state | null (draws nothing), cta,
  //         controls: [ { stepper: key, label, min, max, step, format, less, more, hint }
  //                   | { pick: key, title, items: [[k, label]] | fn(state, p, ctx) }
  //                   | { node: fn(state, p, ctx) → el } ],          (in this order, above the result)
  //         result(state, out, ctx): redraw the result into `out` on every change (U.rows, LBW.kit.h.total, note),
  //         ready(state) → true | 'CTA text', send(state) → [sentence, fields], notes: [[text, cls]] | fn(p, ctx, state), links: fn(p, ctx, state) → [el…] }
  // Compute money in integer cents in your own functions, and call the same function from result and send (and from the
  // battery's widgetHas: a hand-computed total failed a correct reply once). No no-break space in the sentence you send.
  function calc(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('calc', name, cfg, ['state', 'controls', 'result', 'send', 'cta']); if (typeof cfg.title === 'string') budget("calc('" + name + "')", 'title', cfg.title);
    register('calc', name, 'state()', null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var state = cfg.state(p, ctx); if (!state) return null;
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-calc ' + cls), out = el('div', 'kit-out'), said = '';
      var f = U.form('kit-calcform', { state: state, cta: cfg.cta, ready: cfg.ready,
        send: function (s) { var r = cfg.send(s); said = r && r[0]; return r; },
        sent: function (s) { if (cfg.collapse !== false && said) fold(o, said, lang); if (cfg.sent) cfg.sent(s); },
        change: function (s) { out.textContent = ''; cfg.result(s, out, ctx); } });
      U.head(o.box, val(cfg.kicker, p, ctx, state) || '', val(cfg.title, p, ctx, state)); o.box.appendChild(f.el);
      cfg.controls.forEach(function (c) {
        if (c.stepper) f.add(U.stepper(c.label, f.state[c.stepper], { min: c.min, max: c.max, step: c.step, format: c.format, less: c.less, more: c.more, hint: c.hint, change: function (v) { f.state[c.stepper] = v; f.update(); } }));
        else if (c.pick) f.add(choice(c.title, val(c.items, f.state, p, ctx), f.state[c.pick], function (k) { f.state[c.pick] = k; f.update(); }));
        else if (c.node) f.add(c.node(f.state, p, ctx));
      });
      f.add(out);
      (val(cfg.notes, p, ctx, state) || []).forEach(function (n) { note(o.box, n[0], n[1]); });
      var ls = buttons(cfg.links && cfg.links(p, ctx, state)); if (ls.length) U.row(o, ls);
      return o;
    });
  }
  // money from integer cents: money(24700, { cur: 'S/', th: ',', dec: '.' }) → 'S/ 247.00' (a no-break space after the symbol;
  // after: true → '247,00 €'; cents: false drops them). The sentence a widget SENDS must not carry it: use { nb: false }.
  function money(c, o) {
    o = o || {}; var neg = c < 0; c = Math.abs(Math.round(c)); var sp = o.nb === false ? ' ' : String.fromCharCode(160);
    var th = o.th == null ? ',' : o.th, group = function (x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, th); }, r = c % 100;
    var n = o.cents === false ? group(Math.round(c / 100)) : group(Math.floor(c / 100)) + (o.dec || '.') + (r < 10 ? '0' : '') + r;
    var cur = o.cur == null ? '' : o.cur; return (neg ? '−' : '') + (o.after ? n + (cur ? sp + cur : '') : (cur ? cur + (o.space === false ? '' : sp) : '') + n);
  }
  // a label/value line in bold, for a total or a due date: total(out, 'Importe total', 'S/ 247.00', 'is-due')
  function total(box, labelText, value, cls) { var t = el('div', 'kit-total' + (cls ? ' ' + cls : '')); t.appendChild(el('span', null, labelText)); t.appendChild(el('strong', null, value)); box.appendChild(t); return t; }

  // ── overlays (v0.3): a lightbox drawn inside the chat, and a hand-off to a page-level modal ──
  // lightbox(g, start, opener): g = { photos: [{ src, srcset: [[url, w]], alt }], title, lang, page: true }
  //   position: fixed inside the chat's document (the whole chat window: the Livechat iframe or the share page). Esc and ×
  //   close it, ←/→ page, focus is trapped (the rest of the chat is `inert`) and goes back to the opener, the chat's scroller
  //   is locked and its scrollTop restored; wheel and touchmove on it are cancelled (otherwise they chain out of a
  //   Livechat iframe and scroll the host page). A message the bot sends meanwhile lands behind it and doesn't take focus.
  //   page: true + the chat is embedded (window.parent !== window) → an "Enlarge on the page" button posts
  //   { type: 'lbw:modal', kind: 'gallery', title, photos: [src…], start } to the host page (kit/host-modal.js draws it).
  //   Every URL goes through the same `links` check as ui.img. Events go to window.__lbwOverlay (for tests).
  function olog(ev) { (root.__lbwOverlay = root.__lbwOverlay || []).push({ ev: ev, t: Date.now(), focus: (document.activeElement && (document.activeElement.className || document.activeElement.tagName)) || '' }); }
  function scroller(n) { for (; n && n !== document.body; n = n.parentElement) { var s = getComputedStyle(n).overflowY; if ((s === 'auto' || s === 'scroll') && n.scrollHeight > n.clientHeight) return n; } return document.scrollingElement; }
  function lightbox(g, start, opener) {
    if (document.querySelector('.kit-ovl')) return null;
    var w = words(g.lang || 'en'), i = Math.max(0, Math.min(start || 0, g.photos.length - 1));
    var ov = el('div', 'kit-ovl is-lightbox'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', g.title || w.photos || 'Photos');
    var top = el('div', 'kit-ovl-top'), cap = el('span', 'kit-ovl-cap'), x = U.btn('×', 'kit-ovl-x'); x.setAttribute('aria-label', w.close || 'Close');
    top.appendChild(cap); top.appendChild(x); ov.appendChild(top);
    var stage = el('div', 'kit-ovl-stage'); ov.appendChild(stage);
    var prev = U.btn('‹', 'kit-ovl-nav is-prev'), next = U.btn('›', 'kit-ovl-nav is-next');
    prev.setAttribute('aria-label', w.prev || 'Previous photo'); next.setAttribute('aria-label', w.next || 'Next photo');
    if (g.photos.length > 1) { ov.appendChild(prev); ov.appendChild(next); }
    var bar = el('div', 'kit-ovl-bar'); ov.appendChild(bar);
    var embedded = false; try { embedded = root.parent && root.parent !== root; } catch (e) { embedded = true; }
    if (g.page && embedded) {
      var big = U.btn(w.enlarge || 'Enlarge on the page', 'lbw-pill'); bar.appendChild(big);
      big.addEventListener('click', function () {
        var msg = { type: 'lbw:modal', v: 1, kind: 'gallery', title: String(g.title || '').slice(0, 120), start: i,
          photos: g.photos.map(function (p) { return p.big || p.src; }).filter(function (u) { return /^https:\/\//.test(u); }) };
        olog('page:post'); close('page'); root.parent.postMessage(msg, '*');
      });
    }
    function show() {
      stage.textContent = ''; var p = g.photos[i];
      stage.appendChild(U.img(p.src, 'kit-ovl-img', { srcset: p.srcset, sizes: '100vw', alt: p.alt || g.title || '' }));
      [i - 1, i + 1].forEach(function (k) { var q = g.photos[k]; if (q) U.img(q.src, '', { srcset: q.srcset, sizes: '100vw' }); });   // v0.8.1.8: the photos next to it load ahead (detached: the browser fetches, nothing is drawn)
      cap.textContent = (g.title ? g.title + ' · ' : '') + (i + 1) + ' / ' + g.photos.length;
      prev.disabled = i === 0; next.disabled = i === g.photos.length - 1;
    }
    var sc = scroller(opener), keep = sc ? sc.scrollTop : 0, oldOv = sc ? sc.style.overflow : '', made = [];
    [].forEach.call(document.body.children, function (c) { if (c !== ov && !c.hasAttribute('inert')) { c.setAttribute('inert', ''); made.push(c); } });
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('esc'); }
      else if (e.key === 'ArrowLeft' && i > 0) { i--; show(); } else if (e.key === 'ArrowRight' && i < g.photos.length - 1) { i++; show(); }
      else if (e.key === 'Tab') { var f = [].filter.call(ov.querySelectorAll('button'), function (b) { return !b.disabled; }); if (!f.length) return;
        var a = f.indexOf(document.activeElement); if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    }
    function refocus(e) { if (!ov.contains(e.target)) { olog('focus:pulled'); x.focus(); } }
    function close(why) {
      document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', refocus, true);
      made.forEach(function (c) { c.removeAttribute('inert'); }); ov.remove();
      if (sc) { sc.style.overflow = oldOv; sc.scrollTop = keep; }
      olog('close:' + why); if (opener && opener.focus && why !== 'page') opener.focus();
    }
    x.addEventListener('click', function () { close('x'); });
    prev.addEventListener('click', function () { if (i > 0) { i--; show(); } }); next.addEventListener('click', function () { if (i < g.photos.length - 1) { i++; show(); } });
    // v0.8.1.8 · a horizontal swipe of 40 px or more pages (the touchmove guard below only stops the page behind from scrolling)
    var sx = null, sy = 0; stage.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    stage.addEventListener('touchend', function (e) { if (sx == null) return; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0 && i < g.photos.length - 1) { i++; show(); } else if (dx > 0 && i > 0) { i--; show(); } } }, { passive: true });
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target === stage) close('backdrop'); });
    // in a Livechat the wheel over the overlay scrolled the HOST page 700 px (the chat's scroller is locked, so it chains out of the iframe)
    var stop = function (e) { e.preventDefault(); }; ov.addEventListener('wheel', stop, { passive: false }); ov.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('keydown', key, true); document.addEventListener('focusin', refocus, true);
    if (sc) sc.style.overflow = 'hidden';
    document.body.appendChild(ov); show(); x.focus(); olog('open'); return { el: ov, close: close };
  }
  function zoomable(frame, g, title) {   // the slide's photo becomes a button that opens the lightbox
    var b = U.btn('', 'kit-zoom'); b.setAttribute('aria-label', (words(g.lang || 'en').photos || 'Photos') + ' · ' + title + ' (' + g.photos.length + ')');
    b.appendChild(el('span', 'kit-zoom-n', g.photos.length > 1 ? '⤢ ' + g.photos.length : '⤢')); frame.appendChild(b);   // v0.8.1.7: no "1" for a gallery of one
    b.addEventListener('click', function () { lightbox({ photos: g.photos, title: g.title || title, lang: g.lang, page: g.page }, 0, b); });
  }

  // ══ v0.5 · the lead-gen set (ideas from ChatKit's widget gallery, rebuilt on lbw: data in code, the agent picks ids) ══
  // A status line ("✓ Solicitud recibida"): tone 'ok' | 'info' | 'warn' | 'danger' (v0.8.1.4), with an icon that says the
  // tone too, so colour is never the only signal. The icon is an SVG: the line's text is the status alone.
  var TONE_ICON = { ok: 'check', info: 'i', warn: 'bang', danger: 'x', neutral: 'i' };
  function statusLine(st, cls) {
    var t = tone(st.tone, 'ok'), b = el('div', 'kit-statusbar is-' + t + (cls ? ' ' + cls : '')), i = el('span', 'kit-statusbar-i');
    var ic = icon(TONE_ICON[t]); if (ic) i.appendChild(ic); b.appendChild(i); b.appendChild(el('span', null, st.text)); return b;
  }
  function statusHead(box, st) { if (!st || !st.text) return null; var b = statusLine(st); box.appendChild(b); return b; }
  // chart(box, spec): an inline SVG from numbers YOUR code computed (never the agent's). spec = { type: 'line' | 'area' | 'bar',
  //   x: ['1', '2', …], series: [{ label, values: [n…] }] (1 or 2; the 2nd is drawn in --kit-series-2), y: { format(v), ticks: 4 },
  //   mark: { at: index, label } (a dashed vertical line, e.g. the break-even year), height: 170, summary: 'text for screen readers',
  //   stack: true (v0.8.1.12, bars only: 2–4 series piled per point, from 0 up, with each bar's total above it while there are 8 points or fewer) }
  // The values also go into a visually hidden list, so the numbers are readable without the picture.
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function chart(box, spec) {
    var W = 320, H = spec.height || 170, L = 44, R = 8, T = 10, B = 24, all = [];
    var stack = spec.type === 'bar' && !!spec.stack, tots = stack ? spec.x.map(function (_, i) { return spec.series.reduce(function (a, s) { return a + Math.max(0, s.values[i] || 0); }, 0); }) : null;
    if (stack) all = tots.slice(); else spec.series.forEach(function (s) { all = all.concat(s.values); });
    var max = Math.max.apply(null, all.concat([0])), min = Math.min.apply(null, all.concat([0])), ticks = (spec.y && spec.y.ticks) || 4;
    var span = max - min || 1, stepRaw = span / ticks, mag = Math.pow(10, Math.floor(Math.log(stepRaw) / Math.LN10)), step = [1, 2, 2.5, 5, 10].map(function (k) { return k * mag; }).filter(function (k) { return k >= stepRaw; })[0];
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, fmt = (spec.y && spec.y.format) || String, n = spec.x.length;
    var labelAll = stack && n <= 6;   // past 6 points totals would touch (critique 0.8.1.12): then only the tallest is written
    if (stack) { var Y0 = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo || 1); }; if (Y0(max) - T < 16) hi += step; }   // room above the tallest total
    var X = function (i) { return spec.type === 'bar' ? L + (i + 0.5) * (W - L - R) / n : L + (n === 1 ? 0 : i * (W - L - R) / (n - 1)); };
    var Y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo || 1); };
    var wrap = el('figure', 'kit-chart'), svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.summary || '' }); wrap.appendChild(svg);
    for (var v = lo; v <= hi + 1e-9; v += step) { var y = Y(v); sv('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'kit-grid' + (Math.abs(v) < 1e-9 ? ' is-zero' : '') }, svg); var t = sv('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'kit-tick' }, svg); t.textContent = fmt(v); }
    var every = spec.x.every(function (s) { return String(s).length <= 2; }) ? 1 : Math.ceil(n / 6);   // single letters: all twelve months fit
    spec.x.forEach(function (lab, i) { if (i % every && !(i === n - 1 && (n - 1) % every === 0)) return; var t = sv('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'class': 'kit-tick' }, svg); t.textContent = lab; });
    if (stack) {   // one bar per point, the series piled bottom-up in their order; a 1 px gap between parts built into the
      // geometry (a stroke ate thin parts and the baseline), parts never under 2 px, square corners (a stack has no single top)
      var sw = Math.min(28, (W - L - R) / n * 0.62), base = spec.x.map(function () { return 0; });
      spec.series.forEach(function (s, k) { s.values.forEach(function (val, i) { val = Math.max(0, val || 0); if (!val) return; var y0 = Y(base[i]), y1 = Y(base[i] + val), gap = base[i] > 0 ? 1 : 0; base[i] += val;
        sv('rect', { x: X(i) - sw / 2, y: Math.min(y1, y0 - gap - 2), width: sw, height: Math.max(2, y0 - y1 - gap), 'class': 'kit-s' + (k + 1) + ' is-bar is-stack' }, svg); }); });
      var top = tots.indexOf(max); tots.forEach(function (t, i) { if (!labelAll && i !== top) return; var tt = sv('text', { x: X(i), y: Y(t) - 5, 'text-anchor': 'middle', 'class': 'kit-stack-total' }, svg); tt.textContent = fmt(t); });
      if (DEV) setTimeout(function () { var seen = {}; [].forEach.call(svg.querySelectorAll('.is-stack'), function (r) { var c = getComputedStyle(r).fill, k = r.getAttribute('class').split(' ')[0]; seen[k] = c; });
        var rgb = function (c) { var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3]] : null; }, ks = Object.keys(seen);
        ks.forEach(function (a, i) { ks.slice(i + 1).forEach(function (b) { var p = rgb(seen[a]), q = rgb(seen[b]); if (p && q && Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)) < 60) warn('chart', a + ' and ' + b + ' are nearly the same colour (' + seen[a] + ', ' + seen[b] + '): set --kit-series-n in the theme'); }); }); }, 0);
    }
    if (!stack) spec.series.forEach(function (s, k) {
      var c = 'kit-s' + (k + 1);
      if (spec.type === 'bar') { var bw = (W - L - R) / n / (spec.series.length + 1); s.values.forEach(function (val, i) { var x = X(i) - bw * spec.series.length / 2 + k * bw, y0 = Y(Math.max(0, lo)), y1 = Y(val); sv('rect', { x: x, y: Math.min(y0, y1), width: bw - 2, height: Math.abs(y0 - y1), rx: 2, 'class': c + ' is-bar' }, svg); }); return; }
      var d = s.values.map(function (val, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(val).toFixed(1); }).join(' ');
      if (spec.type === 'area') sv('path', { d: d + ' L' + X(n - 1).toFixed(1) + ' ' + Y(Math.max(0, lo)) + ' L' + X(0).toFixed(1) + ' ' + Y(Math.max(0, lo)) + ' Z', 'class': c + ' is-area' }, svg);
      sv('path', { d: d, 'class': c + ' is-line' }, svg);
      sv('circle', { cx: X(n - 1), cy: Y(s.values[n - 1]), r: 3.5, 'class': c + ' is-end' }, svg);
    });
    if (spec.mark && spec.mark.at != null && spec.mark.at >= 0 && spec.mark.at < n) { var mx = X(spec.mark.at); sv('line', { x1: mx, x2: mx, y1: T, y2: H - B, 'class': 'kit-mark' }, svg); if (spec.mark.label) { var mt = sv('text', { x: Math.min(mx + 4, W - R - 2), y: T + 10, 'text-anchor': mx > W - 90 ? 'end' : 'start', 'class': 'kit-mark-l' }, svg); mt.textContent = spec.mark.label; } }
    if (spec.series.length > 1) { var lg = el('div', 'kit-legend'); spec.series.forEach(function (s, k) { var it = el('span', 'kit-legend-i'); it.appendChild(el('i', 'kit-s' + (k + 1))); it.appendChild(document.createTextNode(s.label)); lg.appendChild(it); }); wrap.appendChild(lg); }
    var sr = el('ul', 'kit-sr');
    if (stack) spec.x.forEach(function (x, i) { sr.appendChild(el('li', null, x + ': ' + words(spec.lang).tTotal + ' ' + fmt(tots[i]) + ' (' + spec.series.map(function (s) { return s.label + ' ' + fmt(s.values[i] || 0); }).join(', ') + ')')); });   // one line per point (critique 0.8.1.12)
    else spec.series.forEach(function (s) { s.values.forEach(function (val, i) { sr.appendChild(el('li', null, s.label + ' · ' + spec.x[i] + ': ' + fmt(val))); }); });
    if (!spec.summary) svg.setAttribute('aria-hidden', 'true');

    wrap.appendChild(sr);
    box.appendChild(wrap); return wrap;
  }

  // ── slots: pick a free time for a visit or a call, sent once ────────────────────────────────────
  // cfg = { cls, lang, kicker, title, days(p, ctx) → [{ day: LBW day number, slots: [[from, to, 'busy'?], …] (minutes) }] | null,
  //         cta, say(sel, ctx) → [sentence, fields] (sel = { day, from, to }; kept in LBW.kit.last[name] for a confirm card), ics: { title, where, minutes } (an .ics button
  //         after it sends), note, sep, h12, collapse }
  // The days come from YOUR data (a published schedule, Calendly…); never from the agent. Busy slots show, greyed, so the
  // day reads as a real diary.
  function slots(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('slots', name, cfg, ['days', 'say', 'cta']); budget("slots('" + name + "')", 'title', cfg.title); register('slots', name, 'days()', null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var days = (cfg.days(p, ctx) || []).filter(function (d) { return d && d.slots && d.slots.some(function (x) { return x[2] !== 'busy'; }); }).slice(0, 5);
      if (!days.length) return null;
      var lang = langOf(cfg, ctx), w = words(lang), o = U.card(lang, 'kit-slots ' + cls), said = '', fmtT = function (m) { return T.format(m, cfg.sep, { h12: cfg.h12 }); };
      var dayLabel = function (n) { return D.format(n, lang, { weekday: 'short', day: 'numeric', month: 'short' }); };
      var f = U.form('kit-slotform', { state: { day: days[0].day, from: null, to: null }, cta: cfg.cta,
        ready: function (s) { return s.from != null || w.pick; },
        send: function (s) { var sel = { day: s.day, from: s.from, to: s.to }, r = cfg.say(sel, ctx); said = r && r[0]; return r; },
        sent: function (s) {
          if (said) last[name] = { state: { day: s.day, from: s.from, to: s.to }, text: said };   // kept once it was really sent (a click inside the 1.2 s lock isn't)
          var ex = cfg.ics ? [U.ics(cfg.ics.label || '📅', { title: cfg.ics.title, day: s.day, from: s.from, to: s.to, where: cfg.ics.where, file: cfg.ics.file || 'visita' }, 'kit-sent-ics')] : [];
          if (cfg.collapse !== false && said) fold(o, said, lang, ex); if (cfg.sent) cfg.sent(s); } });
      U.head(o.box, cfg.kicker || '', cfg.title || ''); o.box.appendChild(f.el);
      f.add(choice('', days.map(function (d) { return [String(d.day), dayLabel(d.day)]; }), String(days[0].day), function (k) { f.state.day = +k; f.state.from = f.state.to = null; drawDay(); f.update(); }));
      var list = f.add(el('div', 'kit-slotlist'));
      function drawDay() {
        list.textContent = ''; var d = days.filter(function (x) { return x.day === f.state.day; })[0]; if (!d) return;
        d.slots.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (sl) {
          var busy = sl[2] === 'busy', b = U.btn((busy ? w.busy + ' · ' : '') + fmtT(sl[0]) + '–' + fmtT(sl[1]), 'kit-slot' + (busy ? ' is-busy' : ''));
          if (busy) { b.disabled = true; } else { b.setAttribute('aria-pressed', 'false');
            b.addEventListener('click', function () { if (b.closest('.is-done')) return; [].forEach.call(list.children, function (x) { if (!x.disabled) x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); f.state.from = sl[0]; f.state.to = sl[1]; f.update(); }); }
          list.appendChild(b);
        });
      }
      drawDay(); note(o.box, val(cfg.note, p, ctx), 'is-muted');
      return o;
    });
  }

  // ── confirm: the "done" card after a form or a booking (ChatKit's "Purchase complete") ─────────────
  // cfg = { cls, lang, form: 'plan' (reads LBW.kit.last[form]; nothing to confirm → draws nothing), status: text | fn(last),
  //         title: fn(last, ctx) | text, rows: fn(last, ctx) → [[label, value]], steps: fn(last, ctx) | [] (numbered next steps), note, actions: fn(last, ctx) → [el…] }
  function confirm(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('confirm', name, cfg, ['title']); register('confirm', name, null, null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var ls = cfg.form ? last[cfg.form] : {}; if (!ls) return null;
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-confirm ' + cls), t = val(cfg.title, ls, ctx);
      U.head(o.box, '', t); statusHead(o.box, { text: val(cfg.status, ls, ctx), tone: 'ok' }); budget("confirm('" + name + "')", 'title', t);   // v0.8.1.4: the status under the title, as on every card
      var rows = val(cfg.rows, ls, ctx); if (rows && rows.length) U.rows(o.box, rows).classList.add('kit-lines');
      list(o.box, val(cfg.steps, ls, ctx), 'is-steps'); note(o.box, val(cfg.note, ls, ctx), 'is-muted');
      var a = buttons(cfg.actions && cfg.actions(ls, ctx)); if (a.length) U.row(o, a);
      return o;
    });
  }
  // ── review: a quote or a configuration, line by line, Confirm / Discard (ChatKit's "Software purchase") ──
  // cfg = { cls, lang, kicker, title, state(p, ctx) → start state | null,
  //         lines: [{ label, value: fn(state) } | { label, select: { key, items: [[k, label]] } }],  (a select changes state[key])
  //         total: { label, value: fn(state) }, cta (the confirm label), discard: [label, say], send(state) → [sentence, fields], note, collapse }
  // Native <select>s: compact, keyboard and screen-reader friendly, and closed lists (no free text).
  function review(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('review', name, cfg, ['state', 'lines', 'send', 'cta']); budget("review('" + name + "')", 'title', cfg.title); register('review', name, 'state()', null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var state = cfg.state(p, ctx); if (!state) return null;
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-review ' + cls), said = '', vals = [];
      var f = U.form('kit-reviewform', { state: state, cta: cfg.cta, ready: cfg.ready,
        change: function (s) { vals.forEach(function (v) { v.node.textContent = v.fn(s); }); if (tot) tot.textContent = cfg.total.value(s); },
        send: function (s) { var r = cfg.send(s); said = r && r[0]; return r; },
        sent: function (s) { if (cfg.collapse !== false && said) fold(o, said, lang); if (cfg.sent) cfg.sent(s); } });
      U.head(o.box, cfg.kicker || '', cfg.title || ''); o.box.appendChild(f.el);
      var dl = f.add(el('div', 'kit-rlines'));
      cfg.lines.forEach(function (ln, i) {
        var r = el('div', 'kit-rline'), id = cls + '-' + name + '-' + i + '-' + Math.random().toString(36).slice(2, 6), lab = el('label', 'kit-rlabel', ln.label); r.appendChild(lab);
        if (ln.select) {
          var sel = el('select', 'kit-sel'); sel.id = id; lab.setAttribute('for', id);
          ln.select.items.forEach(function (it) { var op = el('option', null, it[1]); op.value = it[0]; if (it[0] === f.state[ln.select.key]) op.selected = true; sel.appendChild(op); });
          sel.addEventListener('change', function () { if (f.el.classList.contains('is-done')) return; var k = sel.value; if (ln.select.items.some(function (it) { return it[0] === k; })) { f.state[ln.select.key] = k; f.update(); } });
          r.appendChild(sel);
        } else { var v = el('span', 'kit-rvalue'); r.appendChild(v); vals.push({ node: v, fn: ln.value }); }
        dl.appendChild(r);
      });
      var tot = null; if (cfg.total) { var tr = f.add(el('div', 'kit-rtotal')); tr.appendChild(el('span', null, cfg.total.label)); tot = el('strong'); tr.appendChild(tot); }
      if (cfg.discard) f.add(U.reply(cfg.discard[0], cfg.discard[1], { cls: 'kit-discard' }));
      note(o.box, val(cfg.note, p, ctx, state), 'is-muted');
      return o;
    });
  }
  // v0.9.3 · late data and the visitor's own messages. The runtime quiets every one-shot group above the visitor's last
  // message (is-stale + is-done + is-spent), so "used" is only what the visitor pressed: a sent button or a ticked toggle.
  // Measured live: a message typed or sent before the data landed kept untouched cards on their saved copy.
  function usedByVisitor(o) { return !!o.querySelector('.is-sent, [aria-pressed="true"]'); }
  function wasQuieted(o) { return !!o.querySelector('.lbw-once.is-stale') || o.classList.contains('is-spent'); }
  function quietAgain(o) { [].forEach.call(o.querySelectorAll('.lbw-once'), function (g) { g.classList.add('is-stale'); U.done(g); }); o.classList.add('is-spent'); }
  // ── chart: a card around LBW.kit.h.chart ────────────────────────────────────────────────────────
  // cfg = { cls, lang, kicker, title, sub, data(p, ctx) → chart spec | null, note: text | fn(p, ctx, spec), links: fn(p, ctx) → [el…] }
  // Money or savings charts are promises: compute them only from the client's own published rule, and say so in `note`.
  function chartCard(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('chart', name, cfg, ['data', 'title']); budget("chart('" + name + "')", 'title', cfg.title); register('chart', name, 'data()', null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var spec = cfg.data(p, ctx); if (!spec || !spec.series || !spec.series.length) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-chartcard ' + cls); U.head(o.box, cfg.kicker || '', cfg.title, cfg.sub ? el('span', 'kit-chart-sub', val(cfg.sub, p, ctx, spec)) : null);
      if (!spec.lang) spec.lang = langOf(cfg, ctx); chart(o.box, spec); note(o.box, val(cfg.note, p, ctx, spec), 'is-muted');
      var a = buttons(cfg.links && cfg.links(p, ctx, spec)); if (a.length) U.row(o, a);
      return o;
    });
  }
  // ── stats: trust numbers on the brand's colour (ChatKit's player card) ─────────────────────────────
  // cfg = { cls, lang, single: true | items: { id: … }, items._ / items[id] = { kicker, title, stats: [[value, label]] (2–4), source },
  //         reply(id, item) → [label, say], links(id, item) → [el…] }. Numbers from their site, dated in `source`.
  function stats(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), ids = Object.keys(cfg.items || {});
    checkCfg('stats', name, cfg, ['items']);
    if (DEV) ids.forEach(function (id) { var it = cfg.items[id], wh = "stats('" + name + "') " + id; budget(wh, 'title', it.title); if (!it.source) warn(wh, 'no source: say where and when the numbers were read'); if (!it.stats || it.stats.length < 2 || it.stats.length > 4) warn(wh, '2–4 stats'); });
    register('stats', name, cfg.single ? null : 'id', cfg.single ? null : ids);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var id = cfg.single ? '_' : p.one('id', ids), it = id && cfg.items[id]; if (!it) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-stats ' + cls); U.head(o.box, it.kicker || '', it.title || '');
      var g = el('div', 'kit-statgrid'); (it.stats || []).slice(0, 4).forEach(function (s) { var c = el('div', 'kit-stat'); c.appendChild(el('strong', null, s[0])); c.appendChild(el('span', null, s[1])); g.appendChild(c); }); o.box.appendChild(g);
      if (it.source) o.box.appendChild(el('p', 'kit-stat-src', it.source));
      var a = [], r = cfg.reply && cfg.reply(id, it); if (r) { var og = U.once('kit-actions'); og.appendChild(U.reply(r[0], r[1], { primary: true, fields: r[2] })); a.push(og); }
      a = a.concat(buttons(cfg.links && cfg.links(id, it))); if (a.length) U.row(o, a);
      return o;
    });
  }
  // ── people: who will call or visit (ChatKit's speakers) ──────────────────────────────────────────
  // cfg = { cls, lang, kicker, title, items: { id: { name, role, img, note } }, select(p, ctx) → [ids] (default all, max 4),
  //         reply(id, person) → [label, say], note }. Only people on the client's PUBLIC team page; ask before using them.
  // No photo → initials on the accent colour.
  function people(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), ids = Object.keys(cfg.items || {});
    checkCfg('people', name, cfg, ['items']); register('people', name, cfg.select ? 'select()' : null, null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var pick = (cfg.select ? cfg.select(p, ctx) : ids).filter(function (id) { return cfg.items[id]; }).slice(0, 4); if (!pick.length) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-people ' + cls); if (cfg.title) U.head(o.box, cfg.kicker || '', cfg.title);
      var g = U.once('kit-peoplelist');
      pick.forEach(function (id) {
        var x = cfg.items[id], r = el('div', 'kit-person');
        var ini = function () { return el('span', 'kit-avatar is-initials', x.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()); };
        // a photo that is refused or doesn't load becomes the initials, never an empty frame
        if (x.img) { var fr = U.img(x.img, 'kit-avatar', { alt: '', width: 40, height: 40 }), im = fr.querySelector('img'); if (!im) r.appendChild(ini()); else { im.addEventListener('error', function () { if (fr.parentNode) fr.parentNode.replaceChild(ini(), fr); }); r.appendChild(fr); } }
        else r.appendChild(el('span', 'kit-avatar is-initials', x.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()));
        var t = el('div', 'kit-person-t'); t.appendChild(el('strong', null, x.name)); t.appendChild(el('span', null, x.role)); if (x.note) t.appendChild(el('span', 'kit-person-n', x.note)); r.appendChild(t);
        var rr = cfg.reply && cfg.reply(id, x); if (rr) r.appendChild(U.reply(rr[0], rr[1], { fields: rr[2], cls: 'kit-person-b' }));
        g.appendChild(r);
      });
      o.box.appendChild(g); note(o.box, val(cfg.note, p, ctx), 'is-muted');
      return o;
    });
  }
  // ── consent: one clear yes/no before anything is collected (ChatKit's "Enable notification") ──────
  // cfg = { cls, lang, icon: 'check' | 'bell' | 'shield', title, text, yes: [label, say, fields], no: [label, say, fields], link: [label, url] }
  // For production bots that collect data: in a demo, say it collects nothing. Both answers are one-shot and write a field.
  var ICON = { check: 'check', bell: 'bell', shield: 'shield' };   // v0.8.1.4: SVG icons (an emoji drew in each platform's own colours)
  function consent(name, cfg) {
    var cls = cfg.cls || ('kit-' + name);
    checkCfg('consent', name, cfg, ['title', 'yes', 'no']); budget("consent('" + name + "')", 'title', cfg.title); budget("consent('" + name + "')", 'line', cfg.text); register('consent', name, null, null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-consent ' + cls);
      var ci = el('span', 'kit-consent-i'), cg = icon(ICON[cfg.icon] || ICON.check); if (cg) ci.appendChild(cg); o.box.appendChild(ci); o.box.appendChild(el('p', 'kit-consent-t', cfg.title)); if (cfg.text) o.box.appendChild(el('p', 'kit-consent-x', cfg.text));
      var g = U.once('kit-consent-b'); g.appendChild(U.reply(cfg.yes[0], cfg.yes[1], { primary: true, fields: cfg.yes[2] })); g.appendChild(U.reply(cfg.no[0], cfg.no[1], { fields: cfg.no[2] })); o.box.appendChild(g);
      if (cfg.link) o.box.appendChild(U.link(cfg.link[0], cfg.link[1], 'kit-consent-l'));
      return o;
    });
  }

  // ── compare: two or three items of your data side by side (v0.7.4; three demos had written it by hand) ──────────
  // cfg = { cls, lang, kicker, title: text | fn(ids, ctx), param: 'ids', min: 2, max: 3 (never more: the chat column is narrow),
  //         items: { id: { name, values: { rowKey: text }, reply: [label, say, fields], link: [label, url] } },
  //         rows: [[rowKey, label, cls]] (cls 'is-strong' for the line that decides, e.g. the price), empty: '—', note }
  // The tag names the items: [[p:compare ids=a,b,c]]. Fewer than `min` known ids draws nothing (one item is a card's job).
  // A row with no value in any column is left out. One label line, then equal columns: it fits 340 px.
  function compare(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), ids = Object.keys(cfg.items || {}), param = cfg.param || 'ids', max = Math.min(cfg.max || 3, 3), empty = cfg.empty == null ? '—' : cfg.empty;
    checkCfg('compare', name, cfg, ['items', 'rows']); register('compare', name, param, ids);
    if (DEV) ids.forEach(function (id) { budget("compare('" + name + "') " + id, 'title', cfg.items[id].name); });
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var got = p.list(param, ids, max); if (got.length < (cfg.min || 2)) return null;
      var o = U.card(langOf(cfg, ctx), 'kit-compare ' + cls), grid = el('div', 'kit-cmp is-' + got.length); grid.setAttribute('role', 'table');
      var names = got.map(function (id) { return cfg.items[id].name; });
      U.head(o.box, cfg.kicker || '', String(val(cfg.title, got, ctx) || '').split('{names}').join(names.join(' · ')));
      function line(label, cells, c) {
        var r = el('div', 'kit-cmp-row' + (c ? ' ' + c : '')); r.setAttribute('role', 'row');
        if (label) { var h = el('div', 'kit-cmp-label', label); h.setAttribute('role', 'rowheader'); r.appendChild(h); }
        var cs = el('div', 'kit-cmp-cells'); cells.forEach(function (t) { var d = el('div', 'kit-cmp-cell', t); d.setAttribute('role', 'cell'); cs.appendChild(d); });
        r.appendChild(cs); grid.appendChild(r);
      }
      line('', got.map(function (id) { return cfg.items[id].name; }), 'is-head');
      var folded = [];
      (cfg.rows || []).forEach(function (row) {
        var cells = got.map(function (id) { var v = (cfg.items[id].values || {})[row[0]]; return v == null || v === '' ? empty : String(v); });
        // a row where every column says the same isn't a difference: it is drawn quieter (v0.8.1.1), or, with same: 'fold',
        // left out of the table and listed in one line under it (v0.8.1.3: 4 of 7 rows were the same on a live demo)
        var same = cells.length > 1 && cells.every(function (t) { return t === cells[0]; });
        if (!cells.some(function (t) { return t !== empty; })) return;
        if (same && !row[2] && cfg.same === 'fold') { if (cells[0] !== empty) folded.push(row[1] + ': ' + cells[0]); return; }
        line(row[1], cells, (row[2] || '') + (same && !row[2] ? ' is-same' : ''));
      });
      o.box.appendChild(grid);
      if (folded.length) { var Wl = words(langOf(cfg, ctx)), lab = got.length === 2 ? Wl.cSame2 : Wl.cSame; note(o.box, folded.length === 1 ? lab.replace(/\s*:\s*$/, '') + ' · ' + folded[0] : lab + '\n' + folded.join('\n'), 'kit-cmp-same'); }   // v0.8.1.8: one equal row reads "The same in both · View: Sea" (not two colons)   // one equal row stays on the label's line
      note(o.box, cfg.note, 'is-muted');
      var g = U.once('kit-actions'), links = [];
      var firstReply = true;
      got.forEach(function (id, i) { var it = cfg.items[id]; if (it.reply) { var rb = U.reply(it.reply[0], it.reply[1], { primary: firstReply && cfg.primary !== false, fields: it.reply[2] }); rb.style.setProperty('--kit-col', String(i + 1)); g.appendChild(rb); firstReply = false; } if (it.link) links.push(U.link(it.link[0], it.link[1])); });   /* v0.8.1.9: each reply in its item's column; the first reply is the primary ("primary": false for equals, v0.8.1.7) */
      if (g.children.length) { g.classList.add('kit-cmp-acts'); g.style.setProperty('--kit-n', String(got.length)); }   // v0.8.1.9: one column per item, under its column
      var acts = (g.children.length ? [g] : []).concat(buttons(links)); if (acts.length) U.row(o, acts);
      return o;
    });
  }

  // ── rating: thumbs, stars or a scale, sent on one tap, with the fields it saves (v0.8.1.6) ───────────────
  // Landbot's own ask_rating and ask_scale don't draw on the v4 web chat; this does, and the click is a message with fields.
  // cfg = { cls, lang, kicker, title, text, kind: 'thumbs' | 'stars' | 'scale', min, max (stars: 1–max, 5 by default, at most 10;
  //         scale: min–max, 0–10 by default, at most 11 values), labels: [low, high] (thumbs: [no, yes]; scale: under its ends),
  //         say(value, ctx) → [sentence, fields] | null (thumbs: 1 for up, 0 for down), note }
  // One-shot: after the tap the group is done; stars stay filled up to the value, a scale keeps the picked number marked.
  function rating(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), kind = ['thumbs', 'stars', 'scale'].indexOf(cfg.kind) >= 0 ? cfg.kind : 'stars';
    checkCfg('rating', name, cfg, ['title', 'say']); budget("rating('" + name + "')", 'title', cfg.title); budget("rating('" + name + "')", 'line', cfg.text);
    var lo = kind === 'thumbs' ? 0 : kind === 'stars' ? 1 : (cfg.min == null ? 0 : +cfg.min), hi = kind === 'thumbs' ? 1 : kind === 'stars' ? Math.max(3, Math.min(10, +cfg.max || 5)) : (cfg.max == null ? 10 : +cfg.max);
    if (kind === 'scale' && !(hi > lo && hi - lo <= 10)) { warn("rating('" + name + "')", 'a scale holds 2 to 11 values'); hi = Math.min(Math.max(hi, lo + 1), lo + 10); }
    register('rating', name, null, null);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var lang = langOf(cfg, ctx), w = words(lang), labels = cfg.labels || [], o = U.card(lang, 'kit-rating ' + cls);
      U.head(o.box, cfg.kicker || '', cfg.title); if (cfg.text) o.box.appendChild(el('p', 'kit-line', cfg.text));
      var g = U.once('kit-rate is-' + kind); g.setAttribute('role', 'group'); g.setAttribute('aria-label', cfg.title);
      var vals = []; for (var v = lo; v <= hi; v++) vals.push(v); if (kind === 'thumbs') vals = [1, 0];
      var btns = [];
      vals.forEach(function (v) {
        var r = cfg.say(v, ctx); if (!r || !r[0]) return;
        var text = kind === 'thumbs' ? String(labels[v] || (v ? w.yes : w.no)) : kind === 'scale' ? String(v) : '';
        var b = U.reply(text, r[0], { fields: r[1], cls: 'kit-rate-b' + (kind === 'thumbs' ? (v ? ' is-up' : ' is-down') : ''), onSent: function () {
          btns.forEach(function (x) { if (kind === 'stars' ? +x.getAttribute('data-v') <= v : x === b) x.classList.add('is-on'); });
          b.setAttribute('aria-current', 'true'); btns.forEach(function (x) { if (x.classList.contains('is-on')) x.setAttribute('aria-pressed', 'true'); });   // the chosen value, for a screen reader (the rest read as dimmed)
          g.classList.add('is-rated'); g.tabIndex = -1; try { g.focus({ preventScroll: true }); } catch (e) {} } });   // the focused button is now disabled: keep the keyboard's place
        b.setAttribute('data-v', String(v));
        if (kind !== 'scale') withIcon(b, kind === 'thumbs' ? 'thumb' : 'star');
        if (kind !== 'thumbs') b.setAttribute('aria-label', fill(w.rateOf, { n: v, max: hi }) + (kind === 'scale' && v === lo && labels[0] ? ' · ' + labels[0] : kind === 'scale' && v === hi && labels[1] ? ' · ' + labels[1] : ''));
        btns.push(b); g.appendChild(b);
      });
      if (!btns.length) return null;
      if (kind === 'stars') {   // hovering or focusing a star lights the ones before it, so the value reads before the tap
        var hot = function (k) { btns.forEach(function (x) { x.classList.toggle('is-hot', k != null && +x.getAttribute('data-v') <= k); }); };
        btns.forEach(function (b) { var k = +b.getAttribute('data-v'); b.addEventListener('mouseenter', function () { if (!g.classList.contains('is-done')) hot(k); }); b.addEventListener('focus', function () { if (!g.classList.contains('is-done')) hot(k); }); });
        g.addEventListener('mouseleave', function () { hot(null); }); g.addEventListener('focusout', function () { hot(null); });
        btns.forEach(function (b) { b.addEventListener('click', function () { setTimeout(function () { if (!g.classList.contains('is-done')) hot(null); }, 0); }); });   // a tap the send lock refused mustn't look rated
      }
      if (kind === 'scale') { g.style.setProperty('--kit-n', String(btns.length)); g.style.setProperty('--kit-cols', String(btns.length > 6 ? Math.ceil(btns.length / 2) : btns.length)); }
      o.box.appendChild(g);
      if (kind === 'scale' && (labels[0] || labels[1])) { var ends = el('div', 'kit-rate-ends'); ends.setAttribute('aria-hidden', 'true'); ends.appendChild(el('span', null, labels[0] ? lo + ' · ' + labels[0] : '')); ends.appendChild(el('span', null, labels[1] ? hi + ' · ' + labels[1] : '')); /* with their numbers: on two rows the ends don't sit under 0 and 10 */ o.box.appendChild(ends); }
      note(o.box, val(cfg.note, p, ctx), 'is-muted');
      return o;
    });
  }

  LBW.kit = { version: '0.9.4.2', dev: DEV, describe: describe, L: L, last: last, cards: cards, table: table, form: form, contact: contact, chips: chips, carousel: carousel, calc: calc, slots: slots, confirm: confirm, review: review, chart: chartCard, stats: stats, people: people, consent: consent, compare: compare, season: season, rating: rating,
    h: { usedByVisitor: usedByVisitor, wasQuieted: wasQuieted, quietAgain: quietAgain, note: note, list: list, label: label, dup: dup, choice: choice, multiChoice: multiChoice, copyBox: copyBox, status: status, wa: wa, fill: fill, money: money, total: total, lightbox: lightbox, chart: chart, statusHead: statusHead,
      icon: icon, withIcon: withIcon, icons: Object.keys(ICONS), badge: badge, tones: TONES.slice() } };
})(typeof window !== 'undefined' ? window : this);
