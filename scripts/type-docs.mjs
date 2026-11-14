// scripts/type-docs.mjs · one reference page per widget type, in reference/types/, from the schema and the checker.
//   node scripts/type-docs.mjs           write reference/types/<type>.md (20 pages) and reference/types/README.md
//   node scripts/type-docs.mjs --check   change nothing; exit 1 when a page is not what the generator gives
// Generated: the title and one-liner (the schema), the minimal example (the smallest widget of that type in the public example
// configs that the checker accepts), the Keys and Item keys tables (the schema) and "The checker rejects" (the checker run on
// mutated copies of the example, its own sentences quoted). Hand-written: what sits between <!-- prose --> and <!-- /prose -->
// is kept on regeneration. A page's first prose block holds "When to use" and "Gotchas". A type no public example covers (or
// covers without a config of its own) has a second block, the whole "Minimal example" section, written by hand.
// `wrap(example, prefix)` turns a page's example into a config the checker accepts: test/type-docs.test.mjs uses it.
import fs from 'node:fs';
import { generate } from './schema.mjs';
import { checkConfigDetailed } from './lib.mjs';

const root = new URL('..', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const OUT = 'reference/types/';
const SOURCES = ['kit/example/config.json', 'kit/example-lead/config.json', 'kit/example-live/config.json', 'kit/example-status/config.json', 'gallery/config.json'];
const open = '<!-- prose -->', close = '<!-- /prose -->';
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── a page's example → a config the checker accepts ────────────────────────────────────────────
// An example is one widget ({ "type": … }) or, when it needs a widget beside it (a confirm names a form), { "widgets": { … } }
// whose last widget is the one the page is about. The wrapper adds what is not widget: a prefix, languages, a time zone and
// the allow-list for every URL the example uses.
export function mainOf(example, name = 'example') {
  if (example && example.widgets) { const k = Object.keys(example.widgets); return { name: k[k.length - 1], widgets: example.widgets }; }
  return { name, widgets: { [name]: example } };
}
export function wrap(example, prefix = 'x', name) {
  const { widgets } = mainOf(example, name);
  const origins = new Set(['tel:', 'mailto:', 'https://wa.me/', 'https://www.google.com/maps/', 'https://maps.apple.com/', 'https://www.openstreetmap.org/']);
  for (const m of JSON.stringify(widgets).matchAll(/https?:\/\/[^/"\\\s]+\//g)) origins.add(m[0]);
  return { prefix, langs: ['es', 'en'], defaultLang: 'es', timeZone: 'Europe/Madrid', links: [...origins], widgets: clone(widgets) };
}
export const problems = (example, prefix, name) => checkConfigDetailed(wrap(example, prefix, name));

// ── the sources: the smallest widget of a type that stands alone ───────────────────────────────
const ACTION_KEYS = ['reply', 'links', 'buttons', 'buttonsWithSummary', 'actions'];
// a name in "actions" or "replies" is written out, so the example needs no config around it
function inline(v, cfg, key) {
  if (Array.isArray(v)) return v.map((x) => inline(x, cfg, key));
  if (typeof v === 'string' && key === 'reply' && cfg.replies && cfg.replies[v]) return clone(cfg.replies[v]);
  if (typeof v === 'string' && key !== 'reply' && ACTION_KEYS.includes(key) && cfg.actions && cfg.actions[v]) return clone(cfg.actions[v]);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inline(x, cfg, ACTION_KEYS.includes(k) ? k : (Array.isArray(x) || typeof x === 'string' ? k : null))]));
  return v;
}
// the tag that draws a widget: the id it needs, the chips it shows, the two columns it compares
function tagOf(prefix, name, w) {
  const o = w.items && !Array.isArray(w.items) && typeof w.items === 'object' ? Object.keys(w.items) : [];
  let extra = '';
  if (w.type === 'chips') extra = ' q=' + o.join(',');
  else if (w.type === 'compare') extra = ' ids=' + o.slice(0, 2).join(',');
  else if (o.length && w.type !== 'people' && !w.source) extra = ' id=' + o[0];
  return `[[${prefix}:${name}${extra}]]`;
}
function candidates() {
  const by = {};
  for (const f of SOURCES) {
    let cfg; try { cfg = JSON.parse(read(f)); } catch { continue; }
    for (const [name, w0] of Object.entries(cfg.widgets || {})) {
      const w = inline(w0, cfg, null);
      if (Object.values(w.params || {}).some((p) => p && p.required)) continue;   // its tag would need values this page can't invent
      // a confirm names the widget it confirms: that one goes with it
      const ex = w.form && cfg.widgets[w.form] ? { widgets: { [w.form]: inline(cfg.widgets[w.form], cfg, null), [name]: w } } : w;
      (by[w.type] = by[w.type] || []).push({ file: f, name, prefix: cfg.prefix, widget: w, example: ex, size: JSON.stringify(ex).length });
    }
  }
  for (const l of Object.values(by)) l.sort((a, b) => a.size - b.size || (a.file + a.name < b.file + b.name ? -1 : 1));
  return by;
}
function pick(type, by) {
  for (const c of by[type] || []) if (!problems(c.example, c.prefix, c.name).length) return c;
  return null;
}

// ── the schema, as tables ──────────────────────────────────────────────────────────────────────
const REF = { text: 'text', reply: 'reply', action: 'action', links: 'list of actions', money: 'object', params: 'object', photo: 'photo', pair: '[label, url]', price: 'object', flow: 'true or list of keys', meter: 'object', toned: 'object', param: 'lower-case word' };
const range = (p) => (p.minimum != null || p.maximum != null ? ` ${p.minimum ?? ''}–${p.maximum ?? ''}` : '');
function typeOf(p, S) {
  if (p.const !== undefined) return `\`"${p.const}"\``;
  if (p.enum) return p.enum.filter((x) => x !== null).map((x) => `\`${JSON.stringify(x)}\``).join(', ');
  if (p.$ref) {
    const n = p.$ref.split('/').pop();
    if (n === 'tone') return 'tone: ' + S.$defs.tone.anyOf[0].enum.filter(Boolean).map((x) => `\`${x}\``).join(', ');
    if (n === 'icon') return 'icon name';
    if (n === 'byLang') return 'by language';
    if (/^item_/.test(n)) return 'item';
    return REF[n] || n;
  }
  if (p.anyOf) {
    const parts = [...new Set(p.anyOf.filter((b) => !(b.$ref && b.$ref.endsWith('/byLang')) && !(b.type === 'null')).map((b) => (b.type === 'array' ? (b.items && b.items.$ref ? 'list of ' + typeOf(b.items, S) + 's' : 'list') : typeOf(b, S))))];
    const lang = p.anyOf.some((b) => b.$ref && b.$ref.endsWith('/byLang'));
    return parts.join(' or ') + (lang && parts.length && !/text|by language/.test(parts.join()) ? ' (or by language)' : '');
  }
  if (p.type) {
    const ts = (Array.isArray(p.type) ? p.type : [p.type]).filter((t) => t !== 'null');
    return ts.map((t) => (t === 'integer' ? 'integer' + range(p) : t === 'number' ? 'number' + range(p) : t === 'string' && p.pattern === '^[a-z_][a-z0-9_]*$' ? 'lower-case word' : t === 'array' ? 'list' : t)).join(' or ');
  }
  return '';
}
// the schema's own placeholder text points at a private page: say there is nothing to say
const scrub = (d) => String(d || '').replace(/See docs\/[^(]*\("[^"]*"\)\.?/, 'Described in the checker only.').replace(/\s+/g, ' ').trim();
const cell = (s) => String(s).replace(/\|/g, '\\|');
function table(props, required, S) {
  const rows = Object.entries(props).map(([k, p]) => {
    const d = p.description || (p.$ref && S.$defs[p.$ref.split('/').pop()].description) || (k === 'type' ? 'The widget\'s type.' : '');
    return `| \`${k}\` | ${required.includes(k) ? 'yes' : ''} | ${cell(typeOf(p, S))} | ${cell(scrub(d))} |`;
  });
  return ['| Key | Required | Type | What it is |', '|---|---|---|---|', ...rows].join('\n');
}
function itemDef(def, S) {
  const find = (p) => {
    if (!p) return null;
    if (p.$ref && /item_/.test(p.$ref)) return p.$ref.split('/').pop();
    for (const x of [p.additionalProperties, p.items, ...(p.anyOf || [])]) { const r = find(x); if (r) return r; }
    return null;
  };
  const n = find(def.properties.items) || find(def.properties.item);
  if (!n) return null;
  let d = S.$defs[n];
  if (!d.properties && d.anyOf) d = d.anyOf.find((b) => b.properties);
  return { name: n, def: d };
}

// ── the checker, run on mutated copies of the example ──────────────────────────────────────────
const shorten = (m) => m.replace(/Known: [^"]*?(?=(\. Did you mean|$))/g, 'Known: …').replace(/\. Known: …$/, '. Known: …');
function mutations(example, S, type, wname) {
  const def = S.$defs[type], { name } = mainOf(example, wname), w = example.widgets ? example.widgets[name] : example;
  const keys = Object.keys(w).filter((k) => k !== 'type'), out = [];
  const make = (fn) => { const e = clone(example), x = e.widgets ? e.widgets[name] : e; fn(x); return e; };
  void wname;
  const typo = keys.find((k) => /^(title|kicker|note|cta|label)$/.test(k)) || keys.find((k) => k.length > 4 && def.properties[k]);
  if (typo) { const bad = typo[0] + typo[2] + typo[1] + typo.slice(3); out.push([`Misspell \`${typo}\` as \`${bad}\``, make((x) => { x[bad] = x[typo]; delete x[typo]; })]); }
  out.push(['Add a key the type does not have, `colour`', make((x) => { x.colour = 'red'; })]);
  for (const r of (def.required || []).filter((k) => k !== 'type' && k in w).slice(0, 2)) out.push([`Leave out \`${r}\``, make((x) => { delete x[r]; })]);
  const en = Object.entries(def.properties).find(([k, p]) => k in w && (p.enum || (p.anyOf && p.anyOf[0].enum)) && !(k === 'type')) || Object.entries(def.properties).find(([k, p]) => k !== 'type' && (p.enum || (p.anyOf && p.anyOf[0].enum)));
  if (en) out.push([`Give \`${en[0]}\` a value it does not have, \`"nope"\``, make((x) => { x[en[0]] = 'nope'; })]);
  const num = Object.entries(def.properties).find(([k, p]) => k in w && /integer|number/.test(JSON.stringify(p.type || '')));
  const txt = keys.find((k) => def.properties[k] && def.properties[k].$ref === '#/$defs/text' && typeof w[k] === 'string');
  if (num) out.push([`Give \`${num[0]}\` a word instead of a number`, make((x) => { x[num[0]] = 'many'; })]);
  else if (txt) out.push([`Give \`${txt}\` a number instead of text`, make((x) => { x[txt] = 42; })]);
  const itemsKey = ['items', 'item'].find((k) => w[k] && typeof w[k] === 'object' && !Array.isArray(w[k]));
  if (itemsKey) {
    const first = itemsKey === 'items' ? Object.keys(w.items)[0] : null, it = first ? w.items[first] : w.item;
    if (it && typeof it === 'object' && !Array.isArray(it) && itemDef(def, S)) out.push(['Add an unknown key to an item, `colour`', make((x) => { (first ? x.items[first] : x.item).colour = 'red'; })]);
  }
  out.push([`Write the type as \`${type}s\``, make((x) => { x.type = type + 's'; })]);
  return out;
}
function rejects(example, S, type, prefix, name) {
  const seen = new Set(), rows = [];
  for (const [what, ex] of mutations(example, S, type, name)) {
    const p = problems(ex, prefix, name)[0];
    if (!p || seen.has(p.message)) continue;
    seen.add(p.message); rows.push([what, shorten(p.message)]);
    if (rows.length === 5) break;
  }
  return rows;
}

// ── a page ─────────────────────────────────────────────────────────────────────────────────────
function proseBlocks(file) {
  if (!fs.existsSync(new URL(file, root))) return [];
  const t = read(file), out = [];
  for (let i = t.indexOf(open); i >= 0; i = t.indexOf(open, i + 1)) { const j = t.indexOf(close, i); if (j < 0) break; out.push(t.slice(i + open.length, j).replace(/^\n|\n$/g, '')); }
  return out;
}
const block = (s) => `${open}\n${s}\n${close}`;
function exampleSection(example, tag, from) {
  return ['## Minimal example', '', from, '', 'The tag that draws it: `' + tag + '`', '', '```json', fmt(example), '```'].join('\n');
}
// JSON for people: an object a key per line, a list or small object on one line when it fits
function fmt(v, ind = '') {
  const one = (x) => Array.isArray(x) ? '[' + x.map(one).join(', ') + ']' : x && typeof x === 'object' ? (Object.keys(x).length ? '{ ' + Object.entries(x).map(([k, y]) => JSON.stringify(k) + ': ' + one(y)).join(', ') + ' }' : '{}') : JSON.stringify(x);
  const flat = one(v);
  if (flat.length + ind.length <= 100 || !v || typeof v !== 'object') return flat;
  const next = ind + '  ';
  if (Array.isArray(v)) return '[\n' + v.map((x) => next + fmt(x, next)).join(',\n') + '\n' + ind + ']';
  return '{\n' + Object.entries(v).map(([k, y]) => next + JSON.stringify(k) + ': ' + fmt(y, next)).join(',\n') + '\n' + ind + '}';
}
function jsonOf(section) {
  const m = /```json\n([\s\S]*?)\n```/.exec(section);
  return m ? JSON.parse(m[1]) : null;
}

export function pages() {
  const S = generate().schema, by = candidates(), seeds = SEED, out = {};
  const types = S.$defs.widget.oneOf.map((o) => o.$ref.split('/').pop());
  for (const type of types) {
    const def = S.$defs[type], file = `${OUT}${type}.md`, old = proseBlocks(file), seed = seeds[type] || {};
    const prose = block(old[0] ?? `## When to use\n\n${(seed.when || ['TODO']).map((g) => '- ' + g).join('\n')}\n\n## Gotchas\n\n${(seed.gotchas || ['TODO']).map((g) => '- ' + g).join('\n')}`);
    const c = pick(type, by);
    let exampleMd, example, prefix, wname;
    if (c && !seed.hand) {
      example = c.example; prefix = c.prefix; wname = c.name;
      exampleMd = exampleSection(example, tagOf(c.prefix, c.name, c.widget), `The smallest \`${type}\` in the public example configs: \`${c.name}\` in \`${c.file}\`, with the names it uses written out${c.example.widgets ? ` (and the \`${c.widget.form}\` widget it confirms)` : ''}. The checker needs \`links\` to allow every URL it uses.`);
    } else {
      const text = old[1] ?? seed.hand;
      if (!text) throw new Error(`${type}: no public example passes the checker and the generator has no hand-written one`);
      exampleMd = block(text);
      example = jsonOf(text); const tg = /\[\[(\w+):(\w+)/.exec(text) || []; prefix = tg[1] || 'x'; wname = tg[2] || 'example';
    }
    const item = itemDef(def, S);
    const needs = (def.anyOf || []).map((b) => (b.required || []).map((k) => `\`${k}\``).join(' or ')).filter(Boolean);
    const rj = rejects(example, S, type, prefix, wname);
    const md = [
      `# \`${type}\``, '', def.description, '', prose, '', exampleMd, '',
      '## Keys', '',
      table(def.properties, def.required || [], S), '',
      ...(needs.length ? [`Also needed: one of ${needs.join(', or ')}.`, ''] : []),
      `Every text may also be written by language (\`{ "en": …, "es": … }\`), and a key may be \`null\` to leave it out. A key not in this table is an error.`, '',
      ...(item ? [`## Item keys`, '', `${item.def.description}`, '', table(item.def.properties, item.def.required || [], S), ''] : []),
      '## The checker rejects', '',
      `Each row is the example above with one change, run through \`npm run check:config\`; the sentence is the checker's own (a list of known keys is shortened to \`Known: …\`).`, '',
      '| Change | The checker says |', '|---|---|', ...rj.map(([a, b]) => `| ${cell(a)} | ${cell('`' + b.replace(/`/g, "'") + '`')} |`), '',
    ].join('\n');
    out[file] = md;
  }
  const idx = ['# Widget types', '', 'One page per type: when to use it, the smallest working example, every key, and what the checker rejects. Generated from the schema and the checker by `scripts/type-docs.mjs`; the prose between `<!-- prose -->` markers is written by hand and kept.', '',
    '| Type | What it draws | Page |', '|---|---|---|', ...types.map((t) => `| \`${t}\` | ${cell(S.$defs[t].description)} | [${t}.md](${t}.md) |`), '',
    // the top-level "screen" key: screen mode works with every type
    '## Screen mode: the `screen` key', '', S.properties.screen.description, '',
    table(S.properties.screen.properties, S.properties.screen.required || [], S), '',
    '`screen.header`:', '', table(S.properties.screen.properties.header.properties, [], S), '',
    'Every type also takes `"screen": false` (never the screen) and `"step"` (its step\'s id). A tag may name the step itself, `step=when` or `step=2`; any other value is logged and ignored. An agent\'s text between screens shows as a normal bubble under the current screen. If the chat\'s DOM is not what the library expects, or the `screen` key is wrong, the bot is a normal chat.', ''].join('\n');
  out[`${OUT}README.md`] = idx;
  return out;
}

// ── the first run's prose and hand-written examples (a page's own prose block wins once the page exists) ────
const SEED = {
  cards: {
    when: [
      'A card per thing the visitor can ask about: a service, an FAQ answer, an address, the state of a repair, a room with a photo and a price.',
      'The agent names the card with `id=` in the tag; the text lives in the config, so the agent never writes prices or opening times.',
      'One card with no id (`item` instead of `items`) suits a single fact, such as "where we build".',
      'Buttons go on the widget (`reply`, `links`), not on the item.',
    ],
    gotchas: [
      'The checker needs `items` (a card per id) or `item` (one card); the schema marks neither as required, only the checker says so.',
      'A card without a `title` is an error, whichever way it is written.',
      '`status` on the widget lets the tag choose a status line (`estado=lista`); its `param` must differ from the card\'s own `param`.',
      'A row written `[label, value, key]` is left out while the number param `key` is 0, so a sold-out row can disappear by itself.',
      'With `source` the rows come from a data message; the saved `items` stay as the copy for when the data never arrives.',
    ],
  },
  table: {
    when: [
      'A price list, a timetable or opening hours by season: several rows that share the same columns.',
      'Each item is one table (`title`, `cols`, `rows`); the tag picks it with `id=`.',
      'With `pick`, a tap anywhere on a row sends a sentence built from that row and saves fields, so the visitor can choose a time or a price.',
    ],
    gotchas: [
      '`cols` takes 2 to 5 entries, `[key, label]` or `[key, label, "end"]` (right-aligned); `rows` takes 1 to 30, one text per column.',
      'More than `fold` rows (8 by default) are folded behind "See all".',
      'A column that says the same in every row (three rows or more, never the first) leaves the table and shows once above it; `"same": false` keeps it.',
      '`pick.fields` is required whenever `pick` is there.',
      'About three columns fit on a phone; more scroll sideways with the first column held.',
    ],
  },
  form: {
    when: [
      'A short guided choice, one question at a time, that ends with one sentence the visitor sends and a few fields saved in Landbot.',
      'Good for planning a project, narrowing down a product or a booking request, where the flow needs the answers as fields.',
      'A step can be answered from the tag (`preset`), so the agent can skip a question the visitor already answered.',
    ],
    gotchas: [
      '`steps`, `summary` and `cta` are all required.',
      'An option is `[key, label]` or `[key, label, desc]`; the description is one line, 80 characters at most, and turns the step into a list.',
      '`summary` and `fields` are templates over the steps\' keys (`{kind:label}`); a placeholder with no answer leaves a saved field out.',
      'A step\'s `items` may be `{ "by": "earlier step", "map": { … }, "else": [] }` when its options depend on an earlier answer.',
      'Compact by default: an answered step folds to one line with a change button; `"density": "comfy"` shows all of it.',
    ],
  },
  contact: {
    when: [
      'How to reach the business: a phone number or an address in big type, a few rows, opening hours and buttons.',
      'With `hours` the card says whether the place is open now and when that changes.',
      'Put it at the end of an answer that the bot cannot finish, so the visitor has a way on.',
    ],
    gotchas: [
      '`title` is the only required key.',
      '`hours.week` is keyed by weekday (0 is Sunday) with `[open, close]` pairs in minutes after midnight, so `[570, 840]` is 9:30 to 14:00; `holidays` is a list like `["1/1", "25/12"]`.',
      'Set `timeZone` at the top of the config so "open now" is the client\'s time, not the visitor\'s.',
      'Buttons are `buttons` (not `links`); phone, WhatsApp and mail buttons need `tel:`, `https://wa.me/` or `mailto:` in the top-level `links` list.',
      '`summary` can show what a form sent, with its own actions.',
    ],
  },
  chips: {
    when: [
      'Quick replies under an answer: each chip sends a sentence as the visitor, so the next block or the agent can carry on from it.',
      'Use them to offer the two or three most likely next questions, not a menu of everything.',
      'A chip may save Landbot fields with its sentence (`fields`).',
    ],
    gotchas: [
      '`items` is required, and the tag must say which chips to show: `[[x:chips q=plan,area]]`. Without `q` nothing is drawn, and the checker cannot catch that.',
      'A chip is `[label, sentence]` or `{ "label", "say", "desc", "fields" }`; `desc` is one line, 80 characters at most.',
      'Chips stay out when the cards above already carry two actions (`crowd`; `0` keeps them).',
      '`own` and `carriedBy` leave a chip out when its own widget, or a card that offers the same thing, is in the reply.',
    ],
  },
  carousel: {
    when: [
      'A strip of slides to swipe through: products, rides, rooms, with a photo, a price and a status each.',
      'The slides are saved in `items`, or read live from a CSV, a JSON or a data message in `source`.',
      'A `filter` lets the tag show one kind of slide (`tipo=electrica`), or `ids=a,b` shows only those slides, in that order.',
    ],
    gotchas: [
      'The checker needs `items` or a `source`; the schema marks neither as required.',
      'A slide needs a `name`; a slide may also carry the key the filter reads (`filter.by`), so other keys are allowed there.',
      '`until` (D/M/YYYY) hides a slide after that day and needs `timeZone`.',
      'A `map` cannot fill `reply`: a cell would become a sentence the visitor sends.',
      'With a live `source`, keep at least one saved item per filter value, or a blocked file draws nothing.',
    ],
  },
  calc: {
    when: [
      'A calculator the visitor moves (days, size, options) with a total that updates, ending in one sentence sent with the numbers saved.',
      'Prices come from `tables` and `compute`, never from the agent, so the total is always the config\'s arithmetic.',
      'The tag can set the starting position (`dias=3 bici=ebike`).',
    ],
    gotchas: [
      '`state`, `controls`, `result`, `send` and `cta` are all required.',
      'Formulas use `+ - * / ( )` and `round floor ceil abs min max`; money is integer cents, shown with `{total:money}` and the widget\'s `money`.',
      'State keys are lower-case; a value above `max` is capped and an unknown pick draws the `default`.',
      'A control is `{ "stepper": key, "label" }` or `{ "pick": key, "items" }`; 2 or 3 short options become a segmented control.',
      '`send.fields` names the Landbot fields saved; a placeholder with no value leaves its field out.',
    ],
  },
  stats: {
    when: [
      'Two to four figures with where and when they were read: years in business, homes served, a rating from a public page.',
      'Use it for facts that build trust; always say the source and date in `source`.',
      'One card with no id (`item`) or several by id.',
    ],
    gotchas: [
      'Each item needs `stats` (2 to 4 `[value, label]` pairs) and a `source` line; the checker needs `items` or `item`.',
      'Values are text: write "1,200" or "4.8" the way they should read.',
      'Do not invent figures: the card repeats what the config says, and the source line is what makes it honest.',
      '`reply` and `links` go on the widget.',
    ],
  },
  people: {
    when: [
      'Who will help: a few named people with a role and a short note, optionally a photo.',
      'The tag can list who to show (`who=ana,ben`, with `filter.param`), or show everyone.',
      'The `reply` can use `{name}` and `{role}`: "Ask {name}".',
    ],
    gotchas: [
      'Each person needs a `name` and a `role`; the checker needs `items` or `item`.',
      'At most four people are drawn per tag.',
      '`filter` is `{ "param": the tag key that lists ids }`.',
      'A photo `src` must be under an entry of the top-level `links`.',
    ],
  },
  consent: {
    when: [
      'Ask permission once, with a yes and a no, and save the answer in Landbot: an SMS reminder, a call back, marketing.',
      'Each button sends a sentence and saves its own fields, so the flow can branch on the answer.',
    ],
    gotchas: [
      '`title`, `yes` and `no` are required; each of `yes` and `no` is `[label, sentence]` or `[label, sentence, { field: value }]`.',
      'The `fields` of the two buttons should use the same field names, so one condition in the flow reads either answer.',
      '`icon` is `check`, `bell` or `shield` only.',
      '`link` is a `[label, url]` pair (a privacy page) under the top-level `links`.',
    ],
  },
  slots: {
    when: [
      'Let the visitor pick a day and a time from the ones you offer, then send it as one sentence with fields saved.',
      'Use fixed dates (`days`) for a few known appointments, or a `weekly` plan that repeats `ahead` weeks.',
      'A `confirm` widget can show what was picked, and offer an .ics calendar file.',
    ],
    gotchas: [
      '`cta` and `say` are required, and either `days` or `weekly` has to give the slots.',
      '`weekly.week` is keyed by weekday (0 is Sunday); a time is `["09:00", "10:00"]`, and a third `"busy"` greys it out.',
      '`say` is `{ "text", "fields" }` over `{day}`, `{from}` and `{to}`.',
      'Past slots and days with nothing left are left out.',
      'It books nothing: the sentence goes to Landbot, and your flow does the booking.',
    ],
  },
  confirm: {
    when: [
      'Close the loop after a form, slots or calendar widget: say what was received and what happens next.',
      'It reads what that widget sent (the day, the time, the fields) and shows it as a card, or as a ticket with `"style": "pass"`.',
    ],
    gotchas: [
      '`form` names another widget in the same config, and it must be a form, slots or calendar widget: those are the ones that keep what they sent.',
      '`title`, `status`, `rows` and `steps` are templates over what that widget sent, plus `{text}`; a placeholder that widget does not offer is a checker error.',
      'With `"style": "pass"` the ticket gets a countdown and an "add to calendar" button; `"ics": false` removes it.',
      'It confirms what was sent, not that anything was booked: say so in `note` when the flow is a demo.',
    ],
  },
  review: {
    when: [
      'A receipt the visitor checks before confirming: lines, a total, and a confirm and a discard button.',
      'Lines may be fixed, or a pick between options that changes the total.',
      'Confirming sends one sentence with the fields saved.',
    ],
    gotchas: [
      '`state`, `lines`, `send` and `cta` are required.',
      'A line is `{ "label", "value" }` (a template) or `{ "label", "select", "items" }`.',
      'The total comes from `tables` and `compute`; compute it once and use the same name in the line and in what is sent.',
      '`discard` is `[label, sentence]`: a second button that sends its own sentence.',
      'The tag can set the starting picks (`ruedas=si`).',
    ],
  },
  chart: {
    when: [
      'Show how something changes over a range: sales by month, a price by season, a forecast.',
      'One or two series as line, area or bars; two to four stacked as bars.',
      'Say what is plotted and its unit once, in `sub`, and where the numbers come from in `note`.',
    ],
    gotchas: [
      '`title`, `x` and `series` are required.',
      '`x` is a list of labels or `{ "from", "to", "step", "label" }`; a series is `{ "label", "values": [...] }` or `{ "label", "value": a formula of i }`.',
      'Stacking (`"stack": true`) needs `"kind": "bar"` and 2 to 4 series.',
      '`height` is 100 to 400; `mark.at` puts a labelled marker on one point.',
      'The values are what the config says: do not use a chart for figures nobody measured.',
    ],
  },
  compare: {
    when: [
      'Two or three things side by side over the same rows: bikes, plans, rooms.',
      'The tag picks which (`ids=urbana,ebike`); `best` marks the one you recommend.',
      'A cell may be text, or true and false for a tick and a cross.',
    ],
    gotchas: [
      '`rows` is required, and the checker needs `items` with at least two columns, each with a `name` and `values` by row key.',
      'The tag names the columns: `ids=a,b` or `ids=a,b,c` (`min` and `max` are 2 or 3).',
      'A row is `[key, label]`, `[key, label, class]` or `[key, label, class, unit]`.',
      '`"same": "fold"` lists the rows where every column agrees in one line; the default `"mute"` draws them quieter.',
      'Values are text: format money yourself.',
    ],
  },
  season: {
    when: [
      'Say whether something is open today and when that changes: a seasonal route, a pool, a terrace.',
      'The card works out "open" or "closed", the next change and the days left from your date ranges.',
    ],
    gotchas: [
      '`ranges` is required: `[first open day, last open day]` pairs in D/M/YYYY; overlapping ranges count as one.',
      'It needs `timeZone` at the top of the config: "today" is the client\'s day (the checker says so).',
      'Write the years: a range for this year does not carry over to the next.',
      '`rows` are `[label, value]` lines; a row with a key (`[label, value, key]`) follows the number params like on cards.',
      'The kit\'s own words exist in six languages; `words` is only for a seventh or to change a phrase.',
    ],
  },
  map: {
    when: [
      'Where a shop, a workshop or a pickup point is: one to five places as pins and a list with distance, open-now and directions.',
      'It fetches nothing: no tiles, no key, no third-party script. It draws a schematic, or your own image.',
    ],
    gotchas: [
      '`places` is required; a place has `id`, `name`, `lat` and `lng` (and optionally `address`, `hours`, `status`, `link`).',
      'Without `image` the drawing is a sketch: say so in `note` when the streets are invented.',
      '`directions` (`google`, `apple`, `osm` or your own URL with `{q}`) needs its host under the top-level `links`.',
      'The tag `id=` highlights one place and `ids=` draws only those; none found draws nothing.',
      '`sort: "distance"` needs `from`.',
    ],
  },
  tracker: {
    when: [
      'Where an order, a repair, a booking or an application is, step by step; the state lives in Landbot, not in the agent.',
      'A flow\'s Message block writes the tag with the saved fields (`estado=@{estado}`), so the visitor sees the real step.',
      'A step may carry its own buttons while it is current ("I will collect it").',
    ],
    gotchas: [
      '`title` and `steps` (2 to 8) are required; step keys are lower-case and unique across `steps` and `states`.',
      'The current step comes from the tag; an unset or unknown value draws `default`, and without a `default` the widget draws nothing.',
      '`states` are delays (`at` a step) or ends (`"end": true`); `ref` shows the order code from the tag, never invented.',
      '`eta` needs a day or a time (tag keys) and its text must contain `{when}`; a past ETA is left out.',
      'The newest tracker with the same name and reference is the live one; older ones keep what they said.',
    ],
  },
  rating: {
    when: [
      'One tap to rate: thumbs ("was this useful"), stars, or a 0 to 10 scale for a recommendation score.',
      'The tap sends a sentence and saves the value in Landbot, so the flow can branch on it.',
    ],
    gotchas: [
      '`title` and `send` are required, and `send.fields` as well: a rating that saves nothing in Landbot is only a picture.',
      '`kind` is `thumbs`, `stars` (the default, 1 to `max`, 3 to 10) or `scale` (`min` to `max`).',
      '`bands` (`[[6, "detractor"], [8, "passive"], [10, "promoter"]]`) fill `{band}` in `send`.',
      'The value stays marked and the rest go quiet once sent.',
    ],
  },
  calendar: {
    when: [
      'Availability and prices for a month, and one day or a stay picked with two taps: nights in a hotel or rental, a day at a restaurant.',
      'Days are free, few, full or closed, from `rates` (a price per night over a period), `days` (one date) and `closed`.',
      'The tag can open on a month (`month=2026-12`) or with a stay already picked (`from=21/11/2026|to=24/11/2026`).',
    ],
    gotchas: [
      '`cta` and `send` are required, and `send.fields` as well.',
      'Prices are plain amounts per night (`189`, `"189,50"`), with no currency or thousands separator; the checker requires `money` when there are prices.',
      'In a stay, the first tap is the check-in (free or few); the second is the check-out, which may be a full or closed day.',
      'A preset in the tag is kept only if the visitor could have picked it; anything else is ignored and logged.',
      '`mode` is `range` (the default) or `single`; `nights.min` and `max` limit the stay; `notice` and `horizon` limit how soon and how far.',
    ],
  },
};

// ── main ───────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (isMain) {
  const check = process.argv.includes('--check'), want = pages();
  if (check) {
    const stale = Object.entries(want).filter(([f, t]) => !fs.existsSync(new URL(f, root)) || read(f) !== t).map(([f]) => f);
    if (stale.length) { console.error(`stale: ${stale.join(', ')}\nrun: node scripts/type-docs.mjs`); process.exit(1); }
    console.log(`reference/types: ${Object.keys(want).length} pages up to date`);
  } else {
    fs.mkdirSync(new URL(OUT, root), { recursive: true });
    for (const [f, t] of Object.entries(want)) fs.writeFileSync(new URL(f, root), t);
    console.log(`reference/types: ${Object.keys(want).length} pages written`);
  }
}

