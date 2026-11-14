# `form`

Questions one step at a time; sends a summary and saves fields.

<!-- prose -->
## When to use

- A short guided choice, one question at a time, that ends with one sentence the visitor sends and a few fields saved in Landbot.
- Good for planning a project, narrowing down a product or a booking request, where the flow needs the answers as fields.
- A step can be answered from the tag (`preset`), so the agent can skip a question the visitor already answered.

## Gotchas

- `steps`, `summary` and `cta` are all required.
- An option is `[key, label]` or `[key, label, desc]`; the description is one line, 80 characters at most, and turns the step into a list.
- `summary` and `fields` are templates over the steps' keys (`{kind:label}`); a placeholder with no answer leaves a saved field out.
- A step's `items` may be `{ "by": "earlier step", "map": { … }, "else": [] }` when its options depend on an earlier answer.
- Compact by default: an answered step folds to one line with a change button; `"density": "comfy"` shows all of it.
<!-- /prose -->

## Minimal example

The smallest `form` in the public example configs: `plan` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:plan]]`

```json
{
  "type": "form",
  "kicker": "Planificador",
  "title": "¿Qué ruta buscas?",
  "cta": "Enviar mi plan",
  "note": "Tres preguntas, sin datos personales.",
  "steps": [
    {
      "key": "nivel",
      "title": "Tu nivel",
      "ask": "¿Qué nivel tienes?",
      "items": [
        ["suave", "Paseo tranquilo", "Llano, sin prisas, con paradas"],
        ["medio", "Algo de subida", "Hasta 40 km con algún repecho"],
        ["duro", "Quiero sudar", "Más de 60 km y puertos"]
      ]
    },
    {
      "key": "con",
      "title": "Con quién",
      "ask": "¿Con quién vas?",
      "items": [["solo", "Solo"], ["pareja", "En pareja"], ["familia", "En familia"]]
    },
    {
      "key": "extra",
      "title": "Extras (elige varios)",
      "ask": "¿Algún extra?",
      "multi": true,
      "none": "nada",
      "items": [["casco", "Casco"], ["sillita", "Sillita infantil"], ["nada", "Nada"]]
    }
  ],
  "summary": "Mi plan: {nivel:label} · {con:label:lower} · Extras: {extra:labels:lower}",
  "fields": { "gx_nivel": "{nivel}", "gx_con": "{con}", "gx_extra": "{extra}" }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"form"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `cta` | yes | text | The main button's label. |
| `note` |  | text | A note at the end. |
| `preset` |  | object | { "step", "param" }: a step the tag answers. |
| `steps` | yes | list (or by language) | The questions: { "key", "title", "items": [[key, label]] or { "by", "map", "else" } }. |
| `summary` | yes | text | A template over the steps. |
| `fields` |  | object | { field: template }: saved in Landbot. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `collapse` |  |  | false: keep it open after it is sent. |
| `density` |  | `"compact"`, `"comfy"` (or by language) | "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `plan: unknown option "kciker" for form. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `plan: unknown option "colour" for form. Known: …` |
| Leave out `steps` | `plan: missing "steps"` |
| Leave out `summary` | `plan: missing "summary"` |
| Give `density` a value it does not have, `"nope"` | `plan: "density" is "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout)` |
