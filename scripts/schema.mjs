// scripts/schema.mjs · the config's JSON Schema and its TypeScript types, generated from the checker's own tables.
//   node scripts/schema.mjs           write dist/lbw-kit.schema.json and types/lbw-kit.config.d.ts
//   node scripts/schema.mjs --check   change nothing; exit 1 when either file is not what the checker's tables give
// The source of truth is kit/setup-check.js (TOP, KEYS, ITEM, NEED, the icons and tones, exported on LBW.kit.setup._) and
// the types setup() knows (LBW.kit.setup.types). The schema is a first line for editors and agents, never stricter than the
// checker: where a value's shape depends on the rest of the config (templates, formulas, params, a filter's key), it only
// describes it. Every text may also be { "en": …, "es": … } (by language), and a key left out may also be null.
// `npm run check:config` stays the full check. scripts/build.mjs calls generate() so the schema is part of dist/.
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

// the checker as scripts/lib.mjs loads it: lbw.js, a bare LBW.kit, setup.js and setup-check.js
export function tables() {
  const window = { document: { documentElement: {}, querySelector: () => null, querySelectorAll: () => [] } };
  const ctx = vm.createContext({ window, document: window.document });
  vm.runInContext(read('runtime/host-v4.js'), ctx);
  vm.runInContext(read('runtime/lbw.js'), ctx);
  window.LBW.kit = { h: {} };
  vm.runInContext(read('kit/setup.js'), ctx);
  vm.runInContext(read('kit/setup-check.js'), ctx);
  const I = window.LBW.kit.setup._, k = I.keys, words = (s) => s.split(' ');
  const KEYS = Object.fromEntries(Object.entries(k.KEYS).map(([t, s]) => [t, words(s).concat('flow')]));
  const types = [...window.LBW.kit.setup.types];
  const a = Object.keys(KEYS).sort().join(), b = [...types].sort().join();
  if (a !== b) throw new Error(`the checker's types (${a}) are not setup()'s (${b})`);
  return { TOP: [...k.TOP], KEYS, ITEM: JSON.parse(JSON.stringify(k.ITEM)), NEED: JSON.parse(JSON.stringify(k.NEED)),
    ICONS: [...I.icons], TONES: [...I.tones], PTYPES: [...I.PTYPES], DIRECTIONS: Object.keys(I.mapDir || {}), types: Object.keys(KEYS) };
}

// ── the building blocks ─────────────────────────────────────────────────────────────────────────
// `ts` is a hint for the TypeScript types only (a key the checker doesn't check, whose use is plain); it never reaches the schema
const ref = (n, description) => (description ? { $ref: `#/$defs/${n}`, description } : { $ref: `#/$defs/${n}` });
const text = (d) => ref('text', d);
const any = (d, ts) => ({ description: d, ...(ts ? { ts: ts + ' | null' } : {}) });
const words = (vals, d) => ({ description: d, anyOf: [{ enum: [...vals, null] }, ref('byLang')] });
const bool = (d) => ({ description: d, type: ['boolean', 'null'] });
const int = (d, min, max) => ({ description: d, type: ['integer', 'null'], ...(min != null ? { minimum: min } : {}), ...(max != null ? { maximum: max } : {}) });
const num = (d, min, max) => ({ description: d, type: ['number', 'null'], ...(min != null ? { minimum: min } : {}), ...(max != null ? { maximum: max } : {}) });
const list = (d, items) => ({ description: d, anyOf: [{ type: 'array', ...(items ? { items } : {}) }, ref('byLang'), { type: 'null' }] });
const obj = (d, properties, opt = {}) => ({ description: d, type: ['object', 'null'], ...(properties ? { properties } : {}),
  ...(opt.required ? { required: opt.required } : {}), ...(opt.closed ? { additionalProperties: false } : opt.values ? { additionalProperties: opt.values } : {}),
  ...(opt.names ? { propertyNames: { pattern: opt.names } } : {}), ...(opt.min ? { minProperties: opt.min } : {}) });
const strict = (d, properties, required) => obj(d, properties, { closed: true, required });
const WORD = '^[a-z_][a-z0-9_]*$';
const PAIR_TS = '[LbwText, LbwText] | [LbwText, LbwText, Record<string, LbwText | number | boolean>] | LbwByLang';   // a list's texts may be by language too
const param = (d) => ({ description: d, pattern: WORD });   // a tag key: lower-case (pattern only applies to a text)

