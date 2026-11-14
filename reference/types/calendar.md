# `calendar`

A month grid of days, free, few, full or closed, with a price per night.

<!-- prose -->
## When to use

- Availability and prices for a month, and one day or a stay picked with two taps: nights in a hotel or rental, a day at a restaurant.
- Days are free, few, full or closed, from `rates` (a price per night over a period), `days` (one date) and `closed`.
- The tag can open on a month (`month=2026-12`) or with a stay already picked (`from=21/11/2026|to=24/11/2026`).

## Gotchas

- `cta` and `send` are required, and `send.fields` as well.
- Prices are plain amounts per night (`189`, `"189,50"`), with no currency or thousands separator; the checker requires `money` when there are prices.
- In a stay, the first tap is the check-in (free or few); the second is the check-out, which may be a full or closed day.
- A preset in the tag is kept only if the visitor could have picked it; anything else is ignored and logged.
- `mode` is `range` (the default) or `single`; `nights.min` and `max` limit the stay; `notice` and `horizon` limit how soon and how far.
<!-- /prose -->

## Minimal example

The smallest `calendar` in the public example configs: `noches` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:noches]]`

```json
{
  "type": "calendar",
  "kicker": "Cabaña de la vía verde",
  "title": "Elige tus noches",
  "cta": "Reservar estas noches",
  "note": "Precios y plazas ficticios para la galería.",
  "money": { "cur": "€", "after": true, "dec": ",", "th": ".", "cents": false },
  "priceFrom": true,
  "nights": { "min": 2, "max": 14 },
  "rates": [
    { "from": "1/11/2026", "to": "31/3/2027", "price": 189 },
    { "from": "4/12/2026", "to": "8/12/2026", "price": 229 }
  ],
  "days": [
    { "date": "21/11/2026", "price": 276, "state": "few", "left": 1 },
    { "date": "28/11/2026", "state": "few", "left": 2 },
    { "date": "5/12/2026", "state": "full" },
    { "date": "6/12/2026", "state": "full" }
  ],
  "closed": { "dates": ["24/12", "25/12", "31/12", "1/1"] },
  "send": {
    "text": "Quiero reservar la cabaña del {from:dmy} al {to:dmy}: {nights} noches, {total:money}",
    "fields": {
      "gx_llegada": "{from:dmy}",
      "gx_salida": "{to:dmy}",
      "gx_noches": "{nights}",
      "gx_importe": "{total:money}"
    }
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"calendar"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `cta` | yes | text | The main button's label. |
| `note` |  | text | A note at the end. |
| `mode` |  | `"range"`, `"single"` (or by language) | "range" (check-in → check-out, the default) or "single". |
| `nights` |  | object | { "min", "max" }: the shortest and the longest stay. |
| `notice` |  | integer 0–365 | Days from today that can't be picked yet (0–365). |
| `horizon` |  | integer 1–730 | Days ahead that can be picked (1–730; 365). |
| `months` |  | `1`, `2` | 1 or 2 (a second month where the card is wide). |
| `rates` |  | list (or by language) | [{ "from", "to", "price" }]: a price per night. |
| `days` |  | list (or by language) | [{ "date", "price", "state", "left" }]. |
| `closed` |  | object | { "weekdays": [1], "dates": ["24/12", "1/1/2027"] } (0 = Sunday). |
| `unlisted` |  | `"free"`, `"closed"` (or by language) | "free" (a day with no data can be picked) or "closed". |
| `priceFrom` |  | boolean | true: the total reads "from 654 €". |
| `source` |  | object | Days from LBW.data: { "data", "map": { "date", "price", "state", "left" } }. |
| `send` | yes | object | { "text", "fields" } over {from} {to} {day} {nights} {total} {price} {summary}. |
| `collapse` |  |  | false: keep it open after it is sent. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `noches: unknown option "kciker" for calendar. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `noches: unknown option "colour" for calendar. Known: …` |
| Leave out `cta` | `noches: missing "cta"` |
| Leave out `send` | `noches: missing "send"` |
| Give `mode` a value it does not have, `"nope"` | `noches: "mode" is "range" (check-in and check-out, the default) or "single" (one day)` |
