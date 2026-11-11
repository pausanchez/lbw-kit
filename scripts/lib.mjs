// scripts/lib.mjs · what the command-line tools share: reading the library's files and checking a config with no browser.
import fs from 'node:fs';
import vm from 'node:vm';

export const root = new URL('..', import.meta.url);
export const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

// lbw.js for its day and time readers (it touches no page until init), a bare LBW.kit for setup.js to hang check() on
export function checkConfig(config) {
  const window = { document: { documentElement: {}, querySelector: () => null, querySelectorAll: () => [] } };
  const ctx = vm.createContext({ window, document: window.document });
  vm.runInContext(read('runtime/lbw.js'), ctx);
  window.LBW.kit = { h: {} };
  vm.runInContext(read('kit/setup.js'), ctx);
  vm.runInContext(read('kit/setup-check.js'), ctx);
  return [...window.LBW.kit.setup.check(config)];
}
