// Types for lbw-kit: the global `LBW` (runtime/lbw.js), `LBW.kit` (kit/kit.js) and `LBW.kit.setup` (kit/setup.js).
// Written by hand from the source and the runtime documentation.
// The config type is generated: ./lbw-kit.config.d.ts. Members marked @experimental are in the source but not in the docs.
import type { LbwConfig } from './lbw-kit.config';

export type { LbwConfig, LbwWidget } from './lbw-kit.config';

/** A day as a UTC day number (whole days since 1970-01-01): no time zone, plain arithmetic. */
export type DayNumber = number;
/** Minutes since midnight. */
export type Minutes = number;
/** Fields written to Landbot (custom_data) with a message. */
export type Fields = Record<string, string>;

export interface InitOptions {
  /** Tag namespace: `[[np:…]]`. */
  prefix?: string;
  /** Languages the widgets speak. */
  langs?: string[];
  /** Language used when a tag's `lang` is not in `langs`. */
  defaultLang?: string;
  /** Your strings per language; a widget gets the right set as `ctx.L`. */
  labels?: Record<string, Record<string, any>>;
  /** Origins links and images may use (each read as ending in '/'); 'tel:' and 'mailto:' allow those schemes. */
  links?: string[];
  /** Widgets per bot message; extra ones are dropped. */
  maxPerMessage?: number;
  /** Quick replies wait this long after the chat goes quiet. */
  quietMs?: number;
  /** Longest wait before a quick reply is sent. */
  maxWaitMs?: number;
  /** Where the client is (IANA name): `LBW.day.today()` uses it. */
  timeZone?: string;
  /** v0.10: false turns every animation off. */
  motion?: boolean;
  /** @experimental Read by the runtime (`cfg.reveal`) but not documented yet. */
  reveal?: unknown;
}

/** The parameters of a tag; every value is untrusted. */
export interface Params {
  /** `false` when missing, empty, `@{field}` or `@word` left as is, or `Visitor #n`. */
  has(k: string): boolean;
  /** The first value that is in `allowed`, or `null` (unknown values are logged). */
  one<T extends string>(k: string, allowed: readonly T[]): T | null;
  /** Known values only, each once, in order (splits on `, + ; | &` and spaces; unknown values are logged). */
  list<T extends string>(k: string, allowed: readonly T[], max?: number): T[];
  /** A number in range; missing, unreadable or `< lo` gives `dflt`; `> hi` gives `hi` (or `dflt` with `reject`); `int` refuses non-integers. */
  num(k: string, lo: number, hi: number, dflt: number, opts?: { int?: boolean; reject?: boolean }): number;
  /** Free text with `<>[]{}` removed, trimmed to `max` (default 80); show it with `textContent` only. */
  text(k: string, max?: number): string;
  /** A whole day as a UTC day number from `D/M/YYYY`, `YYYY-MM-DD` or `YYYYMMDD`; `null` when it isn't a real day. */
  day(k: string): DayNumber | null;
  /** A `Date` from `D/M/YYYY` or `YYYYMMDD` (years 20xx), or `null`; prefer `day`. */
  date(k: string): Date | null;
  /** The raw strings, if you must. */
  raw: Record<string, string>;
}

/** What a widget's render function is told about its tag. */
export interface Ctx {
  /** The tag's `lang` if it's in `langs`, else `defaultLang`. */
  lang: string;
  /** `labels[lang]`. */
  L: Record<string, any>;
  /** The tag as written. */
  tag: string;
  /** The bot message element. */
  message: HTMLElement;
  /** The visitor's last message before this one, lowercased. */
  prev: string;
  /** The widget names of every tag in this message, including the ones after this one. */
  tags: string[];
  /** The widgets already drawn from this message, before this one. */
  others: HTMLElement[];
}

export interface WidgetOptions {
  /** Drawn after the other widgets of the same message. */
  last?: boolean;
  /** For a tag a flow message writes with field values in it: true, or the only keys it may take. */
  flow?: boolean | string[];
}

export type WidgetRender = (p: Params, ctx: Ctx) => HTMLElement | null;

/** The outer `.lbw` element of a card; the white box inside is `.box`. */
export interface Card extends HTMLElement { box: HTMLElement }

export interface ReplyOptions {
  /** Fields written with the message. */
  fields?: Fields;
  /** Draws the primary look. */
  primary?: boolean;
  /** Extra class(es). */
  cls?: string;
  /** Called once the message is out. */
  onSent?: () => void;
}

