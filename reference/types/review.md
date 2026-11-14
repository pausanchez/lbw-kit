# `review`

An order to review: lines, a total, send or discard.

<!-- prose -->
## When to use

- A receipt the visitor checks before confirming: lines, a total, and a confirm and a discard button.
- Lines may be fixed, or a pick between options that changes the total.
- Confirming sends one sentence with the fields saved.

## Gotchas

- `state`, `lines`, `send` and `cta` are required.
- A line is `{ "label", "value" }` (a template) or `{ "label", "select", "items" }`.
- The total comes from `tables` and `compute`; compute it once and use the same name in the line and in what is sent.
- `discard` is `[label, sentence]`: a second button that sends its own sentence.
- The tag can set the starting picks (`ruedas=si`).
<!-- /prose -->

## Minimal example

The smallest `review` in the public example configs: `presu` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:presu]]`

```json
{
  "type": "review",
  "kicker": "Presupuesto",
  "title": "Revísalo",
  "cta": "Confirmar",
  "discard": ["Descartar", "Descarto el presupuesto"],
  "note": "Precios ficticios.",
  "state": { "ruedas": { "values": ["no", "si"], "default": "no" } },
  "tables": { "extra": { "no": 0, "si": 3000 } },
  "compute": { "total": "4500 + extra[ruedas]" },
  "money": { "cur": "€", "after": true, "cents": false, "th": "." },
  "lines": [
    { "label": "Revisión", "value": "45 €" },
    { "label": "Ruedas nuevas", "select": "ruedas", "items": [["no", "No"], ["si", "Sí, +30 €"]] }
  ],
  "total": { "label": "Total", "value": "{total:money}" },
  "send": { "text": "Confirmo el presupuesto: {total:money}", "fields": { "gx_presu": "{total}" } }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"review"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `cta` | yes | text | The main button's label. |
| `note` |  | text | A note at the end. |
| `collapse` |  |  | false: keep it open after it is sent. |
| `density` |  | `"compact"`, `"comfy"` (or by language) | "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `state` | yes | object | The values the visitor changes: { key: { "min", "max", "default" } or { "values", "default" } }. |
| `tables` |  | object | Lookup tables of numbers: { name: { key: number } }. |
| `compute` |  | object | Formulas, in order: { name: "formula" }. |
| `money` |  | object | How {x:money} is written. |
| `lines` | yes | list (or by language) | { "label", "value" } (a template) or { "label", "select", "items" }. |
| `total` |  | object | { "label", "value" }. |
| `discard` |  | reply | A reply: a name in "replies", or [label, sentence] or [label, sentence, { field: value }] (the visitor sends the sentence; the fields are saved in Landbot). |
| `send` | yes | object | { "text", "fields" }: the sentence sent and the fields saved. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `presu: unknown option "kciker" for review. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `presu: unknown option "colour" for review. Known: …` |
| Leave out `state` | `presu: missing "state"` |
| Leave out `lines` | `presu: missing "lines"` |
| Give `density` a value it does not have, `"nope"` | `presu: "density" is "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout)` |
