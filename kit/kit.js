/* AI Widgets kit v0.11.0 · on lbw.js v0.11.0 · the widgets every url-to-demo build rewrote, written once with options. Load it after lbw.js and before the
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
          open: 'Open now · until {t}', closed: 'Closed now · opens {d} at {t}', closedLong: 'Closed now', today: 'today', change: 'Change', tomorrow: 'tomorrow',
          days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], localTime: 'Local time: {t}', sent: 'Sent', show: 'Show', hide: 'Hide', busy: 'Busy', pick: 'Pick a time', confirm: 'Confirm', yes: 'Yes', no: 'No',
          close: 'Close', prev: 'Previous photo', next: 'Next photo', photos: 'Photos', enlarge: 'Enlarge on the page', cSame: 'The same in all:', cSame2: 'The same in both:',
          sOpen: 'Open today', sClosed: 'Closed today', sUntil: 'Open until', sOpens: 'Opens', sIn: 'Opens in', sCloses: 'Season', sDay: '1 day', sDays: '{n} days', sUnknown: 'The next dates aren’t published yet.' , rateOf: '{n} of {max}', tMore: 'See all {n} rows', tLess: 'See fewer', tPick: 'Choose', tPicked: 'Chosen', tTotal: 'Total', updated: 'Updated', photoOf: 'photo {n} of {max}', day: 'Day', live: 'Live', full: 'Full', addCal: 'Add to calendar', inDays: 'in {n} days', code: 'Booking code', best: 'Best pick' },
    es: { copy: 'Copiar', copied: 'Copiado ✓', select: 'Selecciona el texto y cópialo', summary: 'Tu resumen',
          open: 'Abierto ahora · hasta las {t}', closed: 'Cerrado ahora · abre {d} a las {t}', closedLong: 'Cerrado ahora', today: 'hoy', change: 'Cambiar', tomorrow: 'mañana',
          days: ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'], localTime: 'Hora local: {t}', sent: 'Enviado', show: 'Ver', hide: 'Ocultar', busy: 'Ocupado', pick: 'Elige una hora', confirm: 'Confirmar', yes: 'Sí', no: 'No',
          close: 'Cerrar', prev: 'Foto anterior', next: 'Foto siguiente', photos: 'Fotos', enlarge: 'Ampliar en la página', cSame: 'Igual en todas:', cSame2: 'Igual en las dos:',
          sOpen: 'Abierto hoy', sClosed: 'Cerrado hoy', sUntil: 'Abierto hasta', sOpens: 'Abre', sIn: 'Abre en', sCloses: 'Temporada', sDay: '1 día', sDays: '{n} días', sUnknown: 'Las próximas fechas aún no están publicadas.' , rateOf: '{n} de {max}', tMore: 'Ver las {n} filas', tLess: 'Ver menos', tPick: 'Elegir', tPicked: 'Elegido', tTotal: 'Total', updated: 'Actualizado', photoOf: 'foto {n} de {max}', day: 'Día', live: 'En directo', full: 'Completo', addCal: 'Añadir al calendario', inDays: 'en {n} días', code: 'Código de reserva', best: 'Mejor opción' },
    it: { copy: 'Copia', copied: 'Copiato ✓', select: 'Seleziona il testo e copialo', summary: 'Il tuo riepilogo',
          open: 'Aperto ora · fino alle {t}', closed: 'Chiuso ora · apre {d} alle {t}', closedLong: 'Chiuso ora', today: 'oggi', change: 'Cambia', tomorrow: 'domani',
          days: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'], localTime: 'Ora locale: {t}', sent: 'Inviato', show: 'Mostra', hide: 'Nascondi', busy: 'Occupato', pick: 'Scegli un orario', confirm: 'Conferma', yes: 'Sì', no: 'No',
          close: 'Chiudi', prev: 'Foto precedente', next: 'Foto successiva', photos: 'Foto', enlarge: 'Ingrandisci nella pagina', cSame: 'Uguale in tutte:', cSame2: 'Uguale in entrambe:',
          sOpen: 'Aperto oggi', sClosed: 'Chiuso oggi', sUntil: 'Aperto fino a', sOpens: 'Apre', sIn: 'Apre tra', sCloses: 'Stagione', sDay: '1 giorno', sDays: '{n} giorni', sUnknown: 'Le prossime date non sono ancora pubblicate.' , rateOf: '{n} su {max}', tMore: 'Vedi tutte le {n} righe', tLess: 'Vedi meno', tPick: 'Scegli', tPicked: 'Scelto', tTotal: 'Totale', updated: 'Aggiornato', photoOf: 'foto {n} di {max}', day: 'Giorno', live: 'In diretta', full: 'Completo', addCal: 'Aggiungi al calendario', inDays: 'tra {n} giorni', code: 'Codice di prenotazione', best: 'Scelta migliore' },
    de: { copy: 'Kopieren', copied: 'Kopiert ✓', select: 'Text markieren und kopieren', summary: 'Deine Zusammenfassung',
          open: 'Jetzt geöffnet · bis {t} Uhr', closed: 'Jetzt geschlossen · öffnet {d} um {t} Uhr', closedLong: 'Jetzt geschlossen', today: 'heute', change: 'Ändern', tomorrow: 'morgen',
          days: ['am Sonntag', 'am Montag', 'am Dienstag', 'am Mittwoch', 'am Donnerstag', 'am Freitag', 'am Samstag'], localTime: 'Ortszeit: {t}', sent: 'Gesendet', show: 'Anzeigen', hide: 'Ausblenden', busy: 'Belegt', pick: 'Uhrzeit wählen', confirm: 'Bestätigen', yes: 'Ja', no: 'Nein',
          close: 'Schließen', prev: 'Vorheriges Foto', next: 'Nächstes Foto', photos: 'Fotos', enlarge: 'Auf der Seite vergrößern', cSame: 'Bei allen gleich:', cSame2: 'Bei beiden gleich:',
          sOpen: 'Heute geöffnet', sClosed: 'Heute geschlossen', sUntil: 'Geöffnet bis', sOpens: 'Öffnet', sIn: 'Öffnet in', sCloses: 'Saison', sDay: '1 Tag', sDays: '{n} Tagen', sUnknown: 'Die nächsten Termine sind noch nicht veröffentlicht.' , rateOf: '{n} von {max}', tMore: 'Alle {n} Zeilen anzeigen', tLess: 'Weniger anzeigen', tPick: 'Wählen', tPicked: 'Gewählt', tTotal: 'Gesamt', updated: 'Aktualisiert', photoOf: 'Foto {n} von {max}', day: 'Tag', live: 'Live', full: 'Ausgebucht', addCal: 'Zum Kalender hinzufügen', inDays: 'in {n} Tagen', code: 'Buchungscode', best: 'Beste Wahl' },
    fr: { copy: 'Copier', copied: 'Copié ✓', select: 'Sélectionnez le texte et copiez-le', summary: 'Votre résumé',
          open: 'Ouvert · jusqu’à {t}', closed: 'Fermé · ouvre {d} à {t}', closedLong: 'Fermé', today: 'aujourd’hui', change: 'Modifier', tomorrow: 'demain',
          days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], localTime: 'Heure locale : {t}', sent: 'Envoyé', show: 'Voir', hide: 'Masquer', busy: 'Occupé', pick: 'Choisissez une heure', confirm: 'Confirmer', yes: 'Oui', no: 'Non',
          close: 'Fermer', prev: 'Photo précédente', next: 'Photo suivante', photos: 'Photos', enlarge: 'Agrandir sur la page', cSame: 'Identique pour toutes :', cSame2: 'Identique pour les deux :',
          sOpen: 'Ouvert aujourd’hui', sClosed: 'Fermé aujourd’hui', sUntil: 'Ouvert jusqu’au', sOpens: 'Ouverture', sIn: 'Ouvre dans', sCloses: 'Saison', sDay: '1 jour', sDays: '{n} jours', sUnknown: 'Les prochaines dates ne sont pas encore publiées.' , rateOf: '{n} sur {max}', tMore: 'Voir les {n} lignes', tLess: 'Voir moins', tPick: 'Choisir', tPicked: 'Choisi', tTotal: 'Total', updated: 'Mis à jour', photoOf: 'photo {n} sur {max}', day: 'Jour', live: 'En direct', full: 'Complet', addCal: 'Ajouter au calendrier', inDays: 'dans {n} jours', code: 'Code de réservation', best: 'Meilleur choix' },
    ca: { copy: 'Copia', copied: 'Copiat ✓', select: 'Selecciona el text i copia’l', summary: 'El teu resum',
          open: 'Obert ara · fins a les {t}', closed: 'Tancat ara · obre {d} a les {t}', closedLong: 'Tancat ara', today: 'avui', change: 'Canvia', tomorrow: 'demà',
          days: ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'], localTime: 'Hora local: {t}', sent: 'Enviat', show: 'Mostra', hide: 'Amaga', busy: 'Ocupat', pick: 'Tria una hora', confirm: 'Confirma', yes: 'Sí', no: 'No',
          close: 'Tanca', prev: 'Foto anterior', next: 'Foto següent', photos: 'Fotos', enlarge: 'Amplia a la pàgina', cSame: 'Igual a totes:', cSame2: 'Igual a les dues:',
          sOpen: 'Obert avui', sClosed: 'Tancat avui', sUntil: 'Obert fins al', sOpens: 'Obre', sIn: 'Obre d’aquí a', sCloses: 'Temporada', sDay: '1 dia', sDays: '{n} dies', sUnknown: 'Les properes dates encara no estan publicades.' , rateOf: '{n} de {max}', tMore: 'Veure les {n} files', tLess: 'Veure’n menys', tPick: 'Tria', tPicked: 'Triat', tTotal: 'Total', updated: 'Actualitzat', photoOf: 'foto {n} de {max}', day: 'Dia', live: 'En directe', full: 'Complet', addCal: 'Afegeix al calendari', inDays: 'd’aquí a {n} dies', code: 'Codi de reserva', best: 'Millor opció' }
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
    form: 'cls lang kicker title cta note preset steps summary fields sent allowDup collapse density',
    contact: 'cls lang kicker title big rows topic hours note buttons summary compact allowDup',
    chips: 'cls lang max items own carriedBy',
    carousel: 'cls lang select slide allowDup live style',
    calc: 'cls lang kicker title state cta controls result ready send notes links sent allowDup collapse density',
    slots: 'cls lang kicker title days cta say ics note sep h12 allowDup collapse sent density',
    confirm: 'cls lang form status title rows steps note actions allowDup style code ics countdown sep h12',
    review: 'cls lang kicker title state lines total cta discard send ready note allowDup collapse sent density',
    chart: 'cls lang kicker title sub data note links allowDup',
    stats: 'cls lang items single reply links allowDup',
    people: 'cls lang kicker title items select reply note allowDup',
    consent: 'cls lang icon title text yes no link allowDup',
    compare: 'cls lang kicker title param items rows min max empty note allowDup same primary best',
    season: 'cls lang kicker ranges words rows note reply links allowDup',   // v0.8.1.4: missing since 0.8.1, so dev mode threw and the season card drew nothing
    map: 'cls lang kicker title note places image lines from directions go links sort max allowDup',
    tracker: 'cls lang kicker title note param default ref eta steps states actions links live allowDup',   // v0.10
    rating: 'cls lang kicker title text kind min max labels say note allowDup'
  };
  OPTS.calendar = 'cls lang kicker title cta note mode min max notice horizon months money priceFrom days closed send collapse allowDup';   // v0.10
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
    // v0.9.5 · the send failed (lbw.js shows "Not sent · Retry"): open again, with no "Sent" line; a retry folds it anew
    o.addEventListener('lbw-unsent', function un() { o.removeEventListener('lbw-unsent', un); line.remove(); o.classList.remove('is-collapsed'); });
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
  // v0.9.5 · a question names its group: the title is the group's label (role=group / radiogroup + aria-labelledby);
  // with no title, `aria` (a word) names it
  var QID = 0;
  function question(title, g, aria) {
    var w = el('div', 'kit-q');
    if (title) { var q = el('p', 'kit-ql', title); q.id = 'lbw-kq' + (++QID); w.appendChild(q); g.setAttribute('aria-labelledby', q.id); }
    else if (aria) g.setAttribute('aria-label', aria);
    return w;
  }
  // v0.9.5 · one of several is a radiogroup (WAI-ARIA radio pattern): role=radio + aria-checked, one Tab stop (the checked
  // one, or the first), arrows and Home/End move and choose. Buttons added later (slots redraw) call the returned rove().
  function radioGroup(g) {
    g.setAttribute('role', 'radiogroup');
    var live = function () { return [].filter.call(g.querySelectorAll('[role="radio"]'), function (b) { return !b.disabled; }); };
    function rove() { var bs = live(), on = bs.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0] || bs[0]; bs.forEach(function (b) { b.tabIndex = b === on ? 0 : -1; }); }
    g.addEventListener('keydown', function (e) {
      var k = e.key, dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[k];
      if (!dir && k !== 'Home' && k !== 'End') return; if (g.closest('.is-done')) return;
      var bs = live(), i = bs.indexOf(document.activeElement); if (i < 0 || !bs.length) return;
      e.preventDefault(); var n = k === 'Home' ? 0 : k === 'End' ? bs.length - 1 : (i + dir + bs.length) % bs.length;
      bs[n].focus(); g.kbd = true; try { bs[n].click(); } finally { g.kbd = false; }   // v0.10: a pick by arrow key doesn't move a progressive form on
    });
    return rove;
  }
  // v0.10 · density. "compact" (the default for the multi-step makers: form, calc, review, slots) or "comfy" (the v0.9.5 layout):
  // cfg.density, else the theme's --lbw-density on :root. Compact: one question at a time, short picks as a segmented control,
  // the total and the CTA in a footer that stays in view; every target stays 44 px
  function dense(cfg) {
    var d = cfg.density; if (!d) try { d = getComputedStyle(document.documentElement).getPropertyValue('--lbw-density').trim(); } catch (e) {}
    return d !== 'comfy';
  }
  // 2–3 short options (≤ 14 characters, no description) draw as a segmented control beside their question
  function seg(w, items) { if (items.length >= 2 && items.length <= 3 && items.every(function (it) { return !it[2] && String(it[1]).length <= 14; })) w.classList.add('is-seg'); return w; }
  // the total(s) and the CTA in one footer, sticky at the card's foot (the box clips, it doesn't scroll, so sticky reaches the chat)
  function foot(f, o) { var ft = f.add(el('div', 'kit-foot')), t = ft.appendChild(el('div', 'kit-foot-t')); ft.appendChild(f.cta); o.classList.add('kit-dense'); ft.t = t;
    f.add = function (n) { if (n) f.el.insertBefore(n, ft); return n; }; return ft; }
  function radio(b, on) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false'); return b; }
  function choice(title, items, cur, pick, aria) {   // one of [[key, label], …]; returns the block
    var g = listy(el('div', 'lbw-chips'), items, function (it) { return it[2]; }), w = question(title, g, aria), rove = radioGroup(g);
    items.forEach(function (it) {
      var b = radio(described(U.btn(it[1], 'lbw-tog'), it[1], it[2]), it[0] === cur); b.setAttribute('data-k', it[0]);
      b.addEventListener('click', function () { if (b.closest('.is-done')) return; [].forEach.call(g.children, function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); }); rove(); pick(it[0]); });
      g.appendChild(b);
    });
    rove(); w.appendChild(g); return w;
  }
  function multiChoice(title, items, cur, pick, none) {   // any of them; the `none` key clears the rest and the rest clear it
    var g = listy(el('div', 'lbw-chips'), items, function (it) { return it[2]; }), w = question(title, g); g.setAttribute('role', 'group'); cur = cur || [];
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
  // ── v0.10 · cards & pass: shared pieces ──
  // a price: { now, unit, list } → "159 € /noche ~~180 €~~" (formatted by your data: the kit never does arithmetic on it)
  function priceEl(pr) {
    if (!pr || !pr.now) return null; var n = el('div', 'kit-price'); n.appendChild(el('strong', null, pr.now));
    if (pr.unit) n.appendChild(el('span', 'kit-unit', pr.unit)); if (pr.list) n.appendChild(el('s', 'kit-list', pr.list)); return n;
  }
  // a card's photo, full-bleed on top of the box (the box is its only frame)
  function media(o, im, title) {
    var f = U.img(im.src, 'kit-media' + (im.cls ? ' ' + im.cls : ''), Object.assign({ sizes: '(max-width: 480px) 92vw, 520px', alt: im.alt == null ? '' : im.alt }, im));
    o.box.insertBefore(f, o.box.firstChild); o.classList.add('has-media'); return f;
  }
  // "189 € · 6 libres": the first part is the value, the rest is quieter (the text is the same: a screen reader and a test read it whole)
  function splitVals(dl) {
    [].forEach.call(dl.querySelectorAll('dd'), function (dd) { var t = dd.textContent, i = t.indexOf(' · '); if (i < 1 || dd.children.length) return;
      dd.textContent = ''; dd.appendChild(el('span', 'kit-v', t.slice(0, i))); dd.appendChild(el('span', 'kit-v2', t.slice(i))); });
    return dl;
  }
  // motion (v0.10 rules): once, only when the node is on screen in a visible tab and motion is allowed. Without it the
  // final state is the default, so a frozen or skipped animation never leaves anything half drawn.
  function whenSeen(n, cls, ms) {
    try {
      if (!root.IntersectionObserver || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      var io = new root.IntersectionObserver(function (es) {
        if (!es.some(function (e) { return e.isIntersecting; }) || document.visibilityState !== 'visible') return;
        io.disconnect(); n.classList.add(cls); setTimeout(function () { n.classList.remove(cls); }, ms || 900);
      }, { threshold: 0.5 });
      io.observe(n);
    } catch (e) {}
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // ── cards: one item from a table ────────────────────────────────────────────────────────────────
  // cfg = { cls, param: 'id', items: { id: item }, kicker, reply(id, item, ctx) → [label, say] | null, links(id, item, ctx) → [el…],
  //         disclaimer, lang, single: true (no id: draws items._),
  //         fallback: 'id' (v0.3: an UNSET id, a flow's @{field}, draws that item instead of nothing; an unknown id still draws nothing) }
  // item = { kicker, title, who, line, points: [], pointsCls: 'is-check', rows: [[label, value]], note, noteCls, link: [label, url],
  //          img: { src, srcset, alt, width, height } (v0.10: full-bleed on top), price: { now, unit, list } (v0.10: on the photo, or under the title) }
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
      // v0.10 · a card with a photo leads with it, full-bleed (one frame), the badge and the price on it over a scrim
      var md = it.img && it.img.src ? media(o, it.img, it.title) : null, pr = priceEl(it.price);
      if (md) { var bd = badgeOf(it.badge); if (bd) { bd.classList.add('kit-on-photo'); md.appendChild(bd); } }
      U.head(o.box, it.kicker || val(cfg.kicker, id, it) || '', it.title, md ? null : badgeOf(it.badge));
      statusHead(o.box, sk ? cfg.status.items[sk] : it.status);   // under the title, as on every card (v0.8.1.4 critique)
      if (pr) { if (md && !/\bis-product\b/.test(it.img.cls || '')) { pr.classList.add('is-over'); o.classList.add('has-over'); } o.box.appendChild(pr); }   // after the title in the DOM: a screen reader hears the name first
      if (it.who) o.box.appendChild(el('p', 'kit-who', it.who));
      if (it.line) o.box.appendChild(el('p', 'kit-line', it.line));
      if (it.rows) meters(splitVals(U.rows(o.box, it.rows)), it.rows, lang).classList.add('kit-lines');   // v0.10: values split at ' · ' (cards & pass), [label, value, { of }] rows carry a meter (live & numbers)
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
      // v0.10 · "meter": { "col": "plazas", "of": 12 | "aforo" (a column), "low", "full" }: that column draws a meter, a row at 0 is muted and has no pick
      var mt = t.meter && typeof t.meter.col === 'string' ? t.meter : null, ck = cols.map(function (c) { return c[0]; }), mi = mt ? ck.indexOf(mt.col) : -1, oi = mt && typeof mt.of === 'string' ? ck.indexOf(mt.of) : -1;
      U.head(o.box, t.kicker || val(cfg.kicker, id, t) || '', t.title);
      var wrap = el('div', 'kit-tbl-wrap'), tb = el('table', 'kit-tbl' + (cfg.pick ? ' is-pick' : '')), head = el('thead'), hr = el('tr'), body = el('tbody');
      // a keyboard stop and a region only when it scrolls (critique 0.8.1.11: an empty tab stop otherwise)
      // v0.9.5 · split in a read and a write, so that one ResizeObserver for every table reads them all before it writes any
      var scrollsRead = function () { var on = wrap.scrollWidth > wrap.clientWidth + 1; return function () { if (on) { wrap.setAttribute('tabindex', '0'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', t.title || ''); } else { wrap.removeAttribute('tabindex'); wrap.removeAttribute('role'); wrap.removeAttribute('aria-label'); } }; };
      if (root.ResizeObserver) sized(wrap, scrollsRead); else setTimeout(function () { scrollsRead()(); }, 0);
      var cap = el('caption', 'kit-sr', t.title || ''); tb.appendChild(cap);
      // v0.8.1.13 · a column with no value in any row is left out (Callan: the online timetable's empty "Rate"); pick still reads it
      var shown = cols.map(function (c, j) { return rows.some(function (r) { return r[j] != null && String(r[j]).trim() !== ''; }); });
      // v0.8.1.14 · a column that says the same in every row (3 rows or more, not the first) leaves the table for one line
      // above it, "Días: L/X o M/J" (Callan: the days on every timetable row squeezed the times into two lines)
      var same = [];
      if (rows.length >= 3 && cfg.same !== false) cols.forEach(function (c, j) { if (!j || !shown[j] || j === mi) return; var v = rows[0][j] == null ? '' : String(rows[0][j]); if (v.trim() && rows.every(function (r) { return String(r[j] == null ? '' : r[j]) === v; }) && shown.filter(Boolean).length > 2) { same.push(c[1] + ': ' + v); shown[j] = false; } });
      cols.forEach(function (c, j) { if (!shown[j]) return; var th = el('th', c[2] === 'end' ? 'is-end' : '', c[1]); th.setAttribute('scope', 'col'); hr.appendChild(th); });
      if (cfg.pick) { var thp = el('th', 'kit-tbl-act', ''); thp.appendChild(el('span', 'kit-sr', cfg.pick.label || w.tPick)); hr.appendChild(thp); }
      head.appendChild(hr); tb.appendChild(head); tb.appendChild(body);
      var g = cfg.pick ? U.once('kit-tbl-once') : null, more = null;
      rows.forEach(function (r, i) {
        var tr = el('tr', i >= fold && rows.length > fold + 1 ? 'is-folded' : '');
        var first = true, mtd = null; cols.forEach(function (c, j) { if (!shown[j]) return; var td = el(first ? 'th' : 'td', c[2] === 'end' ? 'is-end' : '', r[j] == null ? '' : String(r[j])); if (first) td.setAttribute('scope', 'row'); first = false; if (j === mi) mtd = td; tr.appendChild(td); });
        var full = mtd ? meterIn(tr, mtd, { of: oi >= 0 ? r[oi] : mt.of, low: mt.low, full: mt.full, word: !!mt.full }, r[mi], lang) === 'full' : false;
        if (cfg.pick) {
          var row = {}; cols.forEach(function (c, j) { row[c[0]] = r[j] == null ? '' : String(r[j]); });
          var say = cfg.pick.say(row, id); var td2 = el('td', 'kit-tbl-act');
          // the verb on a bordered button, not a bare ›: in a chat › reads as "open details" (critique 0.8.1.11). Its label
          // names the whole row ("Elegir: Hora 12:00, Plazas 4, Precio 14 €"); once sent it says it was chosen.
          var whole = cols.filter(function (c, j) { return shown[j]; }).map(function (c) { var j = cols.indexOf(c); return c[1] + ' ' + (r[j] == null ? '' : r[j]); }).join(', ');
          if (say && !full) { var b = U.reply(cfg.pick.label || w.tPick, say, { fields: cfg.pick.fields ? cfg.pick.fields(row, id) : undefined, cls: 'kit-tbl-b', onSent: function (x) {
              var t2 = x.closest('tr'); if (t2) t2.classList.add('is-picked');
              x.textContent = ''; x.setAttribute('aria-label', w.tPicked + ': ' + x.getAttribute('data-row'));   /* v0.8.1.14: only the ✓ (CSS) — a wider "✓ Elegido" overflowed the table and the held first column covered the next one (Callan live) */ x.setAttribute('aria-pressed', 'true');
              tb.classList.add('is-open'); if (more) more.hidden = true;   // the chosen row never folds away, and nothing is left to unfold
            } });
            b.setAttribute('data-row', whole); b.setAttribute('aria-label', (cfg.pick.label || w.tPick) + ': ' + whole); td2.appendChild(b);
            b.addEventListener('lbw-unsent', function (e) { var x = e.target, t3 = x.closest('tr'); if (t3) t3.classList.remove('is-picked');   // v0.9.5: not sent, not picked
              x.textContent = cfg.pick.label || w.tPick; x.setAttribute('aria-label', (cfg.pick.label || w.tPick) + ': ' + x.getAttribute('data-row')); x.removeAttribute('aria-pressed'); }); }
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
      // v0.10 · compact: one question at a time. An answered step folds to one line ("Who with · As a couple · Change") that
      // opens it again; the next question appears once this one is answered; "2 / 3" beside the title
      var prog = dense(cfg) && cfg.steps.length > 1, at = -1, wraps = [], sums = [], ind = prog && cfg.title ? el('span', 'kit-count kit-stepn') : null, w = words(lang);
      if (prog) { o.classList.add('kit-dense'); ind && ind.setAttribute('aria-hidden', 'true'); }
      if (cfg.title) U.head(o.box, cfg.kicker || '', cfg.title, ind);
      o.box.appendChild(f.el);
      var slots = cfg.steps.map(function (st, i) {
        if (!prog) return f.add(el('div', 'kit-step'));   // was 'kit-slot', the time button's class: every form step drew as a bordered box (v0.8.1)
        var wr = wraps[i] = f.add(el('div', 'kit-step')), sm = sums[i] = wr.appendChild(U.btn('', 'kit-sum'));
        sm.setAttribute('aria-expanded', 'false');
        sm.addEventListener('click', function () { if (sm.closest('.is-done')) return; at = i; lay(); var t = slots[i].querySelector('[tabindex="0"], .lbw-tog'); if (t) t.focus(); });
        return wr.appendChild(el('div', 'kit-step-q'));
      });
      function answered(i) { var v = f.state[cfg.steps[i].key]; return cfg.steps[i].multi ? !!(v && v.length) : v != null; }
      function lay(from) {
        var had = from && from.contains(document.activeElement), gate = false, opened = null, n = 0, pos = 0;
        cfg.steps.forEach(function (st, i) {
          var has = !!slots[i].firstChild, ans = answered(i), mode = !has ? 'skip' : i === at ? 'open' : ans ? 'sum' : gate ? 'wait' : 'open';
          if (mode === 'open' && !ans && !st.optional) { if (!gate && !pos) pos = n + 1; gate = true; }
          if (mode === 'open' && opened == null && i !== at) opened = i;
          if (has) n++;
          wraps[i].className = 'kit-step is-' + mode;
          if (mode === 'sum') {
            var items = val(st.items, f.state) || [], v = f.state[st.key], picked = (st.multi ? v : [v]).map(function (k) { return label(items, k); }).join(', ');
            sums[i].textContent = ''; sums[i].appendChild(el('span', 'kit-sum-q', st.title || '')); sums[i].appendChild(el('span', 'kit-sum-a', picked)); sums[i].appendChild(el('span', 'kit-sum-e', w.change));
          }
        });
        if (ind) ind.textContent = (pos || n) + ' / ' + n;
        if (had && !from.parentNode.classList.contains('is-open')) { var t = opened != null ? slots[opened].querySelector('[tabindex="0"], .lbw-tog') : null; try { (t || f.cta).focus({ preventScroll: true }); } catch (e) {} }
      }
      function draw(i) {
        var st = cfg.steps[i], slot = slots[i]; slot.textContent = '';
        var items = val(st.items, f.state); if (!items || !items.length) return;
        var pick = function (v) {
          var changed = JSON.stringify(f.state[st.key]) !== JSON.stringify(v); f.state[st.key] = v;
          if (changed) for (var j = i + 1; j < cfg.steps.length; j++) if (typeof cfg.steps[j].items === 'function') { f.state[cfg.steps[j].key] = cfg.steps[j].multi ? [] : null; draw(j); }
          f.update();
          if (prog) { var rg = slot.querySelector('[role="radiogroup"]'); at = st.multi || (rg && rg.kbd) ? i : -1; lay(slot); }   // a multi step stays open until another is touched
        };
        slot.appendChild(st.multi ? multiChoice(st.title, items, f.state[st.key], pick, st.none) : prog ? seg(choice(st.title, items, f.state[st.key], pick), items) : choice(st.title, items, f.state[st.key], pick));
        f.el.classList.toggle('has-list', !!f.el.querySelector('.lbw-chips.is-list'));   // v0.8.1.10: the plain steps then draw as a grid that matches
      }
      cfg.steps.forEach(function (s, i) { draw(i); });
      if (prog) lay();
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
    var sl = el('div', 'lbw-slide kit-slide'); sl.setAttribute('role', 'listitem');   /* v0.9.5: an <article> may not be a listitem (axe) */ if (s.id) sl.setAttribute('data-id', s.id);
    // v0.8.1.7 · a slide's photo is drawn ~70 % of a phone's width, ~300 px on a wide column: ask for that, not the 90vw default
    if (s.img) { var io = s.img.sizes ? s.img : Object.assign({}, s.img, { sizes: '(max-width: 480px) 65vw, 300px' });   /* v0.8.1.8: 65vw keeps a 2× phone on a ~500 px copy (72vw sent it to the ~960 px one: 4× the bytes, seen live) */ var im = U.img(s.img.src, 'kit-img' + (s.img.cls ? ' ' + s.img.cls : ''), io); if (s.badge) im.appendChild(el('span', 'kit-badge', s.badge)); sl.appendChild(im);
      if (s.gallery && s.gallery.photos && s.gallery.photos.length) zoomable(im, s.gallery, s.name); }   // v0.3: the photo opens LBW.kit.h.lightbox
    var b = el('div', 'lbw-slide-body'); sl.appendChild(b);
    if (s.kicker) b.appendChild(el('div', 'kit-slide-kicker', s.kicker));
    var nm = b.appendChild(el('div', 'lbw-name', s.name)); nm.setAttribute('role', 'heading'); nm.setAttribute('aria-level', '4');   // v0.9.5: under the card's level-3 title
    if (s.sub) b.appendChild(el('div', 'lbw-muted kit-sub', s.sub));
    var pr = priceEl(s.price); if (pr) { b.appendChild(pr); if (s.img && !(s.img.cls && /\bis-product\b/.test(s.img.cls))) { pr.classList.add('is-over'); sl.classList.add('has-over'); } }   // v0.10: on the photo (a product shot on white keeps it below)
    if (s.save) b.appendChild(el('div', 'kit-save', s.save));
    if (s.status) { var stt = tone(s.status.tone, s.status.ok ? 'ok' : ''); var sd = el('div', 'kit-stock' + (stt ? ' is-' + stt : ''), s.status.text); if (stt && stt !== 'neutral') withIcon(sd, { ok: 'check', info: 'info', warn: 'alert', danger: 'x' }[stt]); b.appendChild(sd); }   // v0.8.1.4: a tone, or ok: true as before
    if (s.desc) b.appendChild(el('p', 'kit-desc', s.desc));
    // v0.10 · a slide's reply is a quiet ring, never a fill: one primary per carousel (its own reply, under the strip)
    var acts = []; if (s.reply) acts.push(U.reply(s.reply[0], s.reply[1], { fields: s.reply[2], cls: 'kit-slide-b' })); if (s.link) acts.push(U.link(s.link[0], s.link[1]));
    if (acts.length) U.row(b, acts);
    return sl;
  }
  // ── layout reads, batched (v0.9.5) ──
  // afterLayout(read): read() runs after the next frame has been laid out (a requestAnimationFrame, then a task), with every
  // other read queued for that frame, and only then the writes they answer (a function, or nothing). A read inside the
  // requestAnimationFrame itself forced a synchronous layout of the whole chat (the review's top cost on the live page).
  var readQ = [], readT = false;
  function flushReads() { readT = false; var q = readQ; readQ = []; q.map(function (r) { try { return r(); } catch (e) { return null; } }).forEach(function (w) { if (typeof w === 'function') w(); }); }
  function afterLayout(read) { readQ.push(read); if (readT) return; readT = true; requestAnimationFrame(function () { setTimeout(flushReads, 0); }); }
  // sized(el, read): one ResizeObserver for every element; a callback reads every element that changed, then writes
  var sizeRO = null, sizeFns = typeof WeakMap === 'function' ? new WeakMap() : null;
  function sized(n, read) {
    if (!sizeFns) { new root.ResizeObserver(function () { read()(); }).observe(n); return; }
    if (!sizeRO) sizeRO = new root.ResizeObserver(function (es) { es.map(function (e) { var r = sizeFns.get(e.target); return r ? r() : null; }).forEach(function (w) { if (typeof w === 'function') w(); }); });
    sizeFns.set(n, read); sizeRO.observe(n);
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
        if (sel.title || sel.kicker) st.setAttribute('aria-label', sel.title || sel.kicker);   // v0.9.5: a focusable list has a name
        sel.items.forEach(function (x, i) { var s = cfg.slide(x, ctx), wh = "carousel('" + name + "') slide " + i;
          if (s && s.gallery && !s.gallery.lang) s = Object.assign({}, s, { gallery: Object.assign({}, s.gallery, { lang: lang }) });   // v0.8.1.7: the lightbox and its label speak the card's language
          if (!s || !s.name) { warn(wh, 'no name: the slide was left out'); return; }
          budget(wh, 'title', s.name); budget(wh, 'line', s.desc); st.appendChild(slideEl(s)); });
        if (!st.children.length) return false;
        // v0.10 · photos lead: the slides are the cards (no box around them: one frame per photo). "style": "box" keeps the box
        if (cfg.style !== 'box' && st.querySelector('.kit-img:not(.is-empty)')) o.classList.add('is-media');
        U.head(o.box, sel.kicker || '', sel.title || '');
        note(o.box, sel.lead); o.box.appendChild(st); note(o.box, sel.note);
        // v0.8.1.1 · "1 / 6": the cut slide says "swipe", the count says how far. It follows the strip.
        var total = st.children.length, hd = o.box.querySelector('.lbw-head');
        if (total > 1 && hd) {
          var cnt = el('span', 'kit-count', ''); cnt.setAttribute('aria-hidden', 'true'); hd.appendChild(cnt);
          // the slides fully in view: "1 / 6" on a phone, "1–2 / 4" on a wide column; nothing when all fit. v0.9.5: it only
          // reads, and answers the write to make, so the first count waits for the frame's own layout (afterLayout) instead of
          // forcing one of the whole chat, and several carousels read together before any of them writes
          var count = function () {
            if (st.scrollWidth <= st.clientWidth + 2) return function () { cnt.textContent = ''; };
            var b = st.getBoundingClientRect(), a = -1, z = -1, best = 0, bi = 0;
            [].forEach.call(st.children, function (c, i) { var r = c.getBoundingClientRect(), ov = Math.min(r.right, b.right) - Math.max(r.left, b.left);
              if (ov > best) { best = ov; bi = i; } if (r.left >= b.left - 2 && r.right <= b.right + 2) { if (a < 0) a = i; z = i; } });
            if (a < 0) a = z = bi;
            var txt = (a === z ? (a + 1) : (a + 1) + '–' + (z + 1)) + ' / ' + total;
            return function () { cnt.textContent = txt; };
          };
          cnt.textContent = '1 / ' + total;
          if (typeof requestAnimationFrame === 'function') afterLayout(count);
          var tick = null; st.addEventListener('scroll', function () { if (tick) return; tick = setTimeout(function () { tick = null; count()(); }, 80); }, { passive: true });
        }
        var acts = []; if (sel.reply) { var g = U.once('kit-actions'); g.appendChild(U.reply(sel.reply[0], sel.reply[1], { primary: true, fields: sel.reply[2] })); acts.push(g); }
        acts = acts.concat(buttons(sel.links)); if (acts.length) U.row(o, acts);
        return true;
      }
      // v0.7.6 · live data: select() may answer { later: a promise, then(data) → the selection, fallback() → a selection from
      // the snapshot }. The card is a skeleton until the data comes; with no data and no fallback it removes itself.
      if (sel.later) {
        o = U.loading(lang, 'kit-carousel ' + cls);
        return LBW.later(o, sel.later, function (d) { var ok = fill(o, sel.then(d)); if (ok && cfg.live) liveMark(o, lang); return ok; },   // v0.10: drawn from the live answer
          sel.fallback ? function () { if (!fill(o, sel.fallback())) throw new Error('nothing to show');
            // v0.9.2 · upgrade(o) → a promise of the selection from data that came late (null: keep these slides). Drawn on a
            // fresh card and moved in; v0.10: the strip stays on the slide it showed, and what changed flashes (liveSwap)
            if (sel.upgrade) sel.upgrade(o).then(function (s2) { var n = U.card(lang, 'kit-carousel ' + cls); if (!s2 || !fill(n, s2)) return;
              var q = wasQuieted(o);   // v0.9.3: the conversation moved on: the live slides come in quiet too
              liveSwap(o, function () { while (o.firstChild) o.removeChild(o.firstChild); o.className = n.className; while (n.firstChild) o.appendChild(n.firstChild); o.box = n.box; if (q) quietAgain(o); }, lang);
              if (cfg.live) liveMark(o, lang); }, function () {}); } : null);   // v0.9.5: focus kept, "Updated" said
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
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-calc ' + cls), out = el('div', 'kit-out'), said = '', was = null;
      var f = U.form('kit-calcform', { state: state, cta: cfg.cta, ready: cfg.ready,
        send: function (s) { var r = cfg.send(s); said = r && r[0]; return r; },
        sent: function (s) { if (cfg.collapse !== false && said) fold(o, said, lang); if (cfg.sent) cfg.sent(s); },
        // v0.9.5 · a changed total is said (the total lines only, never the breakdown), after the control that changed it
        // v0.10 · compact: the total lines go to the footer, beside the CTA; a changed total ticks to its new value
        change: function (s) { var shown = tots(ft ? ft.t : out); out.textContent = ''; cfg.result(s, out, ctx); var ts = out.querySelectorAll('.kit-total'); if (ft) { ft.t.textContent = ''; [].forEach.call(ts, function (x) { ft.t.appendChild(x); }); }
          tots(ft ? ft.t : out).forEach(function (n, i) { if (was != null) tick(n, shown[i] && shown[i].textContent, n.textContent); });
          var t = totalsText(ft ? ft.t : out); if (was != null && t && t !== was) LBW.announce(t, lang, 'total:' + name); was = t; } });
      var cpt = dense(cfg), ft = null;
      U.head(o.box, val(cfg.kicker, p, ctx, state) || '', val(cfg.title, p, ctx, state)); o.box.appendChild(f.el);
      var grid = null;   // v0.10 · compact: steppers side by side, two to a row (an odd last one takes the row, label beside it)
      cfg.controls.forEach(function (c) {
        if (!c.stepper) grid = null; else if (cpt && !grid) grid = f.add(el('div', 'kit-stepgrid'));
        if (c.stepper) (grid ? function (n) { return grid.appendChild(n); } : f.add)(U.stepper(c.label, f.state[c.stepper], { min: c.min, max: c.max, step: c.step, format: c.format, less: c.less, more: c.more, hint: c.hint, change: function (v) { f.state[c.stepper] = v; f.update(); } }));
        else if (c.pick) { var its = val(c.items, f.state, p, ctx), q = f.add(choice(c.title, its, f.state[c.pick], function (k) { f.state[c.pick] = k; f.update(); })); if (cpt) seg(q, its || []); }
        else if (c.node) f.add(c.node(f.state, p, ctx));
      });
      f.add(out); if (cpt) ft = foot(f, o);
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
  function tots(box) { return [].slice.call(box.querySelectorAll('.kit-total > strong')); }   // v0.10: the totals a change ticks
  function totalsText(box) { return [].map.call(box.querySelectorAll('.kit-total'), function (t) { return [].map.call(t.children, function (c) { return c.textContent.trim(); }).join(' '); }).join('. '); }
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
    ov.setAttribute('lang', g.lang || (opener && opener.closest && opener.closest('[lang]') ? opener.closest('[lang]').getAttribute('lang') : 'en'));   // v0.9.5: on <body>, outside the widget: its own lang
    var top = el('div', 'kit-ovl-top'), cap = el('span', 'kit-ovl-cap'), x = U.btn('×', 'kit-ovl-x'); x.setAttribute('aria-label', w.close || 'Close');
    cap.setAttribute('aria-live', 'polite'); cap.setAttribute('aria-atomic', 'true');   // v0.9.5: ←/→ say which photo (the chat's region is inert under the dialog)
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
      var n = g.photos.length, of = n > 1 ? fill(w.photoOf, { n: i + 1, max: n }) : '';   // v0.9.5: no two photos with the same alt
      stage.appendChild(U.img(p.src, 'kit-ovl-img', { srcset: p.srcset, sizes: '100vw', alt: [p.alt || g.title || '', of].filter(Boolean).join(', ') }));
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
      var dq = f.add(choice('', days.map(function (d) { return [String(d.day), dayLabel(d.day)]; }), String(days[0].day), function (k) { f.state.day = +k; f.state.from = f.state.to = null; drawDay(); f.update(); }, w.day));
      if (dense(cfg)) {   // v0.10 · compact: the days as a date strip (weekday, a big day number, the month), the full date as each one's name
        o.classList.add('kit-dense'); dq.classList.add('kit-dates');
        [].forEach.call(dq.querySelectorAll('[role="radio"]'), function (b) {
          var n = +b.getAttribute('data-k'), part = function (x) { return D.format(n, lang, x); };
          b.setAttribute('aria-label', part({ weekday: 'long', day: 'numeric', month: 'long' })); b.textContent = ''; b.classList.add('kit-day');
          b.appendChild(el('span', 'kit-dw', part({ weekday: 'short' }).replace(/\.$/, ''))); b.appendChild(el('span', 'kit-dn', part({ day: 'numeric' }))); b.appendChild(el('span', 'kit-dm', part({ month: 'short' }).replace(/\.$/, '')));
        });
      }
      var list = f.add(el('div', 'kit-slotlist')), rove = radioGroup(list); list.setAttribute('aria-label', w.pick);   // v0.9.5: the times are one of several
      function drawDay() {
        list.textContent = ''; var d = days.filter(function (x) { return x.day === f.state.day; })[0]; if (!d) return;
        d.slots.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (sl) {
          var busy = sl[2] === 'busy', t = fmtT(sl[0]) + '–' + fmtT(sl[1]), b = radio(U.btn((busy ? w.busy + ' · ' : '') + t, 'kit-slot' + (busy ? ' is-busy' : '')), false);
          if (busy) { b.disabled = true; b.setAttribute('aria-label', t + ' · ' + w.busy); }   // the time first, as on the free ones
          else b.addEventListener('click', function () { if (b.closest('.is-done')) return; [].forEach.call(list.children, function (x) { if (!x.disabled) x.setAttribute('aria-checked', x === b ? 'true' : 'false'); }); rove(); f.state.from = sl[0]; f.state.to = sl[1]; f.update(); });
          list.appendChild(b);
        });
        rove();
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
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-confirm ' + cls), t = val(cfg.title, ls, ctx), w = words(lang);
      budget("confirm('" + name + "')", 'title', t);
      // v0.10 · a booking code: from the sent state or a param, never invented; a value that isn't a plain code is left out
      var code = String(val(cfg.code, ls, ctx) || '').trim(); if (code && !/^[A-Za-z0-9][A-Za-z0-9 ._\/-]{0,23}$/.test(code)) { LBW.drop('confirm ' + name + ': the code is not a plain code'); code = ''; }
      if (cfg.style === 'pass') return pass(o, cfg, ls, ctx, lang, t, code);
      U.head(o.box, '', t); statusHead(o.box, { text: val(cfg.status, ls, ctx), tone: 'ok' });   // v0.8.1.4: the status under the title, as on every card
      var rows = (val(cfg.rows, ls, ctx) || []).concat(code ? [[w.code, code]] : []); if (rows.length) U.rows(o.box, rows).classList.add('kit-lines');
      list(o.box, val(cfg.steps, ls, ctx), 'is-steps'); note(o.box, val(cfg.note, ls, ctx), 'is-muted');
      var a = buttons(cfg.actions && cfg.actions(ls, ctx)); if (a.length) U.row(o, a);
      return o;
    });
  }
  // v0.10 · the "pass": a ticket for a booking. The status with a check that draws itself, the title, the date big and the
  // time (a slots booking), then a perforation and the stub: the rows (less the one that repeats the time), the booking code,
  // the next steps, the note. Its primary is "Add to calendar" (the .ics the slots widget makes) when there is a date.
  function pass(o, cfg, ls, ctx, lang, t, code) {
    var w = words(lang), s = ls.state || {}, day = typeof s.day === 'number' ? s.day : null, box = o.box;
    var fmt = function (m) { return T.format(m, cfg.sep, { h12: cfg.h12 }); }, tm = day != null && !s.cal && typeof s.from === 'number' ? fmt(s.from) + (typeof s.to === 'number' ? '–' + fmt(s.to) : '') : '';
    o.classList.add('kit-pass');
    var top = box.appendChild(el('div', 'kit-pass-top')), bar = top.appendChild(el('div', 'kit-pass-bar')), ck = bar.appendChild(el('span', 'kit-pass-i')), ic = icon('check'), st = val(cfg.status, ls, ctx);
    if (ic) ck.appendChild(ic); if (st) bar.appendChild(el('span', 'kit-pass-st', st));
    if (day != null && cfg.countdown !== false) { var n = day - D.today(); if (n >= 0 && n <= 366) bar.appendChild(el('span', 'kit-pass-in', cap(n === 0 ? w.today : n === 1 ? w.tomorrow : fill(w.inDays, { n: n })))); }
    U.head(top, '', t);
    if (day != null) {
      var wh = top.appendChild(el('div', 'kit-pass-when')), dt = wh.appendChild(el('div', 'kit-pass-date')), f = function (k) { var x = {}; x[k] = k === 'day' ? 'numeric' : 'long'; return D.format(day, lang, x); };
      dt.appendChild(el('span', 'kit-pass-wd', f('weekday'))); dt.appendChild(el('span', 'kit-pass-d', f('day'))); dt.appendChild(el('span', 'kit-pass-m', f('month')));
      if (tm) wh.appendChild(el('div', 'kit-pass-t', tm));
    }
    var stub = el('div', 'kit-pass-stub'), rows = (val(cfg.rows, ls, ctx) || []).filter(function (r) { return !(tm && r && String(r[1]).replace(/\s/g, '') === tm.replace(/\s/g, '')); });
    if (code) { var c = stub.appendChild(el('div', 'kit-pass-code')); c.appendChild(el('span', null, w.code)); c.appendChild(el('strong', null, code)); }
    if (rows.length) U.rows(stub, rows).classList.add('kit-lines');
    list(stub, val(cfg.steps, ls, ctx), 'is-steps'); note(stub, val(cfg.note, ls, ctx), 'is-muted');
    if (stub.children.length) box.appendChild(stub); else o.classList.add('is-short');
    var a = buttons(cfg.actions && cfg.actions(ls, ctx)), e = day != null && cfg.ics !== false ? (val(cfg.ics, ls, ctx) || {}) : null;
    if (e) { var cal = withIcon(U.ics(e.label || w.addCal, (s.cal ? { title: e.title || t, day: day, end: typeof s.to === 'number' && s.to > day ? s.to - 1 : day, where: e.where, file: e.file || 'reserva' } : { title: e.title || t, day: day, from: s.from, to: s.to, where: e.where, file: e.file || 'reserva' }), 'is-primary kit-pass-cal'), 'calendar');
      a.forEach(function (x) { x.classList.remove('is-primary'); }); a.unshift(cal); }   // one primary
    if (a.length) U.row(o, a);
    whenSeen(ck, 'is-drawing', 900);
    return o;
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
      var lang = langOf(cfg, ctx), o = U.card(lang, 'kit-review ' + cls), said = '', vals = [], was = null, cpt = dense(cfg);
      var f = U.form('kit-reviewform', { state: state, cta: cfg.cta, ready: cfg.ready,
        change: function (s) { vals.forEach(function (v) { v.node.textContent = v.fn(s); }); if (tot) { var t = cfg.total.value(s), shown = tot.textContent; tot.textContent = t; if (was != null) tick(tot, shown, t); if (was != null && t !== was) LBW.announce(cfg.total.label + ' ' + t, lang, 'total:' + name); was = t; } },   // v0.9.5
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
          if (cpt) { var sw = el('span', 'kit-selw'); sw.appendChild(sel); r.appendChild(sw); r.classList.add('has-sel'); } else r.appendChild(sel);   // v0.10: a chip that opens the list (the chevron follows the accent)
        } else { var v = el('span', 'kit-rvalue'); r.appendChild(v); vals.push({ node: v, fn: ln.value }); }
        dl.appendChild(r);
      });
      // v0.10 · compact: a receipt (lines, a dashed rule, the total big) whose total and Confirm stay in view in a footer
      var ft = cpt ? foot(f, o) : null;
      var tot = null; if (cfg.total) { var tr = ft ? ft.t.appendChild(el('div', 'kit-rtotal')) : f.add(el('div', 'kit-rtotal')); tr.appendChild(el('span', null, cfg.total.label)); tot = el('strong'); tr.appendChild(tot); }
      if (cfg.discard) { var dz = U.reply(cfg.discard[0], cfg.discard[1], { cls: 'kit-discard' }); if (ft) ft.appendChild(dz); else f.add(dz); }
      note(o.box, val(cfg.note, p, ctx, state), 'is-muted');
      return o;
    });
  }
  // v0.9.3 · late data and the visitor's own messages. The runtime quiets every one-shot group above the visitor's last
  // message (is-stale + is-done + is-spent), so "used" is only what the visitor pressed: a sent button or a ticked toggle.
  // Measured live: a message typed or sent before the data landed kept untouched cards on their saved copy.
  function usedByVisitor(o) { return !!o.querySelector('.is-sent, [aria-pressed="true"], [aria-checked="true"]'); }
  // v0.9.5 · a card redrawn in place (the late-data upgrade, setup's transplant) keeps the keyboard's place: before the swap
  // keepPlace(o) notes what had focus (the same sentence, slide, option or strip); the function it returns puts focus on its
  // twin in the new content, or on the card's title. Nothing happens when focus wasn't in the card.
  function keepPlace(o) {
    var a = document.activeElement; if (!a || !o.contains(a)) return function () {};
    var say = a.getAttribute('data-say'), k = a.getAttribute('data-k'), sl = a.closest('[data-id]'), id = sl && sl.getAttribute('data-id'), strip = a.classList.contains('lbw-strip');
    var same = function (sel, at, v) { return [].filter.call(o.querySelectorAll(sel), function (x) { return x.getAttribute(at) === v; })[0] || null; };
    return function () {
      var t = say != null ? same('[data-say]', 'data-say', say) : null;
      if (!t && k != null) t = same('[data-k]', 'data-k', k);
      if (!t && id != null) { var s2 = same('[data-id]', 'data-id', id); t = s2 && s2.querySelector('button:not(:disabled), a[href]'); }
      if (!t && strip) t = o.querySelector('.lbw-strip');
      if (t && !t.disabled) { try { t.focus({ preventScroll: true }); } catch (e) {} if (document.activeElement === t) return; }
      U.rescue(o, null);
    };
  }
  // the late data replaced a card the visitor could see: "Updated: Rooms" in the chat's live region
  function upgraded(o, lang) { lang = lang || o.getAttribute('lang'); var t = U.titleOf(o), w = words(lang); LBW.announce(t ? w.updated + ': ' + t : w.updated, lang, 'card:' + t); }
  function wasQuieted(o) { return !!o.querySelector('.lbw-once.is-stale') || o.classList.contains('is-spent'); }
  function quietAgain(o) { [].forEach.call(o.querySelectorAll('.lbw-once'), function (g) { g.classList.add('is-stale'); U.done(g); }); o.classList.add('is-spent'); }

  // ── v0.10 · live & numbers ───────────────────────────────────────────────────────────────────────
  // Data that is alive looks alive: a "Live" chip on a card drawn from live rows, the values the late data changed flash once
  // (a number ticks to its new value), and a row with a count can carry a meter. Motion only in a visible tab without
  // prefers-reduced-motion (moving()); otherwise the final state at once, and a flash is a colour change of 150 ms. The text
  // is always the real value first: a tick only redraws it for ≤ 400 ms, and a timer writes the final value even in a tab
  // that stopped painting. The live region still says one line per upgrade or total (upgraded(), calc/review).
  function seen() { try { return document.visibilityState === 'visible'; } catch (e) { return false; } }
  // v0.10 merge: the runtime's gate first (it also honours init's "motion": false), then the kit's own check
  function moving() { try { if (typeof LBW.motion === 'function' && !LBW.motion()) return false; return seen() && typeof root.matchMedia === 'function' && !root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  // live(o, lang): "● Live" beside the title (decided: on by default for rows from data, opt-in for a flow tag's params)
  function liveMark(o, lang) {
    var hd = o && o.querySelector('.lbw-head'); if (!hd) return null;
    var t = hd.querySelector('.kit-live'), wl = words(lang || o.getAttribute('lang')).live; if (t) return t;
    if ([].some.call(hd.querySelectorAll(':scope > .kit-tag'), function (b) { return b.textContent.trim() === wl; })) return null;   // the card's own "En directo" badge already says it
    t = el('span', 'kit-live' + (moving() ? ' is-pulse' : ''), wl);   // two pulses, then still (WCAG 2.2.2: under 5 s)
    var cnt = hd.querySelector(':scope > .kit-count'); hd.insertBefore(t, cnt || null); o.setAttribute('data-lbw-live', '1'); return t;
  }
  // numbers inside a text: "1.234,50 €" → parts ['', ' €'] + nums ['1.234,50']; a token's separators read as the text writes them
  var NUMRE = /\d+(?:[.,  ]\d+)*/g;
  function numsOf(t) { return { parts: String(t).split(NUMRE), nums: String(t).match(NUMRE) || [] }; }
  function numRead(s) {
    var seps = s.replace(/\d/g, ''), d = '', th = '';
    if (seps) { var last = seps.charAt(seps.length - 1), tail = s.length - s.lastIndexOf(last) - 1;
      if (seps.split(last).join('')) { d = last; th = seps.charAt(0); }   // two kinds: "1.234,50" (the last one is the decimal mark)
      else if (seps.length > 1 || tail === 3 || /[  ]/.test(last)) th = last;   // "1.234.567", "1.234", "1 234"
      else d = last; }   // "2,5", "247.00"
    var n = +s.split(th || '\u0000').join('').replace(d || '\u0000', '.'), dec = d ? s.length - s.lastIndexOf(d) - 1 : 0;
    return isFinite(n) ? { n: n, d: d, th: th, dec: dec } : null;
  }
  function numWrite(x, f) {
    var s = Math.abs(x).toFixed(f.dec), i = s.split('.')[0], r = s.split('.')[1];
    if (f.th) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, f.th);
    return i + (r ? f.d + r : '');
  }
  function joinNums(parts, nums) { var s = parts[0]; for (var i = 0; i < nums.length; i++) s += nums[i] + parts[i + 1]; return s; }
  // tick(node, from, to): the node already says `to`; for ≤ 400 ms it counts from `from` (one number differs, the rest of the
  // text the same: "762 €" → "870 €"). false when it doesn't move (no motion, not one number, a node with elements inside).
  function tick(n, from, to) {
    if (!moving() || !n || n.firstElementChild || from == null || from === to) return false;
    var a = numsOf(from), b = numsOf(to), at = -1;
    if (a.parts.join('\u0000') !== b.parts.join('\u0000') || a.nums.length !== b.nums.length) return false;
    for (var i = 0; i < b.nums.length; i++) if (a.nums[i] !== b.nums[i]) { if (at >= 0) return false; at = i; }
    var x = at >= 0 && numRead(a.nums[at]), y = at >= 0 && numRead(b.nums[at]); if (!x || !y || x.n === y.n) return false;
    var me = {}, t0 = null, D = 380, nums = b.nums.slice(), done = function () { if (n.__kitTick !== me) return; n.__kitTick = null; n.textContent = to; n.classList.remove('is-ticking'); };
    n.__kitTick = me; n.classList.add('is-ticking');
    var step = function (ts) {
      if (n.__kitTick !== me) return; if (!seen()) return done();
      if (t0 == null) t0 = ts; var k = Math.min(1, (ts - t0) / D); if (k >= 1) return done();
      nums[at] = numWrite(x.n + (y.n - x.n) * (1 - Math.pow(1 - k, 3)), y); n.textContent = joinNums(b.parts, nums); requestAnimationFrame(step);
    };
    requestAnimationFrame(step); setTimeout(done, D + 250);   // the real value, even if frames stop (a hidden tab)
    return true;
  }
  // flash(node): a soft highlight that fades (1.2 s; reduced motion: held, then 150 ms). Never in a hidden tab.
  function flash(n) {
    if (!seen()) return false; n.classList.remove('kit-flash', 'is-still'); n.classList.add('kit-flash'); if (!moving()) n.classList.add('is-still');
    setTimeout(function () { n.classList.remove('kit-flash', 'is-still'); }, 1300); return true;
  }
  // the values of a card, by a key that survives a redraw: the slide's id, the table row's first cell, the row's label or
  // the stat's label, then the element's place under it. Buttons, links, the kicker and the counters are not values.
  var NOTVAL = 'button, a, .lbw-kicker, .kit-count, .kit-live, .kit-sr, .lbw-loading, svg';
  function valuesOf(o) {
    var out = [], seenK = {};
    [].forEach.call(o.querySelectorAll('.lbw-box *'), function (n) {
      if (n.closest(NOTVAL)) return; var t = ''; for (var c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue; t = t.trim(); if (!t) return;
      var a = n.closest('[data-id], tr, [role="row"], .lbw-rows > div, .kit-stat'), key = '', h;
      if (a && !o.contains(a)) a = null;
      if (a) { h = a.hasAttribute('data-id') ? a.getAttribute('data-id') : (a.querySelector('th, [role="rowheader"], dt, .kit-stat > span') || a.firstElementChild || a).textContent.trim(); key = a.tagName + ':' + h; }
      for (var p = n; p && p !== a && p !== o; p = p.parentElement) { var sib = 0, sig = p.tagName + '.' + (p.classList[0] || ''); for (var q = p.previousElementSibling; q; q = q.previousElementSibling) if (q.tagName + '.' + (q.classList[0] || '') === sig) sib++; key += '/' + sig + sib; }
      if (seenK[key]) key += '#' + (seenK[key]++); else seenK[key] = 1;
      out.push([n, t, key]);
    });
    return out;
  }
  // what scrolls inside a card (the strip, a wide table) and an unfolded table, kept across a redraw
  function holdScroll(o) {
    var st = o.querySelector('.lbw-strip'), tw = o.querySelector('.kit-tbl-wrap'), open = !!o.querySelector('.kit-tbl.is-open'), sx = null, tx = tw ? tw.scrollLeft : 0;
    if (st && st.scrollLeft > 0 && st.children.length) { var k0 = st.children[0].offsetLeft;
      for (var i = 0; i < st.children.length; i++) { var c = st.children[i]; if (c.offsetLeft - k0 + c.offsetWidth > st.scrollLeft) { sx = [c.getAttribute('data-id'), st.scrollLeft - (c.offsetLeft - k0)]; break; } } }
    return function () {
      var s2 = o.querySelector('.lbw-strip'); if (s2 && sx) { var tg = [].filter.call(s2.children, function (c) { return c.getAttribute('data-id') === sx[0]; })[0];
        if (tg) { var x = tg.offsetLeft - s2.children[0].offsetLeft + sx[1]; if (typeof s2.scrollTo === 'function') { try { s2.scrollTo({ left: x, behavior: 'instant' }); } catch (e) { s2.scrollLeft = x; } } else s2.scrollLeft = x; } }
      var t2 = o.querySelector('.kit-tbl-wrap'); if (t2 && tx) t2.scrollLeft = tx;
      var mb = open && o.querySelector('.kit-tbl-more'); if (mb && mb.getAttribute('aria-expanded') === 'false') mb.click();
    };
  }
  // liveSwap(o, swap, lang): the late data redraws a card in place. swap() moves the new content in; focus, scroll and an
  // unfolded table stay; what changed flashes (a number ticks), what didn't stays still; "Updated: …" is said once. When most
  // of the card is new (other rows altogether) nothing flashes: the chip and the line say it.
  function liveSwap(o, swap, lang) {
    var before = {}; valuesOf(o).forEach(function (v) { before[v[2]] = v[1]; });
    var back = keepPlace(o), hold = holdScroll(o);
    swap(); hold(); back();
    var after = valuesOf(o), ch = after.filter(function (v) { return before[v[2]] !== v[1]; });
    o.setAttribute('data-lbw-upgraded', '1'); o.setAttribute('data-lbw-changed', String(ch.length));
    // the changed text gets its own span, so the highlight hugs the words (a block cell or a stat would light up whole)
    if (ch.length <= Math.max(3, after.length * 0.6)) ch.forEach(function (v) {
      var n = v[0], ts = [].filter.call(n.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); }), was = before[v[2]];
      if (ts.length === 1) { var sp = el('span', 'kit-chg'); n.insertBefore(sp, ts[0]); sp.appendChild(ts[0]); n = sp; }
      if (was != null) tick(n, was, n.textContent.trim() === v[1] ? n.textContent : v[1]); flash(n); });
    upgraded(o, lang);
    return ch.length;
  }
  // ── meters: a count against a capacity ("3 of 12 seats"), on a card's row or a table's column ──
  // m = { of: 12 (or a numeric text), low: 3 (≤ low is "low"; 20 % of `of` by default), n: the count (else the value's first
  // number), full: the words at 0 }. 0 → the row is full: muted, and a bare "0" says `full` (or the kit's "Full").
  function firstNum(v) { var m = String(v == null ? '' : v).match(/-?\d+(?:[.,]\d+)?/); return m ? +m[0].replace(',', '.') : NaN; }
  function meterIn(row, cell, m, v, lang) {
    var of = firstNum(m.of), n = m.n != null ? +m.n : firstNum(v); if (!(of > 0) || !isFinite(n) || !cell) return null;
    n = Math.max(0, n); var low = m.low != null && isFinite(+m.low) ? +m.low : Math.max(1, Math.round(of * 0.2)), st = n <= 0 ? 'full' : n <= low ? 'low' : 'ok', w = words(lang);
    row.classList.add('kit-m-' + st);
    if (st === 'full' && m.word !== false && /^\s*0\s*$/.test(String(v))) cell.textContent = m.full || w.full;   // a table says it only with its own "full" (a narrow column)
    var bar = el('span', 'kit-meter is-' + st), f = el('i'); f.style.setProperty('--kit-fill', String(Math.min(1, n / of)));
    bar.setAttribute('role', 'meter'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(of)); bar.setAttribute('aria-valuenow', String(Math.min(n, of)));
    bar.setAttribute('aria-valuetext', fill(w.rateOf, { n: n, max: of })); var lb = row.querySelector('dt, th'); if (lb) bar.setAttribute('aria-label', lb.textContent.trim());
    bar.appendChild(f); cell.appendChild(bar); return st;
  }
  // a card's rows: [label, value, { of, low, n, full }] (U.rows draws only rows with a value: the same filter here)
  function meters(dl, rows, lang) {
    var shown = (rows || []).filter(function (p) { return p && p[1] != null && p[1] !== ''; });
    [].forEach.call(dl.children, function (r, i) { var m = shown[i] && shown[i][2]; if (m && typeof m === 'object' && !Array.isArray(m) && m.of != null) meterIn(r, r.querySelector('dd'), m, shown[i][1], lang); });
    return dl;
  }
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
      var ci = el('span', 'kit-consent-i'), cg = icon(ICON[cfg.icon] || ICON.check); if (cg) ci.appendChild(cg); o.box.appendChild(ci); var ct = o.box.appendChild(el('p', 'kit-consent-t', cfg.title)); ct.setAttribute('role', 'heading'); ct.setAttribute('aria-level', '3'); if (cfg.text) o.box.appendChild(el('p', 'kit-consent-x', cfg.text));
      var g = U.once('kit-consent-b'); g.appendChild(U.reply(cfg.yes[0], cfg.yes[1], { primary: true, fields: cfg.yes[2] })); g.appendChild(U.reply(cfg.no[0], cfg.no[1], { fields: cfg.no[2] })); o.box.appendChild(g);
      if (cfg.link) o.box.appendChild(U.link(cfg.link[0], cfg.link[1], 'kit-consent-l'));
      return o;
    });
  }

  // ── compare: two or three items of your data side by side (v0.7.4; three demos had written it by hand) ──────────
  // cfg = { cls, lang, kicker, title: text | fn(ids, ctx), param: 'ids', min: 2, max: 3 (never more: the chat column is narrow),
  //         items: { id: { name, values: { rowKey: text | true | false }, img: { src, srcset, alt }, reply: [label, say, fields], link: [label, url] } },
  //         rows: [[rowKey, label, cls, unit]] (cls 'is-strong' for the line that decides, e.g. the price; unit 'm²' is written
  //         after every value that lacks it), empty: '—', note, best: 'id' | { id, label } (v0.10: the column you recommend) }
  // The tag names the items: [[p:compare ids=a,b,c]]. Fewer than `min` known ids draws nothing (one item is a card's job).
  // A row with no value in any column is left out. One label line, then equal columns: it fits 340 px; from 460 px the labels
  // take a column of their own. v0.10: a yes/no value (true/false, or the language's own "Yes"/"No") draws ✓ or ✕ with the
  // word kept for a screen reader; item photos head their columns; the best column is tinted and badged, and its reply is the primary.
  function compare(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), ids = Object.keys(cfg.items || {}), param = cfg.param || 'ids', max = Math.min(cfg.max || 3, 3), empty = cfg.empty == null ? '—' : cfg.empty;
    checkCfg('compare', name, cfg, ['items', 'rows']); register('compare', name, param, ids);
    if (DEV) ids.forEach(function (id) { budget("compare('" + name + "') " + id, 'title', cfg.items[id].name); });
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var got = p.list(param, ids, max); if (got.length < (cfg.min || 2)) return null;
      var lang = langOf(cfg, ctx), Wl = words(lang), bst = cfg.best && (typeof cfg.best === 'string' ? { id: cfg.best } : cfg.best), bi = bst ? got.indexOf(bst.id) : -1;
      var o = U.card(lang, 'kit-compare ' + cls), grid = el('div', 'kit-cmp is-' + got.length + (bi >= 0 ? ' has-best' : '')); grid.setAttribute('role', 'table');
      var names = got.map(function (id) { return cfg.items[id].name; }), ttl = String(val(cfg.title, got, ctx) || '').split('{names}').join(names.join(' · '));
      U.head(o.box, cfg.kicker || '', ttl); if (ttl) grid.setAttribute('aria-label', ttl); grid.setAttribute('aria-colcount', String(got.length + 1));
      // a yes/no value → [its word, 'yes' | 'no'] (the word stays the cell's text), else null
      var yn = function (v) { if (v === true || v === false) return [v ? Wl.yes : Wl.no, v ? 'yes' : 'no']; var t = String(v).trim().toLowerCase(); return t === Wl.yes.toLowerCase() ? [String(v), 'yes'] : t === Wl.no.toLowerCase() ? [String(v), 'no'] : null; };
      // v0.9.5 · the item names are column headers, and every cell says its column (aria-colindex: the row's label is column 1),
      // so "16 kg" is read with "Urbana". A cell is text, or a function that fills it.
      function line(label, cells, c) {
        var r = el('div', 'kit-cmp-row' + (c ? ' ' + c : '')), head = !label; r.setAttribute('role', 'row');
        if (label) { var h = el('div', 'kit-cmp-label', label); h.setAttribute('role', 'rowheader'); h.setAttribute('aria-colindex', '1'); r.appendChild(h); }
        var cs = el('div', 'kit-cmp-cells'); cells.forEach(function (t, i) {
          var d = el('div', 'kit-cmp-cell' + (i === bi ? ' is-best' : ''), typeof t === 'string' ? t : null); d.setAttribute('role', head ? 'columnheader' : 'cell'); d.setAttribute('aria-colindex', String(i + 2));
          if (typeof t === 'function') t(d); cs.appendChild(d); });
        r.appendChild(cs); grid.appendChild(r);
      }
      var pics = got.some(function (id) { var im = cfg.items[id].img; return im && im.src; });
      line('', got.map(function (id, i) { var it = cfg.items[id]; return !pics && i !== bi ? it.name : function (d) {
        if (it.img && it.img.src) d.appendChild(U.img(it.img.src, 'kit-cmp-img', Object.assign({ sizes: '200px' }, it.img, { alt: '' })));   // beside its name: decorative
        else if (pics) d.appendChild(el('div', 'lbw-img kit-cmp-img is-blank'));   // the names stay on one line
        d.appendChild(el('span', 'kit-cmp-name', it.name));
        if (i === bi) { d.appendChild(el('span', 'kit-sr', ', ')); d.appendChild(el('span', 'kit-tag kit-cmp-best', bst.label || Wl.best)); } }; }), 'is-head');   // read "Eléctrica, Best pick"
      var folded = [];
      (cfg.rows || []).forEach(function (row) {
        var raw = got.map(function (id) { return (cfg.items[id].values || {})[row[0]]; });
        var cells = raw.map(function (v) { if (v == null || v === '') return empty; var y = yn(v); if (y) return y[0]; v = String(v); return row[3] && v.indexOf(row[3]) < 0 ? v + ' ' + row[3] : v; });
        // a row where every column says the same isn't a difference: it is drawn quieter (v0.8.1.1), or, with same: 'fold',
        // left out of the table and listed in one line under it (v0.8.1.3: 4 of 7 rows were the same on a live demo)
        var same = cells.length > 1 && cells.every(function (t) { return t === cells[0]; });
        if (!cells.some(function (t) { return t !== empty; })) return;
        if (same && !row[2] && cfg.same === 'fold') { if (cells[0] !== empty) folded.push(row[1] + ': ' + cells[0]); return; }
        line(row[1], cells.map(function (t, i) { var y = t !== empty ? yn(raw[i]) : null; return !y ? t : function (d) {
          var m = el('span', 'kit-yn is-' + y[1]), ic = icon(y[1] === 'yes' ? 'check' : 'x'); if (ic) m.appendChild(ic); d.appendChild(m); d.appendChild(el('span', 'kit-sr', t)); }; }),
          (row[2] || '') + (same && !row[2] ? ' is-same' : ''));
      });
      o.box.appendChild(grid);
      if (folded.length) { var lab = got.length === 2 ? Wl.cSame2 : Wl.cSame; note(o.box, folded.length === 1 ? lab.replace(/\s*:\s*$/, '') + ' · ' + folded[0] : lab + '\n' + folded.join('\n'), 'kit-cmp-same'); }   // v0.8.1.8: one equal row reads "The same in both · View: Sea" (not two colons)   // one equal row stays on the label's line
      note(o.box, cfg.note, 'is-muted');
      var g = U.once('kit-actions'), links = [];
      // the primary: the best column's reply, else the first one ("primary": false for equals, v0.8.1.7)
      var pi = bi >= 0 && cfg.items[got[bi]].reply ? bi : got.map(function (id) { return !!cfg.items[id].reply; }).indexOf(true);
      got.forEach(function (id, i) { var it = cfg.items[id]; if (it.reply) { var rb = U.reply(it.reply[0], it.reply[1], { primary: i === pi && cfg.primary !== false, fields: it.reply[2] }); rb.style.setProperty('--kit-col', String(i + 1)); g.appendChild(rb); } if (it.link) links.push(U.link(it.link[0], it.link[1])); });   /* v0.8.1.9: each reply in its item's column */
      if (g.children.length) { g.classList.add('kit-cmp-acts'); g.style.setProperty('--kit-n', String(got.length)); }   // v0.8.1.9: one column per item, under its column
      // v0.10 · inside the card, under the columns they choose (they were three equal pills under it)
      var acts = (g.children.length ? [g] : []).concat(buttons(links)); if (acts.length) U.row(o.box, acts, 'kit-cmp-foot');
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
      g.addEventListener('lbw-unsent', function () {   // v0.9.5: the value wasn't sent, so nothing reads as rated
        btns.forEach(function (x) { x.classList.remove('is-on'); x.removeAttribute('aria-pressed'); x.removeAttribute('aria-current'); }); g.classList.remove('is-rated'); g.removeAttribute('tabindex'); });
      if (kind === 'scale') { if (btns.length > 6) g.classList.add('is-long'); g.style.setProperty('--kit-n', String(btns.length)); g.style.setProperty('--kit-cols', String(btns.length > 6 ? Math.ceil(btns.length / 2) : btns.length)); }
      o.box.appendChild(g);
      if (kind === 'scale' && (labels[0] || labels[1])) { var ends = el('div', 'kit-rate-ends'); ends.setAttribute('aria-hidden', 'true'); ends.appendChild(el('span', null, labels[0] ? lo + ' · ' + labels[0] : '')); ends.appendChild(el('span', null, labels[1] ? hi + ' · ' + labels[1] : '')); /* with their numbers: on two rows the ends don't sit under 0 and 10 */ o.box.appendChild(ends); }
      note(o.box, val(cfg.note, p, ctx), 'is-muted');
      return o;
    });
  }

  /* v0.10 · calendar */
  // ── calendar: a month of availability and prices; one day, or a stay from check-in to check-out ─────────────────────
  // cfg = { cls, lang, kicker, title, cta, note, mode: 'range' | 'single', min, max (nights in a stay: 1 and 30 by default),
  //         notice (days from today before the first that can be picked: 0), horizon (days ahead: 365), months: 1 | 2 (2: the
  //         second shows where the card is wide), money: { cur, after, dec, th } (prices are integer cents), priceFrom,
  //         days(p, ctx) → { days: { dayNumber: { s: 'free' | 'few' | 'full' | 'closed', p: cents, left: n } }, unlisted: 'free' | 'closed' }
  //                      | { later: a promise of that, fallback() → that, upgrade(o) → a promise of that or null } | null,
  //         closed(n) → true for a day a rule closes, send(sel, ctx) → [sentence, fields] }
  // sel = { from, to, day, nights, total (cents; null when a night has no price), price (single), summary }, days as LBW.day numbers.
  // The tag may preset month=2026-12, from=21/11/2026, to=24/11/2026: a value that isn't something the visitor could pick is
  // ignored (and logged). The total is the sum of the nights' own prices, never a guess.
  var CALW = {
    en: ['Previous month', 'Next month', 'Pick your check-in', 'Now pick your check-out', 'Pick a day', '{a} – {b}', '{n} night', '{n} nights', 'from {p}', 'few left', '{n} left', 'full', 'closed', 'At least {n} nights', 'At most {n} nights', 'Some nights in between are not available', 'check-in', 'check-out', 'Check-in {d}', 'Price per night', '{n} left'],
    es: ['Mes anterior', 'Mes siguiente', 'Elige la llegada', 'Ahora elige la salida', 'Elige un día', 'Del {a} al {b}', '{n} noche', '{n} noches', 'desde {p}', 'quedan pocas', 'quedan {n}', 'completo', 'cerrado', 'Mínimo {n} noches', 'Máximo {n} noches', 'Hay noches sin disponibilidad entre medias', 'llegada', 'salida', 'Llegada el {d}', 'Precio por noche', 'queda {n}'],
    it: ['Mese precedente', 'Mese successivo', 'Scegli l’arrivo', 'Ora scegli la partenza', 'Scegli un giorno', 'Dal {a} al {b}', '{n} notte', '{n} notti', 'da {p}', 'ultimi posti', 'ne restano {n}', 'completo', 'chiuso', 'Minimo {n} notti', 'Massimo {n} notti', 'Alcune notti in mezzo non sono disponibili', 'arrivo', 'partenza', 'Arrivo il {d}', 'Prezzo a notte', 'ne resta {n}'],
    de: ['Vorheriger Monat', 'Nächster Monat', 'Anreise wählen', 'Jetzt Abreise wählen', 'Tag wählen', '{a} – {b}', '{n} Nacht', '{n} Nächte', 'ab {p}', 'nur noch wenige', 'noch {n}', 'ausgebucht', 'geschlossen', 'Mindestens {n} Nächte', 'Höchstens {n} Nächte', 'Dazwischen sind Nächte nicht verfügbar', 'Anreise', 'Abreise', 'Anreise am {d}', 'Preis pro Nacht', 'noch {n}'],
    fr: ['Mois précédent', 'Mois suivant', 'Choisissez l’arrivée', 'Choisissez maintenant le départ', 'Choisissez un jour', 'Du {a} au {b}', '{n} nuit', '{n} nuits', 'à partir de {p}', 'dernières places', 'plus que {n}', 'complet', 'fermé', 'Minimum {n} nuits', 'Maximum {n} nuits', 'Des nuits entre ces dates ne sont pas disponibles', 'arrivée', 'départ', 'Arrivée le {d}', 'Prix par nuit', 'il en reste {n}'],
    ca: ['Mes anterior', 'Mes següent', 'Tria l’arribada', 'Ara tria la sortida', 'Tria un dia', 'Del {a} al {b}', '{n} nit', '{n} nits', 'des de {p}', 'en queden poques', 'en queden {n}', 'complet', 'tancat', 'Mínim {n} nits', 'Màxim {n} nits', 'Hi ha nits sense disponibilitat entremig', 'arribada', 'sortida', 'Arribada el {d}', 'Preu per nit', 'en queda {n}']
  };
  var CALK = 'prev next pickIn pickOut pickDay range night nights from few left full closed min max gap inDay outDay arrive per left1'.split(' '), CALID = 0;
  function calWords(lang) { var a = CALW[lang] || CALW.en, o = {}; CALK.forEach(function (k, i) { o[k] = a[i]; }); return o; }
  function calendar(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), range = cfg.mode !== 'single', has = Object.prototype.hasOwnProperty;
    checkCfg('calendar', name, cfg, ['days', 'send', 'cta']); budget("calendar('" + name + "')", 'title', cfg.title); register('calendar', name, null, null);
    var minN = range ? Math.max(1, +cfg.min || 1) : 0, maxN = range ? Math.max(minN, +cfg.max || 30) : 0;
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var src = cfg.days(p, ctx); if (!src) return null;
      var lang = langOf(cfg, ctx), w = calWords(lang), two = cfg.months !== 1, mk = 'kit-cal ' + cls + (two ? ' is-two' : '');
      if (src.later) {   // a skeleton until the data comes; the saved copy after "wait"; data that lands later still repaints it
        var lo = U.loading(lang, mk);
        return LBW.later(lo, src.later, function (d) { return draw(lo, d); },
          src.fallback ? function () { if (!draw(lo, src.fallback())) throw new Error('nothing to show');
            if (src.upgrade) src.upgrade(lo).then(function (d2) { if (d2 && lo.__cal && lo.__cal(d2)) { lo.setAttribute('data-lbw-upgraded', '1'); upgraded(lo, lang); } }, function () {}); } : null);
      }
      var c = U.card(lang, mk); return draw(c, src) ? c : null;
      function draw(o, data) {
        if (!data || !data.days) return false;
        var today = D.today(), first = today + Math.max(0, +cfg.notice || 0), end = today + Math.max(1, +cfg.horizon || 365);
        var ym = function (n) { var q = D.parts(n); return q.y * 12 + q.m - 1; }, mStart = function (mi) { return D.num(Math.floor(mi / 12), mi % 12 + 1, 1); };
        var firstM = ym(today), lastM = ym(end), days = data.days, unl = data.unlisted === 'closed' ? 'closed' : 'free';
        var cash = function (n, o2) { return money(n, Object.assign({}, cfg.money, n % 100 ? { cents: true } : null, o2)); };   // a price with cents is never rounded
        var pend = null, view, foc, grid = el('div', 'kit-cal-months'), sum = el('p', 'kit-cal-sum'), nav = [];
        var f = U.form('kit-calform', { state: { from: null, to: null }, cta: cfg.cta,
          ready: function (s) { return s.from == null ? (range ? w.pickIn : w.pickDay) : range && s.to == null ? w.pickOut : true; },
          send: function (s) { var sel = selOf(s, true), r = cfg.send(sel, ctx); pend = { sel: sel, text: r && r[0] }; return r; },
          sent: function () { if (!pend) return; last[name] = { state: Object.assign({}, pend.sel, { day: pend.sel.from, cal: true }), text: pend.text }; if (cfg.collapse !== false) fold(o, pend.text, lang); } });
        // what a day is: off (past, inside the notice, after the horizon), closed (a rule or the data), full, few or free; p in cents
        function info(n) {
          if (n < first || n > end) return { s: 'off' };
          if (cfg.closed && cfg.closed(n)) return { s: 'closed' };
          var d = has.call(days, n) ? days[n] : null; return d ? { s: d.s || 'free', p: d.p, left: d.left } : { s: unl };
        }
        var night = function (n) { var s = info(n).s; return s === 'free' || s === 'few'; };
        function why(a, b) {   // a stay from a to b (the day they leave): null when it can be booked, else the sentence that says why not
          var k = b - a; if (k < minN) return fill(w.min, { n: minN }); if (k > maxN) return fill(w.max, { n: maxN });
          for (var n = a; n < b; n++) if (!night(n)) return w.gap;
          return null;
        }
        var can = function (s, n) { return night(n) || (range && s.from != null && s.to == null && n > s.from && why(s.from, n) == null); };
        var dm = function (n, o2) { return D.format(n, lang, o2 || { day: 'numeric', month: 'short' }); };
        function selOf(s, sent) {
          var b = range ? s.to : s.from + 1, t = 0;
          for (var n = s.from; n < b; n++) { var q = info(n).p; if (q == null) { t = null; break; } t += q; }
          var sel = { from: s.from, to: range ? s.to : null, day: s.from, nights: range ? s.to - s.from : 0, total: range ? t : null, price: range ? null : t };
          sel.summary = sumOf(sel, sent); return sel;
        }
        function sumOf(sel, sent) {   // "Del 21 al 24 nov · 3 noches · desde 654 €": the kit's words, the dates by LBW.day
          var nb = sent ? { nb: false } : null;
          if (!range) return [dm(sel.from, { weekday: 'long', day: 'numeric', month: 'long' }), sel.price == null ? '' : cash(sel.price, nb)].filter(Boolean).join(' · ');
          var b = dm(sel.to), a = ym(sel.from) === ym(sel.to) && /^\d/.test(b) ? String(D.parts(sel.from).d) : dm(sel.from);
          return [fill(w.range, { a: a, b: b }), fill(sel.nights === 1 ? w.night : w.nights, { n: sel.nights }),
            sel.total == null ? '' : cfg.priceFrom ? fill(w.from, { p: cash(sel.total, nb) }) : cash(sel.total, nb)].filter(Boolean).join(' · ');
        }
        function label(n, s) {   // "sábado, 21 de noviembre, 189 €, quedan 2"
          var d = info(n), t = [dm(n, { weekday: 'long', day: 'numeric', month: 'long' })];
          if (d.p != null && night(n)) t.push(cash(d.p));
          if (d.s === 'few') t.push(d.left != null ? fill(d.left === 1 ? w.left1 : w.left, { n: d.left }) : w.few); else if (d.s === 'full' || d.s === 'closed') t.push(w[d.s]);
          if (range && n === s.from) t.push(w.inDay); if (range && n === s.to) t.push(w.outDay);
          return t.join(', ');
        }
        // one month: a real grid (a table with role=grid, named by its caption, the weekdays as column headers), Monday first
        function month(mi) {
          var start = mStart(mi), len = mStart(mi + 1) - start, lead = (D.parts(start).w + 6) % 7, m = el('div', 'kit-cal-m'), mn = D.format(start, lang, { month: 'long', year: 'numeric' }), cap = el('p', 'kit-cal-cap', mn.charAt(0).toUpperCase() + mn.slice(1));
          cap.id = 'lbw-kcal' + (++CALID); m.appendChild(cap);
          var t = el('table', 'kit-cal-g'), head = el('thead'), hr = el('tr'), body = el('tbody'), row = null, i; t.setAttribute('role', 'grid'); t.setAttribute('aria-labelledby', cap.id);
          for (i = 0; i < 7; i++) { var wd = D.num(2024, 1, 1 + i), th = el('th', null, D.format(wd, lang, { weekday: 'narrow' })); th.setAttribute('scope', 'col'); th.setAttribute('aria-label', D.format(wd, lang, { weekday: 'long' })); hr.appendChild(th); }
          head.appendChild(hr); t.appendChild(head);
          for (i = 0; i < Math.ceil((lead + len) / 7) * 7; i++) {
            if (i % 7 === 0) { row = el('tr'); body.appendChild(row); }
            var td = el('td'), n = start + i - lead; row.appendChild(td);
            if (i < lead || i >= lead + len) continue;
            td.setAttribute('role', 'gridcell');
            var b = U.btn('', 'kit-cal-d'); b.setAttribute('data-day', String(n)); b.tabIndex = -1;
            b.appendChild(el('span', 'kit-cal-n', String(D.parts(n).d))); b.appendChild(el('span', 'kit-cal-p')); td.appendChild(b);
          }
          t.appendChild(body); m.appendChild(t); return m;
        }
        function render() {
          grid.textContent = ''; nav = [U.btn('‹', 'kit-cal-nav is-prev'), U.btn('›', 'kit-cal-nav is-next')];
          nav.forEach(function (b, i) { b.setAttribute('aria-label', i ? w.next : w.prev); grid.appendChild(b); });
          grid.appendChild(month(view)); if (two && view < lastM) grid.appendChild(month(view + 1));
          paint();
        }
        function paint() {
          var s = f.state, lo2 = s.from, hi = range && s.to != null ? s.to : s.from, bs = [].slice.call(grid.querySelectorAll('.kit-cal-d')), seen = false;
          nav[0].setAttribute('aria-disabled', view <= firstM ? 'true' : 'false'); nav[1].setAttribute('aria-disabled', view >= lastM ? 'true' : 'false');
          bs.forEach(function (b) {
            var n = +b.getAttribute('data-day'), d = info(n), on = n === s.from || (range && n === s.to), inR = lo2 != null && n >= lo2 && n <= hi;
            b.className = 'kit-cal-d is-' + d.s + (n === today ? ' is-today' : '') + (inR ? ' is-in' : '') + (on ? ' is-end' : '');
            b.lastChild.textContent = d.p != null && night(n) ? cash(d.p, { cur: '', cents: d.p % 100 !== 0 }) : '';
            b.setAttribute('aria-label', label(n, s)); b.setAttribute('aria-disabled', can(s, n) ? 'false' : 'true');
            if (on) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed');
            b.parentNode.setAttribute('aria-selected', inR ? 'true' : 'false');
            if (n === foc) seen = true;
          });
          if (!seen && bs.length) { var pk = bs.filter(function (b) { return can(s, +b.getAttribute('data-day')); })[0] || bs[0]; foc = +pk.getAttribute('data-day'); }
          bs.forEach(function (b) { b.tabIndex = +b.getAttribute('data-day') === foc ? 0 : -1; });
          sum.textContent = s.from == null ? '' : range && s.to == null ? fill(w.arrive, { d: dm(s.from, { weekday: 'short', day: 'numeric', month: 'short' }) }) + ' · ' + w.pickOut : sumOf(selOf(s), false);
        }
        var vis = function () { var ms = grid.querySelectorAll('.kit-cal-m'); try { return ms.length > 1 && getComputedStyle(ms[1]).display !== 'none' ? 2 : 1; } catch (e) { return 1; } };
        var caps = function () { return [].map.call(grid.querySelectorAll('.kit-cal-cap'), function (x) { return x.textContent; }).slice(0, vis()).join(' · '); };
        function go(n) {   // the keyboard's place moves to day n; the month turns when n isn't in view
          n = Math.max(mStart(firstM), Math.min(mStart(lastM + 1) - 1, n)); var mi = ym(n), v = view;
          if (mi < view) view = mi; else if (mi > view + vis() - 1) view = mi - vis() + 1;
          foc = n; if (view !== v) { render(); LBW.announce(caps(), lang, 'cal:' + name); } else paint();
          var b = grid.querySelector('[data-day="' + n + '"]'); if (b) b.focus();
        }
        function choose(n) {
          var s = f.state, msg = null; if (f.el.classList.contains('is-done')) return;
          if (!range || s.from == null || s.to != null || n <= s.from) { if (night(n)) { s.from = n; s.to = null; } else msg = label(n, s); }
          else { msg = why(s.from, n); if (msg == null) s.to = n; else if (msg === w.gap && night(n)) { s.from = n; s.to = null; } }
          foc = n; f.update(); paint();
          LBW.announce(msg || sum.textContent, lang, 'cal:' + name);   // a closed or full day says why when pressed, and sends nothing
        }
        grid.addEventListener('click', function (e) {
          var t = e.target.closest ? e.target.closest('button') : null; if (!t || !grid.contains(t)) return;
          if (t.classList.contains('kit-cal-nav')) {
            if (t.getAttribute('aria-disabled') === 'true') return; var nx = t.classList.contains('is-next');
            view += nx ? 1 : -1; foc = null; render(); grid.querySelector(nx ? '.is-next' : '.is-prev').focus(); LBW.announce(caps(), lang, 'cal:' + name); return;
          }
          choose(+t.getAttribute('data-day'));
        });
        grid.addEventListener('keydown', function (e) {
          var t = e.target; if (!t.classList || !t.classList.contains('kit-cal-d')) return;
          var n = +t.getAttribute('data-day'), q = D.parts(n), k = e.key, to = null, wd = (q.w + 6) % 7;
          if (k === 'ArrowRight') to = n + 1; else if (k === 'ArrowLeft') to = n - 1; else if (k === 'ArrowDown') to = n + 7; else if (k === 'ArrowUp') to = n - 7;
          else if (k === 'Home') to = n - wd; else if (k === 'End') to = n + 6 - wd;
          else if (k === 'PageDown' || k === 'PageUp') { var mi = ym(n) + (k === 'PageDown' ? 1 : -1), st = mStart(mi); to = st + Math.min(q.d, mStart(mi + 1) - st) - 1; }
          if (to == null) return; e.preventDefault(); go(to);
        });
        // the tag's preset: a month to open on, a day or a stay the visitor could pick themselves; anything else is ignored
        var bad = function (k) { LBW.drop(name + ': bad value ' + k + '=' + String(p.raw[k]).slice(0, 40)); };
        var pm = p.has('month') ? /^(20\d\d)-(\d\d?)$/.exec(String(p.raw.month).trim()) : null, pf = p.day('from'), pt = p.day('to');
        if (pm && !(+pm[2] >= 1 && +pm[2] <= 12)) pm = null; if (p.has('month') && !pm) bad('month');
        if (pf != null && !night(pf)) pf = null; if (p.has('from') && pf == null) bad('from');
        if (pf != null) { f.state.from = pf; if (range && pt != null && why(pf, pt) == null) f.state.to = pt; else if (p.has('to') && range) bad('to'); }
        view = pf != null ? ym(pf) : pm ? Math.max(firstM, Math.min(lastM, +pm[1] * 12 + +pm[2] - 1)) : ym(first); foc = pf;
        if (cfg.title) U.head(o.box, cfg.kicker || '', cfg.title);
        o.box.appendChild(f.el); f.add(grid);
        var key = el('div', 'kit-cal-key'); key.setAttribute('aria-hidden', 'true');
        if (Object.keys(days).some(function (n) { return days[n] && days[n].p != null; })) key.appendChild(el('span', 'kit-cal-k', w.per + (cfg.money && cfg.money.cur ? ' (' + cfg.money.cur + ')' : '')));
        ['few', 'full'].forEach(function (s) { key.appendChild(el('span', 'kit-cal-k is-' + s, w[s])); });
        f.add(key); f.add(sum); render(); note(o.box, val(cfg.note, p, ctx), 'is-muted');
        // late data: the same cells repainted (focus stays where it was), unless the visitor already picked a day
        o.__cal = function (d2) { if (!d2 || !d2.days || f.state.from != null) return false; days = d2.days; unl = d2.unlisted === 'closed' ? 'closed' : 'free'; paint(); return true; };
        return true;
      }
    });
  }

  // ── v0.10 · map: 1–5 places on the client's own map image, or on a schematic the kit draws from lat/lng ──────────────
  // No tiles, no key, no third-party script: the only thing fetched is cfg.image, which `links` must allow. The LIST is the
  // content (name, kind, address, distance, open now, "Directions ↗"); the map is a group of pin buttons (one Tab stop, the
  // arrows move) over a decorative drawing. A pin and its row select each other. Tag: ids=a,b (those, in that order), id=a.
  // cfg = { cls, lang, kicker, title, note, max (5), sort: 'distance', go (the directions label), links(ctx) → [el…],
  //         image: { src, srcset, width, height, alt, bounds: [[north, west], [south, east]] }: a pin goes at a place's `at`
  //           ([x %, y %] from the left and top edges), else at its lat/lng inside bounds. No image (or one `links` refuses):
  //           the schematic, from lat/lng, with lines: [{ kind: water | road | rail | park, pts: [[lat, lng]…], label }],
  //         from: { name, lat, lng } (distances are measured from it, and it is drawn as a ring on the schematic),
  //         places: [{ id, name, kind, address, lat, lng, at, hours: { week, holiday, sep, h12 } (open now, as contact),
  //                    status: { text, tone }, distance: 'text' (in place of the computed one), link: [label, url] }],
  //         directions(place) → a URL or null (setup builds it from lat/lng or the address; `links` must allow it) }
  var MAPW = { en: { map: 'Map', walk: '{n} min walk', from: 'from {p}', go: 'Directions ↗' }, es: { map: 'Mapa', walk: '{n} min a pie', from: 'desde {p}', go: 'Cómo llegar ↗' },
    it: { map: 'Mappa', walk: '{n} min a piedi', from: 'da {p}', go: 'Indicazioni ↗' }, de: { map: 'Karte', walk: '{n} Min. zu Fuß', from: 'ab {p}', go: 'Route ↗' },
    fr: { map: 'Carte', walk: '{n} min à pied', from: 'depuis {p}', go: 'Itinéraire ↗' }, ca: { map: 'Mapa', walk: '{n} min a peu', from: 'des de {p}', go: 'Com arribar-hi ↗' } };
  function geo(x) { return !!x && typeof x.lat === 'number' && typeof x.lng === 'number'; }
  function metres(a, b) { var r = Math.PI / 180, s = function (x) { x = Math.sin(x / 2); return x * x; }, h = s((b.lat - a.lat) * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * s((b.lng - a.lng) * r); return 12742000 * Math.asin(Math.min(1, Math.sqrt(h))); }
  function mapCard(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), all = cfg.places || [], ids = all.map(function (x) { return x.id; }), max = Math.min(5, cfg.max || 5), W0 = 320, H0 = 200;
    checkCfg('map', name, cfg, ['places']); budget("map('" + name + "')", 'title', cfg.title);
    register('map', name, 'id', ids);
    LBW.widget(name, function (p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var lang = langOf(cfg, ctx), w = MAPW[lang] || MAPW.en, fr = geo(cfg.from) ? cfg.from : null, by = Object.create(null), im = cfg.image;
      all.forEach(function (x) { by[x.id] = x; });
      var want = p.has('ids') ? p.list('ids', ids, max) : null; if (want && !want.length) return null;   // ids naming no place: nothing, as a carousel
      var hi = p.one('id', ids), list = want ? want.map(function (k) { return by[k]; }) : all.slice();
      var dist = function (x) { return fr && geo(x) ? metres(fr, x) : null; };
      if (cfg.sort === 'distance' && fr) list.sort(function (a, b) { var da = dist(a), db = dist(b); return (da == null) - (db == null) || (da || 0) - (db || 0); });
      if (list.length > max) { var keep = hi && list.indexOf(by[hi]) >= max; list = list.slice(0, max); if (keep) list[max - 1] = by[hi]; }
      if (list.indexOf(by[hi]) < 0) hi = null;
      var o = U.card(lang, 'kit-map ' + cls), fig = el('div', 'kit-map-fig'), pos = null, proj = null;
      U.head(o.box, cfg.kicker || '', cfg.title || '');
      if (im && im.src) {   // the client's map: a refused URL (or the mock's noimg pin) falls back to the schematic
        var f = U.img(im.src, 'kit-map-img', { srcset: im.srcset, sizes: '(max-width: 480px) 92vw, 520px', width: im.width, height: im.height, alt: '' });
        if (f.classList.contains('is-empty')) im = null;
        else { fig.appendChild(f); if (im.width && im.height) fig.style.setProperty('--kit-map-ar', String(im.width / im.height)); var b = im.bounds;
          pos = list.map(function (x) { var q = x.at || (b && geo(x) ? [(x.lng - b[0][1]) / (b[1][1] - b[0][1]) * 100, (b[0][0] - x.lat) / (b[0][0] - b[1][0]) * 100] : null);
            return q && q[0] >= 0 && q[0] <= 100 && q[1] >= 0 && q[1] <= 100 ? q : null; }); }
      } else im = null;
      if (!im) {   // the schematic: lat/lng fitted into 320×200 (room for a pin above each point), lines and the "from" ring under the pins
        var pts = list.filter(geo).concat(fr ? [fr] : []);
        if (pts.length) {
          var k = Math.cos(pts.reduce(function (a, x) { return a + x.lat; }, 0) / pts.length * Math.PI / 180), X = function (x) { return x.lng * k; }, Y = function (x) { return -x.lat; };
          var mm = function (f, g) { return Math[g].apply(null, pts.map(f)); }, x0 = mm(X, 'min'), x1 = mm(X, 'max'), y0 = mm(Y, 'min'), y1 = mm(Y, 'max');
          var s = Math.min(240 / Math.max(x1 - x0, 1e-9), 136 / Math.max(y1 - y0, 1e-9), 240 / 0.006);   // never closer than ~500 m across
          proj = function (x) { return [W0 / 2 + (X(x) - (x0 + x1) / 2) * s, 116 + (Y(x) - (y0 + y1) / 2) * s]; };
          pos = list.map(function (x) { if (!geo(x)) return null; var q = proj(x); return [q[0] / W0 * 100, q[1] / H0 * 100]; });
          var g = sv('svg', { viewBox: '0 0 ' + W0 + ' ' + H0, 'aria-hidden': 'true', focusable: 'false', 'class': 'kit-map-sch' });
          sv('rect', { width: W0, height: H0, 'class': 'kit-map-bg' }, g);
          for (var gx = 40; gx < W0; gx += 40) sv('path', { d: 'M' + gx + ' 0V' + H0, 'class': 'kit-map-grid' }, g);
          for (var gy = 40; gy < H0; gy += 40) sv('path', { d: 'M0 ' + gy + 'H' + W0, 'class': 'kit-map-grid' }, g);
          var at = function (q) { return proj({ lat: q[0], lng: q[1] }); };
          (cfg.lines || []).forEach(function (l) {
            var ps = (l.pts || []).map(at), park = l.kind === 'park'; if (ps.length < 2) return;
            sv('path', { d: ps.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + (park ? 'Z' : ''), 'class': 'kit-map-ln is-' + l.kind }, g);
            if (l.label) { var mq = ps[Math.floor((ps.length - 1) / 2)], nq = ps[Math.floor((ps.length - 1) / 2) + 1] || mq, tl = sv('text', { x: ((mq[0] + nq[0]) / 2).toFixed(1), y: ((mq[1] + nq[1]) / 2 + (park ? 4 : -9)).toFixed(1), 'text-anchor': 'middle', 'class': 'kit-map-lab' }, g); tl.textContent = l.label; }
          });
          if (fr) { var fq = proj(fr); sv('circle', { cx: fq[0].toFixed(1), cy: fq[1].toFixed(1), r: 5, 'class': 'kit-map-from' }, g);
            if (fr.name) { var ft = sv('text', { x: fq[0].toFixed(1), y: (fq[1] + 18).toFixed(1), 'text-anchor': 'middle', 'class': 'kit-map-lab is-from' }, g); ft.textContent = fr.name; } }
          fig.appendChild(g);
        }
      }
      var pinL = el('div', 'kit-map-pins'), rove = radioGroup(pinL), ol = el('ol', 'kit-map-list'), pins = Object.create(null), rows = Object.create(null);
      pinL.setAttribute('aria-label', (im && im.alt) || (w.map + (cfg.title ? ': ' + cfg.title : '')));
      ol.setAttribute('aria-label', cfg.title || w.map);
      function sel(id) {
        list.forEach(function (x) { var on = x.id === id; if (pins[x.id]) pins[x.id].setAttribute('aria-checked', on ? 'true' : 'false'); rows[x.id].li.classList.toggle('is-on', on); rows[x.id].b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        rove();
      }
      var km = function (m) { return m < 950 ? Math.max(10, Math.round(m / 10) * 10) + '\u00a0m' : (m / 1000).toLocaleString(lang, { maximumFractionDigits: m < 9950 ? 1 : 0 }) + '\u00a0km'; };
      list.forEach(function (x, i) {
        var n = String(i + 1), q = pos && pos[i];
        if (q) { var pb = radio(U.btn('', 'kit-map-pin'), false), dr = el('span', 'kit-map-drop'); dr.appendChild(el('b', null, n)); pb.appendChild(dr);
          pb.setAttribute('aria-label', n + '. ' + x.name); pb.style.left = q[0].toFixed(2) + '%'; pb.style.top = q[1].toFixed(2) + '%';
          pb.addEventListener('click', function () { sel(x.id); }); pins[x.id] = pb; pinL.appendChild(pb); }
        var li = el('li', 'kit-map-place'), b = U.btn('', 'kit-map-pick'), nm = el('span', 'kit-map-n', n); li.setAttribute('data-id', x.id);
        nm.setAttribute('aria-hidden', 'true'); b.appendChild(nm); b.appendChild(el('span', 'kit-map-name', x.name)); if (x.kind) b.appendChild(el('span', 'kit-map-kind', x.kind));
        b.addEventListener('click', function () { sel(x.id); }); li.appendChild(b);
        li.addEventListener('click', function (e) { if (!e.target.closest('a, button')) sel(x.id); });   // the whole row, for a mouse; the keyboard has its button
        if (x.address) li.appendChild(el('p', 'kit-map-addr', x.address));
        var m = dist(x), d = x.distance || (m == null ? '' : km(m) + (fr.name ? ' ' + fill(w.from, { p: fr.name }) : '') + (m <= 3200 ? ' · ' + fill(w.walk, { n: Math.max(1, Math.round(m / 80)) }) : ''));   // walking: 80 m a minute
        if (d) li.appendChild(el('p', 'kit-map-dist', d));
        if (x.hours && x.hours.week) li.appendChild(status(x.hours, lang).node); else if (x.status && x.status.text) li.appendChild(statusLine(x.status));
        var go = cfg.directions ? cfg.directions(x) : null, acts = buttons([go ? U.link(cfg.go || w.go, go) : null, x.link ? U.link(x.link[0], x.link[1]) : null]);
        if (acts.length) U.row(li, acts);
        rows[x.id] = { li: li, b: b }; ol.appendChild(li);
      });
      if (DEV) list.forEach(function (x) { budget("map('" + name + "') " + x.id, 'title', x.name); });
      var wrap = el('div', 'kit-map-wrap');
      if (pinL.children.length) fig.appendChild(pinL);
      if (fig.children.length) { wrap.appendChild(fig); wrap.classList.add('has-fig'); }
      wrap.appendChild(ol); o.box.appendChild(wrap);
      sel(hi);
      note(o.box, val(cfg.note, p, ctx), 'is-muted');
      var ls = buttons(cfg.links && cfg.links(ctx)); if (ls.length) U.row(o, ls);
      return o;
    });
  }

  // ── v0.10 · tracker: where an order, a booking or a repair is, step by step (the design review's "status timeline") ──
  // cfg = { cls, lang, kicker, title, note, allowDup, param: 'estado' (the tag key that names the current step),
  //         default: a step or state key for an unset or unknown value (none: nothing is drawn),
  //         ref: { param, label } (an order code the tag carries: shown, never invented), eta: { day, time, text: 'Lista {when}' }
  //         (tag keys; {when} = "hoy a las 18:00"), live: a key of LBW.data (a data message redraws the newest tracker in place),
  //         steps: [{ key, label, detail, time, tone }], states: [{ key, text, tone, at: a step key (a delay), end: true (cancelled) }],
  //         actions(key, ref, ctx) → [el…] (while that step or state is the current one), links(ref, ctx) → [el…] (always) }
  // One rule for updates: the NEWEST tracker of a widget and reference is the live one. Drawing one marks every earlier one
  // with the same name and ref "Actualizado: <its state>" and quiets its one-shot actions; the old card stays as written.
  var TW = {
    en: { steps: 'Steps', s: ['done', 'now', 'to come'], at: 'at {t}', on: 'on {d}', eta: 'Expected {when}', ref: 'Ref.' },
    es: { steps: 'Pasos', s: ['hecho', 'ahora', 'pendiente'], at: 'a las {t}', on: 'el {d}', eta: 'Previsto para {when}', ref: 'Ref.' },
    it: { steps: 'Fasi', s: ['fatto', 'ora', 'in attesa'], at: 'alle {t}', on: '{d}', eta: 'Previsto per {when}', ref: 'Rif.' },
    de: { steps: 'Schritte', s: ['erledigt', 'jetzt', 'ausstehend'], at: 'um {t} Uhr', on: 'am {d}', eta: 'Voraussichtlich {when}', ref: 'Nr.' },
    fr: { steps: 'Étapes', s: ['fait', 'en cours', 'à venir'], at: 'à {t}', on: 'le {d}', eta: 'Prévu {when}', ref: 'Réf.' },
    ca: { steps: 'Passos', s: ['fet', 'ara', 'pendent'], at: 'a les {t}', on: 'el {d}', eta: 'Previst per a {when}', ref: 'Ref.' }
  };
  var REFV = /^[A-Za-z0-9][A-Za-z0-9._\/#-]{0,31}$/, TRKON = false;
  function tracker(name, cfg) {
    var cls = cfg.cls || ('kit-' + name), param = cfg.param || 'estado', steps = cfg.steps || [], states = cfg.states || [], R = cfg.ref, E = cfg.eta;
    var keys = steps.concat(states).map(function (s) { return s.key; }), idx = function (k) { for (var i = 0; i < steps.length; i++) if (steps[i].key === k) return i; return -1; };
    checkCfg('tracker', name, cfg, ['title', 'steps']); budget("tracker('" + name + "')", 'title', cfg.title);
    steps.forEach(function (s) { budget("tracker('" + name + "') " + s.key, 'title', s.label); budget("tracker('" + name + "') " + s.key, 'line', s.detail); });
    register('tracker', name, param, keys);
    if (cfg.live) trkLive();
    function render(p, ctx) {
      if (!cfg.allowDup && dup(ctx, cls)) return null;
      var key = p.one(param, keys) || (keys.indexOf(cfg['default']) >= 0 ? cfg['default'] : null); if (!key) return null;
      var lang = langOf(cfg, ctx), w = words(lang), tw = TW[lang] || TW.en, o = U.card(lang, 'kit-tracker ' + cls), ref = null;
      if (R && p.has(R.param)) { ref = String(p.raw[R.param]).trim(); if (!REFV.test(ref)) { LBW.drop(name + ': bad value ' + R.param + '=' + ref.slice(0, 40)); ref = null; } }
      var st = states.filter(function (s) { return s.key === key; })[0], i = idx(st ? st.at : key), last = steps.length - 1;
      var end = st ? !!st.end : i === last, tn = st ? tone(st.tone, st.end ? 'danger' : 'warn') : tone(steps[i].tone, i === last ? 'ok' : 'info'), text = st ? st.text : steps[i].label;
      U.head(o.box, cfg.kicker || '', cfg.title, ref ? badge((R.label || tw.ref) + ' ' + ref) : null);
      statusHead(o.box, { text: text, tone: tn });
      var eta = end ? '' : when(p, lang, w, tw); if (eta) o.box.appendChild(withIcon(el('p', 'kit-trk-eta', fill(E.text || tw.eta, { when: eta })), 'clock'));
      // an ordered list; the current step has aria-current="step", and every step says its state in words (never colour only)
      var ol = el('ol', 'kit-trk-steps'); ol.setAttribute('aria-label', tw.steps);
      steps.forEach(function (s, j) {
        var n = j < i || (j === i && end && !st) ? 0 : j === i ? 1 : 2, li = el('li', 'kit-trk-step ' + ['is-past', 'is-now', 'is-next'][n]), dot = el('span', 'kit-trk-dot');
        if (j === i) { li.setAttribute('aria-current', 'step'); if (st) li.classList.add('is-' + tn); }
        var ic = n === 0 ? icon('check') : j === i && st ? icon(tn === 'danger' ? 'x' : 'bang') : null; if (ic) dot.appendChild(ic);
        dot.setAttribute('aria-hidden', 'true'); li.appendChild(dot);
        var b = el('span', 'kit-trk-b'); b.appendChild(el('span', 'kit-trk-l', s.label)); b.appendChild(el('span', 'kit-sr', ' (' + tw.s[n] + ')'));
        if (s.detail && n < 2) b.appendChild(el('span', 'kit-trk-d', s.detail)); if (s.time && n < 2) b.appendChild(el('span', 'kit-trk-t', s.time));
        li.appendChild(b); ol.appendChild(li);
      });
      o.box.appendChild(ol); note(o.box, cfg.note, 'is-muted');
      var a = buttons(cfg.actions && cfg.actions(key, ref, ctx)), acts = [];
      if (a.length) { var g = U.once('kit-trk-acts'); a.forEach(function (x) { g.appendChild(x); }); acts.push(g); }
      acts = acts.concat(buttons(cfg.links && cfg.links(ref, ctx))); if (acts.length) U.row(o, acts);
      o.setAttribute('data-trk', name + '|' + (ref || '').toLowerCase()); o.setAttribute('data-trk-state', key);
      o.__trk = { p: p, ctx: ctx, render: render, text: text, live: cfg.live, ref: ref, refKey: R && R.param, keys: [param, R && R.param, E && E.day, E && E.time].filter(Boolean) };
      Promise.resolve().then(function () { trkSettle(o); });   // once the runtime has put it in the chat
      return o;
    }
    // "hoy a las 18:00", "mañana", "el sábado, 21 de noviembre a las 9:30"; a time alone is today's; a past one isn't shown
    function when(p, lang, w, tw) {
      if (!E) return '';
      var n = E.day ? p.day(E.day) : null, m = E.time && p.has(E.time) ? T.read(String(p.raw[E.time])) : null, today = D.today();
      if (E.day && p.has(E.day) && n == null) LBW.drop(name + ': bad value ' + E.day + '=' + String(p.raw[E.day]).slice(0, 40));
      if (E.time && p.has(E.time) && m == null) LBW.drop(name + ': bad value ' + E.time + '=' + String(p.raw[E.time]).slice(0, 40));
      if (n == null && m == null) return ''; if (n == null) n = today;
      if (n < today || (n === today && m != null && m < T.now())) { LBW.drop(name + ': the eta has passed'); return ''; }
      return (n === today ? w.today : n === today + 1 ? w.tomorrow : fill(tw.on, { d: D.format(n, lang, { weekday: 'long', day: 'numeric', month: 'long' }) })) + (m != null ? ' ' + fill(tw.at, { t: T.format(m) }) : '');
    }
    LBW.widget(name, render);
  }
  // the newest tracker of a name and ref is the live one; the earlier ones say what it says now, and their actions go quiet.
  // Said in the live region when it is in the newest message, or when a data message changed it (force)
  function trkSettle(o, force) {
    if (!o.isConnected) return;
    var id = o.getAttribute('data-trk'), all = [].filter.call(document.querySelectorAll('.kit-tracker'), function (x) { return x.getAttribute('data-trk') === id && x.__trk; }), top = all[all.length - 1];
    all.forEach(function (x) {
      if (x === top) return; var u = x.querySelector('.kit-trk-upd') || x.box.insertBefore(el('p', 'kit-trk-upd'), x.box.firstChild);
      u.textContent = words(x.getAttribute('lang')).updated + ': ' + top.__trk.text;
      if (!x.classList.contains('is-old')) { x.classList.add('is-old'); quietAgain(x); }
    });
    if (o !== top) return;
    if (!o.__trkSeen) {   // the pulse runs once the card is on screen in a visible tab (kit.css: twice, then still; never with reduced motion)
      o.__trkSeen = 1; var on = function () { o.classList.add('is-seen'); }, IO = root.IntersectionObserver;
      if (!IO) on(); else { var io = new IO(function (es) { if (!es.some(function (e) { return e.isIntersecting; })) return; io.disconnect();
        if (document.visibilityState !== 'hidden') on(); else document.addEventListener('visibilitychange', function v() { document.removeEventListener('visibilitychange', v); on(); }); }); io.observe(o); }
    }
    var ms = LBW.host.messages(), prev = all[all.length - 2], t = U.titleOf(o), w = words(o.getAttribute('lang'));
    if (force || (ms.length && ms[ms.length - 1] === LBW.host.messageOf(o)))
      LBW.announce((force || (prev && prev.getAttribute('data-trk-state') !== o.getAttribute('data-trk-state')) ? w.updated + ': ' : '') + t + ' · ' + o.__trk.text, o.getAttribute('lang'), 'card:' + t);
  }
  // live: a data message under the tracker's "live" key ({ estado, orden, … } or a list of them) redraws the newest tracker
  // of that ref in place: the same keys the tag carries, checked the same way. An unknown state changes nothing.
  function trkLive() {
    if (TRKON) return; TRKON = true;
    LBW.on('data', function (e) {
      if (!e.ok) return; var d = LBW.data.get(e.key);
      [].forEach.call(document.querySelectorAll('.kit-tracker:not(.is-old)'), function (o) {
        var t = o.__trk; if (!t || t.live !== e.key) return;
        var r = (Array.isArray(d) ? d : [d]).filter(function (x) { return x && typeof x === 'object' && (!t.ref || String(x[t.refKey] == null ? '' : x[t.refKey]).toLowerCase() === t.ref.toLowerCase()); })[0];
        if (!r) return; var raw = {}, same = true, k;
        for (k in t.p.raw) if (Object.prototype.hasOwnProperty.call(t.p.raw, k)) raw[k] = t.p.raw[k];
        t.keys.forEach(function (x) { var v = r[x]; if (v != null && typeof v !== 'object' && Object.prototype.hasOwnProperty.call(r, x)) { if (String(v) !== String(raw[x])) same = false; raw[x] = String(v); } });
        if (same) return;
        var p2 = Object.create(Object.getPrototypeOf(t.p)), s = Object.prototype.hasOwnProperty.call(r, t.keys[0]) ? String(r[t.keys[0]]).trim().toLowerCase().replace(/-/g, '_') : null; p2.raw = raw;
        var n = t.render(p2, t.ctx); if (!n || (s != null && n.getAttribute('data-trk-state') !== s)) { LBW.drop('tracker: data "' + e.key + '" has no known state; the card stays'); return; }
        var back = keepPlace(o), q = wasQuieted(o);
        o.textContent = ''; o.className = n.className; while (n.firstChild) o.appendChild(n.firstChild); o.box = n.box;
        ['data-trk', 'data-trk-state'].forEach(function (a) { o.setAttribute(a, n.getAttribute(a)); }); o.__trk = n.__trk; o.__trkSeen = 0;
        back(); if (q) quietAgain(o); o.setAttribute('data-lbw-upgraded', '1'); trkSettle(o, true);
      });
    });
  }

  LBW.kit = { version: '0.11.0', dev: DEV, describe: describe, L: L, last: last, cards: cards, table: table, form: form, contact: contact, chips: chips, carousel: carousel, calc: calc, slots: slots, confirm: confirm, review: review, chart: chartCard, stats: stats, people: people, consent: consent, compare: compare, season: season, rating: rating,
    h: { usedByVisitor: usedByVisitor, wasQuieted: wasQuieted, quietAgain: quietAgain, keepPlace: keepPlace, upgraded: upgraded, radioGroup: radioGroup, note: note, list: list, label: label, dup: dup, choice: choice, multiChoice: multiChoice, copyBox: copyBox, status: status, wa: wa, fill: fill, money: money, total: total, lightbox: lightbox, chart: chart, statusHead: statusHead,
      icon: icon, withIcon: withIcon, icons: Object.keys(ICONS), badge: badge, tones: TONES.slice() } };
  // v0.10 · live & numbers (its own line: other makers' exports stay where they are)
  Object.assign(LBW.kit.h, { live: liveMark, liveSwap: liveSwap, tick: tick, flash: flash, meter: meterIn, moving: moving });
  LBW.kit.calendar = calendar;   // v0.10
  LBW.kit.map = mapCard;   // v0.10
  LBW.kit.tracker = tracker;   // v0.10
})(typeof window !== 'undefined' ? window : this);