export interface ImgOptions {
  /** `[[url, width], …]`; every URL must be allowed. */
  srcset?: Array<[string, number]>;
  sizes?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface FormOptions<S extends Record<string, any>> {
  /** The values the controls change. */
  state?: S;
  /** The CTA's label. */
  cta: string;
  /** `true` enables the CTA; a string is its label while it can't send. */
  ready?: (state: S) => true | false | string | null;
  /** Runs on every `update()`. */
  change?: (state: S) => void;
  /** Returns `[text, fields]`, sent together once. */
  send: (state: S) => [string, Fields?] | null | undefined | false | [];
  /** Called once sent. */
  sent?: (state: S) => void;
}

export interface FormHandle<S extends Record<string, any>> {
  /** The one-shot group element (`.lbw-once.lbw-form`). */
  el: HTMLElement;
  state: S;
  /** The CTA button. */
  cta: HTMLButtonElement;
  /** Inserts a control before the CTA. */
  add<T extends Node>(node: T): T;
  /** Re-runs `ready` and `change`. */
  update(): void;
}

export interface StepperOptions {
  /** Default 0. */
  min?: number;
  /** Default 20. */
  max?: number;
  /** Default 1. */
  step?: number;
  /** What the counter shows. */
  format?: (v: number) => string;
  hint?: string;
  /** The minus button's aria-label. */
  less?: string;
  /** The plus button's aria-label. */
  more?: string;
  change?: (v: number) => void;
}

export interface Stepper extends HTMLElement {
  /** The current number. */
  value: number;
  /** Moves the value (for preset chips). */
  set(v: number): void;
}

export interface CalEvent {
  title: string;
  /** Day number; all-day when `from`/`to` are missing. */
  day: DayNumber;
  /** Last day (included) of an all-day event. */
  end?: DayNumber;
  from?: Minutes;
  to?: Minutes;
  where?: string;
  url?: string;
  tz?: string;
  /** File name (without `.ics`) for `ui.ics`. */
  file?: string;
}

export interface Ui {
  /** Any element with the class(es) you give; text via `textContent`. */
  el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, text?: string | null): HTMLElementTagNameMap[K];
  /** A card: `.lbw` with the white `.lbw-box` inside (`.box`); give it your own `cls`. */
  card(lang: string, cls?: string): Card;
  /** `.lbw-head` with a kicker, a title and an optional element on the right. */
  head(box: HTMLElement, kicker: string, title: string, aside?: HTMLElement | null): void;
  /** Label/value rows (`<dl class="lbw-rows">`); empty values are skipped. */
  rows(box: HTMLElement, pairs: Array<[string, string | null | undefined]>): void;
  /** A `.lbw-actions` row of pills/buttons under `parent` (`null` items are skipped). */
  row(parent: HTMLElement, items: Array<HTMLElement | null>, cls?: string): HTMLElement;
  /** A pill link, or `null` (logged) if `href` isn't allowed by `links`. */
  link(text: string, href: string, cls?: string): HTMLAnchorElement | null;
  /** A Call pill from a number as people write it; `cc` makes it international. Needs 'tel:' in `links`. */
  tel(text: string, phone: string, cls?: string, cc?: string): HTMLAnchorElement | null;
  /** An image frame that hides itself if the image fails or isn't allowed. */
  img(src: string, cls?: string, opts?: ImgOptions): HTMLElement;
  /** A card with a skeleton for an async widget; `shape` follows `cls` when unset. */
  loading(lang: string, cls?: string, shape?: 'card' | 'carousel' | 'table'): Card;
  /** A `<button type=button>` with only your class. */
  btn(text: string, cls?: string): HTMLButtonElement;
  /** A quick reply: on click posts `text` as the visitor (and writes `fields`). */
  reply(label: string, text: string, opts?: ReplyOptions): HTMLButtonElement;
  /** A one-shot group: after one reply in it, or once the visitor writes again, its buttons disable. */
  once(cls?: string): HTMLElement;
  /** A multi-select with a CTA; `send(keys)` returns `[text, fields]`. */
  multi(items: Array<[string, string]>, ctaLabel: string, send: (keys: string[]) => [string, Fields?], pre?: string[], label?: string): HTMLElement;
  /** Disables a group yourself. */
  done(group: HTMLElement): void;
  /** A form that sends once: the text and the fields go out together. */
  form<S extends Record<string, any>>(cls: string, opts: FormOptions<S>): FormHandle<S>;
  /** A − n + counter in `[min, max]`. */
  stepper(label: string, value: number, opts?: StepperOptions): Stepper;
  /** A button that downloads `event` as an `.ics` file. */
  ics(label: string, event: CalEvent, cls?: string): HTMLButtonElement;
  /** A check that draws itself (v0.10). */
  check(): HTMLElement;
  /** Adds the receipt ("Sent · 21:04") to a finished widget (v0.10); the runtime calls it itself. */
  receipt(widget: HTMLElement, after?: HTMLElement | null): HTMLElement | null;
  /** @experimental In the source's `LBW.ui`, not in the docs: tells whether a URL is allowed by `links`. */
  allowed(url: string, links?: string[]): boolean;
  /** @experimental In the source's `LBW.ui` (v0.9.5), not in the docs: says a card's title in the live region. */
  announceCard(widget: HTMLElement): boolean;
  /** @experimental In the source's `LBW.ui` (v0.9.5), not in the docs. */
  titleOf(widget: HTMLElement): string;
  /** @experimental In the source's `LBW.ui` (v0.9.5), not in the docs. */
  rescue(...args: any[]): any;
}

