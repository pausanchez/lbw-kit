# `people`

People with a name and a role (four at most per tag).

<!-- prose -->
## When to use

- Who will help: a few named people with a role and a short note, optionally a photo.
- The tag can list who to show (`who=ana,ben`, with `filter.param`), or show everyone.
- The `reply` can use `{name}` and `{role}`: "Ask {name}".

## Gotchas

- Each person needs a `name` and a `role`; the checker needs `items` or `item`.
- At most four people are drawn per tag.
- `filter` is `{ "param": the tag key that lists ids }`.
- A photo `src` must be under an entry of the top-level `links`.
<!-- /prose -->

## Minimal example

The smallest `people` in the public example configs: `equipo` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:equipo]]`

```json
{
  "type": "people",
  "kicker": "Guías",
  "title": "Quién te acompaña",
  "note": "De la página pública del equipo.",
  "filter": { "param": "who" },
  "reply": ["Ruta con {name}", "Quiero una ruta con {name}", { "guia": "{id}" }],
  "items": {
    "ana": { "name": "Ana Ruiz", "role": "Guía de montaña", "note": "Lun–Jue" },
    "ben": { "name": "Ben Cole", "role": "Mecánico y guía", "note": "Fines de semana" }
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"people"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `note` |  | text | A note at the end. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `items` |  | object | The people by id. |
| `filter` |  | object | { "param": the tag key that lists ids }. |
| `reply` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `source` |  | object | Rows from LBW.data: { "data": a key, "map": { part: "{column}" } }. |
| `live` |  | boolean | The "Live" chip beside the title (true by default for rows from a source). |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Also needed: one of `items`, or `source`.

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

An item of a people widget.

| Key | Required | Type | What it is |
|---|---|---|---|
| `name` | yes | text | The name. |
| `role` | yes | text | The role. |
| `img` |  | photo | A photo: { "src", "srcset", "width", "height", "alt" }, or "set:file.jpg" / { "photo": "set:file.jpg", "alt" } with "photos". "src" must be under "links". |
| `note` |  | text | A note. |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `equipo: unknown option "kciker" for people. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `equipo: unknown option "colour" for people. Known: …` |
| Give `kicker` a number instead of text | `equipo: kicker must be text` |
| Add an unknown key to an item, `colour` | `equipo: ana: unknown key "colour". Known: …` |
| Write the type as `peoples` | `equipo: unknown type "peoples". Known: …. Did you mean "people"?` |
