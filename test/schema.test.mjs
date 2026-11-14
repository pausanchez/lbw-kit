// test/schema.test.mjs · the config's JSON Schema (dist/lbw-kit.schema.json) and types (types/lbw-kit.config.d.ts) are generated
// from the checker's tables by scripts/schema.mjs. They stay in step with it, accept every config the checker accepts, and
// reject the plain mistakes it rejects (an unknown key, an unknown type, a missing key).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { generate, validate, tables } from '../scripts/schema.mjs';
import { checkConfig, checkConfigDetailed } from '../scripts/lib.mjs';

const HERE = new URL('..', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, HERE), 'utf8');
const { schema, json, dts } = generate();
const pkg = JSON.parse(read('package.json'));
const clone = (x) => JSON.parse(JSON.stringify(x));

test('schema: the committed schema and config types are what the checker\'s tables give', () => {
  assert.equal(read('dist/lbw-kit.schema.json'), json, 'run: node scripts/schema.mjs (or npm run build)');
  assert.equal(read('types/lbw-kit.config.d.ts'), dts, 'run: node scripts/schema.mjs (or npm run build)');
  assert.equal(schema.$id, `https://cdn.jsdelivr.net/gh/${pkg.repository}@v${pkg.version}/dist/lbw-kit.schema.json`);
  const m = JSON.parse(read('dist/manifest.json'));
  assert.ok(m.files['lbw-kit.schema.json'], 'the schema is in dist/manifest.json');
});

test('schema: every type, with exactly the checker\'s keys and needs', () => {
  const t = tables();
  assert.deepEqual(Object.keys(schema.properties), t.TOP);
  assert.equal(schema.$defs.widget.oneOf.length, 20);
  for (const ty of t.types) {
    const d = schema.$defs[ty];
    assert.deepEqual(Object.keys(d.properties), t.KEYS[ty], ty);
    assert.equal(d.properties.type.const, ty);
    assert.equal(d.additionalProperties, false);
    assert.ok(d.description && !d.description.includes('\n'), ty + ': a one-line description');
    for (const k of t.NEED[ty] || []) assert.ok(d.required.includes(k) || (d.anyOf || []).some((a) => a.required.includes(k)), `${ty} needs ${k}`);
  }
  for (const [k, keys] of Object.entries(t.ITEM)) assert.deepEqual(Object.keys(schema.$defs['item_' + k].properties), keys, 'ITEM.' + k);
  assert.match(dts, /export interface LbwConfig \{/); assert.match(dts, /export type LbwWidget =\n {2}\| LbwCardsWidget/);
});

// the kit's examples, the gallery, and the configs inside the golden fixtures (the four examples, the gallery, a showcase)
const CONFIGS = [];
for (const d of fs.readdirSync(new URL('kit/', HERE)).filter((d) => /^example/.test(d)).sort()) if (fs.existsSync(new URL(`kit/${d}/config.json`, HERE))) CONFIGS.push([`kit/${d}/config.json`, JSON.parse(read(`kit/${d}/config.json`))]);
CONFIGS.push(['gallery/config.json', JSON.parse(read('gallery/config.json'))]);
const GOLD = new URL('test/fixtures/golden-095/', HERE);
for (const f of fs.readdirSync(GOLD).filter((f) => f.endsWith('.json.gz')).sort()) CONFIGS.push([`fixture ${f}`, JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(f, GOLD)))).config]);

test('schema: every example and fixture config passes the checker and the schema', () => {
  assert.ok(CONFIGS.length >= 10, 'the configs were found');
  for (const [name, cfg] of CONFIGS) {
    assert.deepEqual(checkConfig(cfg), [], name + ': the checker');
    assert.deepEqual(validate(schema, cfg), [], name + ': the schema');
  }
  for (const d of ['example', 'example-lead']) assert.equal(JSON.parse(read(`kit/${d}/config.json`)).$schema, schema.$id, `kit/${d}: "$schema" is this version's`);
});

test('schema: what the checker accepts in odd but valid shapes (by language, null, a filter\'s own key) the schema accepts too', () => {
  const ok = (cfg, why) => { assert.deepEqual(checkConfig(cfg), [], why + ': the checker'); assert.deepEqual(validate(schema, cfg), [], why + ': the schema'); };
  const base = { prefix: 'np', langs: ['en', 'es'], defaultLang: 'en', timeZone: 'Europe/Madrid', links: ['https://shop.example/'] };
  ok({ ...base, widgets: { c: { type: 'cards', kicker: { en: 'K', es: 'K' }, disclaimer: null, items: { a: { title: { en: 'A', es: 'A' }, points: { en: ['x'], es: ['y'] } } } } } }, 'texts and lists by language, a null');
  ok({ ...base, widgets: { s: { type: 'carousel', filter: { by: 'kind', param: 'kind' }, items: [{ name: 'A', kind: 'boat' }, { name: 'B', kind: 'bus' }] } } }, 'a slide\'s filter key');
  ok({ ...base, widgets: { f: { type: 'chips', items: { a: ['A', 'Say A'], b: { en: ['B', 'Say B'], es: ['B', 'Di B'] }, c: { label: 'C', say: 'Say C' } } } } }, 'chips in their three shapes');
  ok({ ...base, widgets: { p: { type: 'people', source: { data: 'staff', map: { name: '{n}', role: '{r}' } } } } }, 'people from a source, no items');
  ok({ ...base, widgets: { d: { type: 'form', density: { en: 'compact', es: 'comfy' }, cta: 'Go', summary: '{a}', steps: [{ key: 'a', items: [['x', 'X']] }] } } }, 'an option by language');
  ok({ ...base, widgets: { m: { type: 'map', places: [{ id: 'a-1', name: 'A', lat: 40, lng: -3 }] } } }, 'a map place id with a dash');
});

