# Home shelves (Writings + Papershelf)

On `/`, after the practice row, Writings and Papershelf stack full-width (Writings first).
Each shelf is capped at `max-w-3xl` so title lines stay readable.

## Sub-features

- `home-writings` 5 newest non-draft posts with short date (`Oct 21`), full wrapping title, up to
  2 `#tag` chips from `post.data.tags`, and an `All posts` pill linking to `/blog`.
- `home-papers` 5 newest papers with short date, full wrapping title, up to 2 `#tag` chips from
  `paper.data.tags`, external-link icon, and an `All papers` pill linking to `/papers`.
- `home-shelf-layout` heading + pill on one row, blurb under; shelves always stacked (not
  side-by-side). Tags sit under the title on mobile and to the right of the title on desktop.
  No sideways scroll.

## How to get to it (user POV)

- Open `/`. Scroll past the practice row. Or use the sidebar `Blog` / `Papershelf` links, which the
  pills also point at.

## Driving it with scripts/verify.ts

Preconditions: fresh `bun run build`.

- Papers already assert the 3 newest appear on Home (`papers: ... on home`). Posts on Home are not
  scripted yet; after a visual change, look at `$VERIFY_OUT` home screenshots or shoot
  `.home-row--shelves` at 390px and 1280px yourself.

## Gotchas

- Short dates are Home-only (`FormattedDate format="short"`). Blog, papers list, and post headers
  still show the year.
- Titles on Home must not use `list-row__title--compact` (that class clamps to 2 lines). Use
  `list-row__title--shelf`.
- Tag chips are plain spans inside the row link (no nested anchors). First 2 frontmatter tags only,
  with a `#` prefix.
- `PillLink.astro` + `.pill-link` is the shared pill; keep the zinc border look.
- Practice row still uses `.home-row--practice` for a two-column desktop layout. Shelves do not.
