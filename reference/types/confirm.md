# `confirm`

What a form, slots or calendar widget sent, confirmed (a card or a ticket).

<!-- prose -->
## When to use

- Close the loop after a form, slots or calendar widget: say what was received and what happens next.
- It reads what that widget sent (the day, the time, the fields) and shows it as a card, or as a ticket with `"style": "pass"`.

## Gotchas

- `form` names another widget in the same config, and it must be a form, slots or calendar widget: those are the ones that keep what they sent.
- `title`, `status`, `rows` and `steps` are templates over what that widget sent, plus `{text}`; a placeholder that widget does not offer is a checker error.
- With `"style": "pass"` the ticket gets a countdown and an "add to calendar" button; `"ics": false` removes it.
- It confirms what was sent, not that anything was booked: say so in `note` when the flow is a demo.
<!-- /prose -->

## Minimal example

The smallest `confirm` in the public example configs: `done` in `kit/example-lead/config.json`, with the names it uses written out (and the `visit` widget it confirms). The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[lg:done]]`

```json
{
  "widgets": {
    "visit": {
      "type": "slots",
      "cls": "lg-visit",
      "kicker": "Free survey",
      "title": "Pick a time",
      "cta": "Book it",
      "note": "A demo: nothing is booked.",
      "weekly": {
        "ahead": 3,
        "skip": ["25/12"],
        "week": {
          "1": [["09:00", "10:00"], ["10:00", "11:00", "busy"], ["14:00", "15:00"]],
          "3": [["10:00", "11:00"]],
          "5": [["09:00", "10:00"], ["11:00", "12:00"]]
        }
      },
      "say": {
        "text": "My visit: {day:date}, {from:time}–{to:time}",
        "fields": { "lg_day": "{day:dmy}", "lg_from": "{from:time}" }
      },
      "ics": { "title": "Solar survey", "where": "At your home" }
    },
    "done": {
      "type": "confirm",
      "cls": "lg-done",
      "form": "visit",
      "status": "Request received",
      "title": "See you {day:date}",
      "rows": [["When", "{from:time}–{to:time}"], ["Sent", "{text}"]],
      "steps": ["We call to confirm", "The surveyor visits"],
      "note": "A demo: nothing is booked.",
      "actions": [{ "tel": "0116 000 0000", "cc": "44", "label": "Call us" }]
    }
  }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"confirm"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `allowDup` |  |  | true: draw it even when the same widget is already in the message. |
| `form` | yes | text | The form, slots or calendar widget whose sending it confirms. |
| `status` |  | text | A status line (a template). |
| `title` | yes | text | The title. |
| `rows` |  | list (or by language) | [label, value] templates. |
| `steps` |  | list (or by language) | What happens next (templates). |
| `note` |  | text | A note at the end. |
| `actions` |  | list of actions | Buttons: actions (names in "actions" or written out). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `style` |  | `"pass"`, `"card"` (or by language) | "pass" (a ticket) or "card" (the default). |
| `code` |  | text | A booking code ("{ref}"). |
| `ics` |  | `false` or object | { "title", "where", "label", "file" }, or false. |
| `countdown` |  | boolean | false hides the countdown. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `title` as `ttile` | `done: unknown option "ttile" for confirm. Known: …. Did you mean "title"?` |
| Add a key the type does not have, `colour` | `done: unknown option "colour" for confirm. Known: …` |
| Leave out `form` | `done: missing "form"` |
| Leave out `title` | `done: missing "title"` |
| Give `style` a value it does not have, `"nope"` | `done: "style" is "pass" (a ticket) or "card" (the default)` |
