# `carousel`

Slides, saved or read live from a CSV, JSON or LBW.data; a filter the tag drives.

<!-- prose -->
## When to use

- A strip of slides to swipe through: products, rides, rooms, with a photo, a price and a status each.
- The slides are saved in `items`, or read live from a CSV, a JSON or a data message in `source`.
- A `filter` lets the tag show one kind of slide (`tipo=electrica`), or `ids=a,b` shows only those slides, in that order.

## Gotchas

- The checker needs `items` or a `source`; the schema marks neither as required.
- A slide needs a `name`; a slide may also carry the key the filter reads (`filter.by`), so other keys are allowed there.
- `until` (D/M/YYYY) hides a slide after that day and needs `timeZone`.
- A `map` cannot fill `reply`: a cell would become a sentence the visitor sends.
- With a live `source`, keep at least one saved item per filter value, or a blocked file draws nothing.
<!-- /prose -->

## Minimal example

The smallest `carousel` in the public example configs: `bikes` in `kit/example-status/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[tn:bikes]]`

```json
{
  "type": "carousel",
  "kicker": { "es": "Bicis de alquiler", "en": "Hire bikes" },
  "title": { "es": "Para este fin de semana", "en": "For this weekend" },
  "items": [
    {
      "id": "urbana",
      "name": { "es": "Urbana", "en": "City" },
      "price": { "now": "15 €", "unit": { "es": "/día", "en": "/day" } },
      "status": { "text": { "es": "6 libres", "en": "6 free" }, "tone": "ok" }
    },
    {
      "id": "electrica",
      "name": { "es": "Eléctrica", "en": "E-bike" },
      "price": { "now": "35 €", "unit": { "es": "/día", "en": "/day" } },
      "status": { "text": { "es": "Quedan 2", "en": "2 left" }, "tone": "warn" }
    },
    {
      "id": "montana",
      "name": { "es": "Montaña", "en": "Mountain" },
      "price": { "now": "25 €", "unit": { "es": "/día", "en": "/day" } },
      "status": { "text": { "es": "Agotada", "en": "Sold out" }, "tone": "danger" }
    }
  ]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"carousel"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `items` |  | list of items (or by language) | The slides. |
| `source` |  | object | Slides read live: { "csv" \| "json" \| "data", "id", "map": { "name": "{column}", … } }. |
| `filter` |  | object | { "by": a key of the items, "param": the tag key, "values" }. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `titles` |  | object | Titles by filter value. |
| `lead` |  | text | A line above the slides. |
| `note` |  | text | A note at the end. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `max` |  |  | How many slides at most. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `live` |  | boolean | The "Live" chip beside the title. |
| `style` |  | `"media"`, `"box"` (or by language) | "media" (photos lead, no box) or "box". |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a carousel (a slide). It also takes the key the carousel's "filter.by" names, so other keys are allowed here.

| Key | Required | Type | What it is |
|---|---|---|---|
| `id` |  |  | The slide's id (the tag's ids=a,b). |
| `img` |  | photo | A photo: { "src", "srcset", "width", "height", "alt" }, or "set:file.jpg" / { "photo": "set:file.jpg", "alt" } with "photos". "src" must be under "links". |
| `badge` |  | text | A small label. |
| `kicker` |  | text | A small line above the name. |
| `name` | yes | text | The slide's name. |
| `sub` |  | text | A line under the name. |
| `price` |  |  | { "now", "unit", "list" }: already formatted. |
| `save` |  | text | What it saves. |
| `status` |  |  | { "text", "tone" } or { "text", "ok": true }. |
| `desc` |  | text | A description. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `link` |  | [label, url] | [label, url]: a link under an entry of "links". |
| `gallery` |  |  | { "title", "photos": [ … ] }: a gallery of photos. |
| `until` |  | text | The last day it shows, D/M/YYYY (needs "timeZone"). |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `bikes: unknown option "kciker" for carousel. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `bikes: unknown option "colour" for carousel. Known: …` |
| Give `style` a value it does not have, `"nope"` | `bikes: "style" is "media" (photos lead, no box: the default when a slide has a photo) or "box"` |
| Write the type as `carousels` | `bikes: unknown type "carousels". Known: …. Did you mean "carousel"?` |
