# A carousel read live (lbw-kit v0.7.6)

`config.json` draws `[[lv:rides]]` from `catalog.csv`, fetched in the browser each page view. Fictional data.
The rows show what the reader does with a sheet a client edits: a missing cell, a per-language column (`name_es`),
an expired row, a bad id, a repeated id, a row with no name, a link outside `"links"`.
`"items"` is the saved copy drawn when the file can't be read.

`agent-instructions.txt` is a starting file for a bot in several languages: the language rule with a `lang` field,
`lang=` in every tag, button sentences listed once, who is talking, the refusal list, what it doesn't know.