export interface DayApi {
  /** Today where the client is (`tz`, or `init`'s `timeZone`). */
  today(tz?: string): DayNumber;
  /** `D/M/YYYY`, `YYYY-MM-DD` or `YYYYMMDD` to a day number, or `null`. */
  read(s: string): DayNumber | null;
  /** A day number from year, month, day. */
  num(y: number, m: number, d: number): DayNumber;
  /** `{ y, m, d, w }` of a day number (`w`: 0 = Sunday). */
  parts(n: DayNumber): { y: number; m: number; d: number; w: number };
  /** `toLocaleDateString` in UTC. */
  format(n: DayNumber, lang: string, opts?: Intl.DateTimeFormatOptions): string;
  /** `'21/11/2026'`, the form to send and to store in a field. */
  str(n: DayNumber): string;
  /** Easter Sunday of year `y`. */
  easter(y: number): DayNumber;
  /** Which of its weekday in the month `n` is (1 for a first Sunday). */
  nth(n: DayNumber): number;
  /** The first day from `n` (included) where `test` is true, within `max` days (400), or `null`. */
  next(n: DayNumber, test: (day: DayNumber) => boolean, max?: number): DayNumber | null;
  /** A test for a list of days: `D/M` entries match every year, `D/M/YYYY` only that one. */
  on(list: string[]): (day: DayNumber) => boolean;
}

export type TimeRanges = Array<[Minutes, Minutes]>;

export interface TimeApi {
  /** Minutes since midnight where the client is. */
  now(tz?: string): Minutes;
  /** `'10:30'`, `'10.30'`, `'10h30'`, `'1030'`, `'10'` to minutes; `null` otherwise. */
  read(s: string): Minutes | null;
  /** Minutes to `'10:30'`; `sep` `'.'` for Catalan; `h12` for `'10:30 am'`. */
  format(m: Minutes, sep?: string, opts?: { h12?: boolean }): string;
  /** Open now (`until`) or not (`next` opening later today, or `null`). */
  state(ranges: TimeRanges, m: Minutes): { open: true; until: Minutes } | { open: false; next: Minutes | null };
  /** The next opening within `max` days (14), `now: true` when open now, or `null`. */
  nextOpen(hoursOf: (day: DayNumber) => TimeRanges, n: DayNumber, m: Minutes, max?: number): { n: DayNumber; m: Minutes; now?: true } | null;
}

export interface CalApi {
  /** Google Calendar's "add event" URL. */
  google(event: CalEvent): string;
  /** The `.ics` text. */
  ics(event: CalEvent): string;
}

export interface DataApi {
  /** Keeps a copy of `x` (object, list, JSON text or Python repr); `true`, or `false` and a line in `__lbwDropped`. */
  put(key: string, x: unknown): boolean;
  /** The copy, or `undefined`. */
  get<T = any>(key: string): T | undefined;
  /** A Promise of the copy; rejected when the `put` was unreadable or after `ms` (1500). */
  wait<T = any>(key: string, ms?: number): Promise<T>;
  /** Forgets it. */
  clear(key: string): void;
}

export interface FetchOptions {
  /** Refresh after this many ms (default 60 000). */
  maxAge?: number;
}

export type CsvRow = Record<string, string>;

export interface RenderEvent { widget: string; tag: string; lang: string; el: HTMLElement; message: HTMLElement }
export interface SayEvent { text: string; fields?: Fields }

