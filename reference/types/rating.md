# `rating`

Thumbs, stars or a scale: one tap sends and saves.

<!-- prose -->
## When to use

- One tap to rate: thumbs ("was this useful"), stars, or a 0 to 10 scale for a recommendation score.
- The tap sends a sentence and saves the value in Landbot, so the flow can branch on it.

## Gotchas

- `title` and `send` are required, and `send.fields` as well: a rating that saves nothing in Landbot is only a picture.
- `kind` is `thumbs`, `stars` (the default, 1 to `max`, 3 to 10) or `scale` (`min` to `max`).
- `bands` (`[[6, "detractor"], [8, "passive"], [10, "promoter"]]`) fill `{band}` in `send`.
- The value stays marked and the rest go quiet once sent.
<!-- /prose -->

## Minimal example

The smallest `rating` in the public example configs: `util` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:util]]`

```json
{
  "type": "rating",
  "kind": "thumbs",
  "title": "¿Te ha servido?",
  "send": { "text": "Valoro la respuesta: {label}", "fields": { "gx_util": "{value}" } }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"rating"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The title. |
| `text` |  | text | The body text. |
| `kind` |  | `"thumbs"`, `"stars"`, `"scale"` (or by language) | thumbs, stars (the default) or scale. |
| `min` |  | integer | The lowest value of a scale. |
| `max` |  | integer | The highest value (stars 3–10, a scale up to min + 10). |
| `labels` |  | list (or by language) | [no, yes] for thumbs, [low end, high end] for a scale. |
| `bands` |  | list (or by language) | [[top value, name], …] for {band}. |
| `send` | yes | object | { "text": "…{value}…", "fields": { field: "{value}" } }. |
| `note` |  | text | A note at the end. |
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
| Misspell `title` as `ttile` | `util: unknown option "ttile" for rating. Known: …. Did you mean "title"?` |
| Add a key the type does not have, `colour` | `util: unknown option "colour" for rating. Known: …` |
| Leave out `title` | `util: missing "title"` |
| Leave out `send` | `util: missing "send"` |
| Give `kind` a value it does not have, `"nope"` | `util: "kind" is thumbs, stars or scale` |
