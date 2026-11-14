# Widget types

One page per type: when to use it, the smallest working example, every key, and what the checker rejects. Generated from the schema and the checker by `scripts/type-docs.mjs`; the prose between `<!-- prose -->` markers is written by hand and kept.

| Type | What it draws | Page |
|---|---|---|
| `cards` | Cards by id (or one "item"): a title, rows, points, a status, a photo and a price, with a reply and links. | [cards.md](cards.md) |
| `table` | A table by id (or one "item"): 2–5 columns and 1–30 rows; "pick" makes each row a button. | [table.md](table.md) |
| `form` | Questions one step at a time; sends a summary and saves fields. | [form.md](form.md) |
| `contact` | How to reach you: a title, rows, opening hours and buttons. | [contact.md](contact.md) |
| `chips` | Quick replies: [label, sentence] or { label, say, desc, fields }. | [chips.md](chips.md) |
| `carousel` | Slides, saved or read live from a CSV, JSON or LBW.data; a filter the tag drives. | [carousel.md](carousel.md) |
| `calc` | A calculator: state the visitor changes, formulas, a result and a sentence to send. | [calc.md](calc.md) |
| `stats` | Cards of 2–4 figures, each with where and when they were read. | [stats.md](stats.md) |
| `people` | People with a name and a role (four at most per tag). | [people.md](people.md) |
| `consent` | A yes/no consent with its fields. | [consent.md](consent.md) |
| `slots` | Time slots on fixed days or a weekly plan; sends the day and time. | [slots.md](slots.md) |
| `confirm` | What a form, slots or calendar widget sent, confirmed (a card or a ticket). | [confirm.md](confirm.md) |
| `review` | An order to review: lines, a total, send or discard. | [review.md](review.md) |
| `chart` | A line, area or bar chart of one or two series (two to four stacked). | [chart.md](chart.md) |
| `compare` | Two or three items side by side, by row. | [compare.md](compare.md) |
| `season` | Open or closed today, from the season's date ranges (needs "timeZone"). | [season.md](season.md) |
| `map` | 1–5 places on a schematic or on your own image, with hours and directions. | [map.md](map.md) |
| `tracker` | A step timeline: the current step comes from the tag. | [tracker.md](tracker.md) |
| `rating` | Thumbs, stars or a scale: one tap sends and saves. | [rating.md](rating.md) |
| `calendar` | A month grid of days, free, few, full or closed, with a price per night. | [calendar.md](calendar.md) |

## Screen mode: the `screen` key

Screen mode: the chat as an app, one screen at a time. The newest widget is the screen, the messages before its turn fold behind "View conversation", a header shows the steps and a bar mirrors the primary action.

| Key | Required | Type | What it is |
|---|---|---|---|
| `on` | yes | boolean | true: screen mode is on. |
| `header` |  | object | The app header: a title and the steps. |
| `bar` |  | boolean | false: no bottom bar (the primary action mirrored while it is out of view). |
| `history` |  | `"collapse"`, `"keep"` (or by language) | "collapse" (earlier messages fold behind "View conversation", the default) or "keep" (they stay). |
| `bleed` |  | boolean | true: the current screen drops its card and bubble, fills the column, its short text reads as a heading and its buttons as full-width rows. |

`screen.header`:

| Key | Required | Type | What it is |
|---|---|---|---|
| `title` |  | text | The header's title, one line. |
| `steps` |  | list (or by language) | 2–8 steps, [id, label]: the id is a lower-case word (a tag's step=id or step=2, or a widget's "step"). |
| `progress` |  | boolean | true: a bar and "Step 2 of 4" instead of the steps by name. |

Every type also takes `"screen": false` (never the screen) and `"step"` (its step's id). A tag may name the step itself, `step=when` or `step=2`; any other value is logged and ignored. A step gets its ✓ once the visitor was on it and moved forward; a step jumped over reads as skipped. An agent's text between screens shows as a normal bubble under the current screen. If the chat's DOM is not what the library expects, or the `screen` key is wrong, the bot is a normal chat.

Theme tokens (each defaults to the card's): `--lbw-screen-head-bg`, `--lbw-screen-head-ink`, `--lbw-screen-head-muted`, `--lbw-screen-head-line`, `--lbw-screen-head-accent`, `--lbw-screen-head-track`, `--lbw-screen-bar-bg`, `--lbw-screen-bar-ink`, `--lbw-screen-bar-line`; with `bleed`: `--lbw-screen-surface`, `--lbw-screen-gutter`, `--lbw-screen-pad`, `--lbw-screen-radius`, `--lbw-screen-title-ink`, `--lbw-screen-intro-ink`.
