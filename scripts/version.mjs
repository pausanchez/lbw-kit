// scripts/version.mjs · one version for the whole library. package.json holds it; this writes it into the sources.
//   node scripts/version.mjs          write package.json's version into lbw.js, kit.js, the CSS headers and kit/README.md
//   node scripts/version.mjs --check  change nothing; exit 1 when a file is out of step
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const v = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8')).version;
const check = process.argv.includes('--check');

// [file, [[pattern, replacement], …]]: every pattern must match exactly once
const targets = [
  ['runtime/lbw.js', [
    [/^(\/\* lbw\.js · Landbot AI Widgets runtime · v)[\d.]+/, `$1${v}`],
    [/(\n    version: ')[\d.]+(',)/, `$1${v}$2`],
  ]],
  ['kit/kit.js', [
    [/^(\/\* AI Widgets kit v)[\d.]+( · on lbw\.js v)[\d.]+/, `$1${v}$2${v}`],
    [/(LBW\.kit = \{ version: ')[\d.]+(')/, `$1${v}$2`],
  ]],
  ['runtime/lbw.css', [[/^(\/\* lbw\.css · base look for Landbot AI Widgets \(v)[\d.]+\)/, `$1${v})`]]],
  ['kit/kit.css', [[/^(\/\* AI Widgets kit v)[\d.]+/, `$1${v}`]]],
  ['kit/README.md', [[/(`runtime\/lbw\.js` v)[\d.]+\d/, `$1${v}`]]],
];

let stale = 0;
for (const [file, pairs] of targets) {
  const url = new URL(file, root);
  const before = fs.readFileSync(url, 'utf8');
  let after = before;
  for (const [re, to] of pairs) {
    if (!re.test(after)) { console.error(`${file}: no match for ${re}`); process.exit(2); }
    after = after.replace(re, to);
  }
  if (after === before) continue;
  stale++;
  if (check) console.error(`${file}: not at v${v}`);
  else { fs.writeFileSync(url, after); console.log(`${file} → v${v}`); }
}
if (check && stale) process.exit(1);
console.log(check ? `all sources at v${v}` : `v${v} written (${stale} file${stale === 1 ? '' : 's'} changed)`);
