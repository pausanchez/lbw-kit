# lbw-kit principles

What the kit is for, what it is not for, and the questions every new feature has to answer before it ships. When a change and these principles disagree, the change loses or this page is changed on purpose, in its own commit.

## What it is
1. **The agent chooses, the code tells.** An AI agent in a Landbot web chat picks which widget to show by writing a short tag. The widget's facts (prices, dates, stock, specs) come from data the bot owns: a config, a sheet, an API, Landbot fields. The model never supplies them, and an id it invents draws nothing.
2. **Widgets live inside the conversation.** A widget is an answer in a chat: the visitor can always read it, tap it, or type something else, and the agent answers. The chat stays a chat.
3. **One config per bot, checked before it ships.** A bot's widgets are one JSON object, validated by the checker and the schema. No hand-written JavaScript per bot unless the JSON can't say it.
4. **One place that knows Landbot.** Everything the kit assumes about Landbot's web chat lives in `runtime/host-v4.js`. When Landbot changes, the fix is in one file, and the canary and the e2e tests say so first.
5. **Data can be static or live with the same widget.** The same config shape draws from a static table or a live source, without changing the agent's tags.
6. **Proven with people, not only with assertions.** A feature is done when a first-time visitor on a phone can read everything, always knows what to do next, can reach and read the text box, and gets a useful answer to anything they type.

## What it is not
- Not a way to make the chat look like something else. A widget may be rich, but the kit does not hide the conversation, take over the window, or reorder Landbot's own interface to imitate an app.
- Not a showcase engine. A feature that only exists to impress in a demo, and that a real bot would not keep, does not ship.
- Not a per-bot hack. If one bot needs something, it goes into the kit for every bot, or it stays in that bot's config.

## Questions before a feature ships
1. Does it make the conversation with the agent better, for a visitor with a goal?
2. How many new things does it assume about Landbot's DOM (`data-lb-*` parts, classes, scroll, layout)? Each one is a future breakage. More than one needs a strong reason.
3. What does it add to every bot's download (gzip), and is it loaded only by the bots that use it?
4. Which visitor-level checks prove it: contrast of what they type, the text box reachable without scrolling on a phone with the keyboard open, a useful reply to free text, the active widget in view after a reply, no duplicated controls?
5. Would we keep it in a bot that has been live for a year?

## Experimental features
A feature that fails a question above but is worth learning from ships as **experimental**: off by default, marked in the README, the reference and the gallery, not used in demos to sell the kit, and decided (kept, reshaped into a smaller feature, or removed) at the next minor version with evidence.

Current experimental features: **screen mode** (`"screen"`), since v0.13.0.

---
lbw-kit is a personal project, not an official Landbot product.
