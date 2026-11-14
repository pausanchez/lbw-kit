// node gallery/build.mjs → gallery/index.html
// One self-contained page: every kit type drawn live by the built library (dist/), with its short docs.
// The library and its CSS are inlined, so the page works offline and as an Artifact.
import { readFileSync, writeFileSync } from 'node:fs';
import { groups, types, tags, examples } from './docs.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const version = JSON.parse(read('package.json')).version;
const config = JSON.parse(read('gallery/config.json'));
const lib = read('dist/lbw-kit.min.js');
const libCss = read('dist/lbw-kit.min.css').replace(/@import[^;]+;/g, '');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const script = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
// what a Webhook block's object becomes in @{salidas}: a Python repr (single quotes, double ones around an apostrophe, None)
const DATA = "{'fecha': '2026-11-13', 'salidas': [{'hora': '10:00', 'ruta': 'Ría de Bilbao', 'guia': 'Ana', 'plazas': 6}, "
  + "{'hora': '12:30', 'ruta': \"Mirador d'Artxanda\", 'guia': 'Ben', 'plazas': 2}, {'hora': '17:00', 'ruta': 'Puerto Viejo', 'guia': 'Ana', 'plazas': 0}, "
  + "{'hora': '18:30', 'ruta': 'Txakoli y viñedos', 'guia': None, 'plazas': 8}]}";
const jsonFor = (names) => JSON.stringify(Object.fromEntries(names.map((n) => [n, config.widgets[n]])), null, 2);

// an entry's key: its type, or its own id when it shows a type again (the two data channels draw cards and a table)
const key = (t) => t.id || t.type;
const count = new Set(types.map((t) => t.type)).size, channels = types.filter((t) => t.group === 'datos').length;
const nav = groups.map((g) => `<div class="nav-group"><p class="nav-h">${esc(g.title)}</p>${types.filter((t) => t.group === g.id)
  .map((t) => `<a href="#${key(t)}"><span>${esc(t.name)}</span><code>${esc(t.code || t.type)}</code></a>`).join('')}</div>`).join('');

const tagHtml = (text) => esc(text).replace(/\[\[[^\]]+\]\]/g, (m) => `<code class="tag">${m}</code>`);
// the visitor's bubbles are drawn but not marked as chat messages: on one page with 19 chats, the runtime would
// take each as the latest visitor message and quiet every widget above it
const row = (author, text, cls = '') => `<div class="row is-${author}"${author === 'bot' ? ' data-lb-part="message" data-lb-author="bot"' : ''}><div class="bubble${cls}"><div data-lb-part="message-text">${esc(text)}</div></div></div>`;
function chat(t) {
  const k = key(t), ex = examples[k];
  // the worked example first (the visitor, then the agent's or the flow's message with its tag), then the type's other demos
  const msgs = row('user', ex.user, t.type === 'confirm' ? ' js-booked' : '') + row('bot', ex.chat || ex.agent)
    + t.demo.slice(1).map(([text, tag]) => row('bot', text ? text + ' ' + tag : tag, text ? '' : ' is-bare')).join('');
  // the Code block's data, on and off: off, the next message waits for it and then draws the saved copy
  const sim = k === 'data' ? `<button type="button" class="sim" id="sim-data" aria-pressed="false">Probar sin los datos del bloque Code</button>` : '';
  return `<div class="chat" data-section="${k}">${msgs}</div>${sim}
    <div class="sent" id="sent-${k}" hidden><p class="sent-h">Lo que ha enviado el visitante</p><ol></ol></div>`;
}
// one line of the worked example: a tag line, a line of code, or plain text with `code`
const exLine = ([who, text, kind]) => `<div class="ex-line${who === 'Código' ? ' is-code' : ''}"><span class="ex-who">${esc(who)}</span><span>${
  kind === 'tag' ? tagHtml(text) : kind === 'code' ? `<code class="ex-src">${esc(text)}</code>` : md(text)}</span></div>`;

