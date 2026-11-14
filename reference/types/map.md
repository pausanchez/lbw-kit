# `map`

1–5 places on a schematic or on your own image, with hours and directions.

<!-- prose -->
## When to use

- Where a shop, a workshop or a pickup point is: one to five places as pins and a list with distance, open-now and directions.
- It fetches nothing: no tiles, no key, no third-party script. It draws a schematic, or your own image.

## Gotchas

- `places` is required; a place has `id`, `name`, `lat` and `lng` (and optionally `address`, `hours`, `status`, `link`).
- Without `image` the drawing is a sketch: say so in `note` when the streets are invented.
- `directions` (`google`, `apple`, `osm` or your own URL with `{q}`) needs its host under the top-level `links`.
- The tag `id=` highlights one place and `ids=` draws only those; none found draws nothing.
- `sort: "distance"` needs `from`.
<!-- /prose -->

## Minimal example

The smallest `map` in the public example configs: `donde` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:donde]]`

```json
{
  "type": "map",
  "kicker": "Dónde estamos",
  "title": "Tienda, taller y recogida",
  "directions": "google",
  "from": { "name": "Plaza Mayor", "lat": 43.2566, "lng": -2.9275 },
  "lines": [
    {
      "kind": "water",
      "label": "Ría",
      "pts": [
        [43.2668, -2.9395],
        [43.263, -2.933],
        [43.2612, -2.9265],
        [43.2618, -2.919],
        [43.2652, -2.912]
      ]
    },
    {
      "kind": "road",
      "label": "Avenida del Puerto",
      "pts": [[43.2532, -2.9385], [43.257, -2.93], [43.2582, -2.92], [43.2575, -2.915], [43.256, -2.911]]
    },
    {
      "kind": "park",
      "label": "Parque del Faro",
      "pts": [[43.254, -2.9255], [43.2552, -2.9205], [43.2528, -2.918], [43.2515, -2.923]]
    }
  ],
  "places": [
    {
      "id": "tienda",
      "name": "Tienda Roda Norte",
      "kind": "Tienda",
      "address": "Muelle de las Bicis 4",
      "lat": 43.2598,
      "lng": -2.9318,
      "hours": {
        "week": {
          "1": [[570, 840], [990, 1200]],
          "2": [[570, 840], [990, 1200]],
          "3": [[570, 840], [990, 1200]],
          "4": [[570, 840], [990, 1200]],
          "5": [[570, 840], [990, 1200]],
          "6": [[600, 840]]
        }
      }
    },
    {
      "id": "taller",
      "name": "Taller",
      "kind": "Taller",
      "address": "Calle del Piñón 18",
      "lat": 43.2556,
      "lng": -2.9236,
      "hours": {
        "week": {
          "1": [[540, 1080]],
          "2": [[540, 1080]],
          "3": [[540, 1080]],
          "4": [[540, 1080]],
          "5": [[540, 1080]]
        }
      },
      "link": ["El taller ↗", "https://rodanorte.example/taller/"]
    },
    {
      "id": "recogida",
      "name": "Punto de recogida Estación",
      "kind": "Recogida",
      "address": "Plaza del Radio 2, junto a la estación",
      "lat": 43.2598,
      "lng": -2.9158,
      "status": { "text": "Taquillas abiertas 24 h", "tone": "ok" }
    }
  ],
  "note": "Lugares, calles y plano ficticios para la galería."
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"map"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `note` |  | text | A note at the end. |
| `places` | yes | list (or by language) | 1–20 places. |
| `image` |  | text or object | Your own map: { "src", "width", "height", "alt", "bounds" }, or "set:map.png" with "photos". |
| `lines` |  | list (or by language) | The schematic's lines (12 at most). |
| `from` |  | object | Where distances are measured from. |
| `directions` |  | `"google"`, `"apple"`, `"osm"` or object (or by language) | A directions link: google, apple, osm, or { "url": "https://…{q}…", "label" }. |
| `sort` |  | `"distance"` (or by language) | "distance" (needs "from"). |
| `max` |  | integer 1–5 | The places one tag shows, 1 to 5. |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `donde: unknown option "kciker" for map. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `donde: unknown option "colour" for map. Known: …` |
| Leave out `places` | `donde: missing "places"` |
| Give `directions` a value it does not have, `"nope"` | `donde: "directions" is google, apple, osm, or { "url": "https://…{q}…", "label" }` |
| Give `kicker` a number instead of text | `donde: kicker must be text` |
