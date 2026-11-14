# `compare`

Two or three items side by side, by row.

<!-- prose -->
## When to use

- Two or three things side by side over the same rows: bikes, plans, rooms.
- The tag picks which (`ids=urbana,ebike`); `best` marks the one you recommend.
- A cell may be text, or true and false for a tick and a cross.

## Gotchas

- `rows` is required, and the checker needs `items` with at least two columns, each with a `name` and `values` by row key.
- The tag names the columns: `ids=a,b` or `ids=a,b,c` (`min` and `max` are 2 or 3).
- A row is `[key, label]`, `[key, label, class]` or `[key, label, class, unit]`.
- `"same": "fold"` lists the rows where every column agrees in one line; the default `"mute"` draws them quieter.
- Values are text: format money yourself.
<!-- /prose -->

## Minimal example

The smallest `compare` in the public example configs: `vs` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:vs ids=urbana,ebike]]`

```json
{
  "type": "compare",
  "kicker": "Comparar",
  "titles": { "2": "Dos bicis frente a frente", "3": "Tres bicis frente a frente" },
  "rows": [
    ["peso", "Peso", "", "kg"],
    ["autonomia", "Autonomía", "", "km"],
    ["cesta", "Cesta"],
    ["precio", "Día", "is-strong"]
  ],
  "best": { "id": "ebike", "label": "La más alquilada" },
  "items": {
    "urbana": {
      "name": "Urbana",
      "values": { "peso": "16", "cesta": true, "precio": "15 €" },
      "reply": ["La urbana", "Quiero la urbana"]
    },
    "ebike": {
      "name": "Eléctrica",
      "values": { "peso": "23", "autonomia": "80", "cesta": true, "precio": "35 €" },
      "reply": ["La eléctrica", "Quiero la eléctrica"]
    },
    "mtb": { "name": "Montaña", "values": { "peso": "14", "cesta": false, "precio": "25 €" } }
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"compare"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `titles` |  | object | { "2": text, "3": text }: by how many are compared. |
| `param` |  |  | The tag key that names the item ("id" by default): lower-case. |
| `items` |  | object | The columns by id (two or more). |
| `rows` | yes | list (or by language) | [key, label], [key, label, class] or [key, label, class, unit]. |
| `min` |  | integer 2–3 | How many at least (2 or 3). |
| `max` |  | integer 2–3 | How many at most (2 or 3). |
| `empty` |  | text | What an empty cell says. |
| `note` |  | text | A note at the end. |
| `same` |  | `"fold"`, `"mute"` (or by language) | "fold": equal rows go in one line under the table; "mute" (the default): drawn quieter. |
| `primary` |  |  | The primary action. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `source` |  | object | Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }. |
| `live` |  | boolean | The "Live" chip beside the title (true by default for rows from a source). |
| `best` |  | text or object | The column you recommend: an id, or { "id", "label" }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Also needed: one of `items`, or `source`.

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a compare widget.

| Key | Required | Type | What it is |
|---|---|---|---|
| `name` | yes | text | The column's name. |
| `values` | yes |  | { row key: text, or true/false for ✓/✕ }. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `link` |  | [label, url] | [label, url]: a link under an entry of "links". |
| `img` |  | photo | A photo: { "src", "srcset", "width", "height", "alt" }, or "set:file.jpg" / { "photo": "set:file.jpg", "alt" } with "photos". "src" must be under "links". |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `vs: unknown option "kciker" for compare. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `vs: unknown option "colour" for compare. Known: …` |
| Leave out `rows` | `vs: missing "rows"` |
| Give `same` a value it does not have, `"nope"` | `vs: "same" is "fold" (equal rows go in one line under the table) or "mute" (the default: drawn quieter)` |
| Give `kicker` a number instead of text | `vs: kicker must be text` |
