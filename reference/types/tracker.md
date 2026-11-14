# `tracker`

A step timeline: the current step comes from the tag.

<!-- prose -->
## When to use

- Where an order, a repair, a booking or an application is, step by step; the state lives in Landbot, not in the agent.
- A flow's Message block writes the tag with the saved fields (`estado=@{estado}`), so the visitor sees the real step.
- A step may carry its own buttons while it is current ("I will collect it").

## Gotchas

- `title` and `steps` (2 to 8) are required; step keys are lower-case and unique across `steps` and `states`.
- The current step comes from the tag; an unset or unknown value draws `default`, and without a `default` the widget draws nothing.
- `states` are delays (`at` a step) or ends (`"end": true`); `ref` shows the order code from the tag, never invented.
- `eta` needs a day or a time (tag keys) and its text must contain `{when}`; a past ETA is left out.
- The newest tracker with the same name and reference is the live one; older ones keep what they said.
<!-- /prose -->

## Minimal example

The smallest `tracker` in the public example configs: `pedido` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:pedido]]`

```json
{
  "type": "tracker",
  "kicker": "Taller Roda Norte",
  "title": "Tu reparación",
  "default": "recibida",
  "ref": { "param": "orden", "label": "Orden" },
  "eta": { "time": "hora", "text": "Lista {when}" },
  "steps": [
    { "key": "recibida", "label": "Recibida", "detail": "La dejaste en el taller" },
    { "key": "diagnostico", "label": "Diagnóstico", "detail": "Cadena y pastillas de freno" },
    { "key": "taller", "label": "En el taller" },
    {
      "key": "lista",
      "label": "Lista para recoger",
      "tone": "ok",
      "actions": [
        {
          "reply": [
            "Voy a recogerla",
            "Voy a recoger la bici",
            { "estado": "recogida", "gx_orden": "{ref}" }
          ],
          "primary": true,
          "icon": "check"
        }
      ]
    },
    { "key": "recogida", "label": "Recogida" }
  ],
  "states": [
    {
      "key": "pieza",
      "at": "taller",
      "text": "Retrasado: esperando una pieza",
      "actions": [
        {
          "reply": ["Avisadme cuando llegue", "Avisadme cuando llegue la pieza", { "gx_aviso": "si" }]
        }
      ]
    },
    { "key": "anulada", "end": true, "text": "Reparación anulada" }
  ],
  "links": [{ "tel": "600 000 000", "cc": "34", "label": "Llamar", "icon": "phone" }]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"tracker"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The title. |
| `note` |  | text | A note at the end. |
| `param` |  |  | The tag key of the current step ("estado"). |
| `default` |  | text | The step or state when the tag has none. |
| `ref` |  | object | The order code: { "param": the tag key, "label" }. |
| `eta` |  | object | { "day": a tag key, "time": a tag key, "text": "Lista {when}" }. |
| `steps` | yes | list (or by language) | 2–8 steps in order. |
| `states` |  | list (or by language) | A delay at a step ("at") or an end ("end": true). |
| `links` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `live` |  | string (or by language) | The key of a data message that updates it (a lower-case word). |
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
| Misspell `kicker` as `kciker` | `pedido: unknown option "kciker" for tracker. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `pedido: unknown option "colour" for tracker. Known: …` |
| Leave out `title` | `pedido: missing "title"` |
| Leave out `steps` | `pedido: missing "steps"` |
| Give `kicker` a number instead of text | `pedido: kicker must be text` |