export interface KitSetupResult {
  ok: boolean;
  errors: string[];
  widgets: string[];
}

export interface KitSetup {
  /** Registers the widgets of a JSON config (calls `LBW.init` itself: don't call it too). */
  (config: LbwConfig): KitSetupResult;
  /** Checks a config; returns the error messages (empty when fine). Absent from the bundle a live bot loads. */
  check(config: LbwConfig): string[];
  /** The JSON widget types (the names of the makers). */
  types: string[];
}

export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral';

export interface KitHelpers {
  /** `true` when a widget with class `cls` is already drawn in this message: return `null` then. */
  dup(ctx: Ctx, cls: string): boolean;
  /** A `.kit-q` block with one toggle per `[key, label, desc?]`; one at a time; not appended: `form.add()` it. */
  choice(title: string | null, items: Array<[string, string, string?]>, cur: string | null, pick: (key: string) => void): HTMLElement;
  /** The same, any number: `pick(keys)`; the `none` key clears the others. */
  multiChoice(title: string | null, items: Array<[string, string, string?]>, cur: string[], pick: (keys: string[]) => void, none?: string): HTMLElement;
  /** Appends `<p class="kit-note">`; `null` without text. */
  note(box: HTMLElement, text: string, cls?: 'is-muted' | 'is-safe' | string): HTMLElement | null;
  /** Appends a list of strings: `'is-check'`, `'is-dot'` or `'is-steps'`. */
  list(box: HTMLElement, items: string[], cls?: 'is-check' | 'is-dot' | 'is-steps' | string): HTMLElement;
  /** The label of `key` in `[[key, label], …]`, or `''`. */
  label(pairs: Array<[string, string]>, key: string): string;
  /** `'{k}'` becomes `values.k` (`''` when missing). */
  fill(template: string, values: Record<string, unknown>): string;
  /** Appends the status line cards use (`.kit-statusbar.is-<tone>`). */
  statusHead(box: HTMLElement, opts: { text: string; tone?: Tone }): HTMLElement | null;
  /** A `.kit-tag.is-<tone>` label (`neutral` by default); `null` without text. */
  badge(text: string, tone?: Tone): HTMLElement | null;
  /** An inline SVG icon (names in `icons`). */
  icon(name: string, cls?: string): HTMLElement;
  /** The node with an icon in front (`null` passes through). */
  withIcon<T extends HTMLElement | null>(node: T, name: string): T;
  /** The icon names. */
  icons: string[];
  /** The tones `statusHead` and `badge` take. */
  tones: Tone[];
  /** Formats integer cents: `money(24700, { cur: '€', th: '.', dec: ',', after: true })` is `'247,00 €'`. */
  money(cents: number, opts?: { cur?: string; th?: string; dec?: string; after?: boolean; cents?: boolean; nb?: boolean; space?: string }): string;
  /** Appends a bold label/value line (`cls`: `'is-due'`). */
  total(box: HTMLElement, label: string, value: string, cls?: string): HTMLElement;
  /** Appends a read-only textarea; you place the Copy button and its message. */
  copyBox(box: HTMLElement, text: string, lang: string, opts?: { rows?: number; aria?: string; copy?: string }): { ta: HTMLTextAreaElement; btn: HTMLButtonElement; msg: HTMLElement };
  /** Open now from `hours = { week, holiday, open, closed, sep, h12 }`. */
  status(hours: Record<string, any>, lang: string): { open: boolean; text: string; node: HTMLElement; now: unknown };
  /** A WhatsApp link with prefilled text (`'https://wa.me/'` must be in `links`). */
  wa(label: string, phone: string, text: string, cls?: string): HTMLAnchorElement | null;
  /** The `chart` maker's SVG on its own. */
  chart(box: HTMLElement, spec: Record<string, any>): HTMLElement | null;
  /** The carousel's in-chat photo viewer. */
  lightbox(g: { photos: Array<{ src: string; srcset?: unknown; alt?: string }>; title?: string; lang?: string; page?: number }, start: number, opener?: HTMLElement): void;
  /** `true` once the visitor pressed something in the widget. */
  usedByVisitor(o: HTMLElement): boolean;
  /** For a widget that must go quiet when the visitor moves on. */
  wasQuieted(o: HTMLElement): boolean;
  /** For a widget that must go quiet when the visitor moves on. */
  quietAgain(o: HTMLElement): void;
  /** v0.9.5: notes what had focus before a redraw; the returned function puts it on the twin after. */
  keepPlace(o: HTMLElement): () => void;
  /** v0.9.5: says "Actualizado: …" once. */
  upgraded(o: HTMLElement, lang: string): void;
  /** v0.10: redraws a card in place from new data; returns how many values changed. */
  liveSwap(o: HTMLElement, swap: () => void, lang: string): number;
  /** v0.10: the "● Live" chip beside the title; `null` when the card's own badge already says it. */
  live(o: HTMLElement, lang: string): HTMLElement | null;
  /** v0.10: counts a node from `from` to `to` for at most 400 ms; `false` when it doesn't move. */
  tick(node: HTMLElement, from: number, to: number): boolean;
  /** v0.10: a soft highlight that fades; `false` in a hidden tab. */
  flash(node: HTMLElement): boolean;
  /** v0.10: a `role="meter"` bar in `cell`; returns the state or `null` without a capacity. */
  meter(row: HTMLElement, cell: HTMLElement, spec: { of?: number; low?: number; n?: number; full?: number }, value: number, lang: string): string | null;
  /** v0.10: `true` in a visible tab without reduced motion (`LBW.motion()` also reads `"motion": false`). */
  moving(): boolean;
  /** @experimental In the source's `LBW.kit.h`, not in the docs. */
  radioGroup(...args: any[]): any;
}

