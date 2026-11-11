// test/helpers.mjs · a stand-in for the Landbot v4 web chat: the same data-lb-part / data-lb-author hooks lbw.js reads,
// in jsdom, with the library evaluated inside that window. One window per test (LBW is a singleton per window).
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
export const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
export const pkg = JSON.parse(read('package.json'));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const json = (x) => JSON.parse(JSON.stringify(x));   // objects made in the jsdom window → plain ones to compare

export function boot({ lbw = true, kit = false, landbot = true, scripts = [] } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div data-lb-part="window"><div id="chat"></div></div></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://chat.example/' });
  const w = dom.window, sent = [];
  if (landbot) w.Landbot = { exec: (name, payload) => { sent.push([name, json(payload)]); } };
  if (lbw) w.eval(read('runtime/lbw.js'));
  if (kit) w.eval(read('kit/kit.js'));
  scripts.forEach((p) => w.eval(read(p)));
  const chat = w.document.getElementById('chat');
  function message(author, text, html) {
    const m = w.document.createElement('div'), t = w.document.createElement('div');
    m.setAttribute('data-lb-part', 'message'); m.setAttribute('data-lb-author', author);
    t.setAttribute('data-lb-part', 'message-text');
    if (html != null) t.innerHTML = html; else t.textContent = text;   // html: what the chat's Markdown renderer would leave
    m.appendChild(t); chat.appendChild(m);
    m.text = () => t.textContent;
    m.widgets = () => [...m.querySelectorAll('.lbw')];
    return m;
  }
  return {
    w, d: w.document, LBW: w.LBW, sent, chat,
    bot: (text, html) => message('bot', text, html),
    user: (text) => message('user', text),
    dropped: () => (w.__lbwDropped || []).map(String),
    close: () => {},   // closing the window empties the document, which wakes lbw.js's observer on a dead page: let it go with the process
  };
}
