// scripts/canary.mjs · a daily early warning for a live lbw-kit bot. It opens a published bot's share URL in headless Chrome
// with a NORMAL user agent (Landbot's send endpoint refuses "HeadlessChrome"), clicks one welcome button, and checks that what
// the runtime relies on is still there and worked. Read-only: one click on the bot's own button, nothing typed, no Landbot writes.
//
//   node scripts/canary.mjs <share-url> --button "Button text" [--version X.Y.Z] [--min-widgets 1] [--timeout 60]
//                           [--state file.json | --state-from in.json --state-to out.json] [--json]
//   URL and button also come from the environment: LBW_CANARY_URL, LBW_CANARY_BUTTON (arguments win). Example URL:
//   https://landbot.pro/v3/H-XXXX/index.html
//
// Checks (each failure is a line "FAIL <reason>"; exit 1 if any):
//   library   window.LBW is there (the CDN and the CSP let it load), LBW.version = --version when given, LBW.ready,
//             and the fallback didn't take over
//   setup     no __kitSetupErrors, no uncaught error or console.error that names LBW / lbw / kit
//   dom       LBW.host.check() when the library has it (v0.12+: { ok, missing }); otherwise the Landbot hooks the runtime reads:
//             [data-lb-part="message"], data-lb-author="bot", [data-lb-part="message-text"] inside a bot message,
//             [data-lb-part="window"] (a text box in [data-lb-part="input-field"] is only reported: the v4 chat has none while
//             it shows buttons)
//   send      window._landbot.sendMessage is a function (share page) and the click added a data-lb-author="user" message
//   widgets   at least --min-widgets .lbw[data-widget] on the page once the reply settles
//   raw tags  no [[ left in any bot message-text, no [[x: anywhere on the page outside widgets, code and the visitor's
//             messages, nothing in __lbwDropped that says "raw tag left" or "message failed"
// Info (never fails): the sha256 and ETag of Landbot's landbot-3 bundle. A changed hash is the signal that Landbot shipped a new
// front-end: the day to rerun the whole battery. State can live in a file between runs (--state), or, in CI, be restored and saved
// by the workflow: --state-from reads the previous hashes, --state-to writes the new ones. A change shows as "landbot bundle
// CHANGED" in info and in the JSON as "bundleChanged": true plus "bundles": [{ url, hash, previous, changed }]; it is not a failure.
// Exit codes: 0 all good . 1 a check failed . 2 usage, Chrome or the page didn't load.
//
// Schedule it: cron (`0 8 * * * node scripts/canary.mjs ... --state ~/.lbw-canary.json`) or the scheduled workflow
// .github/workflows/canary.yml (secrets LBW_CANARY_URL and LBW_CANARY_BUTTON; the hash state travels in actions/cache).
// CHROME=/path/to/chrome overrides the lookup (google-chrome, chromium on Linux, the macOS default); UA= overrides the user agent.
// Node 22+ (global WebSocket).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2), opt = { minWidgets: 1, timeout: 60, button: process.env.LBW_CANARY_BUTTON || '' }, rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--button') opt.button = argv[++i];
  else if (a === '--version') opt.version = String(argv[++i]).replace(/^v/, '');
  else if (a === '--min-widgets') opt.minWidgets = +argv[++i];
  else if (a === '--timeout') opt.timeout = +argv[++i];
  else if (a === '--state') opt.stateFrom = opt.stateTo = argv[++i];
  else if (a === '--state-from') opt.stateFrom = argv[++i];
  else if (a === '--state-to') opt.stateTo = argv[++i];
  else if (a === '--json') opt.json = true;
  else rest.push(a);
}
const url = rest[0] || process.env.LBW_CANARY_URL;
if (!url || !opt.button) { console.error('usage: node scripts/canary.mjs <share-url> --button "<welcome button text>" [--version X.Y.Z] [--min-widgets 1] [--timeout 60] [--state file.json | --state-from in.json --state-to out.json] [--json]\n       (or set LBW_CANARY_URL and LBW_CANARY_BUTTON)'); process.exit(2); }