// the defs every widget shares
function defs(t) {
  return {
    byLang: { description: 'The same value by language: { "en": …, "es": … }, one per code in "langs" (texts or lists only).', type: 'object', minProperties: 1,
      propertyNames: { pattern: '^[A-Za-z]{2}(-[A-Za-z]{2})?$' }, additionalProperties: { type: ['string', 'array'] } },
    text: { description: 'A text, or the same text by language.', anyOf: [{ type: ['string', 'null'] }, ref('byLang')] },
    tone: words(t.TONES, 'One of the kit\'s tones.'),
    icon: words(t.ICONS, 'One of the kit\'s icons.'),
    toned: strict('{ "text", "tone" }: a status line.', { text: text('What it says.'), tone: ref('tone') }, ['text']),
    reply: any('A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot).', 'string | ' + PAIR_TS),
    action: {
      description: 'An action: a name in "actions", or an object with one of tel, wa, link, reply, mail and a "label".',
      anyOf: [{ type: 'string' }, ref('byLang'), {
        type: 'object',
        properties: {
          use: any('The name of an action in "actions" this one starts from.', 'LbwText'), label: text('The button\'s label.'),
          tel: any('A phone number to call (needs "tel:" in "links").', 'LbwText'), wa: any('A WhatsApp number (needs "https://wa.me/" in "links").', 'LbwText'),
          link: any('A URL under an entry of "links" (a calc\'s links may hold {placeholders}).', 'LbwText'),
          mail: any('One plain e-mail address (needs "mailto:" in "links").', 'LbwText'),
          reply: any('[label, sentence] or [label, sentence, { field: value }]: the visitor sends the sentence.', PAIR_TS),
          icon: ref('icon'), danger: bool('A destructive action (never the primary one).'), primary: any('The card\'s one main action.', 'boolean'),
          text: text('The text this action carries, where a widget fills it ({text}).'),
        },
      }],
    },
    links: list('Buttons: actions (names in "actions" or written out).', ref('action')),
    money: strict('How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }.', {
      cur: text('The currency sign.'), after: any('true: the sign after the amount.', 'boolean'), dec: text('The decimal separator.'), th: text('The thousands separator.'),
      cents: any('Show cents.', 'boolean'), space: any('A space between the amount and the sign.', 'boolean') }),
    params: obj('Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }.', null,
      { names: WORD, min: 1, values: ref('param') }),
    param: { description: 'A typed value from the tag.', oneOf: t.PTYPES.map((ty) => {
      const more = { one: 'values labels', list: 'values labels max', int: 'min max forms', num: 'min max', money: 'min max cents', text: 'max', day: 'min max', time: '' }[ty];
      const p = { type: { const: ty }, param: param('The tag key it is read from (the param\'s name by default).'), required: { description: 'true: without it the widget draws nothing.', enum: [true, null] }, default: any('The value when the tag has none (or an invalid one).') };
      const desc = { values: any('The only values the tag may carry: lower-case words.', 'string[] | LbwByLang'), labels: any('{ value: label } for {name:label}.', 'Record<string, LbwText>'),
        max: any({ list: 'How many values the tag may list.', text: 'The longest text (80 by default, 300 at most).', money: 'The highest amount in cents.', int: 'The highest value.', num: 'The highest value.', day: '"today" or D/M/YYYY.' }[ty], ty === 'day' ? 'string' : 'number'),
        min: any(ty === 'day' ? '"today" or D/M/YYYY.' : ty === 'money' ? 'The lowest amount in cents.' : 'The lowest value.', ty === 'day' ? 'string' : 'number'),
        cents: any('true: the tag carries whole cents (3499).', 'boolean'), forms: any('{ "zero", "one", "other" } for {name:count}; {n} is the number.', '{ zero?: LbwText; one?: LbwText; other: LbwText }') };
      if (more) more.split(' ').forEach((k) => { p[k] = desc[k]; });
      const required = ['type'].concat({ int: ['min', 'max'], num: ['min', 'max'], money: ['max'], one: ['values'], list: ['values'] }[ty] || []);
      return { type: 'object', properties: p, required, additionalProperties: false };
    }) },
    photo: any('A photo: { "src", "srcset", "width", "height", "alt" }, or "set:file.jpg" / { "photo": "set:file.jpg", "alt" } with "photos". "src" must be under "links".',
      'LbwText | { src?: LbwText; srcset?: unknown; width?: number; height?: number; alt?: LbwText; photo?: LbwText; [key: string]: unknown }'),
    pair: any('[label, url]: a link under an entry of "links".', '[LbwText, LbwText] | LbwByLang'),
    price: strict('{ "now", "unit", "list" }: already formatted.', { now: text('The price now.'), unit: text('Per what ("/ night").'), list: text('The price before (struck through).') }, ['now']),
    flow: { description: 'true, or the list of keys its flow tag writes, e.g. ["texto", "lang"].', anyOf: [{ enum: [true, null] }, { type: 'array', minItems: 1, items: { type: 'string', pattern: '^[a-z_][a-z0-9_]*$' } }, ref('byLang')] },
    meter: any('A meter on a row: { "of": the capacity, "low": the count from which it reads low }.', '{ of: number | string; low?: number; full?: LbwText }'),
  };
}

// a source read from LBW.data (cards, table, stats, people, compare)
const itemSource = (t) => strict('Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }.', {
  data: any('A key of LBW.data, or { "param": a "one" param whose values are keys }.', 'LbwText | { param: string }'),
  wait: num('How long to wait for the data, ms (0–8000; 1500).'), upgrade: num('How long the saved copy may still be replaced by late data, ms (0–60000).'),
  path: any('The dotted key of the list inside the data, as "data.items".', 'LbwText'), id: any('The id column.', 'LbwText'),
  map: any('{ part: "{column}" }: which column fills which part.', 'Record<string, unknown>'), merge: bool('true: the saved item with the same id fills what a row lacks.'),
  max: int('How many rows are read.', 1, 5000) }, ['data', 'map']);