export interface Kit {
  /** The library's version. */
  version: string;
  /** Dev mode (`?kitdev=1` or `window.__kitDev`). */
  dev: boolean;
  /** Lists every kit widget registered: `tags` for the instructions, `cases` for the mock. */
  describe(prefix?: string): { tags: unknown; cases: unknown };
  /** The kit's own texts per language; add a language with `LBW.kit.L.pt = {…}`. */
  L: Record<string, Record<string, any>>;
  /** What a kit form last sent, by form name. */
  last: Record<string, any>;
  /** JSON from config to widgets. */
  setup: KitSetup;
  /** The helpers for widgets you write yourself. */
  h: KitHelpers;
  /** @experimental The makers (`cards`, `table`, `form`, `contact`, `chips`, `carousel`, `calc`, `slots`, `confirm`, `review`, `chart`, `stats`, `people`, `consent`, `compare`, `season`, `rating`, `calendar`, `map`, `tracker`): their options are and the generated config type, not here. */
  cards: KitMaker; table: KitMaker; form: KitMaker; contact: KitMaker; chips: KitMaker; carousel: KitMaker; calc: KitMaker; slots: KitMaker;
  confirm: KitMaker; review: KitMaker; chart: KitMaker; stats: KitMaker; people: KitMaker; consent: KitMaker; compare: KitMaker; season: KitMaker;
  rating: KitMaker; calendar: KitMaker; map: KitMaker; tracker: KitMaker;
}

/** @experimental A kit maker: registers a widget from an options object. */
export type KitMaker = (cfg: any, ...rest: any[]) => any;

/** Screen mode (runtime/screen.js): the current screen, or `null` while there is none or screen mode is off. */
export interface ScreenState {
  /** The current step's id (from the tag's `step=`, else the widget's `"step"`, else the last one), or `null`. */
  step: string | null;
  /** Its place in `screen.header.steps` (0-based), or -1. */
  index: number;
  /** The steps the visitor completed (was on, then moved forward from), in the steps' order. */
  done: string[];
  /** How many steps there are. */
  of: number;
  /** The tag name of the screen's last widget (the one the bar follows). */
  widget: string | null;
  /** Every widget of the screen's message, in order. */
  widgets: string[];
  /** `true` while the earlier messages are shown ("View conversation"). */
  open: boolean;
  /** How many earlier messages are folded. */
  past: number;
}

/** Screen mode: the chat as an app, one screen at a time. `LBW.kit.setup` starts it from the config's `"screen"`. */
export interface ScreenApi {
  /** Turns it on by hand (no kit config): `true` when on. A wrong config, or a chat whose DOM isn't the expected one, stays a normal chat. */
  start(config: NonNullable<LbwConfig['screen']>, opts?: { lang?: string; widgets?: Record<string, { screen?: boolean; step?: string }> }): boolean;
  /** The current screen. */
  state(): ScreenState | null;
  /** Shows (`true`) or folds again (`false`) the earlier messages; returns the new state, or `false` when off. */
  history(open: boolean): boolean;
}