function section(t) {
  const k = key(t), g = tags[k], ex = examples[k];
  const lines = ex.lines || [['Visitante', ex.user, 'md'], ['Agente', ex.agent, 'tag']];
  return `<section class="type" id="${k}">
  <header class="type-head">
    <h3>${esc(t.name)}</h3><code class="tname">"type": "${t.type}"</code>${t.since ? `<span class="since">${t.since}</span>` : ''}
  </header>
  <div class="type-body">
    <div class="doc">
      <p class="what">${md(t.what)}</p>
      <dl><div><dt>Cuándo</dt><dd>${md(t.when)}</dd></div></dl>
      <ol class="steps">
        <li>
          <h4>${esc(g.h || 'El agente escribe el tag')}</h4>
          <p class="by">${md(g.by)}</p>
          <div class="ptable"><table>
            <thead><tr><th scope="col">Clave</th><th scope="col">Acepta</th><th scope="col">Si falta</th><th scope="col">Si no existe</th></tr></thead>
            <tbody>${g.p.map((r) => `<tr><th scope="row"><code>${esc(r[0])}</code></th><td>${md(r[1])}</td><td>${md(r[2])}</td><td>${md(r[3])}</td></tr>`).join('')}</tbody>
          </table></div>
          <div class="prompt"><div class="prompt-h"><span>${esc(g.promptH || 'En las instrucciones del agente')}</span><button type="button" class="copy" id="copy-${k}">Copiar</button></div><pre>${esc(g.prompt)}</pre></div>
          <div class="example">
            <p class="ex-h">${esc(g.exH || 'Ejemplo: así lo escribe el agente')}</p>
            ${t.type === 'confirm' ? `<div class="ex-line"><span class="ex-who">Visitante</span><span class="ex-booked">${esc(ex.user)}</span></div>${exLine(lines[1])}` : lines.map(exLine).join('')}
            ${exLine(['Código', ex.code, 'md'])}
          </div>
        </li>
        <li>
          <h4>El código lo valida y lo dibuja con tu JSON</h4>
          <ul>${t.keys.map((k) => `<li>${md(k)}</li>`).join('')}</ul>
          <details><summary>El JSON de este ejemplo</summary><pre><code>${esc(jsonFor(t.widgets))}</code></pre></details>
        </li>
        <li>
          <h4>El visitante toca</h4>
          <p>${md(t.saves)}</p>
        </li>
      </ol>
      <p class="watch"><strong>Ojo.</strong> ${md(t.watch)}</p>
    </div>
    <div class="stage">${chat(t)}</div>
  </div>
</section>`;
}

const body = groups.map((g) => `<div class="group" id="g-${g.id}"><div class="group-head"><h2>${esc(g.title)}</h2><p>${md(g.lead)}</p></div>
${types.filter((t) => t.group === g.id).map(section).join('\n')}</div>`).join('\n');