// item shapes, from ITEM (a key the table has but this file doesn't describe is still allowed, described loosely)
function itemDefs(t) {
  const fill = (keys, known) => Object.fromEntries(keys.map((k) => [k, known[k] || any(`Checked by the config checker; see reference/types/.`)]));
  const card = {
    kicker: text('A small line above the title.'), title: text('The card\'s title.'), who: text('Who it is for or by.'), line: text('One line under the title.'),
    points: list('Bullet points (texts).'), pointsCls: text('A CSS class for the points.'), pointsTitle: text('A title above the points.'),
    rows: list('Rows: [label, value], [label, value, key], or a meter row [label, value, { "of": 12 }].'), note: text('A note at the end.'), noteCls: text('A CSS class for the note.'),
    link: ref('pair'), status: ref('toned'), badge: { description: '"text" or { "text", "tone" }: a small label beside the title.', anyOf: [ref('text'), ref('toned')] },
    img: ref('photo'), price: ref('price') };
  const table = { kicker: text('A small line above the title.'), title: text('The table\'s title.'), cols: list('2–5 columns: [key, label] or [key, label, "end"].'),
    rows: list('1–30 rows, one text per column.'), note: text('A note under the table.'), source: text('Where and when the numbers were read.'), link: ref('pair'),
    meter: any('{ "col": the count column, "of": the capacity (a number or a column), "low", "full" }.', '{ col: string; of: number | string; low?: number; full?: LbwText }') };
  const stats = { kicker: text('A small line above the title.'), title: text('The title.'), stats: list('2–4 [value, label].'), source: text('Where and when the numbers were read.') };
  const people = { name: text('The name.'), role: text('The role.'), img: ref('photo'), note: text('A note.') };
  const slide = { id: any('The slide\'s id (the tag\'s ids=a,b).', 'LbwText'), img: ref('photo'), badge: text('A small label.'), kicker: text('A small line above the name.'),
    name: text('The slide\'s name.'), sub: text('A line under the name.'), price: any('{ "now", "unit", "list" }: already formatted.', 'LbwPrice'), save: text('What it saves.'),
    status: any('{ "text", "tone" } or { "text", "ok": true }.', '{ text: LbwText; tone?: LbwTone; ok?: boolean }'), desc: text('A description.'),
    reply: ref('reply'), link: ref('pair'), gallery: any('{ "title", "photos": [ … ] }: a gallery of photos.', '{ title?: LbwText; photos: unknown[] | LbwByLang }'), until: text('The last day it shows, D/M/YYYY (needs "timeZone").') };
  const compare = { name: text('The column\'s name.'), values: any('{ row key: text, or true/false for ✓/✕ }.', 'Record<string, LbwText | boolean>'), reply: ref('reply'), link: ref('pair'), img: ref('photo') };
  const all = { table, cards: card, stats, people, slide, compare };
  for (const k of Object.keys(t.ITEM)) if (!all[k]) throw new Error(`ITEM.${k}: no item shape in scripts/schema.mjs`);
  const req = { cards: ['title'], table: ['title', 'cols'], stats: ['stats', 'source'], people: ['name', 'role'], slide: ['name'], compare: ['name', 'values'] };
  const out = {};
  for (const [k, keys] of Object.entries(t.ITEM)) {
    const s = { description: `An item of a ${k === 'slide' ? 'carousel (a slide)' : k + ' widget'}.`, type: 'object', properties: fill(keys, all[k]), required: req[k] };
    // a slide also takes the key its widget's filter reads ("filter": { "by": "kind" }): any other key is allowed
    if (k === 'slide') s.description += ' It also takes the key the carousel\'s "filter.by" names, so other keys are allowed here.';
    else s.additionalProperties = false;
    out[`item_${k}`] = s;
  }
  out.item_chips = { description: 'A chip: [label, sentence], or { "label", "say", "desc", "fields" }.', anyOf: [
    { type: 'array', minItems: 2, maxItems: 2, ts: '[LbwText, LbwText]' }, ref('byLang'),
    { type: 'object', properties: { label: text('The chip\'s label.'), say: text('The sentence it sends.'), desc: text('One line under the label (80 characters at most).'),
      fields: any('{ field: value }: saved in Landbot with the sentence.', 'Record<string, string | number | boolean>') }, required: ['label', 'say'], additionalProperties: false }] };
  return out;
}

// what each key means, shared by the types (a type's own meaning overrides it below)
function common(t) {
  return {
    cls: text('Extra CSS class(es) on the card.'), lang: text('A fixed language for this widget.'),
    kicker: text('A small line above the title.'), title: text('The title.'), cta: text('The main button\'s label.'), note: text('A note at the end.'),
    text: text('The body text.'), big: text('A big line (a phone number, an address).'), sub: text('A subtitle.'), disclaimer: text('A disclaimer under the card.'), lead: text('A line above the slides.'),
    allowDup: any('true: draw it even when the same widget is already in the message.', 'boolean'),
    params: ref('params'), money: ref('money'), flow: ref('flow'),
    links: ref('links'), buttons: ref('links'), buttonsWithSummary: ref('links'), actions: ref('links'),
    reply: ref('reply'), param: param('The tag key that names the item ("id" by default): lower-case.'),
    item: any('A single item (no id in the tag).'), items: any('The items.'),
    fallback: text('The item drawn when the tag names none (a flow\'s unset id).'), single: any('true: a card with no id.', 'boolean'), pointsCls: text('A CSS class for the points.'),
    live: bool('The "Live" chip beside the title (true by default for rows from a source).'),
    density: words(['compact', 'comfy'], '"compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout).'),
    collapse: any('false: keep it open after it is sent.', 'boolean'), state: obj('The values the visitor changes: { key: { "min", "max", "default" } or { "values", "default" } }.'),
    tables: obj('Lookup tables of numbers: { name: { key: number } }.'), compute: obj('Formulas, in order: { name: "formula" }.'),
    result: obj('{ "rows", "total", "note" }: templates over the state and compute.'), send: obj('{ "text", "fields" }: the sentence sent and the fields saved.', null, { required: ['text'] }),
    summary: any('A template (or, for contact, { "form", "text", "actions" }).'), steps: list('The steps.'), rows: list('Rows.'), status: any('A status.'),
    source: itemSource(t), filter: obj('A filter the tag drives.'), titles: obj('Titles by filter value or by count.'), max: any('How many at most.', 'number'), min: any('How many at least.', 'number'),
    kind: any('The kind.'), same: any('What to do with rows that say the same everywhere.'), style: any('The look.'), ics: any('An .ics calendar file.'), code: text('A booking code ("{ref}").'),
    days: list('Days.'), labels: any('Labels.'), lines: list('Lines.'), ranges: list('[first open day, last open day], each D/M/YYYY.'), words: any('The kit\'s words, changed.'),
  };
}

