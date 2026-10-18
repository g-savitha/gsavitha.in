# Papershelf

A searchable list of external papers and articles at `/papers`, newest first; the 5 newest also
appear on Home.

## Sub-features

- `papers-list` every entry in `src/content/papers` renders with title, date, and tags.
- `papers-home` the 5 newest by `date` appear on Home.
- `papers-search` typing in the list's search box filters titles.

## How to get to it (user POV)

- Sidebar link `Papershelf`, or Home's recent papers section.

## Driving it with scripts/verify.ts

Preconditions: fresh `bun run build`.

- **New entry renders.** Add a paper, then `bun run verify:site`. The `papers: "<title>" on /papers`,
  `... on home`, and `links to its url` lines pass for the 3 newest entries.
- **Visible in browser.** `papers: newest "<title>" visible in browser` passes and
  `$VERIFY_OUT/papers.png` shows it at the top.

## Gotchas

- `url` and `date` are required. The `linkOnly` loader drops the body, so the page is titles and links.
- Search filtering is not scripted yet; check it by hand if you change `SearchableList.tsx`.