export interface Api {
  /** The library's version, the same as package.json. */
  readonly version: string;
  /** `true` once `init` ran and the first scan is done. */
  ready: boolean;
  /** Sets the options and starts watching the chat. Don't call it with `LBW.kit.setup`. */
  init(options: InitOptions): Api;
  /** Registers a widget; `render(p, ctx)` returns an element or `null`. */
  widget(name: string, render: WidgetRender, opts?: WidgetOptions): Api;
  /** Listens to `'render'`, `'say'`, `'drop'`, `'unsent'` or `'ready'`. */
  on(name: 'render', fn: (e: RenderEvent) => void): Api;
  on(name: 'say' | 'unsent', fn: (e: SayEvent) => void): Api;
  on(name: 'drop', fn: (reason: unknown) => void): Api;
  on(name: 'ready', fn: (e: { version: string }) => void): Api;
  /** @experimental `'data'` is emitted when a flow's data message arrives (v0.9.5); the payload is only in a source comment. */
  on(name: 'data', fn: (e: { key: string; via: 'event' | 'dom'; ok: boolean; length: number; at: number }) => void): Api;
  /** The UI kit: text only, links checked. */
  ui: Ui;
  /** Posts `text` as the visitor, with `fields` as custom_data; queued until the chat is quiet. Returns `true` if accepted. */
  say(text: string, fields?: Fields): boolean;
  /** Queues fields without sending; they are only saved with the next message. */
  store(fields: Fields): unknown;
  /** Call at the top level of an inline Custom JS script (`this` is the v4 widget); true if it took a widget. */
  landbot(widget: unknown): boolean;
  /** When `promise` resolves, removes the skeleton and calls `fill(data)`; `fill` returning `false` removes the widget. Returns `o`. */
  later<T, E extends HTMLElement>(o: E, promise: Promise<T>, fill: (data: T) => false | void | unknown, fallback?: (error: unknown) => void): E;
  /** Fetches a CSV once per page view and answers rows keyed by the lower-cased header. */
  csv(url: string, opts?: FetchOptions): Promise<CsvRow[]>;
  /** The CSV parser alone (RFC 4180). */
  parseCSV(text: string): string[][];
  /** v0.7.6: fetches a JSON endpoint (CORS), cached like `csv`. */
  json<T = any>(url: string, opts?: FetchOptions): Promise<T>;
  /** v0.4: fetches one of the client's own HTML pages as an inert Document; the URL must be in `links`. */
  page(url: string, opts?: FetchOptions): Promise<Document>;
  /** Dates as UTC day numbers. */
  day: DayApi;
  /** Minutes since midnight. */
  time: TimeApi;
  /** Calendar links. */
  cal: CalApi;
  /** Data handed by the flow. */
  data: DataApi;
  /** `true` while animations may run (v0.10). */
  motion(): boolean;
  /** Says one short line in the chat's polite live region (v0.9.5). */
  announce(text: string, lang: string, key?: string): unknown;
  /** Screen mode (runtime/screen.js): inert until a config's `"screen": { "on": true }` or `start()`. */
  screen: ScreenApi;
  /** The kit. Present only when `kit/kit.js` is loaded. */
  kit: Kit;
  /** @experimental In the source's `LBW`, not in the docs: logs to `window.__lbwDropped`. */
  drop(what: string): void;
  /** @experimental In the source's `LBW`, not in the docs. */
  missing(v: unknown): boolean;
  /** @experimental In the source's `LBW`, not in the docs. */
  parse(...args: any[]): any;
  /** @experimental In the source's `LBW`, not in the docs: scans the chat for tags now. */
  scan(...args: any[]): void;
}

declare global {
  interface Window {
    LBW: Api;
    /** Everything thrown away, with the reason. */
    __lbwDropped?: unknown[];
    /** Every message posted by a widget, when it is actually sent. */
    __lbwSent?: unknown[];
    /** Every field write. */
    __lbwStored?: unknown[];
    /** The config's errors from `setup()`. */
    __kitSetupErrors?: string[];
    /** Dev mode's warnings (`?kitdev=1`). */
    __kitWarnings?: string[];
    /** Set in tests: pins today (`'D/M/YYYY'`). */
    __lbwToday?: string;
    /** Set in tests: pins the time (`'HH:MM'`). */
    __lbwNow?: string;
    /** Set before the kit: turns dev mode on. */
    __kitDev?: boolean;
  }
  /** AI Widgets for the Landbot v4 web chat. */
  const LBW: Api;
}
