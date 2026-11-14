# Landbot v4 web chat DOM fixtures

What `runtime/host-v4.js` (the library's only view of Landbot's web chat) is tested against in `test/host.test.mjs`.

| File | What it holds |
|---|---|
| `welcome.html` | the chat window as it loads: header, two bot messages, the welcome buttons, no text box |
| `bot-text.html` | one bot message on its own (avatar, author, bubble, text) |
| `buttons.html` | the welcome buttons' box (`options-list`, four `option-button`) |
| `user-message.html` | the window after one click on a welcome button: the visitor's message between the welcome and the reply |

## How they were captured

On 14 Nov 2026, from the live share page of a published test bot (the one the daily canary watches), with
`scripts/capture-host.mjs`: headless Chrome with a normal user agent, read-only. Nothing typed, no form, one click on the
bot's own welcome button.

Sanitized in the page before anything was saved:

- removed: `script`, `style`, `noscript`, `iframe`, `link`, `meta`, `template`, the drawing inside every `svg`, comments,
  and the library's own widgets (`.lbw`) and marks (`data-lbw*`, `lbw-*`, `kit-*`, `is-*` classes, the `aria-hidden` it sets
  on a data message);
- every attribute dropped except `class`, `role`, `type`, `tabindex`, `dir`, `lang`, `disabled`, `hidden`, state `aria-*`
  and `data-lb-*`: no inline style, id, image source, token or event handler is kept; `href` is `#`; `alt`, `title`,
  `placeholder` and `aria-label` are `Label`;
- every text replaced by a placeholder: `Bot message` and `User message` in a message's text, `Option 1`… in a button,
  `Text` anywhere else (the bot's name, the timestamp, the branding). No bot, client or visitor text is left.

The `data-lb-*` hooks, the classes, the roles and the nesting are as Landbot drew them.

## Capturing them again

When Landbot ships a new web chat (the canary says its bundle changed, or the runtime logs `host changed: …` in
`window.__lbwDropped`):

```sh
node scripts/capture-host.mjs "<share-url>" --button "<welcome button text>"
npm test
```

It writes the four files here (`--out <dir>` to write them elsewhere and compare first). If `test/host.test.mjs` fails on
the new DOM, fix `runtime/host-v4.js` and nothing else.