// a config the checker rejects for a plain mistake: the schema says so too
const GOOD = { prefix: 'np', links: ['https://shop.example/'], widgets: { c: { type: 'cards', items: { a: { title: 'A', kicker: 'K' } } }, k: { type: 'contact', title: 'Call us' } } };
const BAD = {
  'an unknown top-level key': (c) => { c.linsk = []; },
  'an unknown option': (c) => { c.widgets.c.kiker = 'x'; },
  'an unknown key in an item': (c) => { c.widgets.c.items.a.kiker = 'x'; },
  'an unknown type': (c) => { c.widgets.z = { type: 'crads' }; },
  'a missing need': (c) => { delete c.widgets.k.title; },
  'an item without its title': (c) => { delete c.widgets.c.items.a.title; },
  'no widgets': (c) => { delete c.widgets; },
  'no prefix': (c) => { delete c.prefix; },
  'an unknown param key': (c) => { c.widgets.c.params = { plazas: { type: 'int', min: 0, max: 9, limit: 3 } }; },
  'an unknown money key': (c) => { c.widgets.c.money = { currency: '€' }; },
  'an unknown density': (c) => { c.widgets.f = { type: 'form', density: 'tight', cta: 'Go', summary: '{a}', steps: [{ key: 'a', items: [['x', 'X']] }] }; },
  'an unknown icon': (c) => { c.actions = { call: { tel: '1', label: 'Call', icon: 'phon' } }; c.links.push('tel:'); },
};
test('schema: the plain mistakes the checker rejects, the schema rejects', () => {
  assert.deepEqual(checkConfig(GOOD), []); assert.deepEqual(validate(schema, GOOD), []);
  for (const [why, edit] of Object.entries(BAD)) {
    const c = clone(GOOD); edit(c);
    assert.notDeepEqual(checkConfig(c), [], why + ': the checker');
    assert.notDeepEqual(validate(schema, c), [], why + ': the schema');
  }
});

test('check: "did you mean" for a misspelt key, in the sentence and in --json', () => {
  const c = clone(GOOD); c.widgets.c.items.a.kiker = 'x'; c.widgets.c.kiker = 'y'; c.linsk = [];
  const e = checkConfig(c).join('\n');
  assert.match(e, /c: a: unknown key "kiker"\. Known: kicker, title[^\n]*\. Did you mean "kicker"\?/);
  assert.match(e, /c: unknown option "kiker" for cards\. Known: [^\n]*\. Did you mean "kicker"\?/);
  assert.match(e, /unknown key "linsk"\. Known: [^\n]*\. Did you mean "links"\?/);
  const d = checkConfigDetailed(c);
  assert.deepEqual(d.find((x) => x.path === 'widgets.c.items.a.kiker'), { widget: 'c', path: 'widgets.c.items.a.kiker', message: d.find((x) => x.path === 'widgets.c.items.a.kiker').message, fix: 'did you mean "kicker"?' });
  assert.ok(d.some((x) => x.path === 'widgets.c.kiker' && x.fix === 'did you mean "kicker"?'));
  assert.ok(d.some((x) => x.widget === null && x.path === 'linsk' && x.fix === 'did you mean "links"?'));
  // nothing close: no guess
  const f = clone(GOOD); f.widgets.c.items.a.zzzzzz = 1;
  assert.doesNotMatch(checkConfig(f).join('\n'), /Did you mean/);
  // the CLI: [] and exit 0 for a valid config; the list and exit 1 otherwise
  const cli = new URL('scripts/check-config.mjs', HERE).pathname;
  assert.equal(execFileSync(process.execPath, [cli, '--json', new URL('kit/example/config.json', HERE).pathname], { encoding: 'utf8' }).trim(), '[]');
  const tmp = fs.mkdtempSync(os.tmpdir() + '/lbw-schema-');
  try {
    fs.writeFileSync(tmp + '/bad.json', JSON.stringify(c));
    let out = null, code = 0;
    try { execFileSync(process.execPath, [cli, '--json', tmp + '/bad.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (x) { out = x.stdout; code = x.status; }
    assert.equal(code, 1); const j = JSON.parse(out);
    assert.ok(j.some((x) => x.path === 'widgets.c.items.a.kiker' && x.fix === 'did you mean "kicker"?'), out);
    assert.deepEqual(Object.keys(j[0]), ['widget', 'path', 'message', 'fix']);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// v0.11 · setup() reads "prefix" and a widget's "type" raw: the checker refuses one per language (the schema too)
test('check: a by-language prefix or type is an error, not a pass that breaks on the page', async () => {
  const { spawnSync } = await import('node:child_process');
  const fsx = await import('node:fs'), os = await import('node:os'), pth = await import('node:path');
  const dir = fsx.mkdtempSync(pth.join(os.tmpdir(), 'lbw-bylang-'));
  const run = (cfg) => { const f = pth.join(dir, 'c.json'); fsx.writeFileSync(f, JSON.stringify(cfg)); return spawnSync(process.execPath, ['scripts/check-config.mjs', f], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }); };
  const base = { prefix: 'np', langs: ['en', 'es'], defaultLang: 'en', widgets: { c: { type: 'chips', items: { a: ['A', 'A'] } } } };
  assert.equal(run(base).status, 0);
  const p = run({ ...base, prefix: { en: 'np', es: 'np' } });
  assert.equal(p.status, 1); assert.match(p.stdout + p.stderr, /"prefix" is one plain word for every language/);
  const t = run({ ...base, widgets: { c: { type: { en: 'chips', es: 'chips' }, items: { a: ['A', 'A'] } } } });
  assert.equal(t.status, 1); assert.match(t.stdout + t.stderr, /"type" is one word for every language/);
});
