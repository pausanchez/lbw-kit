// scripts/mock-report.mjs · what a mock page drew, read without a browser: the numbers to look at before the screenshots.
//   node scripts/mock-report.mjs path/to/mock.html [--today 21/11/2026] [--now 13:45]
// It loads the page in jsdom with dev mode on (?kitdev=1) and prints: the widgets drawn per name, the config's setup
// errors, the kit's dev-mode warnings, what the runtime dropped and why, and how many raw [[tags]] are left in messages.
// Exit 1 when there are setup errors or raw tags. It doesn't judge the look: shoot the page for that.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) { if (/^--(today|now)$/.test(args[i])) opt[args[i].slice(2)] = args[++i]; else files.push(args[i]); }
if (files.length !== 1) { console.error('usage: node scripts/mock-report.mjs <mock.html> [--today D/M/YYYY] [--now HH:MM]'); process.exit(2); }
const q = new URLSearchParams({ kitdev: '1', ...opt });
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(String(e.message).split('\n')[0]));
const dom = new JSDOM(fs.readFileSync(files[0], 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: pathToFileURL(files[0]).href + '?' + q });
await new Promise((r) => setTimeout(r, 1500));
const w = dom.window, all = (s) => [...w.document.querySelectorAll(s)], count = {};
all('.lbw').forEach((x) => { const n = x.getAttribute('data-widget') || '?'; count[n] = (count[n] || 0) + 1; });
const raw = all('[data-lb-part="message-text"]').filter((m) => /\[\[/.test(m.textContent)).map((m) => m.textContent.trim().slice(0, 80));
const report = { devMode: !!(w.LBW && w.LBW.kit && w.LBW.kit.dev), library: w.LBW ? w.LBW.version : null, messages: all('[data-lb-part="message"]').length, widgets: count,
  setupErrors: [...(w.__kitSetupErrors || [])], devWarnings: [...(w.__kitWarnings || [])], dropped: [...(w.__lbwDropped || [])].map(String), rawTagsLeft: raw, pageErrors: errors };
console.log(JSON.stringify(report, null, 2));
process.exit(report.setupErrors.length || raw.length || !w.LBW ? 1 : 0);
