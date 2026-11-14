# `chips`

Quick replies: [label, sentence] or { label, say, desc, fields }.

<!-- prose -->
## When to use

- Quick replies under an answer: each chip sends a sentence as the visitor, so the next block or the agent can carry on from it.
- Use them to offer the two or three most likely next questions, not a menu of everything.
- A chip may save Landbot fields with its sentence (`fields`).

## Gotchas

- `items` is required, and the tag must say which chips to show: `[[x:chips q=plan,area]]`. Without `q` nothing is drawn, and the checker cannot catch that.
- A chip is `[label, sentence]` or `{ "label", "say", "desc", "fields" }`; `desc` is one line, 80 characters at most.
- Chips stay out when the cards above already carry two actions (`crowd`; `0` keeps them).
- `own` and `carriedBy` leave a chip out when its own widget, or a card that offers the same thing, is in the reply.
<!-- /prose -->

## Minimal example

The smallest `chips` in the public example configs: `chips` in `kit/example/config.json`, with the names it uses written out. The checker needs `links` to allow every URL it uses.

The tag that draws it: `[[np:chips q=plan,area,planning,contact]]`

```json
{
  "type": "chips",
  "cls": "np-chips",
  "items": {
    "plan": ["Plan my project", "I want to plan my project"],
    "area": ["Do you cover my area?", "Do you cover my area?"],
    "planning": ["Do I need planning?", "Do I need planning permission?"],
    "contact": ["Talk to the team", "How do I talk to someone?"]
  },
  "own": { "plan": "plan", "area": "area", "contact": "contact" },
  "carriedBy": { "plan": ["service"] }
}
```

## Keys

| Key | Required | Type | What it is |
|---|---|---|---|
| `type` | yes | `"chips"` | The widget's type. |
| `cls` |  | text | Extra CSS class(es) on the card. |
| `lang` |  | text | A fixed language for this widget. |
| `max` |  | integer 1– | How many chips at most. |
| `items` | yes | object | The chips by key. |
| `own` |  | object | Chips left out while their own widget is in the reply. |
| `carriedBy` |  | object | { chip: [widget names] }: left out when a card carries it. |
| `crowd` |  | integer 0– | With that many actions on the cards above, the chips stay out (2; 0 = never). |
| `params` |  | object | Typed values the tag carries ({name} in any text): { "plazas": { "type": "int", "min": 0, "max": 99 } }. |
| `money` |  | object | How {x:money} is written: { "cur": "€", "after": true, "dec": ",", "th": "." }. |
| `flow` |  | true or list of keys | true, or the list of keys its flow tag writes, e.g. ["texto", "lang"]. |
| `screen` |  | boolean | Screen mode: false keeps this widget from becoming the screen (it shows as a normal card on the current one). |
| `step` |  | string | Screen mode: the step this widget is, an id of "screen.header.steps" (a tag's step= wins). |

Every text may also be written by language (`{ "en": …, "es": … }`), and a key may be `null` to leave it out. A key not in this table is an error.

## Item keys

undefined

| Key | Required | Type | What it is |
|---|---|---|---|
| `label` | yes | text | The chip's label. |
| `say` | yes | text | The sentence it sends. |
| `desc` |  | text | One line under the label (80 characters at most). |
| `fields` |  |  | { field: value }: saved in Landbot with the sentence. |

## The checker rejects

Each row is the example above with one change, run through `npm run check:config`; the sentence is the checker's own (a list of known keys is shortened to `Known: …`).

| Change | The checker says |
|---|---|
| Misspell `items` as `ietms` | `chips: unknown option "ietms" for chips. Known: …. Did you mean "items"?` |
| Add a key the type does not have, `colour` | `chips: unknown option "colour" for chips. Known: …` |
| Leave out `items` | `chips: missing "items"` |
| Give `cls` a number instead of text | `chips: cls must be text` |
| Write the type as `chipss` | `chips: unknown type "chipss". Known: …. Did you mean "chips"?` |
