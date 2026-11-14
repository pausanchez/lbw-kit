# lbw-kit · AI Widgets for the Landbot v4 web chat

> **Personal project, not an official Landbot product.** It is not built, supported or endorsed by Landbot. The license is pending: until one is published here, no license is granted.

An AI agent in a Landbot web chat ends its message with a short tag, `[[prefix:name key=value]]`. This library, loaded in the bot's Custom JS, removes the tag and draws an interactive widget in its place (cards, a carousel, a comparison, a form, a calendar, a map, a tracker…) from verified data, never from the model. Widget buttons can post a message as the visitor and write Landbot fields.

- `runtime/`: `lbw.js`, the runtime (tag parsing, rendering, quick replies, field writes, validation), and its CSS
- `kit/`: the widget kit and `LBW.kit.setup`, a bot's widgets as one JSON config, with its checker
- `dist/`: the built files, loaded by URL at a pinned version (see the tags), with their integrity in `dist/manifest.json`
- `test/`: `npm test`

Changes are listed in the tags' commit messages.