// a type's own meaning for a key
function own(t) {
  const PL = { id: { description: 'Its id: a lower-case word (a-z, 0-9, _ and -), 40 at most; the tag names it.', pattern: '^[a-z0-9][a-z0-9_-]{0,39}$' }, name: text('Its name.'), kind: text('What it is ("Shop").'), address: text('Its address.'),
    lat: num('Latitude, −90 to 90.', -90, 90), lng: num('Longitude, −180 to 180.', -180, 180), at: any('[x, y] in % of the image.', '[number, number] | LbwByLang'),
    hours: any('{ "week": { "1": [[600, 840]] }, "holidays", "sep", "h12", "open", "closed" } (0 = Sunday; minutes).', 'Record<string, unknown>'), status: ref('toned'),
    distance: text('The distance, written out.'), link: ref('pair') };
  const tstep = { key: { description: 'The value the flow writes (estado=lista).', pattern: '^[a-z][a-z0-9_]{0,39}$' }, label: text('The step\'s name, 40 characters at most.'),
    detail: text('More about the step.'), time: text('When.'), tone: ref('tone'), actions: ref('links') };
  const tstate = { key: tstep.key, text: text('What its status line says.'), tone: ref('tone'), at: any('The step it holds up (a delay).', 'LbwText'), end: { description: 'true: it ends the tracking.', enum: [true, null] }, actions: ref('links') };
  return {
    cards: { items: obj('The cards by id.', null, { values: ref('item_cards') }), item: ref('item_cards'),
      status: strict('A status the tag names: { "param": "estado", "items": { key: { "text", "tone", "reply", "links" } } }.', { param: param('The tag key.'), items: obj('The statuses by key.') }, ['param', 'items']) },
    table: { items: obj('The tables by id.', null, { values: ref('item_table') }), item: ref('item_table'), fold: int('The rows shown before "See all" (8).', 3),
      pick: strict('Each row a button: { "say": "…{column}…", "fields": { field: "{column}" }, "label" }.', { say: text('The sentence sent.'), fields: obj('Saved in Landbot.'), label: text('The button\'s label.') }, ['say', 'fields']),
      same: { description: 'false: keep a column that says the same in every row.', enum: [false, null] } },
    stats: { items: obj('The cards by id.', null, { values: ref('item_stats') }), item: ref('item_stats') },
    people: { items: obj('The people by id.', null, { values: ref('item_people') }), filter: obj('{ "param": the tag key that lists ids }.') },
    compare: { items: obj('The columns by id (two or more).', null, { values: ref('item_compare') }), rows: list('[key, label], [key, label, class] or [key, label, class, unit].'),
      same: words(['fold', 'mute'], '"fold": equal rows go in one line under the table; "mute" (the default): drawn quieter.'),
      min: int('How many at least (2 or 3).', 2, 3), max: int('How many at most (2 or 3).', 2, 3), empty: text('What an empty cell says.'), primary: any('The primary action.'),
      best: { description: 'The column you recommend: an id, or { "id", "label" }.', anyOf: [ref('text'), { type: 'object', properties: { id: text('The id.'), label: text('Its label.') }, additionalProperties: false }] },
      titles: obj('{ "2": text, "3": text }: by how many are compared.') },
    chips: { items: obj('The chips by key.', null, { values: ref('item_chips') }), max: int('How many chips at most.', 1), crowd: int('With that many actions on the cards above, the chips stay out (2; 0 = never).', 0),
      own: obj('Chips left out while their own widget is in the reply.'), carriedBy: obj('{ chip: [widget names] }: left out when a card carries it.') },
    carousel: { items: list('The slides.', ref('item_slide')), style: words(['media', 'box'], '"media" (photos lead, no box) or "box".'),
      filter: obj('{ "by": a key of the items, "param": the tag key, "values" }.'), titles: obj('Titles by filter value.'), max: any('How many slides at most.', 'number'),
      live: bool('The "Live" chip beside the title.'),
      source: strict('Slides read live: { "csv" | "json" | "data", "id", "map": { "name": "{column}", … } }.', {
        csv: any('An https URL of a CSV.', 'LbwText'), json: any('An https URL of a JSON answer.', 'LbwText'), data: any('A key of LBW.data, or { "param" }.', 'LbwText | { param: string }'),
        wait: num('ms to wait for the data.'), upgrade: num('ms the saved copy may still be replaced.'), path: any('The dotted key of the list.', 'LbwText'), id: any('The id column.', 'LbwText'),
        map: any('{ part: "{column}" }.', 'Record<string, unknown>'), merge: bool('true: a saved item fills what a row lacks.'), order: words(['items'], '"items": the saved items\' order.'),
        max: int('How many rows are read.', 1, 5000), maxAge: num('ms before it is fetched again (10000 at least).', 10000), prefetch: any('false: don\'t fetch it when the chat loads.', 'boolean') }, ['map']) },
    calc: { money: obj('How {x:money} is written: { "cur", "after", "dec", "th", "cents", "space" }.'), controls: list('{ "stepper": a state key, "label" } or { "pick": a state key, "items" }.'), notes: list('[text] or [text, class].'),
      result: obj('{ "rows", "total", "note" }: templates over the state and compute.'), state: obj('The values: { key: { "min", "max", "default" } or { "values", "default", "labels", "required" } }.') },
    review: { money: obj('How {x:money} is written.'), lines: list('{ "label", "value" } (a template) or { "label", "select", "items" }.'), total: obj('{ "label", "value" }.'), discard: ref('reply') },
    chart: { money: obj('How {x:money} is written.'), kind: words(['line', 'area', 'bar'], 'line, area or bar.'), stack: bool('true: bars piled per point (2–4 series).'), height: num('The height, 100 to 400.', 100, 400),
      x: any('A list of labels, or { "from", "to", "step", "label" }.', 'Array<LbwText | number> | LbwByLang | { from: number; to: number; step?: number; label?: LbwText }'),
      series: list('One or two series (2–4 stacked): { "label", "value": a formula of i } or { "label", "values": numbers }.'),
      y: obj('{ "ticks", "suffix" }.'), mark: obj('{ "at": a point of x (or a formula), "label" }.'), summary: text('A template: the chart in one sentence.') },
    consent: { icon: words(['check', 'bell', 'shield'], 'check, bell or shield.'), yes: any('[label, sentence, { field: value }].', PAIR_TS),
      no: any('[label, sentence, { field: value }].', PAIR_TS), link: ref('pair') },
    slots: { days: list('Fixed dates: [{ "date": D/M/YYYY, "slots": [[from, to]] }].'), weekly: obj('{ "week": { "1": [["09:00", "10:00"]] }, "ahead", "from", "skip" } (0 = Sunday).'),
      say: obj('{ "text", "fields" } over {day} {from} {to}.', null, { required: ['text'] }), sep: text('The separator between the times.'), h12: any('12-hour times.', 'boolean'),
      ics: obj('{ "title", "where", "label", "file" }: an .ics file.', null, { required: ['title'] }) },
    confirm: { form: text('The form, slots or calendar widget whose sending it confirms.'), status: text('A status line (a template).'), rows: list('[label, value] templates.'),
      steps: list('What happens next (templates).'), style: words(['pass', 'card'], '"pass" (a ticket) or "card" (the default).'), countdown: bool('false hides the countdown.'),
      ics: { description: '{ "title", "where", "label", "file" }, or false.', anyOf: [{ enum: [false, null] }, { type: 'object', properties: { title: text('The event\'s title.'), where: text('Where.'), label: text('The button\'s label.'), file: any('A file name.', 'LbwText') }, additionalProperties: false }] } },
    season: { ranges: list('[[first open day, last open day], …] in D/M/YYYY.'), rows: list('[label, value].'),
      words: strict('The kit\'s words, changed.', Object.fromEntries('open closed until opens in closes unknown day days'.split(' ').map((k) => [k, text(k === 'days' ? '"{n} days".' : `"${k}".`)]))) },
    map: { places: { description: '1–20 places.', anyOf: [{ type: 'array', minItems: 1, maxItems: 20, items: strict('A place.', PL, ['id', 'name']) }, ref('byLang'), { type: 'null' }] },
      image: { description: 'Your own map: { "src", "width", "height", "alt", "bounds" }, or "set:map.png" with "photos".', anyOf: [ref('text'), strict(null, { src: any('Under "links".', 'LbwText'), srcset: any('[[url, width], …].', 'Array<[string, number]> | LbwByLang'),
        width: any('Pixels.', 'number'), height: any('Pixels.', 'number'), alt: text('What it shows.'), photo: any('"set:file.png".', 'LbwText'), bounds: any('[[north, west], [south, east]].', '[[number, number], [number, number]]') })] },
      lines: { description: 'The schematic\'s lines (12 at most).', anyOf: [{ type: 'array', items: strict('A line.', { kind: words(['water', 'road', 'rail', 'park'], 'water, road, rail or park.'), pts: list('2–40 points [lat, lng].'), label: text('Its label.') }) }, ref('byLang'), { type: 'null' }] },
      from: strict('Where distances are measured from.', { name: text('Its name.'), lat: PL.lat, lng: PL.lng }),
      directions: { description: 'A directions link: ' + t.DIRECTIONS.join(', ') + ', or { "url": "https://…{q}…", "label" }.', anyOf: [{ enum: [...t.DIRECTIONS, null] }, ref('byLang'), strict(null, { url: text('With {q}, {lat}, {lng} or {address}.'), label: text('The link\'s label.') })] },
      sort: words(['distance'], '"distance" (needs "from").'), max: int('The places one tag shows, 1 to 5.', 1, 5) },
    tracker: { steps: { description: '2–8 steps in order.', anyOf: [{ type: 'array', items: strict('A step.', tstep, ['key', 'label']) }, ref('byLang'), { type: 'null' }] },
      states: { description: 'A delay at a step ("at") or an end ("end": true).', anyOf: [{ type: 'array', items: strict('A state.', tstate, ['key', 'text']) }, ref('byLang'), { type: 'null' }] },
      default: text('The step or state when the tag has none.'), param: param('The tag key of the current step ("estado").'),
      ref: strict('The order code: { "param": the tag key, "label" }.', { param: param('The tag key.'), label: text('Its label.') }, ['param']),
      eta: strict('{ "day": a tag key, "time": a tag key, "text": "Lista {when}" }.', { day: param('The tag key of the day.'), time: param('The tag key of the time.'), text: text('With {when}.') }),
      live: { description: 'The key of a data message that updates it (a lower-case word).', anyOf: [{ type: ['string', 'null'], pattern: '^[a-z][a-z0-9_]{0,39}$' }, ref('byLang')] } },
    rating: { kind: words(['thumbs', 'stars', 'scale'], 'thumbs, stars (the default) or scale.'), min: int('The lowest value of a scale.'), max: int('The highest value (stars 3–10, a scale up to min + 10).'),
      labels: list('[no, yes] for thumbs, [low end, high end] for a scale.'), bands: list('[[top value, name], …] for {band}.'),
      send: strict('{ "text": "…{value}…", "fields": { field: "{value}" } }.', { text: text('The sentence sent.'), fields: obj('Saved in Landbot.') }, ['text', 'fields']) },
    calendar: { mode: words(['range', 'single'], '"range" (check-in → check-out, the default) or "single".'),
      nights: strict('{ "min", "max" }: the shortest and the longest stay.', { min: int('Nights.', 1, 365), max: int('Nights.', 1, 365) }),
      notice: int('Days from today that can\'t be picked yet (0–365).', 0, 365), horizon: int('Days ahead that can be picked (1–730; 365).', 1, 730),
      months: { description: '1 or 2 (a second month where the card is wide).', enum: [1, 2, null] },
      rates: { description: '[{ "from", "to", "price" }]: a price per night.', anyOf: [{ type: 'array', items: strict('A rate.', { from: text('D/M/YYYY.'), to: text('D/M/YYYY.'), price: any('A plain amount (189 or "189.5").', 'number | string') }) }, ref('byLang'), { type: 'null' }] },
      days: { description: '[{ "date", "price", "state", "left" }].', anyOf: [{ type: 'array', items: strict('A day.', { date: text('D/M/YYYY.'), price: any('A plain amount.', 'number | string'), state: words(['free', 'few', 'full', 'closed'], 'free, few, full or closed.'), left: int('How many are left.', 0, 9999) }) }, ref('byLang'), { type: 'null' }] },
      closed: strict('{ "weekdays": [1], "dates": ["24/12", "1/1/2027"] } (0 = Sunday).', { weekdays: list('Weekdays, 0–6.'), dates: list('D/M or D/M/YYYY.') }),
      unlisted: words(['free', 'closed'], '"free" (a day with no data can be picked) or "closed".'), priceFrom: bool('true: the total reads "from 654 €".'),
      source: strict('Days from LBW.data: { "data", "map": { "date", "price", "state", "left" } }.', { data: any('A key of LBW.data, or { "param" }.', 'LbwText | { param: string }'),
        wait: num('ms.'), upgrade: num('ms.'), path: any('The dotted key of the list.', 'LbwText'), map: obj('{ "date": "{fecha}", … }.'), max: int('Rows read.', 1, 2000) }, ['data']),
      send: strict('{ "text", "fields" } over {from} {to} {day} {nights} {total} {price} {summary}.', { text: text('The sentence sent.'), fields: obj('Saved in Landbot.') }, ['text', 'fields']) },
    form: { steps: list('The questions: { "key", "title", "items": [[key, label]] or { "by", "map", "else" } }.'), summary: text('A template over the steps.'),
      fields: obj('{ field: template }: saved in Landbot.'), preset: obj('{ "step", "param" }: a step the tag answers.') },
    contact: { rows: list('[label, value].'), hours: obj('{ "week": { "1": [[540, 1080]] }, "holidays" } (0 = Sunday; minutes).'),
      summary: obj('{ "form", "strip", "text", "actions" }: what a form sent.'), compact: obj('{ "label", "buttons" }.') },
  };
}

