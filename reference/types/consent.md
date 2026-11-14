# `consent`

A yes/no consent with its fields.

<!-- prose -->
## When to use

- Ask permission once, with a yes and a no, and save the answer in Landbot: an SMS reminder, a call back, marketing.
- Each button sends a sentence and saves its own fields, so the flow can branch on the answer.

## Gotchas

- `title`, `yes` and `no` are required; each of `yes` and `no` is `[label, sentence]` or `[label, sentence, { field: value }]`.
- The `fields` of the two buttons should use the same field names, so one condition in the flow reads either answer.
- `icon` is `check`, `bell` or `shield` only.
- `link` is a `[label, url]` pair (a privacy page) under the top-level `links`.
<!-- /prose -->

## Minimal example

The smallest `consent` in the public example configs: `permiso` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:permiso]]`

```json
{
  "type": "consent",
  "icon": "shield",
  "title": "¿Te avisamos por SMS?",
  "text": "Solo cuando tu bici esté lista.",
  "yes": ["Sí", "Sí, avisadme por SMS", { "gx_sms": "si" }],
  "no": ["No", "No, gracias", { "gx_sms": "no" }],
  "link": ["Privacidad ↗", "https://rodanorte.example/privacidad/"]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"consent"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `icon` |  | `"check"`, `"bell"`, `"shield"` (or by language) | check, bell or shield. |
| `title` | yes | text | The title. |
| `text` |  | text | The body text. |
| `yes` | yes |  | [label, sentence, { field: value }]. |
| `no` | yes |  | [label, sentence, { field: value }]. |
| `link` |  | [label, url] | [label, url]: a link under an entry of "links". |
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
| Misspell `title` as `ttile` | `permiso: unknown option "ttile" for consent. Known: …. Did you mean "title"?` |
| Add a key the type does not have, `colour` | `permiso: unknown option "colour" for consent. Known: …` |
| Leave out `title` | `permiso: missing "title"` |
| Leave out `yes` | `permiso: missing "yes"` |
| Give `icon` a value it does not have, `"nope"` | `permiso: "icon" is check, bell or shield` |