const html = `<title>Galería de AI Widgets</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a sticky index on the left, then one row per type: its docs beside a live chat column at the v4 width. */
:root {
  --bg: #F3F4F8; --surface: #FFFFFF; --ink: #12131A; --muted: #5A5D6E; --line: #DADCE6;
  --accent: #1E1EFF; --accent-soft: #E7E7FF; --code-bg: #EBECF3; --warn-bg: #FFF4DE; --warn-ink: #6B4500;
  --chat-bg: #F5F5F7; --chat-line: #E6E6E9; --chat-ink: #0D0D0D; --user-bg: #222228; --user-ink: #FFFFFF;
  --f-display: "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif;
  --f-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --col: 340px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101118; --surface: #181A24; --ink: #ECEDF4; --muted: #A0A3B5; --line: #2C2F3D;
  --accent: #8C8CFF; --accent-soft: #23244A; --code-bg: #22243180; --warn-bg: #2E2614; --warn-ink: #F2CF8A; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #101118; --surface: #181A24; --ink: #ECEDF4; --muted: #A0A3B5; --line: #2C2F3D;
  --accent: #8C8CFF; --accent-soft: #23244A; --code-bg: #22243180; --warn-bg: #2E2614; --warn-ink: #F2CF8A; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 15px/1.55 var(--f-body); }
.wrap { max-width: 1320px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 64px; }
main code, .hero code, .ref code { font-family: var(--f-mono); font-size: .86em; background: var(--code-bg); padding: .08em .35em; border-radius: 4px; overflow-wrap: anywhere; }
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* hero */
.hero { padding-block: 48px 28px; display: grid; gap: 20px; max-width: 900px; }
.eyebrow { font: 500 12px/1 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); display: flex; gap: 10px; flex-wrap: wrap; }
.eyebrow b { color: var(--accent); font-weight: 500; }
h1 { font: 700 clamp(34px, 5vw, 54px)/1.02 var(--f-display); letter-spacing: -.02em; margin: 0; text-wrap: balance; }
.lede { font-size: 17px; color: var(--muted); max-width: 64ch; margin: 0; }
.flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 4px 0 0; padding: 0; list-style: none; counter-reset: s; }
.flow li { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; counter-increment: s; }
.flow li::before { content: counter(s); font: 600 12px/1 var(--f-mono); color: var(--accent); display: block; margin-bottom: 8px; }
.flow strong { display: block; font-weight: 600; margin-bottom: 2px; }
.flow span { color: var(--muted); font-size: 14px; }

/* toolbar */
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); border-bottom: 1px solid var(--line); padding-block: 10px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.bar-label { font-size: 13px; color: var(--muted); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface); }
.seg button { font: 500 13px/1 var(--f-body); color: var(--muted); background: none; border: 0; padding: 8px 12px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.bar .count { margin-left: auto; font: 13px var(--f-mono); color: var(--muted); }

/* layout */
.layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 40px; margin-top: 28px; }
nav.index { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 72px); align-self: start; display: grid; gap: 18px; max-height: calc(100vh - 100px); overflow: auto; }
.nav-h { font: 600 11px/1 var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
.nav-group a { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 6px; color: var(--ink); text-decoration: none; font-size: 14px; }
.nav-group a code { background: none; color: var(--muted); padding: 0; font-size: 11px; }
.nav-group a:hover { background: var(--accent-soft); }
@media (max-width: 900px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  nav.index { position: static; max-height: none; display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .nav-group { display: contents; }
  .nav-h { display: none; }
  .nav-group a { border: 1px solid var(--line); background: var(--surface); }
  .nav-group a code { display: none; }
}

/* groups and types */
.group { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; margin-bottom: 56px; }
.group-head h2 { font: 700 28px/1.1 var(--f-display); margin: 0 0 6px; letter-spacing: -.01em; }
.group-head p { margin: 0; color: var(--muted); max-width: 70ch; }
.type { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px; scroll-margin-top: 80px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.type-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.type-head h3 { font: 700 22px/1.15 var(--f-display); margin: 0; }
.tname { color: var(--accent); background: var(--accent-soft); }
.since { font: 500 11px/1 var(--f-mono); color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px; }
.type-body { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
.doc { flex: 1 1 320px; min-width: 0; display: grid; gap: 12px; }
.what { font-size: 16px; margin: 0; max-width: 62ch; }
/* the page's own definition lists (the doc column): scoped so they never restyle a widget's rows (the a11y review saw them leak) */
.doc dl { margin: 0; display: grid; gap: 8px; }
.doc dl div { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 10px; }
.doc dt { font: 600 11px/1.9 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.doc dd { margin: 0; }
code.tag { color: var(--accent); }
.sub-h { font: 600 11px/1 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 4px 0 0; }
.doc ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.watch { margin: 0; background: var(--warn-bg); color: var(--warn-ink); border-radius: 8px; padding: 10px 12px; font-size: 14px; }
.watch code { background: transparent; color: inherit; font-weight: 500; }
details summary { cursor: pointer; font-size: 14px; color: var(--accent); }
details pre { margin: 10px 0 0; background: var(--code-bg); border-radius: 8px; padding: 12px; overflow-x: auto; max-height: 420px; }
details pre code { background: none; padding: 0; font-size: 12px; line-height: 1.5; overflow-wrap: normal; }


/* the three steps of a widget, in the order they happen */
.steps { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 0; counter-reset: st; }
.steps > li { counter-increment: st; position: relative; padding: 0 0 18px 34px; display: grid; gap: 8px; min-width: 0; }
.steps > li::before { content: counter(st); position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--surface); font: 600 12px/22px var(--f-mono); text-align: center; }
.steps > li:not(:last-child)::after { content: ""; position: absolute; left: 10.5px; top: 26px; bottom: 4px; width: 1px; background: var(--line); }
.steps h4 { margin: 0; font: 600 15px/22px var(--f-body); }
.steps p { margin: 0; }
.by { color: var(--muted); font-size: 14px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.ptable { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
.ptable table { border-collapse: collapse; width: 100%; font-size: 13px; }
.ptable th, .ptable td { text-align: left; vertical-align: top; padding: 6px 10px; border-top: 1px solid var(--line); }
.ptable thead th { border-top: 0; font: 600 10.5px/1.6 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); background: var(--code-bg); }
.ptable tbody th { font-weight: 400; white-space: nowrap; }
.prompt { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.prompt-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 10px; background: var(--code-bg); font: 600 10.5px/1.6 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.copy { font: 500 12px/1 var(--f-body); color: var(--accent); background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 5px 9px; cursor: pointer; text-transform: none; letter-spacing: 0; }
.prompt pre { margin: 0; padding: 10px 12px; font: 12.5px/1.55 var(--f-mono); white-space: pre-wrap; overflow-wrap: anywhere; }

/* the worked example: visitor → agent → what the code looks up */
.example { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; display: grid; gap: 6px; }
.ex-h { margin: 0; font: 600 10.5px/1.6 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.ex-line { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 10px; font-size: 14px; }
.ex-line.is-code { border-top: 1px dashed var(--line); padding-top: 6px; }
.ex-who { font: 500 12px/1.75 var(--f-mono); color: var(--muted); }
code.ex-src { display: block; padding: 4px 8px; font-size: 12px; line-height: 1.5; }
.sim { justify-self: start; font: 500 13px/1 var(--f-body); color: var(--accent); background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 7px 10px; cursor: pointer; }
.sim[aria-pressed="true"] { background: var(--accent-soft); }

/* the chat column: always the chat's own light look, as a visitor sees it */
.stage { flex: 0 1 var(--col); width: min(var(--col), 100%); max-width: 100%; min-width: 0; display: grid; gap: 10px; }
.chat { background: var(--chat-bg); border: 1px solid var(--chat-line); border-radius: 12px; padding: 14px 12px; color: var(--chat-ink); color-scheme: light; font: 15px/1.5 system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; gap: 12px; min-height: 80px; }
.row { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.row > .bubble { background: #FFFFFF; border: 1px solid var(--chat-line); border-radius: 18px; padding: 9px 14px; max-width: 86%; }
.row > .bubble.is-bare { display: none; }
.row.is-user { align-items: flex-end; }
.row.is-user > .bubble { background: var(--user-bg); color: var(--user-ink); border: 0; }
.row > .lbw, .row .lbw { max-width: 100%; }
.wait { margin: 0; color: #5D5D5D; font-size: 14px; }
.wait a { color: #1E1EFF; }
.sent { background: var(--code-bg); border-radius: 8px; padding: 10px 12px; font-size: 13px; }
.sent-h { margin: 0 0 6px; font: 600 11px/1 var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.sent ol { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.sent .msg { display: block; }
.sent .fields { display: block; font-family: var(--f-mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }

/* common pieces */
.ref { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.ref > div { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; min-width: 0; }
.ref h3 { font: 700 18px/1.2 var(--f-display); margin: 0 0 10px; }
.ref table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ref td { border-top: 1px solid var(--line); padding: 7px 8px 7px 0; vertical-align: top; }
.ref td:first-child { white-space: nowrap; }
.ref p, .ref ul { margin: 0 0 8px; font-size: 14px; }
.ref ul { padding-left: 18px; display: grid; gap: 4px; }
.tones { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.tones span { font: 500 12px var(--f-mono); border-radius: 999px; padding: 3px 10px; border: 1px solid var(--line); }
.foot { color: var(--muted); font-size: 13px; margin-top: 40px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
html { scroll-behavior: smooth; }

/* the kit's own CSS (dist/lbw-kit.min.css, v${version}) */
${libCss}
</style>

<div class="wrap">
  <header class="hero">
    <p class="eyebrow"><b>lbw-kit v${version}</b><span>${count} tipos</span><span>${channels} canales de datos</span><span>Landbot · chat web v4</span></p>
    <h1>Galería de AI Widgets</h1>
    <p class="lede">Cada tipo que el kit dibuja desde JSON, con su ficha corta y un chat de prueba al lado. Los widgets de esta página los pinta la librería real; puedes tocarlos y ver qué frase enviaría el visitante y qué campos de Landbot guardaría.</p>
    <ol class="flow">
      <li><strong>El agente elige</strong><span>Sus instrucciones le dicen qué tags hay y cuándo usarlos. Termina el mensaje con uno: <code>[[gx:bicis tipo=electrica lang=es]]</code>. Elige ids; nunca inventa precios ni fechas.</span></li>
      <li><strong>El código valida</strong><span>El Custom JS quita el tag y comprueba cada valor contra listas cerradas. Un id inventado no dibuja nada.</span></li>
      <li><strong>El widget habla</strong><span>Dibuja tus datos. Sus botones envían una frase como el visitante y guardan campos con ella.</span></li>
    </ol>
  </header>

  <div class="bar" role="toolbar" aria-label="Ancho del chat">
    <span class="bar-label">Ancho del chat</span>
    <div class="seg">
      <button type="button" id="w-phone" data-w="340" aria-pressed="true">Móvil · 340 px</button>
      <button type="button" id="w-livechat" data-w="350" aria-pressed="false">Livechat · 350 px</button>
      <button type="button" id="w-desk" data-w="672" aria-pressed="false">Escritorio · 672 px</button>
    </div>
    <span class="count">prefijo gx · datos ficticios</span>
  </div>

  <div class="layout">
    <nav class="index" aria-label="Tipos">${nav}<div class="nav-group"><p class="nav-h">Referencia</p><a href="#piezas"><span>Piezas comunes</span></a></div></nav>
    <main>
${body}
      <div class="group" id="piezas">
        <div class="group-head"><h2>Piezas comunes</h2><p>Lo que comparten todos los tipos. La referencia completa está en <code>docs/20-library-and-json.md</code>.</p></div>
        <div class="ref">
          <div>
            <h3>Botones (acciones)</h3>
            <table>
              <tr><td><code>"call"</code></td><td>Una acción con nombre, de <code>actions</code></td></tr>
              <tr><td><code>{ tel, cc, label }</code></td><td>Llamar. Necesita <code>"tel:"</code> en <code>links</code></td></tr>
              <tr><td><code>{ wa, text, label }</code></td><td>WhatsApp. Necesita <code>https://wa.me/</code></td></tr>
              <tr><td><code>{ link, label }</code></td><td>Un enlace bajo un origen de <code>links</code></td></tr>
              <tr><td><code>{ mail, label }</code></td><td>Correo. Necesita <code>"mailto:"</code></td></tr>
              <tr><td><code>{ reply: [l, frase, campos] }</code></td><td>Respuesta rápida que guarda campos</td></tr>
            </table>
            <p style="margin-top:10px">Cualquiera admite <code>"primary": true</code>, <code>"danger": true</code> e <code>"icon"</code>.</p>
          </div>
          <div>
            <h3>Tonos e iconos</h3>
            <div class="tones"><span>neutral</span><span>ok</span><span>info</span><span>warn</span><span>danger</span></div>
            <p>El estado lleva icono además de color (✓, i, !, ×): el color nunca es la única señal.</p>
            <p>Iconos: <code>check x info alert phone mail chat calendar clock pin external star user shield bell doc</code>.</p>
          </div>
          <div>
            <h3>Plantillas y fórmulas</h3>
            <ul>
              <li><code>{clave}</code> un valor; <code>:label</code>, <code>:labels</code>, <code>:lower</code>, <code>:money</code></li>
              <li>Fechas: <code>{day:date}</code>, <code>{day:dmy}</code>, <code>{from:time}</code></li>
              <li>Fórmulas: <code>+ − * / ( )</code>, <code>round floor ceil abs min max</code>, <code>tabla[clave]</code></li>
              <li>El dinero, en céntimos enteros</li>
              <li>Cualquier texto puede ser <code>{ "es": …, "en": … }</code></li>
            </ul>
          </div>
          <div>
            <h3>Aún necesita JavaScript</h3>
            <ul>
              <li>Un widget que el kit no tiene (una recomendación, una comprobación de cobertura)</li>
              <li>Una calculadora cuyos controles cambian con el elemento</li>
              <li>Horarios de varias sedes</li>
              <li>Un filtro de carrusel donde un elemento está en varios valores</li>
              <li>Datos pedidos por URL fuera de un carrusel, y los huecos de Calendly</li>
              <li>Un gráfico con su propio formato de eje</li>
            </ul>
            <p>Ya no, desde v0.9.0: un precio, una fecha o unas plazas que trae el flujo (<code>params</code>) y las filas de un bloque Code (<code>source.data</code>).</p>
            <p>Comprueba la config antes de subirla: <code>npm run check:config -- config.json</code>.</p>
          </div>
        </div>
      </div>
      <p class="foot">Generada con <code>node gallery/build.mjs</code> desde <code>gallery/config.json</code> y <code>dist/</code>. Marca ficticia (Roda Norte), enlaces .example y datos de prueba.</p>
    </main>
  </div>
</div>

<script>
// A fake Landbot: fields queue with setCustomData and leave with the next message, as in the real chat
(function () {
  var pend = {}, lastChat = null;
  document.addEventListener('pointerdown', function (e) { var c = e.target.closest && e.target.closest('.stage'); if (c) lastChat = c; }, true);
  document.addEventListener('keydown', function (e) { var c = e.target.closest && e.target.closest('.stage'); if (c) lastChat = c; }, true);
  function bubble(chat, author, text) {
    var r = document.createElement('div'); r.className = 'row is-' + author; if (author === 'bot') { r.setAttribute('data-lb-part', 'message'); r.setAttribute('data-lb-author', 'bot'); }
    var b = document.createElement('div'); b.className = 'bubble'; var t = document.createElement('div'); t.setAttribute('data-lb-part', 'message-text'); t.textContent = text;
    b.appendChild(t); r.appendChild(b); chat.appendChild(r); return r;
  }
  window._landbot = {
    setCustomData: function (d) { for (var k in d) pend[k] = d[k]; },
    sendMessage: function (m) {
      var fields = Object.assign({}, pend, m.custom_data || {}); pend = {};   // v0.9.5+: the fields travel as custom_data in the message itself
      var stage = lastChat; if (!stage) return;
      var chat = stage.querySelector('.chat'), id = chat.getAttribute('data-section');
      bubble(chat, 'user', m.message);
      var box = document.getElementById('sent-' + id), li = document.createElement('li');
      var a = document.createElement('span'); a.className = 'msg'; a.textContent = '«' + m.message + '»';
      var f = document.createElement('span'); f.className = 'fields'; var keys = Object.keys(fields);
      f.textContent = keys.length ? keys.map(function (k) { return k + ' = ' + fields[k]; }).join(' · ') : 'sin campos';
      li.appendChild(a); li.appendChild(f); box.querySelector('ol').appendChild(li); box.hidden = false;
      if (id === 'slots') {   // the agent answers a booking with the confirm card, in its own section
        var c = document.querySelector('.chat[data-section="confirm"]');
        bubble(c, 'user', m.message);
        bubble(c, 'bot', 'Hecho. [[gx:hecho]]');
      }
    }
  };
  // copy an instruction line: clipboard, else select it
  [].forEach.call(document.querySelectorAll('.copy'), function (b) {
    b.addEventListener('click', function () {
      var pre = b.closest('.prompt').querySelector('pre'), text = pre.textContent;
      var sel = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Seleccionado'; };
      try { navigator.clipboard.writeText(text).then(function () { b.textContent = 'Copiado'; }, sel); } catch (e) { sel(); }
      setTimeout(function () { b.textContent = 'Copiar'; }, 1800);
    });
  });
  // the chat width
  [].forEach.call(document.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () {
      document.documentElement.style.setProperty('--col', b.getAttribute('data-w') + 'px');
      [].forEach.call(document.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
})();
</script>
<script>
// the params demo needs a date from today on (min: "today"): the next Saturday, written into the tag before the library reads it
(function () { var d = new Date(), n = (6 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + n);
  var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  [].forEach.call(document.querySelectorAll('.chat[data-section="params"] [data-lb-part=message-text], #params .example code.tag'), function (x) { x.textContent = x.textContent.replace('2026-11-21', iso); }); })();
</script>
<script>${script(lib)}</script>
<script>
// the flow's Code block, simulated: a Webhook block saved the API's answer in @{salidas}, and Landbot pasted it into the
// script as a Python repr (measured, docs/21 §2). put() reads that form without eval. It runs before the messages are read.
var SALIDAS = String.raw\`${script(DATA)}\`;
LBW.data.put('salidas', SALIDAS);
</script>
<script>window.__gallerySetup = LBW.kit.setup(${JSON.stringify(config).replace(/</g, '\\u003c')});
// an example booking, so the confirm card has something to show before anyone books: the next Monday, 9:00–10:00
(function () { var d = LBW.day.today(), n = 1; while (LBW.day.parts(d + n).w !== 1) n++; LBW.kit.last.cita = { state: { day: d + n, from: 540, to: 600 }, text: 'Ejemplo' };
  var txt = 'Mi cita: ' + LBW.day.format(d + n, 'es', { weekday: 'long', day: 'numeric', month: 'long' }) + ', 9:00–10:00';
  [].forEach.call(document.querySelectorAll('.js-booked [data-lb-part=message-text], .ex-booked'), function (x) { x.textContent = txt; }); })();
// with and without the Code block's data: a new message with the same tag, drawn live, or after 1.5 s from the saved copy
(function () { var b = document.getElementById('sim-data'), chat = document.querySelector('.chat[data-section="data"]'); if (!b) return;
  function say(text) { var r = document.createElement('div'); r.className = 'row is-bot'; r.setAttribute('data-lb-part', 'message'); r.setAttribute('data-lb-author', 'bot');
    var u = document.createElement('div'); u.className = 'bubble'; var t = document.createElement('div'); t.setAttribute('data-lb-part', 'message-text'); t.textContent = text; u.appendChild(t); r.appendChild(u); chat.appendChild(r); }
  b.addEventListener('click', function () { var off = b.getAttribute('aria-pressed') !== 'true';
    if (off) { LBW.data.clear('salidas'); say('Sin datos del bloque Code, la copia guardada: [[gx:hoy lang=es]]'); b.textContent = 'Volver a poner los datos'; }
    else { LBW.data.put('salidas', SALIDAS); say('Con los datos otra vez: [[gx:hoy lang=es]]'); b.textContent = 'Probar sin los datos del bloque Code'; }
    b.setAttribute('aria-pressed', String(off)); }); })();</script>
`;

writeFileSync(new URL('gallery/index.html', root), html);
// --page: a standalone copy for GitHub Pages (the Artifact wrapper adds the doctype, charset and viewport; a plain host doesn't)
if (process.argv.includes('--page')) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(new URL('site/', root), { recursive: true });
  writeFileSync(new URL('site/index.html', root), '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + html + '\n<p style="max-width:960px;margin:32px auto;padding:0 16px;font:13px/1.5 system-ui,sans-serif;color:#667">Proyecto personal, no es un producto oficial de Landbot. Código: <a href="https://github.com/pausanchez/lbw-kit">github.com/pausanchez/lbw-kit</a>. Datos ficticios.</p>\n</html>\n');   // the head closes itself at the first element of the body
}
console.log('wrote gallery/index.html', (html.length / 1024).toFixed(0) + ' KB', count + ' types', types.length + ' entries');
