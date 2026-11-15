// The gallery's "Momentos de foco" demo (v0.14): an agent conversation on a fake v4 chat (the same data-lb-* hooks, a
// header, a scrolling column, a text box). Two widgets become focus moments at the point where they help: the plan form,
// then the calendar. A free question mid-moment gets an answer that ends with the moment's tag again (the newest copy is in
// view, the older one goes inert); a moment that sends folds to its receipt line; the booking ends with the pass.
// Written by gallery/build.mjs as gallery/focus.html (and site/focus.html with --page); the main page shows it in an iframe.
const STEPS = [['plan', 'Tu plan'], ['noches', 'Noches'], ['listo', 'Listo']];
export const focusConfig = (config) => ({
  prefix: config.prefix, langs: config.langs, defaultLang: config.defaultLang, timeZone: config.timeZone, links: config.links, actions: config.actions,
  widgets: {
    plan: { ...config.widgets.plan, kicker: '', title: '¿Qué escapada buscas?', note: 'Tres toques, sin datos personales.',
      focus: { title: 'Tu escapada', steps: STEPS, step: 'plan' } },
    noches: { ...config.widgets.noches, kicker: '', hidePast: true, focus: { title: 'Elige tus noches', steps: STEPS, step: 'noches' } },
    reserva: {
      type: 'confirm', style: 'pass', form: 'noches', status: 'Reserva recibida', title: 'Cabaña de la vía verde',
      rows: [['Llegada', '{from:date}'], ['Salida', '{to:date}'], ['Noches', '{nights}']],
      steps: ['Te escribimos para confirmar', 'Pagas al llegar'], note: 'Demo: no se reserva nada.', actions: ['call'],
      focus: { steps: STEPS, step: 'listo' },
    },
  },
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const script = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

export function focusPage({ config, lib, libCss, version }) {
  const cfg = focusConfig(config);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Momentos de foco</title>
<style>
/* a v4-like chat window filling the frame: its header, the scrolling column, the text box. ?dark=1: a dark chat and dark tokens */
:root { --chat-bg: #F5F5F7; --chat-line: #E6E6E9; --chat-ink: #0D0D0D; --chat-muted: #5D5D5D; --chat-top: #FFFFFF; --user-bg: #222228; --user-ink: #FFFFFF; color-scheme: light; }
html.is-dark { --chat-bg: #121217; --chat-line: #2C2C35; --chat-ink: #F2F2F5; --chat-muted: #B4B4C0; --chat-top: #1B1B22; --user-bg: #E8E8EE; --user-ink: #121217; color-scheme: dark;
  --lbw-card: #1B1B22; --lbw-ink: #F2F2F5; --lbw-muted: #B4B4C0; --lbw-soft: #26262E; --lbw-line: rgba(255,255,255,.14); --lbw-hair: rgba(255,255,255,.08);
  --lbw-accent: #A9A9FF; --lbw-accent-ink: #121217; --lbw-accent-text: #B9B9FF; --lbw-pill-bg: #24242C; --lbw-tint: #2A2A44; --lbw-control: rgba(255,255,255,.55); --lbw-focus: #F2F2F5; }
html, body { height: 100%; margin: 0; }
body { background: var(--chat-bg); color: var(--chat-ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
/* as v4 lays it out: the header, the message list and the text box keep to a 720 px column */
.win { height: 100%; display: flex; flex-direction: column; background: var(--chat-bg); overflow: hidden; }
.responsive-container { width: 100%; max-width: 720px; margin-inline: auto; box-sizing: border-box; }
.win-top { flex: none; padding: 10px 16px; background: var(--chat-top); border-bottom: 1px solid var(--chat-line); }
.win-head { display: flex; align-items: center; gap: 10px; }
.win-head .av { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: #1E1EFF; color: #FFFFFF; font: 700 13px/1 system-ui, sans-serif; }
.win-head h1 { margin: 0; font: 600 16px/1.25 system-ui, sans-serif; }
.win-head p { margin: 0; font-size: 12px; color: var(--chat-muted); }
.col { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.list { display: flex; flex-direction: column; gap: 12px; padding: 16px 12px 20px; }
.msg { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.msg > .bubble { background: var(--chat-top); border: 1px solid var(--chat-line); border-radius: 18px; padding: 9px 14px; max-width: 86%; }
.msg[data-lb-author="user"] { align-items: flex-end; }
.msg[data-lb-author="user"] > .bubble { background: var(--user-bg); color: var(--user-ink); border: 0; }
.msg > .lbw { max-width: 100%; }
.typing { color: var(--chat-muted); font-size: 14px; padding: 0 4px; }
.foot { flex: none; padding: 10px 12px 12px; background: var(--chat-top); border-top: 1px solid var(--chat-line); }
.box { display: flex; gap: 8px; }
.box input { flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid var(--chat-muted); border-radius: 22px; font: inherit; color: inherit; background: var(--chat-top); }
.box input::placeholder { color: var(--chat-muted); opacity: 1; }
.box button { flex: none; min-width: 44px; min-height: 44px; border: 0; border-radius: 22px; padding: 0 16px; background: #1E1EFF; color: #FFFFFF; font: 600 14px/1 system-ui, sans-serif; cursor: pointer; }
.box input:focus-visible, .box button:focus-visible { outline: 2px solid var(--chat-ink); outline-offset: 2px; }
.brand { margin: 6px 0 0; text-align: center; font-size: 11px; color: var(--chat-muted); }
/* the moment reaches the column's edges: the list's 12 px padding is the gutter; its surface is the chat's own top colour */
:root { --lbw-focus-gutter: 12px; }
/* the library's CSS (dist/lbw-kit.min.css, v${version}) */
${libCss}
</style>
</head>
<body>
<div class="win" data-lb-part="window">
  <div class="win-top responsive-container"><div class="win-head" data-lb-part="header"><span class="av" aria-hidden="true">RN</span><div><h1>Roda Norte</h1><p>Asistente · demo de momentos de foco</p></div></div></div>
  <div class="col" aria-label="Conversación"><div class="list responsive-container" id="list"></div></div>
  <div class="foot responsive-container">
    <form class="box" id="box" data-lb-part="input-field"><input id="say" type="text" autocomplete="off" placeholder="Escribe aquí…" aria-label="Escribe un mensaje"><button type="submit">Enviar</button></form>
    <p class="brand">Datos ficticios · no se reserva nada</p>
  </div>
</div>
<script>
// A fake Landbot v4 chat: one message per row, a typing indicator (role=status) while the agent "writes", and
// window._landbot.sendMessage for the widgets. The agent is a script: a free question while a moment is open gets an answer
// that ends with that moment's tag again, as docs/09 tells an agent to do.
(function () {
  if (/[?&]dark=1/.test(location.search)) document.documentElement.classList.add('is-dark');
  var list = document.getElementById('list'), col = list.parentNode, pend = {}, open = null;
  window.__focusSent = [];
  function row(author, text) {
    var r = document.createElement('div'), m = document.createElement('div'), b = document.createElement('div'), t = document.createElement('div');
    r.className = 'row'; m.className = 'msg'; m.setAttribute('data-lb-part', 'message'); m.setAttribute('data-lb-author', author);
    b.className = 'bubble'; t.setAttribute('data-lb-part', 'message-text'); t.textContent = text;
    b.appendChild(t); m.appendChild(b); r.appendChild(m); list.appendChild(r);
    col.scrollTop = col.scrollHeight;   // as v4 does: to the end on every message (lbw.js then shows a tall reply from its start)
    return m;
  }
  var q = [], busy = false;
  function bot(texts) { q = q.concat(texts); if (!busy) next(); }
  function next() {
    var text = q.shift(); if (text == null) { busy = false; return; }
    busy = true;
    var dots = document.createElement('div'); dots.className = 'typing'; dots.setAttribute('role', 'status'); dots.textContent = 'Escribiendo…';
    list.appendChild(dots); col.scrollTop = col.scrollHeight;
    setTimeout(function () { dots.remove(); var m = /\\[\\[gx:(\\w+)/.exec(text); if (m) open = m[1] === 'reserva' ? null : m[1]; row('bot', text); setTimeout(next, 250); }, window.__focusDelay == null ? 600 : window.__focusDelay);
  }
  function answer(text) {
    if (/^Mi plan:/.test(text)) { open = null; return bot(['Perfecto: con ese plan, la cabaña de la vía verde te va bien. Elige tus noches: [[gx:noches]]']); }
    if (/^Quiero reservar la cabaña/.test(text)) { open = null; return bot(['¡Hecho! Aquí tienes tu reserva: [[gx:reserva]]']); }
    // a free question: a useful answer, then the open moment again (its older copy goes inert)
    var again = open && window.__focusRetag !== false ? ' [[gx:' + open + ']]' : '';   // tests: __focusRetag = false, an agent that forgot the tag
    if (/perr/i.test(text)) return bot(['Sí, admitimos perros pequeños sin coste; avísanos al llegar.' + (again ? ' Sigue cuando quieras:' + again : '')]);
    // dates said in words: the agent copies them into the tag (from= to=), and the calendar opens on that month with them picked
    if (/diciembre/i.test(text)) return bot(['Del 9 al 12 de diciembre hay sitio; te lo dejo marcado: [[gx:noches from=9/12/2026 to=12/12/2026]]']);
    if (/precio|cuest|€/i.test(text)) return bot(['Cada noche muestra su precio en el calendario; el total sale al elegir las fechas.' + again]);
    bot(['Te leo. ' + (again ? 'Seguimos donde estabas:' + again : '¿En qué más te ayudo?')]);
  }
  window.__bot = function (t) { bot([t]); };   // tests: a message as the agent would write it
  window._landbot = {
    setCustomData: function (d) { for (var k in d) pend[k] = d[k]; },
    sendMessage: function (m) {
      var fields = Object.assign({}, pend, m.custom_data || {}); pend = {};
      window.__focusSent.push({ text: m.message, fields: fields });
      row('user', m.message); answer(m.message);
    }
  };
  document.getElementById('box').addEventListener('submit', function (e) {
    e.preventDefault(); var i = document.getElementById('say'), v = i.value.trim(); if (!v) return;
    i.value = ''; row('user', v); answer(v);
  });
  bot(['Hola, soy el asistente de Roda Norte. Te ayudo a reservar la cabaña de la vía verde.', 'Primero, cuéntame qué escapada buscas: [[gx:plan]]']);
})();
</script>
<script>${script(lib)}</script>
<script>window.__focusSetup = LBW.kit.setup(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script>
</body>
</html>
`;
}

// the main gallery's entry: what it is, the config, and the conversation in a phone-sized frame
export function focusSection(config) {
  const cfg = focusConfig(config);
  const json = JSON.stringify({ widgets: { plan: { type: 'form', '…': '…', focus: cfg.widgets.plan.focus }, noches: { type: 'calendar', '…': '…', focus: cfg.widgets.noches.focus } } }, null, 2);
  return `<div class="group" id="g-foco"><div class="group-head"><h2>Momentos de foco</h2><p>Un widget, en un punto concreto de la conversación, como una tarea con foco: el formulario de la reserva y el calendario. El chat sigue siendo un chat: la cabecera, el historial y la caja de texto de Landbot no se tocan.</p></div>
<section class="feature" id="foco">
  <header class="type-head"><h3>Una tarea dentro de la conversación</h3><code class="tname">"focus": { "steps", "step" }</code><span class="since">v0.14</span></header>
  <div class="type-body">
    <div class="doc">
      <p class="what">El widget pierde el marco de tarjeta y ocupa el ancho de la columna, con su título y «Paso 2 de 3 · Noches». Mientras es más alto que el chat, su botón principal queda abajo, a la vista. Al enviarlo se pliega a una línea de recibo y la conversación sigue.</p>
      <dl><div><dt>Cuándo</dt><dd>Una decisión con varios datos (fechas, personas, extras), revisar y confirmar, un configurador.</dd></div><div><dt>Cuándo no</dt><dd>Una respuesta normal o una sola elección: para eso, una tarjeta o chips.</dd></div></dl>
      <ul class="feat">
        <li>El paso viene del JSON (<code>"step": "noches"</code>) o del tag (<code>step=noches</code>), siempre de la lista cerrada de <code>focus.steps</code>. Otro valor se anota y se ignora.</li>
        <li>Si el visitante pregunta algo a mitad, el agente responde y termina con el tag del momento otra vez: la copia nueva <strong>conserva lo que ya había elegido</strong> (salvo lo que el tag cambie) y la anterior queda en una línea («Elige tus noches · Del 16 al 19 nov…»). Nunca hay dos juegos de controles vivos.</li>
        <li>Fechas dichas con palabras: el agente las copia en el tag (<code>from=9/12/2026 to=12/12/2026</code>) y el calendario se abre en ese mes con la estancia marcada. Con <code>"hidePast": true</code> no enseña las semanas ya pasadas.</li>
        <li>Una pregunta escrita no cierra el momento: sus botones siguen funcionando hasta que se envía o se dibuja de nuevo.</li>
        <li>Accesible: es una región con nombre; el foco entra al llegar solo si no estás escribiendo en la caja; el recibo se anuncia con cortesía; sin animación con movimiento reducido.</li>
        <li>Tipos con <code>focus</code>: form, calendar, slots, calc, review, compare y confirm. Cualquier tipo acepta <code>"actionRows": true</code> (botones en filas a lo ancho cuando el widget es estrecho).</li>
      </ul>
      <details><summary>El JSON de este ejemplo</summary><pre><code>${esc(json)}</code></pre></details>
      <p class="watch"><strong>Prueba.</strong> Rellena el plan; en el calendario marca dos noches y escribe «¿Admitís perros?»: la copia nueva conserva tus noches. Luego escribe «¿Y en diciembre?».</p>
    </div>
    <div class="stage is-frame"><iframe class="phone" src="focus.html" title="Demo de momentos de foco: una reserva dentro de una conversación"></iframe><p class="frame-note"><a href="focus.html">Abrir la demo a pantalla completa</a> · <a href="focus.html?dark=1">en oscuro</a></p></div>
  </div>
</section></div>`;
}
