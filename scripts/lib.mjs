// scripts/lib.mjs · what the command-line tools share: reading the library's files and checking a config with no browser.
import fs from 'node:fs';
import vm from 'node:vm';

export const root = new URL('..', import.meta.url);
export const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

// lbw.js for its day and time readers (it touches no page until init), a bare LBW.kit for setup.js to hang check() on
function checker() {
  const window = { document: { documentElement: {}, querySelector: () => null, querySelectorAll: () => [] } };
  const ctx = vm.createContext({ window, document: window.document });
  vm.runInContext(read('runtime/lbw.js'), ctx);
  window.LBW.kit = { h: {} };
  vm.runInContext(read('kit/setup.js'), ctx);
  vm.runInContext(read('kit/setup-check.js'), ctx);
  return window.LBW.kit.setup;
}
export function checkConfig(config) {
  return [...checker().check(config)];
}

// the same problems for an agent: [{ widget, path, message, fix }]. `path` is where in the config the problem is,
// as far as the sentence names it ("widgets.x.items.y.kiker"; the widget, or null for the config, when it doesn't); `fix` is
// the checker's "did you mean" for a misspelt key, or null.
export function checkConfigDetailed(config) {
  return [...checker()._check(config)].map((e) => {
    const m = /Did you mean "([^"]+)"\?$/.exec(e.message);
    return { widget: e.widget == null ? null : e.widget, path: pathOf(config, e), message: e.message, fix: m ? `did you mean "${m[1]}"?` : null };
  });
}

// the place a sentence names: "x: items.y: unknown key "kiker"" → widgets.x.items.y.kiker. Only a place that is in the
// config is given: the longest start of the sentence's own path that exists (an item's id is looked up under "items")
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
function walk(o, parts) { let x = o; for (const p of parts) { if (!has(x, p)) return null; x = x[p]; } return x === undefined ? null : { v: x }; }
const split = (s) => s.match(/[^.[\]]+/g) || [];
const join = (parts) => parts.map((p, i) => (/^\d+$/.test(p) ? `[${p}]` : (i ? '.' : '') + p)).join('');
function pathOf(cfg, e) {
  let msg = e.message.replace(/^\[[a-z]{2,3}\] /, ''), base = [];
  if (e.widget != null) {
    base = ['widgets', e.widget];
    if (msg.startsWith(e.widget + ': ')) msg = msg.slice(e.widget.length + 2); else return join(base);
  }
  const unknown = /^(?:(.*?): )?unknown (?:key|option) "([^"]+)"/.exec(msg) || /^unknown (type) "/.exec(msg);
  const where = unknown ? (unknown[1] ? split(unknown[1]) : []).concat(unknown[2] ? [unknown[2]] : []) : split((/^"?([A-Za-z_$][\w$]*(?:\.[\w$-]+|\[\d+\])*)/.exec(msg) || [])[1] || '');
  const at = walk(cfg, base);
  if (!at || !where.length) return base.length ? join(base) : null;
  // the longest start of `where` that exists, straight under the widget or under its "items"
  for (const pre of [[], ['items']]) {
    for (let n = where.length; n > 0; n--) if (walk(at.v, pre.concat(where.slice(0, n)))) return join(base.concat(pre, where.slice(0, n)));
  }
  return base.length ? join(base) : null;
}
