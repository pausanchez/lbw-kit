# lbw-kit · AI Widgets for the Landbot v4 web chat

> **Personal project, not an official Landbot product.** It is not built, supported or endorsed by Landbot. The license is pending: until one is published here, no license is granted.

An AI agent in a Landbot web chat ends its message with a short tag, `[[prefix:name key=value]]`. This library, loaded in the bot's Custom JS, removes the tag and draws an interactive widget in its place (cards, a carousel, a comparison, a form, a calendar, a map, a tracker…) from verified data, never from the model. Widget buttons can post a message as the visitor and write Landbot fields.

The agent chooses which widget to show; the code decides what it says. A bot's widgets are one JSON config, checked before it ships.

- `runtime/`: `lbw.js`, the runtime (tag parsing, rendering, quick replies, field writes, validation), and its CSS
- `kit/`: the widget kit and `LBW.kit.setup`, a bot's widgets as one JSON config, with its checker
- `dist/`: the built files, loaded by URL at a pinned version, with their integrity in `dist/manifest.json`
- `scripts/`: build, version sync, the config checker and the bot-code generator
- `test/`: `npm test`

## Load it in Landbot

Pin the version in the URL (never `@latest`) and keep `integrity` and `crossorigin`. Current version: v0.10.0.1.

Custom JS:

```html
<script src="https://cdn.jsdelivr.net/gh/pausanchez/lbw-kit@v0.10.0.1/dist/lbw-kit.min.js" integrity="sha384-1oECDEwCgD166v/JnJGmifqE5k7XlNnZdTb/VkJoosPZaHi1QxYZmqt0NoLHm/70" crossorigin="anonymous"></script>
<script>LBW.landbot&&LBW.landbot(this);LBW.kit.setup({ …your config… })</script>
```

Custom CSS, first line:

```css
@import url("https://cdn.jsdelivr.net/gh/pausanchez/lbw-kit@v0.10.0.1/dist/lbw-kit.min.css");
```

`npm run bot` writes both for you, with the fallback script that removes raw tags if the library fails to load.

## A minimal config

```json
{
  "prefix": "np",
  "langs": ["en"],
  "defaultLang": "en",
  "links": ["https://northpeak.example/", "tel:"],
  "actions": {
    "call": { "tel": "0116 000 0000", "cc": "44", "label": "Call 0116 000 0000" }
  },
  "replies": { "plan": ["Plan my project", "I want to plan my project"] },
  "widgets": {
    "service": {
      "type": "cards", "kicker": "Service", "reply": "plan", "links": ["call"],
      "items": {
        "extension": { "title": "Extensions", "line": "Single and double storey, designed and built by one team.", "points": ["Drawings and planning", "Groundworks to roof"], "link": ["See the page ↗", "https://northpeak.example/extensions/"] },
        "loft": { "title": "Loft conversions", "line": "Dormer and hip-to-gable conversions.", "points": ["Structural design", "Building Control"] }
      }
    },
    "chips": {
      "type": "chips",
      "items": { "plan": ["Plan my project", "I want to plan my project"], "area": ["Do you cover my area?", "Do you cover my area?"] }
    }
  }
}
```

The agent then ends a message with `[[np:service id=loft]]`. Check a config with `npm run -s check:config -- config.json`.

## The 20 widget types

| Type | What it draws |
|---|---|
| `cards` | Cards from a table of items: title, line, points, rows, a status, a photo and price, one quick reply, links. |
| `table` | A table of 2–5 columns with fold, meters and a button per row. |
| `form` | Picks that send once: one or many per step, steps that depend on an earlier answer, a summary sent as the visitor. |
| `contact` | The handover card: call, WhatsApp, open now from the hours, a summary of a form. |
| `chips` | Quick replies, optionally with a description under each. |
| `carousel` | Slides with photo, badge, price, status, a reply and a link; can read its slides live (CSV, JSON). |
| `calc` | A live estimate from steppers and picks, computed by formulas, sent once. |
| `stats` | Figures per item (2–4), from data or a live source. |
| `people` | A directory of names and roles, filterable from the tag. |
| `rating` | Thumbs, stars or a scale; one tap sends and saves a field. |
| `calendar` | A month grid of free, few, full and closed days with a price per night; a day or a stay. |
| `tracker` | An ordered step list with the current step taken from the tag, delays and an ETA. |
| `consent` | A yes / no consent that saves the answer. |
| `slots` | The next working days, then the day's free and busy times; offers an .ics. |
| `confirm` | A confirmation (status, rows, next steps; or a ticket) built from what a form, slots or calendar sent. |
| `review` | A quote line by line with selectable options, a total and Confirm / Discard. |
| `compare` | Two or three items side by side, with a best column, units and ticks. |
| `map` | 1–5 places on a schematic or your own image, with open now, distance and directions. |
| `season` | Open or closed today from dated ranges, with the next dates. |
| `chart` | Line or bar chart (one or two series; stacked bars) from formulas or values. |

## Build a bot's code

```sh
npm install
npm run bot -- config.json --out build   # writes build/custom_js.html and build/custom_css.css
npm run check                            # version check, build, tests
```

`npm run bot` checks the config first and writes nothing if it has a problem. `--inline` puts the library's code inside the files, for a page that blocks outside hosts.

## For coding agents

Read [.github/AGENTS.md](https://github.com/pausanchez/lbw-kit/blob/main/.github/AGENTS.md): the rules, the model, the short path and where things break. [llms.txt](https://github.com/pausanchez/lbw-kit/blob/main/.github/llms.txt) is the index.

Changes are listed in the tags' commit messages.
