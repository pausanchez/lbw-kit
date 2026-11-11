# A carousel read live (lbw-kit v0.7.6)

`config.json` draws `[[lv:rides]]` from `catalog.csv`, fetched in the browser each page view. Fictional data.
The rows show what the reader does with a sheet a client edits: a missing cell, a per-language column (`name_es`),
an expired row, a bad id, a repeated id, a row with no name, a link outside `"links"`.
`"items"` is the saved copy drawn when the file can't be read.
