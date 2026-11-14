# `table`

A table by id (or one "item"): 2–5 columns and 1–30 rows; "pick" makes each row a button.

<!-- prose -->
## When to use

- A price list, a timetable or opening hours by season: several rows that share the same columns.
- Each item is one table (`title`, `cols`, `rows`); the tag picks it with `id=`.
- With `pick`, a tap anywhere on a row sends a sentence built from that row and saves fields, so the visitor can choose a time or a price.

## Gotchas

- `cols` takes 2 to 5 entries, `[key, label]` or `[key, label, "end"]` (right-aligned); `rows` takes 1 to 30, one text per column.
- More than `fold` rows (8 by default) are folded behind "See all".
- A column that says the same in every row (three rows or more, never the first) leaves the table and shows once above it; `"same": false` keeps it.
- `pick.fields` is required whenever `pick` is there.
- About three columns fit on a phone; more scroll sideways with the first column held.
<!-- /prose -->

## Minimal example

The smallest `table` in the public example configs: `tarifas` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:tarifas id=verano]]`

```json
{
  "type": "table",
  "kicker": "Tarifas de alquiler",
  "items": {
    "verano": {
      "title": "Alquiler · temporada alta",
      "cols": [["bici", "Bici"], ["dia", "Día €", "end"], ["semana", "Semana €", "end"]],
      "rows": [
        ["Urbana", "15", "75"],
        ["Montaña", "25", "120"],
        ["Eléctrica", "35", "170"],
        ["Gravel", "28", "135"]
      ],
      "source": "Datos ficticios para la galería"
    }
  },
  "pick": {
    "say": "Quiero alquilar la {bici}",
    "fields": { "bici": "{bici}", "temporada": "{id}" },
    "label": "Elegir"
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"table"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `param` |  |  | The tag key that names the item ("id" by default): lower-case. |
| `items` |  | object | The tables by id. |
| `item` |  | item | An item of a table widget. |
| `kicker` |  | text | A small line above the title. |
| `fold` |  | integer 3– | The rows shown before "See all" (8). |
| `pick` |  | object | Each row a button: { "say": "…{column}…", "fields": { field: "{column}" }, "label" }. |
| `same` |  | `false` | false: keep a column that says the same in every row. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `lang` |  | text | A fixed language for this widget. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `fallback` |  | text | The item drawn when the tag names none (a flow's unset id). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `source` |  | object | Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }. |
| `live` |  | boolean | The "Live" chip beside the title (true by default for rows from a source). |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a table widget.

| Key | Required | Type | What it is |
|---|---|---|---|
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The table's title. |
| `cols` | yes | list (or by language) | 2–5 columns: [key, label] or [key, label, "end"]. |
| `rows` |  | list (or by language) | 1–30 rows, one text per column. |
| `note` |  | text | A note under the table. |
| `source` |  | text | Where and when the numbers were read. |
| `link` |  | [label, url] | [label, url]: a link under an entry of "links". |
| `meter` |  |  | { "col": the count column, "of": the capacity (a number or a column), "low", "full" }. |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `tarifas: unknown option "kciker" for table. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `tarifas: unknown option "colour" for table. Known: …` |
| Give `same` a value it does not have, `"nope"` | `tarifas: "same" is false (keep a column that says the same in every row) or left out` |
| Give `kicker` a number instead of text | `tarifas: kicker must be text` |
| Add an unknown key to an item, `colour` | `tarifas: verano: unknown key "colour". Known: …` |