const UA = process.env.UA || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
if (/Headless/i.test(UA)) { console.error('UA must be a normal browser\'s: Landbot refuses sends from "HeadlessChrome"'); process.exit(2); }
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const r = spawnSync('which', [n], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return mac;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 600), prof = mkdtempSync(join(tmpdir(), 'lbw-canary-'));
const chromeArgs = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-renderer-backgrounding', '--user-agent=' + UA, `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`];
if (process.env.CI || (process.getuid && process.getuid() === 0)) chromeArgs.push('--no-sandbox', '--disable-dev-shm-usage');
const chrome = spawn(findChrome(), [...chromeArgs, 'about:blank'], { stdio: 'ignore' });
chrome.on('error', () => {});
const fails = [], info = [], errors = [], bundles = [];
function bye(code) { try { chrome.kill(); } catch (e) {} try { rmSync(prof, { recursive: true, force: true }); } catch (e) {} process.exit(code); }
// the button text and the URL identify the bot: never printed (CI logs and issues can be public)
const redact = (x) => String(x).split(opt.button).join('<button>').split(url).join('<url>');
function report(extra, code) {
  const ok = !fails.length;
  for (const a of [fails, info]) a.forEach((x, i) => (a[i] = redact(x)));
  if (opt.json) console.log(JSON.stringify({ ok, fails, info, bundles, bundleChanged: bundles.some((b) => b.changed), ...extra }, null, 1));
  else { info.forEach((x) => console.log('· ' + x)); fails.forEach((x) => console.log('✖ ' + x)); console.log(ok ? '✔ canary passed' : `✖ canary FAILED (${fails.length})`); }
  bye(code != null ? code : ok ? 0 : 1);
}

let tabs = null;
for (let i = 0; i < 75 && !tabs; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.some((x) => x.type === 'page')) tabs = t; } catch (e) {} if (!tabs) await sleep(200); }
if (!tabs) { console.error('✖ Chrome did not start (set CHROME=/path/to/chrome)'); bye(2); }
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl); let id = 0; const pend = {};
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; return; }
  if (d.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + String(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0]);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
};
await new Promise((r) => (ws.onopen = r));
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await cmd('Emulation.setUserAgentOverride', { userAgent: UA });

