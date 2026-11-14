# `calc`

A calculator: state the visitor changes, formulas, a result and a sentence to send.

<!-- prose -->
## When to use

- A calculator the visitor moves (days, size, options) with a total that updates, ending in one sentence sent with the numbers saved.
- Prices come from `tables` and `compute`, never from the agent, so the total is always the config's arithmetic.
- The tag can set the starting position (`dias=3 bici=ebike`).

## Gotchas

- `state`, `controls`, `result`, `send` and `cta` are all required.
- Formulas use `+ - * / ( )` and `round floor ceil abs min max`; money is integer cents, shown with `{total:money}` and the widget's `money`.
- State keys are lower-case; a value above `max` is capped and an unknown pick draws the `default`.
- A control is `{ "stepper": key, "label" }` or `{ "pick": key, "items" }`; 2 or 3 short options become a segmented control.
- `send.fields` names the Landbot fields saved; a placeholder with no value leaves its field out.
<!-- /prose -->

## Minimal example

The smallest `calc` in the public example configs: `alquiler` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:alquiler]]`

```json
{
  "type": "calc",
  "kicker": "Calculadora",
  "title": "Tu alquiler",
  "cta": "Enviar mi cálculo",
  "state": {
    "dias": { "min": 1, "max": 14, "default": 3, "int": true },
    "bici": { "values": ["urbana", "ebike"], "default": "urbana" }
  },
  "controls": [
    { "stepper": "dias", "label": "Días", "step": 1, "less": "Menos", "more": "Más" },
    { "pick": "bici", "title": "Bici", "items": [["urbana", "Urbana"], ["ebike", "Eléctrica"]] }
  ],
  "tables": { "tarifa": { "urbana": 1500, "ebike": 3500 } },
  "compute": {
    "base": "dias * tarifa[bici]",
    "dto": "round(base * 0.1 * min(1, floor(dias / 7)))",
    "total": "base - dto"
  },
  "money": { "cur": "€", "after": true, "dec": ",", "th": "." },
  "result": {
    "rows": [["{dias} días · {bici:label}", "{base:money}"], ["Descuento semana", "−{dto:money}", "dto"]],
    "total": ["Total", "{total:money}"]
  },
  "send": {
    "text": "Mi alquiler: {bici:label:lower}, {dias} días, {total:money}",
    "fields": { "gx_dias": "{dias}", "gx_bici": "{bici}" }
  },
  "notes": [["Tarifas ficticias para la galería.", "is-muted"]]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"calc"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `cta` | yes | text | The main button's label. |
| `state` | yes | object | The values: { key: { "min", "max", "default" } or { "values", "default", "labels", "required" } }. |
| `controls` | yes | list (or by language) | { "stepper": a state key, "label" } or { "pick": a state key, "items" }. |
| `tables` |  | object | Lookup tables of numbers: { name: { key: number } }. |
| `compute` |  | object | Formulas, in order: { name: "formula" }. |
| `money` |  | object | How {x:money} is written: { "cur", "after", "dec", "th", "cents", "space" }. |
| `result` | yes | object | { "rows", "total", "note" }: templates over the state and compute. |
| `send` | yes | object | { "text", "fields" }: the sentence sent and the fields saved. |
| `notes` |  | list (or by language) | [text] or [text, class]. |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `collapse` |  |  | false: keep it open after it is sent. |
| `density` |  | `"compact"`, `"comfy"` (or by language) | "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `alquiler: unknown option "kciker" for calc. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `alquiler: unknown option "colour" for calc. Known: …` |
| Leave out `state` | `alquiler: missing "state"` |
| Leave out `controls` | `alquiler: missing "controls"` |
| Give `density` a value it does not have, `"nope"` | `alquiler: "density" is "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout)` |
