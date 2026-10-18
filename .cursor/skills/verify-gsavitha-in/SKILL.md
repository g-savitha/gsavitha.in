---
name: verify-gsavitha-in
description: Verify the gsavitha.in Astro portfolio (static web UI) end to end. Builds the site, serves it with `astro preview`, drives Home, Papershelf, Writings, Goodies and the ThemePicker in headless Chrome, checks console errors and internal links, and saves screenshots. Use after changing pages, components, styles, or content (new paper, post, or cheat sheet), and before opening a PR.
---

# Verify gsavitha.in

Site layout, collections, and where to add content: [features/README.md](features/README.md).

## Run

```bash
bun install --frozen-lockfile
bun run verify:site          # astro build, then scripts/verify.ts
```

- Needs Node `>=22.12` (Astro refuses older) and Google Chrome at `/usr/bin/google-chrome`
  (override with `CHROME_PATH`). Chrome is driven through `playwright-core`; no browser download.
- `dist/` already fresh? Skip the build: `node --experimental-strip-types scripts/verify.ts`.
- Env: `VERIFY_OUT` (evidence dir, default `verify-artifacts/`, gitignored), `VERIFY_PORT`
  (default `4329`). Set `GITHUB_TOKEN` to build the real GitHub heatmap; without it the build still
  passes with an empty GitHub series (the script prints a note).

## What it checks

`scripts/verify.ts` prints one `PASS`/`FAIL` line per check, then `N/M checks passed`. Exit code 1
on any failure; the build step fails first on Astro or content-schema errors.

- **Static (dist/):** the 3 newest papers by `date` appear on `/papers` and Home and link to their
  `url`; every goodies entry is listed on `/goodies` and its `href` page is built with its title; the
  3 newest non-draft posts are built and listed on `/blog`; every internal `href`/`src` in every
  built HTML file resolves to a file in `dist/`.
- **Browser (`astro preview` + Chrome, 1280x900):** `/`, `/papers`, `/blog`, `/goodies`,
  `/goodies/gcp-ace-cheatsheet`, `/goodies/pstack-cheatsheet` return 200 with no console errors,
  uncaught exceptions, or same-origin 4xx/5xx. Home starts dark with the `DEFAULT_THEME` (purple)
  `--theme-color`; the GCP ACE mind map draws markmap nodes; clicking `Theme picker` then
  `Select pink theme` sets `data-theme`, changes `--theme-color` to that theme's hex, and
  survives a reload.

Expected colours and theme names come from `src/theme/palette.ts` (`PALETTE`, `DEFAULT_THEME`,
`THEME_NAMES`). `--theme-color` is an alias (`var(--theme-<name>)`); the script resolves the used
colour and compares it to `PALETTE`, so palette changes need no script edits.

`bun run verify` is a separate check (format, repo rules, `astro check`, unit tests, build, and
`tests/browser`). This skill's command is `bun run verify:site`.

## Evidence

`$VERIFY_OUT/*.png` (one per page plus `home-theme-<name>.png`) and `summary.json` with every
check. They survive cleanup. Look at the screenshots before claiming a visual change works: the
script proves pages render and themes switch, not that a layout looks right.

## Doctor and cleanup

- Port busy (`astro preview not ready`): `ss -ltnp | grep 4329`, or run with another `VERIFY_PORT`.
  Never drive or kill a preview you did not start.
- The script kills only the preview process group it spawned, including on failure.

## CI

[`ci-verify.yml`](ci-verify.yml) runs `bun run verify:site` on pull requests and uploads the
screenshots. It is a suggestion: copy it to `.github/workflows/verify.yml` to turn it on.

## Manual-only checks

- Visual judgment of new layouts or styles at mobile widths (`<1024px` switches to the mobile
  sidebar and its own ThemePicker).
- Audio player on a post with narration (needs R2 audio, not exercised here).
- `bun run dev`-only content such as drafts (`draft: true` is omitted from builds).
- External links (paper URLs, social links) are not fetched.

Add a check to `scripts/verify.ts` rather than a step here when it can be scripted. Keep the
feature map current with `/maintain-verification-skill`.
