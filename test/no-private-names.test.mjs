// test/no-private-names.test.mjs · leak guard: no client or prospect name in a file the PUBLIC repo publishes.
// The denylist is LBW_DENYLIST (comma- or newline-separated), else tools/private-denylist.txt (tools/ is private-only).
// With neither, the test is skipped. A line "re:<pattern>" is a regular expression; all matching is case-insensitive.
// LBW_DENYLIST_FILE points at another file (used to try the skip path).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIRS = ['runtime', 'kit', 'scripts', 'test', 'dist', 'gallery', '.github'];
const PUBLIC_FILES = ['.gitignore', 'package.json', 'package-lock.json'];

function loadList() {
  let raw = process.env.LBW_DENYLIST;
  if (raw == null || !raw.trim()) {
    const file = process.env.LBW_DENYLIST_FILE || path.join(root, 'tools', 'private-denylist.txt');
    raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  }
  return raw.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')   // comment lines first: they may hold commas
    .split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

function compile(entries) {
  return entries.map((e) => {
    const isRe = e.startsWith('re:');
    const src = isRe ? e.slice(3) : e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { label: e, re: new RegExp(src, 'i') };
  });
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 })
    .split('\n').filter(Boolean);
}

function walk(rel, out) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isFile()) { out.push(rel); return; }
  for (const name of fs.readdirSync(abs)) {
    if (name === 'node_modules' || name === '.DS_Store') continue;
    walk(path.join(rel, name), out);
  }
}

function publicFiles() {
  let files;
  try {
    // the public repo is the normal .git; the private one (.private.git) is never listed
    files = [...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])];
  } catch {
    files = [];
    [...PUBLIC_DIRS, ...PUBLIC_FILES].forEach((p) => walk(p, files));
  }
  return [...new Set(files)].filter((f) => !f.split('/').includes('node_modules') && fs.existsSync(path.join(root, f)));
}

const entries = loadList();

test('no private client names in the public repo', { skip: entries.length ? false : 'no denylist: set LBW_DENYLIST or create tools/private-denylist.txt (private-only); skipping' }, () => {
  const rules = compile(entries);
  const hits = [];
  for (const f of publicFiles()) {
    rules.forEach((r) => { if (r.re.test(f)) hits.push(`${f} (file name): ${r.label}`); });
    const buf = fs.readFileSync(path.join(root, f));
    if (buf.includes(0)) continue;   // binary
    const text = buf.toString('utf8');
    rules.forEach((r) => { if (r.re.test(text)) hits.push(`${f}: ${r.label}`); });
  }
  assert.deepEqual(hits, [], 'denylisted terms found in files the public repo publishes:\n  ' + hits.join('\n  '));
});
