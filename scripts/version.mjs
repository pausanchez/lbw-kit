// scripts/version.mjs · one version for the whole library. package.json holds it; this writes it into the sources.
//   node scripts/version.mjs          write package.json's version into lbw.js, kit.js, the CSS headers and kit/README.md
//   node scripts/version.mjs --check  change nothing; exit 1 when a file is out of step
// It also writes the version and the dist/manifest.json `integrity` into the load lines of .github/README.md and, where the
// private docs are present, docs/20. The integrity is the BUILT file's: after a version bump run version:sync, build, version:sync.
// The config's JSON Schema follows too: its "$id" in dist/lbw-kit.schema.json (build writes it again from package.json) and the
// "$schema" line of every kit/example*/config.json.
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const v = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8')).version;
const check = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(new URL('dist/manifest.json', root), 'utf8'));
const sri = (f) => manifest.files[f].integrity;
const VER = '\\d+(?:\\.\\d+){2,3}';
// the library's load lines: `<script src=".../lbw-kit@vX/dist/lbw-kit.min.js" integrity="…"` and the CSS `@import`
const loadLines = [
  [new RegExp(`(lbw-kit@v)${VER}(/dist/lbw-kit\\.min\\.js" integrity=")[^"]*`), `$1${v}$2${sri('lbw-kit.min.js')}`],
  [new RegExp(`(lbw-kit@v)${VER}(/dist/lbw-kit\\.min\\.css")`), `$1${v}$2`],
];

// [file, [[pattern, replacement], …], 'private'?]: every pattern must match
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
  ['.github/README.md', [...loadLines, [new RegExp(`("\\$schema\": \"[^\"]*lbw-kit@v)${VER}(/dist/lbw-kit\\.schema\\.json\")`), `$1${v}$2`]]],
  ['docs/20-library-and-json.md', loadLines, 'private'],   // not in the public clone: skipped when absent
  ['dist/lbw-kit.schema.json', [
    [new RegExp(`("\\$id": "[^"]*lbw-kit@v)${VER}(/dist/lbw-kit\\.schema\\.json")`), `$1${v}$2`],
    [new RegExp(`("title": "lbw-kit config v)${VER}(")`), `$1${v}$2`],
  ]],
  // every example's "$schema": "https://cdn.jsdelivr.net/gh/…/lbw-kit@vX/dist/lbw-kit.schema.json"
  ...fs.readdirSync(new URL('kit/', root)).filter((d) => /^example/.test(d) && fs.existsSync(new URL(`kit/${d}/config.json`, root))).sort()
    .map((d) => [`kit/${d}/config.json`, [[new RegExp(`("\\$schema": "[^"]*lbw-kit@v)${VER}(/dist/lbw-kit\\.schema\\.json")`), `$1${v}$2`]]]),
];

let stale = 0;
for (const [file, pairs, where] of targets) {
  const url = new URL(file, root);
  if (where === 'private' && !fs.existsSync(url)) continue;
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
