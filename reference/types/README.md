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

## Focus moments: the `focus` key

Types that take it: `form`, `calc`, `slots`, `confirm`, `review`, `compare`, `calendar`.

A focus moment: at this point of the conversation the widget is a focused task, drawn inside the widget (no card chrome, the column's width, its own title, the step, the primary action docked while it is taller than the chat). true, or { "title", "steps", "step", "after" }.

| Key | Required | Type | What it is |
|---|---|---|---|
| `title` |  | text | Its title, one line (60 characters at most); else the widget's own. |
| `steps` |  | list (or by language) | 2–8 steps [id, label] for "Step 2 of 4 · Label": the id a lower-case word, the label 30 characters at most. |
| `step` |  | string | The step this widget is, an id of "steps" (a tag's step=id from the same list wins). |
| `after` |  | `"receipt"`, `"keep"` (or by language) | Once sent: "receipt" (the default: it folds to its "Sent · …" line) or "keep" (it stays open). |

A tag may name the step itself, `step=fechas`, from the same closed list; any other value is logged and ignored. Everything happens inside the widget: Landbot's header, history, text box and scroll are never touched. When the same widget is drawn again (the agent answered a question mid-moment and ended with the tag again), the new copy keeps what the visitor had set in the open one (form picks, steppers, picks, a calendar range, a time slot) except a key whose value the new tag changed, and the older copy becomes one inert line, its title and what it had. An open moment followed by a newer one collapses the same way. A send from the moment completes it; its receipt drops the sentence once the visitor's own bubble shows it. Every type also takes `"actionRows": true`: its buttons as full-width rows while it is narrow. v0.13's `"screen"` (and a widget's `"screen"` and `"step"`) were removed in v0.14: the checker warns and `setup()` ignores them.

Theme tokens: `--lbw-focus-surface` (the moment's background; the card's unset), `--lbw-focus-gutter` (how far it reaches past the message to the column's edges; 0), `--lbw-focus-title` (its title's size; 22px), `--lbw-focus-step` (the step line and bar's accent; the accent as text); `--lbw-title-xl` (a large title: `.lbw-title-xl`, a tracker's `"eta": { "big": true }`; 28px).
