# `cards`

Cards by id (or one "item"): a title, rows, points, a status, a photo and a price, with a reply and links.

<!-- prose -->
## When to use

- A card per thing the visitor can ask about: a service, an FAQ answer, an address, the state of a repair, a room with a photo and a price.
- The agent names the card with `id=` in the tag; the text lives in the config, so the agent never writes prices or opening times.
- One card with no id (`item` instead of `items`) suits a single fact, such as "where we build".
- Buttons go on the widget (`reply`, `links`), not on the item.

## Gotchas

- The checker needs `items` (a card per id) or `item` (one card); the schema marks neither as required, only the checker says so.
- A card without a `title` is an error, whichever way it is written.
- `status` on the widget lets the tag choose a status line (`estado=lista`); its `param` must differ from the card's own `param`.
- A row written `[label, value, key]` is left out while the number param `key` is 0, so a sold-out row can disappear by itself.
- With `source` the rows come from a data message; the saved `items` stay as the copy for when the data never arrives.
<!-- /prose -->

## Minimal example

The smallest `cards` in the public example configs: `area` in `kit/example/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[np:area]]`

```json
{
  "type": "cards",
  "cls": "np-area",
  "links": [{ "tel": "0116 000 0000", "cc": "44", "label": "Call 0116 000 0000" }],
  "item": {
    "kicker": "Where we build",
    "title": "Leicestershire and around",
    "rows": [["Base", "Leicester"], ["Also", "Nottinghamshire, Derbyshire"], ["Elsewhere", "Ask the team"]]
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"cards"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `param` |  |  | The tag key that names the item ("id" by default): lower-case. |
| `items` |  | object | The cards by id. |
| `item` |  | item | An item of a cards widget. |
| `kicker` |  | text | A small line above the title. |
| `disclaimer` |  | text | A disclaimer under the card. |
| `single` |  |  | true: a card with no id. |
| `fallback` |  | text | The item drawn when the tag names none (a flow's unset id). |
| `pointsCls` |  | text | A CSS class for the points. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `lang` |  | text | A fixed language for this widget. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `status` |  | object | A status the tag names: { "param": "estado", "items": { key: { "text", "tone", "reply", "links" } } }. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `source` |  | object | Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }. |
| `live` |  | boolean | The "Live" chip beside the title (true by default for rows from a source). |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a cards widget.

| Key | Required | Type | What it is |
|---|---|---|---|
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The card's title. |
| `who` |  | text | Who it is for or by. |
| `line` |  | text | One line under the title. |
| `points` |  | list (or by language) | Bullet points (texts). |
| `pointsCls` |  | text | A CSS class for the points. |
| `pointsTitle` |  | text | A title above the points. |
| `rows` |  | list (or by language) | Rows: [label, value], [label, value, key], or a meter row [label, value, { "of": 12 }]. |
| `note` |  | text | A note at the end. |
| `noteCls` |  | text | A CSS class for the note. |
| `link` |  | [label, url] | [label, url]: a link under an entry of "links". |
| `status` |  | object | { "text", "tone" }: a status line. |
| `badge` |  | text or object | "text" or { "text", "tone" }: a small label beside the title. |
| `img` |  | photo | A photo: { "src", "srcset", "width", "height", "alt" }, or "set:file.jpg" / { "photo": "set:file.jpg", "alt" } with "photos". "src" must be under "links". |
| `price` |  | object | { "now", "unit", "list" }: already formatted. |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `links` as `lniks` | `area: unknown option "lniks" for cards. Known: …. Did you mean "links"?` |
| Add a key the type does not have, `colour` | `area: unknown option "colour" for cards. Known: …` |
| Give `cls` a number instead of text | `area: cls must be text` |
| Add an unknown key to an item, `colour` | `area: item: unknown key "colour". Known: …` |
| Write the type as `cardss` | `area: unknown type "cardss". Known: …. Did you mean "cards"?` |
