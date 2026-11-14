// scripts/capture-host.mjs · captures the Landbot v4 web chat's DOM from a share page into the adapter's fixtures
// (test/fixtures/host-v4/), so test/host.test.mjs checks runtime/host-v4.js against what the chat really draws.
// READ-ONLY: it opens the page in headless Chrome (a normal user agent: Landbot refuses "HeadlessChrome"), types nothing,
// and clicks at most ONE button, the bot's own welcome button named with --button (none without it).
//
//   node scripts/capture-host.mjs <share-url> --button "<welcome button text>" [--out test/fixtures/host-v4] [--timeout 60]
//
// Writes welcome.html (the chat window as it loads), bot-text.html (one bot message), buttons.html (the welcome buttons'
// box) and user-message.html (the window after the click: the visitor's message and the reply). Everything is sanitized
// in the page before it leaves it: no script, style, iframe, svg drawing or image source; no inline style, id, link,
// event handler or data-* attribute other than data-lb-*; the library's own widgets and marks removed; every text replaced
// by a neutral placeholder ("Bot message", "User message", "Option 1", "Text"), so no bot name, client or visitor data is
// kept. The data-lb-* hooks, the classes, roles and the nesting stay as they are.
// CHROME=/path/to/chrome overrides the macOS default; UA= overrides the user agent. Node 22+ (global WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2), opt = { out: 'test/fixtures/host-v4', timeout: 60 }, rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--button') opt.button = argv[++i];
  else if (a === '--out') opt.out = argv[++i];
  else if (a === '--timeout') opt.timeout = +argv[++i];
  else rest.push(a);
}
const url = rest[0];
if (!url || !/^https:\/\//.test(url)) { console.error('usage: node scripts/capture-host.mjs <share-url> --button "<welcome button text>" [--out dir] [--timeout 60]'); process.exit(2); }

const UA = process.env.UA || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
if (/Headless/i.test(UA)) { console.error('UA must be a normal browser\'s'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 600), prof = mkdtempSync(join(tmpdir(), 'lbw-capture-'));
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-renderer-backgrounding', '--user-agent=' + UA, `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
function bye(code) { try { chrome.kill(); } catch (e) {} try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(code); }

let tabs = null;
for (let i = 0; i < 75 && !tabs; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.some((x) => x.type === 'page')) tabs = t; } catch (e) {} if (!tabs) await sleep(200); }
if (!tabs) { console.error('Chrome did not start (set CHROME=/path/to/chrome)'); bye(2); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); let id = 0; const pend = {};
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
await new Promise((r) => (ws.onopen = r));
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cmd('Emulation.setUserAgentOverride', { userAgent: UA });

// the chat's document: the page itself (share page) or a same-origin iframe that holds the chat
const CTX = `(function(){var w=window;if(!document.querySelector('[data-lb-part]')){[].some.call(document.querySelectorAll('iframe'),function(f){try{if(f.contentDocument&&f.contentDocument.querySelector('[data-lb-part]')){w=f.contentWindow;return true}}catch(e){}return false})}return w})()`;

