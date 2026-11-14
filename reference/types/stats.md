# `stats`

Cards of 2–4 figures, each with where and when they were read.

<!-- prose -->
## When to use

- Two to four figures with where and when they were read: years in business, homes served, a rating from a public page.
- Use it for facts that build trust; always say the source and date in `source`.
- One card with no id (`item`) or several by id.

## Gotchas

- Each item needs `stats` (2 to 4 `[value, label]` pairs) and a `source` line; the checker needs `items` or `item`.
- Values are text: write "1,200" or "4.8" the way they should read.
- Do not invent figures: the card repeats what the config says, and the source line is what makes it honest.
- `reply` and `links` go on the widget.
<!-- /prose -->

## Minimal example

The smallest `stats` in the public example configs: `trust` in `kit/example-lead/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[lg:trust]]`

```json
{
  "type": "stats",
  "cls": "lg-trust",
  "reply": ["Book a visit", "I want to book a visit"],
  "links": [{ "tel": "0116 000 0000", "cc": "44", "label": "Call us" }],
  "item": {
    "kicker": "Since 2009",
    "title": "Numbers from our site",
    "stats": [["1,200", "homes"], ["4.8", "rating"], ["15 yr", "warranty"]],
    "source": "solar.example, Nov 2026"
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"stats"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `items` |  | object | The cards by id. |
| `item` |  | item | An item of a stats widget. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `source` |  | object | Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }. |
| `live` |  | boolean | The "Live" chip beside the title (true by default for rows from a source). |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a stats widget.

| Key | Required | Type | What it is |
|---|---|---|---|
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `stats` | yes | list (or by language) | 2–4 [value, label]. |
| `source` | yes | text | Where and when the numbers were read. |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `reply` as `rpely` | `trust: unknown option "rpely" for stats. Known: …. Did you mean "reply"?` |
| Add a key the type does not have, `colour` | `trust: unknown option "colour" for stats. Known: …` |
| Give `cls` a number instead of text | `trust: cls must be text` |
| Add an unknown key to an item, `colour` | `trust: item: unknown key "colour". Known: …` |
| Write the type as `statss` | `trust: unknown type "statss". Known: …. Did you mean "stats"?` |
