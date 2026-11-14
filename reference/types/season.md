# `season`

Open or closed today, from the season's date ranges (needs "timeZone").

<!-- prose -->
## When to use

- Say whether something is open today and when that changes: a seasonal route, a pool, a terrace.
- The card works out "open" or "closed", the next change and the days left from your date ranges.

## Gotchas

- `ranges` is required: `[first open day, last open day]` pairs in D/M/YYYY; overlapping ranges count as one.
- It needs `timeZone` at the top of the config: "today" is the client's day (the checker says so).
- Write the years: a range for this year does not carry over to the next.
- `rows` are `[label, value]` lines; a row with a key (`[label, value, key]`) follows the number params like on cards.
- The kit's own words exist in six languages; `words` is only for a seventh or to change a phrase.
<!-- /prose -->

## Minimal example

The smallest `season` in the public example configs: `season` in `kit/example-status/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[tn:season]]`

```json
{
  "type": "season",
  "kicker": { "es": "Alquiler de bicis", "en": "Bike hire" },
  "ranges": [["1/3/2026", "31/10/2026"], ["1/3/2027", "31/10/2027"]]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"season"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `ranges` | yes | list (or by language) | [[first open day, last open day], …] in D/M/YYYY. |
| `words` |  | object | The kit's words, changed. |
| `rows` |  | list (or by language) | [label, value]. |
| `note` |  | text | A note at the end. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `season: unknown option "kciker" for season. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `season: unknown option "colour" for season. Known: …` |
| Leave out `ranges` | `season: missing "ranges"` |
| Write the type as `seasons` | `season: unknown type "seasons". Known: …. Did you mean "season"?` |