// runs in the page: a sanitized copy of an element (see the header for what is kept)
const SANITIZE = `function(src){
  var c=src.cloneNode(true),n=0;
  [].forEach.call(c.querySelectorAll('[data-lbw-data]'),function(x){x.removeAttribute('aria-hidden')});   // a data message the library hid
  [].forEach.call(c.querySelectorAll('[data-lb-part="message-text"]'),function(x){if(!x.textContent.trim()&&!x.querySelector('img,video'))x.textContent='x'});   // a text the library emptied (its tags drawn as widgets)
  [].forEach.call(c.querySelectorAll('script,style,noscript,iframe,link,meta,template,.lbw'),function(x){x.remove()});
  [].forEach.call(c.querySelectorAll('svg'),function(s){while(s.firstChild)s.removeChild(s.firstChild);[].slice.call(s.attributes).forEach(function(a){if(!/^(class|role|aria-hidden|data-lb-.*)$/.test(a.name))s.removeAttribute(a.name)})});
  var KEEP=/^(class|role|type|tabindex|dir|lang|disabled|hidden|aria-(hidden|live|busy|expanded|selected|checked|disabled|haspopup|atomic|relevant|level|modal|orientation)|data-lb-.*)$/;
  var TEXT=/^(alt|title|placeholder|aria-label|aria-description)$/;
  [c].concat([].slice.call(c.querySelectorAll('*'))).forEach(function(e){
    [].slice.call(e.attributes).forEach(function(a){
      if(TEXT.test(a.name))e.setAttribute(a.name,'Label');
      else if(a.name==='href')e.setAttribute('href','#');
      else if(!KEEP.test(a.name))e.removeAttribute(a.name);
    });
    if(e.hasAttribute('class')){var k=e.getAttribute('class').split(/\\s+/).filter(function(x){return x&&!/^(lbw|has-lbw|kit-|is-)/.test(x)}).join(' ');if(k)e.setAttribute('class',k);else e.removeAttribute('class')}
  });
  var tw=document.createTreeWalker(c,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_COMMENT),t,list=[];while((t=tw.nextNode()))list.push(t);
  list.forEach(function(t){
    if(t.nodeType===8){t.remove();return}
    if(!t.nodeValue.trim())return;
    var p=t.parentNode,m=p.closest&&p.closest('[data-lb-part="message-text"]')&&p.closest('[data-lb-part="message"]');
    if(p.closest&&p.closest('button'))t.nodeValue='Option '+(++n);
    else if(m&&m.getAttribute('data-lb-author')==='user')t.nodeValue='User message';
    else if(m)t.nodeValue='Bot message';
    else t.nodeValue='Text';
  });
  // one placeholder per button, however many text nodes it had
  [].forEach.call(c.querySelectorAll('button'),function(b){var seen=false;var tw2=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),x,l=[];while((x=tw2.nextNode()))l.push(x);l.forEach(function(x){if(!x.nodeValue.trim())return;if(seen)x.nodeValue='';seen=true})});
  return c.outerHTML;
}`;
const WIN = `(function(){var d=${CTX}.document;return d.querySelector('[data-lb-part="window"]')||d.body})()`;
const snap = (expr) => ev(`(${SANITIZE})(${expr})`);
// the page has settled when its window's HTML stops changing for 3 s
async function settle(max = 30) {
  let last = '', still = 0;
  for (let i = 0; i < max * 2; i++) { await sleep(500); const h = await ev(`(${WIN}||{}).innerHTML||''`).catch(() => ''); if (h === last) { if (++still >= 6) return; } else still = 0; last = h; }
}

await cmd('Page.navigate', { url });
let ok = false;
for (let i = 0; i < opt.timeout * 2 && !ok; i++) { await sleep(500); try { ok = await ev(`!!${CTX}.document.querySelector('[data-lb-part="message"]')`); } catch (e) {} }
if (!ok) { console.error(`no [data-lb-part="message"] in ${opt.timeout} s: the chat didn't load, or Landbot renamed its hooks (look at the page by hand)`); bye(2); }
await settle();

const out = resolve(opt.out); mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const head = (what) => `<!-- ${what} · Landbot v4 web chat, captured ${stamp} by scripts/capture-host.mjs (sanitized: texts are placeholders) -->\n`;
const save = (name, what, html) => { writeFileSync(join(out, name), head(what) + html + '\n'); console.log('wrote ' + join(opt.out, name)); };

save('welcome.html', 'the chat window as it loads', await snap(WIN));
save('bot-text.html', 'one bot message', await snap(`${CTX}.document.querySelector('[data-lb-part="message"][data-lb-author="bot"]')`));
const BUTTONS = `(function(){var d=${CTX}.document,w=${WIN},bs=[].filter.call(w.querySelectorAll('button'),function(b){return !b.closest('.lbw,[data-lb-part="header"],header')&&b.textContent.trim()});
  if(!bs.length)return null;var box=bs[0].parentElement;while(box&&box!==w&&!bs.every(function(b){return box.contains(b)}))box=box.parentElement;return box})()`;
const labels = await ev(`(function(){var b=${BUTTONS};return b?[].map.call(b.querySelectorAll('button'),function(x){return x.textContent.trim()}):[]})()`);
if (labels.length) save('buttons.html', 'the welcome buttons\' box', await snap(BUTTONS));
else console.log('no welcome buttons: buttons.html not written');

if (!opt.button) { console.log('no --button: nothing clicked, user-message.html not written. Buttons on the page: ' + JSON.stringify(labels)); bye(0); }
const BTN = JSON.stringify(opt.button);
const clicked = await ev(`(function(){var b=[].find.call(${CTX}.document.querySelectorAll('button'),function(b){return !b.closest('.lbw')&&b.textContent.trim()===${BTN}});if(!b)return false;b.click();return true})()`);
if (!clicked) { console.error(`no button "${opt.button}" (buttons: ${JSON.stringify(labels)})`); bye(1); }
for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`!!${CTX}.document.querySelector('[data-lb-part="message"][data-lb-author="user"]')`)) break; }
await settle();
save('user-message.html', 'the window after one click on a welcome button', await snap(WIN));
bye(0);
