# `slots`

Time slots on fixed days or a weekly plan; sends the day and time.

<!-- prose -->
## When to use

- Let the visitor pick a day and a time from the ones you offer, then send it as one sentence with fields saved.
- Use fixed dates (`days`) for a few known appointments, or a `weekly` plan that repeats `ahead` weeks.
- A `confirm` widget can show what was picked, and offer an .ics calendar file.

## Gotchas

- `cta` and `say` are required, and either `days` or `weekly` has to give the slots.
- `weekly.week` is keyed by weekday (0 is Sunday); a time is `["09:00", "10:00"]`, and a third `"busy"` greys it out.
- `say` is `{ "text", "fields" }` over `{day}`, `{from}` and `{to}`.
- Past slots and days with nothing left are left out.
- It books nothing: the sentence goes to Landbot, and your flow does the booking.
<!-- /prose -->

## Minimal example

The smallest `slots` in the public example configs: `cita` in `gallery/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[gx:cita]]`

```json
{
  "type": "slots",
  "kicker": "Taller",
  "title": "Elige una hora",
  "cta": "Reservar",
  "note": "Demo: no se reserva nada.",
  "weekly": {
    "ahead": 3,
    "week": {
      "1": [["09:00", "10:00"], ["10:00", "11:00", "busy"], ["17:00", "18:00"]],
      "3": [["10:00", "11:00"], ["12:00", "13:00"]],
      "5": [["09:00", "10:00"], ["11:00", "12:00"]]
    }
  },
  "say": {
    "text": "Mi cita: {day:date}, {from:time}–{to:time}",
    "fields": { "gx_dia": "{day:dmy}", "gx_hora": "{from:time}" }
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"slots"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` |  | text | The title. |
| `cta` | yes | text | The main button's label. |
| `note` |  | text | A note at the end. |
| `sep` |  | text | The separator between the times. |
| `h12` |  |  | 12-hour times. |
| `collapse` |  |  | false: keep it open after it is sent. |
| `density` |  | `"compact"`, `"comfy"` (or by language) | "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout). |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `ics` |  | object | { "title", "where", "label", "file" }: an .ics file. |
| `days` |  | list (or by language) | Fixed dates: [{ "date": D/M/YYYY, "slots": [[from, to]] }]. |
| `weekly` |  | object | { "week": { "1": [["09:00", "10:00"]] }, "ahead", "from", "skip" } (0 = Sunday). |
| `say` | yes | object | { "text", "fields" } over {day} {from} {to}. |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `kicker` as `kciker` | `cita: unknown option "kciker" for slots. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `cita: unknown option "colour" for slots. Known: …` |
| Leave out `cta` | `cita: missing "cta"` |
| Leave out `say` | `cita: missing "say"` |
| Give `density` a value it does not have, `"nope"` | `cita: "density" is "compact" (one question at a time, a footer with the total) or "comfy" (the v0.9.5 layout)` |