// one line per type, from docs/20 ("The twenty types")
const ABOUT = {
  cards: 'Cards by id (or one "item"): a title, rows, points, a status, a photo and a price, with a reply and links.',
  table: 'A table by id (or one "item"): 2–5 columns and 1–30 rows; "pick" makes each row a button.',
  form: 'Questions one step at a time; sends a summary and saves fields.',
  contact: 'How to reach you: a title, rows, opening hours and buttons.',
  chips: 'Quick replies: [label, sentence] or { label, say, desc, fields }.',
  carousel: 'Slides, saved or read live from a CSV, JSON or LBW.data; a filter the tag drives.',
  calc: 'A calculator: state the visitor changes, formulas, a result and a sentence to send.',
  stats: 'Cards of 2–4 figures, each with where and when they were read.',
  people: 'People with a name and a role (four at most per tag).',
  consent: 'A yes/no consent with its fields.',
  slots: 'Time slots on fixed days or a weekly plan; sends the day and time.',
  confirm: 'What a form, slots or calendar widget sent, confirmed (a card or a ticket).',
  review: 'An order to review: lines, a total, send or discard.',
  chart: 'A line, area or bar chart of one or two series (two to four stacked).',
  compare: 'Two or three items side by side, by row.',
  season: 'Open or closed today, from the season\'s date ranges (needs "timeZone").',
  map: '1–5 places on a schematic or on your own image, with hours and directions.',
  tracker: 'A step timeline: the current step comes from the tag.',
  rating: 'Thumbs, stars or a scale: one tap sends and saves.',
  calendar: 'A month grid of days, free, few, full or closed, with a price per night.',
};

