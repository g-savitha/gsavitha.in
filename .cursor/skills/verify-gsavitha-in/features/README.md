# gsavitha.in feature map

Astro 6 static site (React islands for interactive parts), dark-first, deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Read this before changing or verifying the site; run
[`bun run verify:site`](../SKILL.md) to prove changes.

## Pages and routes (`src/pages/`)

| Route                                     | File                                        | Notes                                                               |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `/`                                       | `index.astro`                               | Hero, 5 newest posts, 5 newest papers, practice row (heatmap + DSA) |
| `/blog`, `/blog/<id>`                     | `blog/index.astro`, `blog/[...slug].astro`  | "Writings"; nav label is `Blog`                                     |
| `/papers`                                 | `papers/index.astro`                        | Papershelf, a `SearchableList` of external links                    |
| `/goodies`                                | `goodies/index.astro`                       | Lists the `goodies` collection                                      |
| `/goodies/gcp-ace-cheatsheet`             | `goodies/gcp-ace-cheatsheet/index.astro`    | PDF links + `MindMapSection`                                        |
| `/goodies/pstack-cheatsheet`              | `goodies/pstack-cheatsheet/index.astro`     | Markdown body in `.prose`                                           |
| `/projects`                               | `projects/index.astro`                      | Data from `src/data/projectsList.ts` + GitHub API                   |
| `/certifications`, `/about`               | `certifications/index.astro`, `about.astro` |                                                                     |
| `/tags`, `/tags/<tag>`, `/categories/<c>` | `tags/`, `categories/`                      | Built from post tags/categories                                     |
| `/rss.xml`                                | `rss.xml.js`                                |                                                                     |

Navigation and social links live in `src/consts.ts` (`NAV_LINKS`, rendered by `Sidebar.astro` via
`NavigationLinks.astro`; `SOCIAL_LINKS`, icon row in `Footer.astro` on small screens via
`SocialLinks.astro`, labeled list in the desktop sidebar).

## Content collections (`src/content.config.ts`)

| Collection       | Folder                               | Frontmatter                                                                                                     |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `blog`           | `src/content/blog/*.md(x)`           | `title`, `date`, optional `description`, `tags`, `categories`, `draft`, `updatedDate`, `heroImage`, `audio`     |
| `papers`         | `src/content/papers/*.md(x)`         | `title`, required `url` and `date`, optional `tags`, `categories` (link-only via `linkOnly`; body not rendered) |
| `goodies`        | `src/content/goodies/*.md(x)`        | `title`, `description`, `href`, optional `icon` (Lucide name), `date`                                           |
| `certifications` | `src/content/certifications/*.md(x)` | `title`, `issuer`, optional `url`, `date`, `thumbnail`, `thumbnailUrl`                                          |

## Key components

- `ThemePicker.tsx` (in `Sidebar.astro`, desktop and mobile copies, `client:load`): button
  `aria-label="Theme picker"`, items `Select <name> theme`. Sets `html[data-theme]` and
  `localStorage['theme-color']`; `BaseHead.astro` re-applies it before paint. Themes, the default
  (`purple`), and accent colours live in `src/theme/palette.ts` (`PALETTE`, `DEFAULT_THEME`).
- `goodies/MindMapSection.astro` + `MindMap.tsx`: Markdown nested list to markmap SVG
  (`.mindmap__canvas`, `client:visible`), with a text-outline fallback. See README "Mind maps".
- `practice/ConsistencyHeatmap.tsx` and `practice/DsaProgress.tsx`: Home practice row.
- `SearchableList.tsx`: client-side filter for `/papers`.
- `blog/AudioPlayer.tsx`: narration player on posts with audio (`src/data/audioManifest.json`).

## Data fetched at build time

- GitHub contributions (`src/utils/githubContributions.ts`): needs `GITHUB_TOKEN`; missing token or
  API error gives an empty, `available: false` GitHub series (warning in the build log).
- LeetCode calendar and progress (`src/utils/leetcode.ts`, public GraphQL): on failure the heatmap
  drops LeetCode and Home shows a static DSA Progress placeholder.
- GitHub repos for `/projects` (`src/utils/github.ts`): `GITHUB_TOKEN` optional (rate limit); caches
  in `.cache/`, falls back to stale cache, then renders without live stats.

## Where to add content

- Paper: `bun run new paper <slug>` or add `src/content/papers/<slug>.md`.
- Post: `bun run new blog <slug>` (set `draft: true` to keep it out of builds).
- Cheat sheet: add `src/content/goodies/<slug>.md` with `href: /goodies/<slug>` **and** a page at
  `src/pages/goodies/<slug>/index.astro` (the index only links; it does not generate pages).

## Feature recipes

- [Papershelf](./papershelf.md)
- [Goodies and cheat sheets](./goodies.md)
- [Theme picker](./theme-picker.md)
