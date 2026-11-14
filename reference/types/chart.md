# `chart`

A line, area or bar chart of one or two series (two to four stacked).

<!-- prose -->
## When to use

- Show how something changes over a range: sales by month, a price by season, a forecast.
- One or two series as line, area or bars; two to four stacked as bars.
- Say what is plotted and its unit once, in `sub`, and where the numbers come from in `note`.

## Gotchas

- `title`, `x` and `series` are required.
- `x` is a list of labels or `{ "from", "to", "step", "label" }`; a series is `{ "label", "values": [...] }` or `{ "label", "value": a formula of i }`.
- Stacking (`"stack": true`) needs `"kind": "bar"` and 2 to 4 series.
- `height` is 100 to 400; `mark.at` puts a labelled marker on one point.
- The values are what the config says: do not use a chart for figures nobody measured.
<!-- /prose -->

## Minimal example

The smallest `chart` in the public example configs: `salidas` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:salidas]]`

```json
{
  "type": "chart",
  "kicker": "Datos de ejemplo",
  "title": "Alquileres por mes",
  "sub": "Alquileres",
  "note": "Cifras ficticias para la galería.",
  "kind": "bar",
  "stack": true,
  "x": ["Jun", "Jul", "Ago", "Sep", "Oct"],
  "series": [
    { "label": "Urbana", "values": [120, 180, 210, 140, 80] },
    { "label": "Eléctrica", "values": [60, 110, 150, 90, 40] },
    { "label": "Montaña", "values": [40, 50, 45, 60, 55] }
  ],
  "y": { "ticks": 4 },
  "summary": "Agosto es el mes con más alquileres"
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"chart"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The title. |
| `sub` |  | text | A subtitle. |
| `note` |  | text | A note at the end. |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `kind` |  | `"line"`, `"area"`, `"bar"` (or by language) | line, area or bar. |
| `stack` |  | boolean | true: bars piled per point (2–4 series). |
| `height` |  | number 100–400 | The height, 100 to 400. |
| `state` |  | object | The values the visitor changes: { key: { "min", "max", "default" } or { "values", "default" } }. |
| `tables` |  | object | Lookup tables of numbers: { name: { key: number } }. |
| `compute` |  | object | Formulas, in order: { name: "formula" }. |
| `money` |  | object | How {x:money} is written. |
| `x` | yes |  | A list of labels, or { "from", "to", "step", "label" }. |
| `series` | yes | list (or by language) | One or two series (2–4 stacked): { "label", "value": a formula of i } or { "label", "values": numbers }. |
| `y` |  | object | { "ticks", "suffix" }. |
| `mark` |  | object | { "at": a point of x (or a formula), "label" }. |
| `summary` |  | text | A template: the chart in one sentence. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `salidas: unknown option "kciker" for chart. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `salidas: unknown option "colour" for chart. Known: …` |
| Leave out `title` | `salidas: missing "title"` |
| Leave out `x` | `salidas: missing "x"` |
| Give `kind` a value it does not have, `"nope"` | `salidas: "kind" is line, area or bar` |