export function buildSchema(version, repo = 'pausanchez/lbw-kit') {
  const t = tables(), C = common(t), O = own(t);
  const $defs = { ...defs(t), ...itemDefs(t) };
  for (const ty of t.types) {
    if (!ABOUT[ty]) throw new Error(`type "${ty}": no description in scripts/schema.mjs`);
    const properties = {};
    for (const k of t.KEYS[ty]) properties[k] = k === 'type' ? { const: ty } : (O[ty] && O[ty][k]) || C[k] || any(`Checked by the config checker; see reference/types/${ty}.md.`);
    const need = (t.NEED[ty] || []).filter((k) => !(k === 'items' && properties.source));
    const s = { title: ty, description: ABOUT[ty], type: 'object', properties, required: ['type', ...need], additionalProperties: false };
    // "items" is needed, or a "source" that reads them
    if ((t.NEED[ty] || []).includes('items') && properties.source) s.anyOf = [{ required: ['items'] }, { required: ['source'] }];
    $defs[ty] = s;
  }
  $defs.widget = { description: 'A widget: its "type" says which of the twenty it is.', oneOf: t.types.map((ty) => ref(ty)) };
  const top = {
    $schema: any('This schema\'s URL (ignored by setup()).', 'LbwText'), version: any('Your own version of the config (not read).'),
    prefix: { description: 'The tags\' prefix: [[prefix:widget …]]. A plain word.', type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_]*$' },
    langs: { description: 'The languages, lower-case codes ("es", "ca"): every text may be { "es": …, "ca": … }.', type: ['array', 'null'], minItems: 1, items: { type: 'string', pattern: '^[a-z]{2,3}$' } },
    defaultLang: text('The default language (one of "langs").'), timeZone: text('The client\'s time zone, as Europe/Madrid.'),
    maxPerMessage: any('Widgets drawn per message at most (3).', 'number'), links: list('The allow-list: https origins ending in "/", "tel:", "mailto:".'),
    labels: any('Your own widgets\' words, by language.', 'Record<string, Record<string, string>>'), quietMs: any('ms of quiet before a reply is drawn.', 'number'), maxWaitMs: any('ms to wait at most.', 'number'),
    reveal: bool('false: don\'t scroll the chat to the start of a tall reply.'), motion: bool('false: no animations in this bot.'),
    photos: obj('Photo sets: { "name": { "base": "https://…/", "sizes": [["folder/", 495], …], "ratio": [4, 3] } }.', null, { names: '^[A-Za-z_][A-Za-z0-9_]*$',
      values: { type: 'object', properties: { base: { description: 'An https address ending in "/", under "links".', type: 'string' }, sizes: { description: '[[folder, width], …], smallest first.', type: 'array', minItems: 1 },
        ratio: any('[width, height], such as [4, 3].', '[number, number] | LbwByLang') }, required: ['base', 'sizes'], additionalProperties: false } }),
    actions: obj('Named actions: { name: action }.', null, { values: ref('action') }),
    replies: obj('Named replies: { name: [label, sentence] or [label, sentence, { field: value }] }.', null,
      { values: { anyOf: [{ type: 'array', minItems: 2 }, ref('byLang')], ts: PAIR_TS } }),
    widgets: { description: 'The widgets by tag name (lower-case letters, digits and _).', type: 'object', propertyNames: { pattern: '^[a-z][a-z0-9_]*$' }, additionalProperties: ref('widget') },
  };
  for (const k of t.TOP) if (!top[k]) throw new Error(`top-level key "${k}": not described in scripts/schema.mjs`);
  for (const k of Object.keys(top)) if (!t.TOP.includes(k)) throw new Error(`top-level key "${k}": not in the checker's TOP`);
  const properties = Object.fromEntries(t.TOP.map((k) => [k, top[k]]));
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://cdn.jsdelivr.net/gh/${repo}@v${version}/dist/lbw-kit.schema.json`,
    title: `lbw-kit config v${version}`,
    description: 'A bot\'s widgets for LBW.kit.setup(config). Generated from the checker (kit/setup-check.js); `npm run check:config` is the full check.',
    type: 'object', properties, required: ['prefix', 'widgets'], additionalProperties: false, $defs,
  };
}

