// The gallery's "Modo pantalla" demo: one chat window in screen mode (runtime/screen.js), on a fake v4 chat with the same
// data-lb-* hooks, a scrolling column and a text box. A scripted bot answers: the form (compact) → the calendar → the
// confirm pass, each a screen with its step; anything typed gets a plain text answer, as an AI agent's free text would.
// Written by gallery/build.mjs as gallery/screen.html (and site/screen.html with --page); the main page shows it in an iframe.
export const screenConfig = (config) => ({
  prefix: config.prefix, langs: config.langs, defaultLang: config.defaultLang, timeZone: config.timeZone, links: config.links, actions: config.actions,
  screen: {
    on: true,
    header: { title: 'Reserva la cabaña', steps: [['plan', 'Tu plan'], ['noches', 'Noches'], ['listo', 'Listo']] },
    bar: true,
    history: 'collapse',
  },
  widgets: {
    plan: { ...config.widgets.plan, step: 'plan', kicker: 'Paso 1 · Tu plan', title: '¿Qué escapada buscas?', note: 'Tres toques, sin datos personales.' },
    noches: { ...config.widgets.noches, step: 'noches' },
    reserva: {
      type: 'confirm', style: 'pass', form: 'noches', status: 'Reserva recibida', title: 'Cabaña de la vía verde',
      rows: [['Llegada', '{from:date}'], ['Salida', '{to:date}'], ['Noches', '{nights}']],
      steps: ['Te escribimos para confirmar', 'Pagas al llegar'], note: 'Demo: no se reserva nada.', actions: ['call'],
    },
  },
});

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const script = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

