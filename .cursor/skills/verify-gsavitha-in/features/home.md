# Home shelves (Writings + Papershelf)

On `/`, after the practice row, Writings and Papershelf stack full-width (Writings first).
Shelves use the same content width as the practice row above (GitHub heatmap + LeetCode card):
no extra `max-w-*` on the shelf. The `All posts` / `All papers` pill's right edge lines up
with the LeetCode card's right edge; row dividers span that same width.

## Sub-features

- `home-writings` 5 newest non-draft posts with short date (`Oct 21`), full wrapping title, up to
  2 `#tag` chips from the first two of `post.data.tags`, and an `All posts` pill linking to `/blog`.
- `home-papers` 5 newest papers with short date, full wrapping title, up to 2 `#tag` chips from
  the first two of `paper.data.tags`, external-link icon, and an `All papers` pill linking to
  `/papers`.
- `home-shelf-layout` heading + pill on one row, blurb under; shelves always stacked. Tags sit
  under the title on mobile; on desktop they sit in a right-aligned column whose chip right edges
  share one vertical line with the pill. No sideways scroll.

## How to get to it (user POV)

- Open `/`. Scroll past the practice row. Or use the sidebar `Blog` / `Papershelf` links, which the
  pills also point at.

## Driving it with scripts/verify.ts

Preconditions: fresh `bun run build`.

- Papers already assert the 3 newest appear on Home (`papers: ... on home`). Posts on Home are not
  scripted yet; after a visual change, shoot `.home-row--shelves` at 390px and 1280px and check
  with `getBoundingClientRect` that the pill right edge matches the LeetCode (`.dsa-progress`)
  right edge within 1px, and that every `.list-row__tags` right edge matches the pill.

## Gotchas

- Short dates are Home-only (`FormattedDate format="short"`). Blog, papers list, and post headers
  still show the year.
- Titles on Home must not use `list-row__title--compact` (that class clamps to 2 lines). Use
  `list-row__title--shelf`.
- Tag chips are plain spans inside the row link (no nested anchors). Home shows the first 2
  frontmatter tags with a `#` prefix — keep those two the most topic-relevant; reorder rather
  than delete.
- `PillLink.astro` + `.pill-link` is the shared pill; keep the zinc border look.
- Practice row still uses `.home-row--practice` for a two-column desktop layout. Shelves do not.
- Shelf row links drop the shared list-row `-mx`/`px` so tags share the pill's right edge; the
  chevron is absolutely positioned so it does not steal that edge.
