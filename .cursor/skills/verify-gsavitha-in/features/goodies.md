# Goodies and cheat sheets

`/goodies` lists small tools and cheat sheets; each entry links to its own page, such as the GCP ACE
mind map and the pstack cheat sheet.

## Sub-features

- `goodies-list` every `src/content/goodies` entry is listed with title, description, and date.
- `goodies-page` each entry's `href` page is built and shows its title.
- `goodies-mindmap` the GCP ACE page draws an interactive markmap.

## How to get to it (user POV)

- Sidebar link `Goodies`, then an entry.

## Driving it with scripts/verify.ts

Preconditions: fresh `bun run build`.

- **New cheat sheet.** Add the entry and its page, run `bun run verify:site`. The
  `goodies: ... listed`, `built`, and `shows its title` lines pass, and the internal-links check
  finds no broken `href`.
- **Mind map.** `goodies: mind map renders nodes` reports a node count above 0;
  `$VERIFY_OUT/goodies-gcp-ace-mindmap.png` shows the map.

## Gotchas

- An entry without a matching page fails `built` and the internal-links check: the index does not
  generate pages.
- The browser pass visits only the two existing cheat-sheet routes; add a new route to `routes` in
  `scripts/verify.ts` to screenshot and console-check it.
- The mind map loads with `client:visible`; the script scrolls it into view first.