export function screenPage({ config, lib, libCss, version }) {
  const cfg = screenConfig(config);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modo pantalla</title>
<style>
/* a v4-like chat window filling the frame: header, the scrolling column, the text box. Light, as a visitor sees it */
:root { --chat-bg: #F5F5F7; --chat-line: #E6E6E9; --chat-ink: #0D0D0D; --user-bg: #222228; --user-ink: #FFFFFF; color-scheme: light; }
html, body { height: 100%; margin: 0; }
body { background: var(--chat-bg); color: var(--chat-ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.win { height: 100%; display: flex; flex-direction: column; max-width: 720px; margin: 0 auto; background: var(--chat-bg); overflow: hidden; }
.win-top { flex: none; padding: 10px 16px; background: #FFFFFF; border-bottom: 1px solid var(--chat-line); }
.win-head { display: flex; align-items: center; gap: 10px; }
.win-head .av { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; background: #1E1EFF; color: #FFFFFF; font: 700 13px/1 system-ui, sans-serif; }
.win-head h1 { margin: 0; font: 600 16px/1.25 system-ui, sans-serif; }
.win-head p { margin: 0; font-size: 12px; color: #5D5D5D; }
.col { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.list { display: flex; flex-direction: column; gap: 12px; padding: 16px 12px 20px; }
.msg { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.msg > .bubble { background: #FFFFFF; border: 1px solid var(--chat-line); border-radius: 18px; padding: 9px 14px; max-width: 86%; }
.msg[data-lb-author="user"] { align-items: flex-end; }
.msg[data-lb-author="user"] > .bubble { background: var(--user-bg); color: var(--user-ink); border: 0; }
.msg > .lbw { max-width: 100%; }
.typing { color: #5D5D5D; font-size: 14px; padding: 0 4px; }
.foot { flex: none; padding: 10px 12px 12px; background: #FFFFFF; border-top: 1px solid var(--chat-line); }
.box { display: flex; gap: 8px; }
.box input { flex: 1; min-width: 0; min-height: 44px; box-sizing: border-box; padding: 0 14px; border: 1px solid rgba(13,13,13,.5); border-radius: 22px; font: inherit; color: inherit; background: #FFFFFF; }
.box button { flex: none; min-width: 44px; min-height: 44px; border: 0; border-radius: 22px; padding: 0 16px; background: #1E1EFF; color: #FFFFFF; font: 600 14px/1 system-ui, sans-serif; cursor: pointer; }
.box input:focus-visible, .box button:focus-visible { outline: 2px solid #0D0D0D; outline-offset: 2px; }
.brand { margin: 6px 0 0; text-align: center; font-size: 11px; color: #5D5D5D; }
/* the library's CSS (dist/lbw-kit.min.css, v${version}) */
${libCss}
</style>
</head>
<body>
<div class="win" data-lb-part="window">
  <div class="win-top"><div class="win-head" data-lb-part="header"><span class="av" aria-hidden="true">RN</span><div><h1>Roda Norte</h1><p>Asistente · demo del modo pantalla</p></div></div></div>
  <div class="col" aria-label="Conversación"><div class="list" id="list"></div></div>
  <div class="foot">
    <form class="box" id="box" data-lb-part="input-field"><input id="say" type="text" autocomplete="off" placeholder="Escribe aquí…" aria-label="Escribe un mensaje"><button type="submit">Enviar</button></form>
    <p class="brand">Datos ficticios · no se reserva nada</p>
  </div>
</div>
<script>
// A fake Landbot v4 chat: rows that wrap one message each (as v4 does), a typing indicator (role=status) while the bot
// "writes", and window._landbot.sendMessage for the widgets. The bot is a script; typed text gets a plain answer.
(function () {
  var list = document.getElementById('list'), col = list.parentNode, pend = {};
  window.__screenSent = [];
  function row(author, text) {
    var r = document.createElement('div'), m = document.createElement('div'), b = document.createElement('div'), t = document.createElement('div');
    r.className = 'row'; m.className = 'msg'; m.setAttribute('data-lb-part', 'message'); m.setAttribute('data-lb-author', author);
    b.className = 'bubble'; t.setAttribute('data-lb-part', 'message-text'); t.textContent = text;
    b.appendChild(t); m.appendChild(b); r.appendChild(m); list.appendChild(r);
    col.scrollTop = col.scrollHeight;
    return m;
  }
  // the bot writes one message after another, with a typing indicator in between
  var q = [], busy = false;
  function bot(texts) { q = q.concat(texts); if (!busy) next(); }
  function next() {
    var text = q.shift(); if (text == null) { busy = false; return; }
    busy = true;
    var dots = document.createElement('div'); dots.className = 'typing'; dots.setAttribute('role', 'status'); dots.textContent = 'Escribiendo…';
    list.appendChild(dots); col.scrollTop = col.scrollHeight;
    setTimeout(function () { dots.remove(); row('bot', text); setTimeout(next, 250); }, window.__screenDelay == null ? 600 : window.__screenDelay);
  }
  function answer(text) {
    if (/^Mi plan:/.test(text)) return bot(['Perfecto. Con ese plan, la cabaña de la vía verde te va bien.', 'Elige tus noches: [[gx:noches]]']);
    if (/^Quiero reservar la cabaña/.test(text)) return bot(['¡Hecho! Aquí tienes tu reserva: [[gx:reserva step=listo]]']);
    // anything typed: the agent's free text, no tag. It shows as a bubble on the current screen
    if (/perr/i.test(text)) return bot(['Sí, admitimos perros pequeños sin coste. Sigue con la reserva cuando quieras.']);
    bot(['Te leo. Puedes seguir con la reserva en la pantalla de arriba.']);
  }
  window._landbot = {
    setCustomData: function (d) { for (var k in d) pend[k] = d[k]; },
    sendMessage: function (m) {
      var fields = Object.assign({}, pend, m.custom_data || {}); pend = {};
      window.__screenSent.push({ text: m.message, fields: fields });
      row('user', m.message); answer(m.message);
    }
  };
  document.getElementById('box').addEventListener('submit', function (e) {
    e.preventDefault(); var i = document.getElementById('say'), v = i.value.trim(); if (!v) return;
    i.value = ''; row('user', v); answer(v);
  });
  bot(['Hola, soy el asistente de Roda Norte. Reservemos la cabaña en tres pasos.', 'Primero, tu plan: [[gx:plan]]']);
})();
</script>
<script>${script(lib)}</script>
<script>window.__screenSetup = LBW.kit.setup(${JSON.stringify(cfg).replace(/</g, '\\u003c')});</script>
</body>
</html>
`;
}

// the main gallery's entry: what it is, the config, and the demo in a phone-sized frame
export function screenSection(config) {
  const cfg = screenConfig(config);
  const json = JSON.stringify({ screen: cfg.screen, widgets: { plan: { type: 'form', step: 'plan', '…': '…' }, noches: { type: 'calendar', step: 'noches', '…': '…' } } }, null, 2);
  return `<div class="group" id="g-pantalla"><div class="group-head"><h2>Modo pantalla</h2><p>Para que el bot parezca una app y no un chat: una pantalla cada vez, una cabecera con los pasos y una barra abajo con la acción principal. Funciona con cualquier tipo, guiado por el flujo o por un agente.</p></div>
<section class="feature" id="pantalla">
  <header class="type-head"><h3>Una pantalla cada vez</h3><code class="tname">"screen": { "on": true }</code><span class="since">prototipo</span></header>
  <div class="type-body">
    <div class="doc">
      <p class="what">El widget del mensaje más nuevo es la pantalla. Los mensajes de antes se pliegan (siguen en la página, detrás de «Ver conversación»), la cabecera marca el paso y la acción principal se repite en una barra fija mientras el botón original no se ve.</p>
      <dl><div><dt>Cuándo</dt><dd>Reservas, presupuestos y altas de varios pasos: el formulario, el calendario y la confirmación, uno detrás de otro.</dd></div></dl>
      <ul class="feat">
        <li>El paso viene del JSON (<code>"step": "noches"</code> en el widget) o del tag (<code>step=listo</code> o <code>step=3</code>), siempre de la lista cerrada de <code>screen.header.steps</code>. Otro valor se anota y se ignora.</li>
        <li>Si el agente responde con texto libre entre pantallas, sale como una burbuja normal debajo de la pantalla actual. Nada de lo que llega después de la pantalla se pliega nunca.</li>
        <li>El visitante siempre puede escribir: la caja de texto no se toca, y el foco no sale de ella.</li>
        <li>Accesible: el foco pasa al título de la nueva pantalla, una región «polite» dice «Paso 2 de 3: Noches», y la barra es un atajo para el ratón (el botón original sigue siendo el del teclado y el lector de pantalla).</li>
        <li>Sin el gancho del chat de Landbot, o con la clave <code>screen</code> mal escrita, es un chat normal.</li>
      </ul>
      <details><summary>El JSON de este ejemplo</summary><pre><code>${esc(json)}</code></pre></details>
      <p class="watch"><strong>Prueba.</strong> Rellena el plan, elige dos noches y escribe algo en la caja («¿Admitís perros?») para ver cómo responde el agente sin romper la pantalla.</p>
    </div>
    <div class="stage is-frame"><iframe class="phone" src="screen.html" title="Demo del modo pantalla: un chat de reserva en tres pasos"></iframe><p class="frame-note"><a href="screen.html">Abrir la demo a pantalla completa</a></p></div>
  </div>
</section></div>`;
}