// ── TypeScript from the schema ──────────────────────────────────────────────────────────────────
const pascal = (s) => s.replace(/(^|_)([a-z])/g, (m, a, b) => b.toUpperCase());
const TSNAME = { byLang: 'LbwByLang', text: 'LbwText', tone: 'LbwTone', icon: 'LbwIcon', toned: 'LbwToned', reply: 'LbwReply', action: 'LbwAction', links: 'LbwActions',
  money: 'LbwMoney', params: 'LbwParams', param: 'LbwParam', photo: 'LbwPhoto', pair: 'LbwLinkPair', price: 'LbwPrice', flow: 'LbwFlow', meter: 'LbwMeter', widget: 'LbwWidget' };
const tsName = (n) => TSNAME[n] || (n.startsWith('item_') ? `Lbw${pascal(n.slice(5))}Item` : `Lbw${pascal(n)}Widget`);
const lit = (v) => (v === null ? 'null' : JSON.stringify(v));
const KEY = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
function tsOf(s, ind = '') {
  if (s === true || !s) return 'unknown';
  if (s.ts) return s.ts;
  if (s.$ref) return tsName(s.$ref.split('/').pop());
  if ('const' in s) return lit(s.const);
  if (s.enum) return [...new Set(s.enum.map(lit))].join(' | ');
  if ((s.anyOf || s.oneOf) && !onlyNeeds(s)) return uniq((s.anyOf || s.oneOf).map((x) => tsOf(x, ind))).join(' | ');
  const ty = [].concat(s.type || []);
  if (!ty.length) return s.properties ? objTs(s, ind) : s.pattern ? 'string' : 'unknown';
  return uniq(ty.map((x) => x === 'object' ? objTs(s, ind) : x === 'array' ? arrTs(s, ind) : x === 'integer' ? 'number' : x)).join(' | ');
}
// an anyOf of "required" alone ("items" or "source") says which keys, not what shape: the object's type stands
const onlyNeeds = (s) => !!s.anyOf && s.anyOf.every((x) => Object.keys(x).every((k) => k === 'required'));
function uniq(a) { const out = []; a.forEach((x) => { if (!out.includes(x)) out.push(x); }); return out.includes('unknown') ? ['unknown'] : out; }
function arrTs(s, ind) { const i = s.items ? tsOf(s.items, ind) : 'unknown'; return /[ |]/.test(i) ? `Array<${i}>` : `${i}[]`; }
function objTs(s, ind) {
  const props = s.properties || {}, req = s.required || [], extra = s.additionalProperties;
  const rows = Object.entries(props).map(([k, v]) => `${ind}  ${doc(v, ind + '  ')}${KEY(k)}${req.includes(k) ? '' : '?'}: ${tsOf(v, ind + '  ')};`);
  if (extra !== false) rows.push(`${ind}  [key: string]: ${extra && extra !== true ? tsOf(extra, ind + '  ') : 'unknown'};`);
  return `{\n${rows.join('\n')}\n${ind}}`;
}
function doc(s, ind) { return s && s.description ? `/** ${s.description.replace(/\*\//g, '*\\/')} */\n${ind}` : ''; }

export function buildDts(schema) {
  const D = schema.$defs, out = [];
  out.push(`// types/lbw-kit.config.d.ts · GENERATED by scripts/schema.mjs from the checker's tables (kit/setup-check.js). Don't edit:`);
  out.push(`// run \`node scripts/schema.mjs\` (or \`npm run build\`). ${schema.title}. A text may be by language ({ "en": …, "es": … }).`);
  out.push('');
  for (const [n, s] of Object.entries(D)) {
    if (n === 'widget') continue;
    const name = tsName(n), body = tsOf(s, '');
    out.push(doc(s, '') + (s.type === 'object' && (!s.anyOf || onlyNeeds(s)) && !s.oneOf && !s.ts ? `export interface ${name} ${body}` : `export type ${name} = ${body};`));
    out.push('');
  }
  out.push(`/** ${D.widget.description} */`);
  out.push(`export type LbwWidget =\n${D.widget.oneOf.map((r) => '  | ' + tsName(r.$ref.split('/').pop())).join('\n')};`);
  out.push('');
  out.push(`/** The widget types setup() knows. */`);
  out.push(`export type LbwWidgetType = LbwWidget['type'];`);
  out.push('');
  out.push(`/** ${schema.description} */`);
  out.push(`export interface LbwConfig ${objTs({ ...schema, properties: schema.properties }, '')}`);
  out.push('');
  return out.join('\n');
}