// the chat's window: the page itself (share page) or a same-origin iframe that holds the chat
const CTX = `(function(){var w=window;if(!document.querySelector('[data-lb-part]')){[].some.call(document.querySelectorAll('iframe'),function(f){try{if(f.contentDocument&&f.contentDocument.querySelector('[data-lb-part]')){w=f.contentWindow;return true}}catch(e){}return false})}return w})()`;
const BTN = JSON.stringify(opt.button);
const FIND = `[].find.call(${CTX}.document.querySelectorAll('button'),function(b){return !b.closest('.lbw')&&b.textContent.trim()===${BTN}})`;
const t0 = Date.now(); await cmd('Page.navigate', { url });
let found = false;
for (let i = 0; i < opt.timeout * 2 && !found; i++) { await sleep(500); try { found = await ev(`!!${FIND}`); } catch (e) {} }
if (!found) { fails.push(`the welcome button "${opt.button}" never appeared in ${opt.timeout} s (the chat didn't load, or the flow changed)`); report({}, 2); }
await sleep(2500);   // the library's setup and first scan
info.push(`chat loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const before = await ev(`(function(){var w=${CTX},d=w.document,L=w.LBW;return {lbw:!!L,version:L&&L.version,ready:L?L.ready:null,off:d.documentElement.classList.contains('lbw-off'),
  users:d.querySelectorAll('[data-lb-part="message"][data-lb-author="user"]').length,
  host:(L&&L.host&&typeof L.host.check==='function')?(function(){try{var r=L.host.check();return {ok:!!(r&&r.ok),missing:(r&&r.missing||[]).map(String)}}catch(e){return {ok:false,missing:['host.check threw: '+e.message]}}})():null,
  send:!!(w._landbot&&typeof w._landbot.sendMessage==='function'),
  bundles:performance.getEntriesByType('resource').map(function(e){return e.name}).filter(function(n){return /landbot-3[^/]*\\.m?js(\\?|$)/.test(n)})}})()`);
if (!before.lbw) fails.push('window.LBW is missing: the library did not load (CDN down, CSP, or the Custom JS lost its <script src>)');
else {
  info.push('lbw-kit v' + before.version);
  if (opt.version && before.version !== opt.version) fails.push(`LBW.version is ${before.version}, expected ${opt.version}`);
  if (before.ready === false) fails.push('LBW.ready is false: init() never ran (a Custom JS script that does not parse, or setup threw before init)');
  else if (before.ready == null) info.push('LBW.ready not reported (a library before v0.9.5)');
}
if (before.off) fails.push('the fallback took over (html.lbw-off): visitors read text with no widgets');
if (!before.send) fails.push('window._landbot.sendMessage is not a function: the share page\'s send API changed (clicks fall back to the deprecated bridge)');

// one click on the bot's own welcome button, then wait for the reply to settle (3 s with no new widget)
await ev(`${FIND}.click()`);
let n = 0, last = -1, still = 0;
for (let i = 0; i < 80; i++) {
  await sleep(500);
  n = await ev(`${CTX}.document.querySelectorAll('.lbw[data-widget]').length`);
  if (n >= opt.minWidgets && n === last) { if (++still >= 6) break; } else still = 0;
  last = n;
}
await sleep(1800);   // past the runtime's raw-tag check (1.5 s after the chat goes still)

const after = await ev(`(function(){var w=${CTX},d=w.document,q=function(s){return d.querySelectorAll(s).length};
  var hid=function(t){return !!t.closest('[data-lbw-data]')};   // a data message (v0.9.5): its value is data, not a tag left behind (v0.9.5.1)
  var raw=[].filter.call(d.querySelectorAll('[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]'),function(t){return t.textContent.indexOf('[[')>=0&&!hid(t)}).map(function(t){return t.textContent.slice(0,120)});
  var dataIn=(w.__lbwDataIn||[]).map(function(e){return e.key+' via '+e.via+(e.ok?'':' UNREADABLE')});
  var any=[];
  if(d.body){var tw=d.createTreeWalker(d.body,4),x;while((x=tw.nextNode())){var pe=x.parentNode;if(x.nodeValue.indexOf('[[')>=0&&/\\[\\[\\s*[a-z]+:/i.test(x.nodeValue)&&pe&&pe.closest&&!pe.closest('.lbw,script,style,code,pre,textarea,[data-lb-author="user"]')&&!hid(pe))any.push(x.nodeValue.slice(0,120))}}
  return {msg:q('[data-lb-part="message"]'),bot:q('[data-lb-part="message"][data-lb-author="bot"]'),user:q('[data-lb-part="message"][data-lb-author="user"]'),
    text:q('[data-lb-part="message"][data-lb-author="bot"] [data-lb-part="message-text"]'),win:q('[data-lb-part="window"]'),
    input:q('[data-lb-part="input-field"] input, [data-lb-part="input-field"] textarea'),
    widgets:[].map.call(d.querySelectorAll('.lbw[data-widget]'),function(e){return e.getAttribute('data-widget')}),
    raw:raw,any:any,dataIn:dataIn,dropped:(w.__lbwDropped||[]).map(String),setup:(w.__kitSetupErrors||[]).map(function(e){return typeof e==='string'?e:JSON.stringify(e)})}})()`);

// the library's own check of the Landbot hooks (v0.12+), run again now that a reply is on screen; the DOM counts below stay as
// the fallback for an older library and as a second opinion
const hostNow = await ev(`(function(){var w=${CTX},L=w.LBW;if(!(L&&L.host&&typeof L.host.check==='function'))return null;try{var r=L.host.check();return {ok:!!(r&&r.ok),missing:(r&&r.missing||[]).map(String)}}catch(e){return {ok:false,missing:['host.check threw: '+e.message]}}})()`);
if (hostNow) {
  info.push('LBW.host.check(): ' + (hostNow.ok ? 'ok' : 'not ok'));
  if (!hostNow.ok) fails.push('LBW.host.check() reports missing Landbot hooks: ' + (hostNow.missing.join(', ') || '(none listed)'));
} else if (before.lbw) info.push('LBW.host.check not available (a library before v0.12): the DOM checks stand in');
if (!hostNow) {
  if (!after.msg) fails.push('no [data-lb-part="message"]: Landbot renamed its message hook (the runtime scans nothing)');
  else if (!after.bot) fails.push('no data-lb-author="bot" message: Landbot renamed the author attribute or its value');
  if (after.bot && !after.text) fails.push('no [data-lb-part="message-text"] inside a bot message: Landbot renamed the text hook');
  if (!after.win) fails.push('no [data-lb-part="window"]: the typing-indicator check (a click waits for a quiet chat) is blind');
}
// the v4 chat shows its text box only while the flow waits for text (measured 13 Nov 2026: none at a buttons step), so this
// one is information, not a failure
if (!after.input) info.push('no text box at this step (the flow shows buttons): the last-resort send was not checked');
if (after.user <= before.users) fails.push(`the click on "${opt.button}" added no visitor message (the chat didn't take it)`);
if (after.widgets.length < opt.minWidgets) fails.push(`${after.widgets.length} widget(s) on the page after the click, expected at least ${opt.minWidgets}`);
else info.push('widgets: ' + after.widgets.join(', '));
if (after.dataIn && after.dataIn.length) info.push('data messages read (hidden): ' + after.dataIn.join(', '));
after.raw.forEach((t) => fails.push('raw tag left in a bot message: ' + JSON.stringify(t)));
after.any.filter((t) => !after.raw.some((r) => r.includes(t.trim().slice(0, 40)))).forEach((t) => fails.push('raw tag on the page outside the known message hooks: ' + JSON.stringify(t)));
after.dropped.filter((d) => /^raw tag left|^message failed/.test(d)).forEach((d) => fails.push('runtime: ' + d));
after.setup.forEach((e) => fails.push('setup error: ' + e));
errors.filter((e) => /\bLBW\b|lbw|\bkit\b/.test(e)).forEach((e) => fails.push(e));
const other = errors.filter((e) => !/\bLBW\b|lbw|\bkit\b/.test(e));
if (other.length) info.push(`${other.length} other console error(s), Landbot's own, not failing: ` + other.slice(0, 3).join(' | '));

// Landbot's front-end bundle: a new hash is the release signal
let prev = {}; if (opt.stateFrom) { try { prev = JSON.parse(readFileSync(opt.stateFrom, 'utf8')); } catch (e) {} }
const next = { ...prev };
for (const b of before.bundles || []) {
  try {
    const r = await fetch(b), body = Buffer.from(await r.arrayBuffer()), hash = createHash('sha256').update(body).digest('hex').slice(0, 16), etag = r.headers.get('etag') || '';
    const k = b.replace(/\?.*$/, ''), previous = prev[k] || null, changed = !!previous && previous !== hash;
    bundles.push({ url: k, hash, previous, changed });
    info.push(`landbot bundle ${b.split('/').slice(-2).join('/')} sha256:${hash} ${etag}`);
    if (changed) info.push(`landbot bundle CHANGED (${k}: ${previous} -> ${hash}): rerun the whole battery today`);
    next[k] = hash;
  } catch (e) { info.push('could not hash ' + b + ': ' + e.message); }
}
if (opt.stateTo && bundles.length) { try { writeFileSync(opt.stateTo, JSON.stringify(next, null, 1)); } catch (e) { info.push('could not write state: ' + e.message); } }
report({ before, host: hostNow, after: { ...after, dropped: after.dropped.slice(-10) } });
