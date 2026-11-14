# `contact`

How to reach you: a title, rows, opening hours and buttons.

<!-- prose -->
## When to use

- How to reach the business: a phone number or an address in big type, a few rows, opening hours and buttons.
- With `hours` the card says whether the place is open now and when that changes.
- Put it at the end of an answer that the bot cannot finish, so the visitor has a way on.

## Gotchas

- `title` is the only required key.
- `hours.week` is keyed by weekday (0 is Sunday) with `[open, close]` pairs in minutes after midnight, so `[570, 840]` is 9:30 to 14:00; `holidays` is a list like `["1/1", "25/12"]`.
- Set `timeZone` at the top of the config so "open now" is the client's time, not the visitor's.
- Buttons are `buttons` (not `links`); phone, WhatsApp and mail buttons need `tel:`, `https://wa.me/` or `mailto:` in the top-level `links` list.
- `summary` can show what a form sent, with its own actions.
<!-- /prose -->

## Minimal example

The smallest `contact` in the public example configs: `contact` in `kit/example-status/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[tn:contact]]`

```json
{
  "type": "contact",
  "kicker": { "es": "Contacto", "en": "Contact" },
  "title": "Taller Norte",
  "big": "600 000 000",
  "hours": {
    "week": {
      "1": [[570, 840], [990, 1200]],
      "2": [[570, 840], [990, 1200]],
      "3": [[570, 840], [990, 1200]],
      "4": [[570, 840], [990, 1200]],
      "5": [[570, 840], [990, 1200]],
      "6": [[600, 840]]
    }
  },
  "buttons": [
    { "tel": "600 000 000", "cc": "34", "label": { "es": "Llamar", "en": "Call" }, "icon": "phone" },
    {
      "mail": "hola@tallernorte.example",
      "label": { "es": "Escribir", "en": "Email us" },
      "icon": "mail"
    }
  ]
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"contact"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `kicker` |  | text | A small line above the title. |
| `title` | yes | text | The title. |
| `big` |  | text | A big line (a phone number, an address). |
| `rows` |  | list (or by language) | [label, value]. |
| `hours` |  | object | { "week": { "1": [[540, 1080]] }, "holidays" } (0 = Sunday; minutes). |
| `note` |  | text | A note at the end. |
| `buttons` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `buttonsWithSummary` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `summary` |  | object | { "form", "strip", "text", "actions" }: what a form sent. |
| `compact` |  | object | { "label", "buttons" }. |
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
| Misspell `kicker` as `kciker` | `contact: unknown option "kciker" for contact. Known: …. Did you mean "kicker"?` |
| Add a key the type does not have, `colour` | `contact: unknown option "colour" for contact. Known: …` |
| Leave out `title` | `contact: missing "title"` |
| Give `title` a number instead of text | `contact: title must be text` |
| Write the type as `contacts` | `contact: unknown type "contacts". Known: …. Did you mean "contact"?` |