// the JSON (keys in a fixed order, `ts` hints left out) and the .d.ts
export function generate() {
  const pkg = JSON.parse(read('package.json'));
  const repo = typeof pkg.repository === 'string' ? pkg.repository.replace(/^github:/, '') : 'pausanchez/lbw-kit';
  const schema = buildSchema(pkg.version, repo);
  const json = JSON.stringify(schema, (k, v) => (k === 'ts' && typeof v === 'string' ? undefined : v), 2) + '\n';
  return { schema: JSON.parse(json), json, dts: buildDts(schema) };
}

// ── a validator for the subset of JSON Schema this file writes (for the tests and for agents) ──────
// → [{ path, message }]; empty when the value is valid
export function validate(schema, value) {
  const errs = [], root = schema;
  const typeOk = (t, v) => t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v)
    : t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' && isFinite(v) : typeof v === t;
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function go(s, v, at, out) {
    if (s === true || s == null) return; if (s === false) { out.push({ path: at, message: 'is not allowed' }); return; }
    if (s.$ref) { const n = s.$ref.replace(/^#\/\$defs\//, ''); if (!root.$defs[n]) throw new Error('no $def ' + n); go(root.$defs[n], v, at, out); }
    if (s.type && ![].concat(s.type).some((t) => typeOk(t, v))) { out.push({ path: at, message: `must be ${[].concat(s.type).join(' or ')}` }); return; }
    if ('const' in s && !eq(s.const, v)) out.push({ path: at, message: `must be ${JSON.stringify(s.const)}` });
    if (s.enum && !s.enum.some((e) => eq(e, v))) out.push({ path: at, message: `must be one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')}` });
    if (typeof v === 'string' && s.pattern && !new RegExp(s.pattern, 'u').test(v)) out.push({ path: at, message: `must match ${s.pattern}` });
    if (typeof v === 'number') { if (s.minimum != null && v < s.minimum) out.push({ path: at, message: `must be ${s.minimum} or more` }); if (s.maximum != null && v > s.maximum) out.push({ path: at, message: `must be ${s.maximum} or less` }); }
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) out.push({ path: at, message: `needs ${s.minItems} items at least` });
      if (s.maxItems != null && v.length > s.maxItems) out.push({ path: at, message: `holds ${s.maxItems} items at most` });
      if (s.items) v.forEach((x, i) => go(s.items, x, `${at}[${i}]`, out));
    }
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const ks = Object.keys(v);
      (s.required || []).forEach((k) => { if (!ks.includes(k)) out.push({ path: at, message: `needs "${k}"` }); });
      if (s.minProperties != null && ks.length < s.minProperties) out.push({ path: at, message: `needs ${s.minProperties} keys at least` });
      ks.forEach((k) => {
        const p = at ? `${at}.${k}` : k;
        if (s.propertyNames) go(s.propertyNames, k, p, out);
        if (s.properties && Object.prototype.hasOwnProperty.call(s.properties, k)) go(s.properties[k], v[k], p, out);
        else if (s.additionalProperties === false) out.push({ path: p, message: 'is not a known key' });
        else if (s.additionalProperties && s.additionalProperties !== true) go(s.additionalProperties, v[k], p, out);
      });
    }
    const some = (list) => list.map((x) => { const o = []; go(x, v, at, o); return o; });
    if (s.anyOf) { const r = some(s.anyOf); if (!r.some((o) => !o.length)) out.push(...best(r, at)); }
    if (s.oneOf) {
      const r = some(s.oneOf), n = r.filter((o) => !o.length).length;
      if (n === 0) out.push(...best(r, at)); else if (n > 1) out.push({ path: at, message: 'matches more than one of oneOf' });
    }
  }
  // of the alternatives that failed, the errors of the one that got furthest (fewest errors at the value itself)
  function best(r, at) { const s = [...r].sort((a, b) => a.filter((e) => e.path === at).length - b.filter((e) => e.path === at).length || a.length - b.length)[0]; return s.length ? s : [{ path: at, message: 'matches none of the alternatives' }]; }
  go(schema, value, '', errs);
  return errs;
}

// how many keys only describe their value (no type, enum or shape): for the release notes
export function permissive(schema) {
  let n = 0; const seen = [];
  const walk = (s, at) => { if (!s || typeof s !== 'object') return; if (s.properties) Object.entries(s.properties).forEach(([k, v]) => {
    if (v && !v.$ref && !v.type && !v.enum && !v.anyOf && !v.oneOf && !('const' in v) && !v.pattern) { n++; seen.push(`${at}.${k}`); } walk(v, `${at}.${k}`); });
    ['anyOf', 'oneOf'].forEach((x) => (s[x] || []).forEach((y) => walk(y, at))); if (s.items) walk(s.items, at + '[]'); if (s.additionalProperties && typeof s.additionalProperties === 'object') walk(s.additionalProperties, at + '.*'); };
  walk(schema, ''); Object.entries(schema.$defs).forEach(([k, v]) => walk(v, k));
  return { count: n, keys: seen };
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === fs.realpathSync(process.argv[1]);
if (isMain) {
  const { json, dts, schema } = generate(), check = process.argv.includes('--check');
  const files = [['dist/lbw-kit.schema.json', json], ['types/lbw-kit.config.d.ts', dts]];
  let stale = 0;
  for (const [f, body] of files) {
    const url = new URL(f, root), now = fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : null;
    if (now === body) continue; stale++;
    if (check) console.error(`${f}: not what the checker's tables give (run node scripts/schema.mjs)`);
    else { fs.mkdirSync(new URL('.', url), { recursive: true }); fs.writeFileSync(url, body); console.log(`${f} written`); }
  }
  if (process.argv.includes('--stats')) { const p = permissive(schema); console.log(`${(json.length / 1024).toFixed(1)} KB, ${Object.keys(schema.$defs).length} defs, ${p.count} keys only described`); }
  if (check && stale) process.exit(1);
  if (check) console.log('schema and config types up to date');
}
