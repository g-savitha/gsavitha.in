# Repository Working Agreement

This file defines the engineering conventions for contributors and coding agents working in this
repository. Preserve existing behavior unless a change is explicitly requested.

## Working Method

- Work incrementally: complete, verify, and present one step for review before starting the next.
- Keep each approved step in its own focused commit. Do not mix unrelated cleanup into a commit.
- Split unrelated changes into separate PRs. One change per PR, with a title that names that one
  change.
- Before editing, inspect the working tree and staged changes. Preserve user-authored changes and
  avoid overwriting or reformatting unrelated files.
- Reuse and improve existing code before introducing new abstractions or dependencies.
- Prefer small, reviewable changes that maintain the site's current behavior and appearance.

## Technology Boundaries

- Use TypeScript for new source files and when converting an existing JavaScript file is in scope.
  Keep strict types; avoid `any`, unsafe assertions, and duplicated type definitions.
- Use Astro for static pages, layouts, and presentational components that do not need client-side
  state or interaction.
- Use React for interaction-heavy or stateful functionality. Hydrate React islands only when
  needed, using the least eager appropriate Astro client directive.
- Do not move static Astro markup into React without a functional reason.

## Styling: Tailwind and Global CSS

- Use short, semantic class names in `.astro` and React markup. Keep Tailwind-backed class
  definitions centralized in `src/styles/global.css` instead of placing long utility lists inline.
- `src/styles/variables.css` is the single source of truth for colors, motion, surfaces, and other
  design tokens. Do not duplicate token values in TypeScript or component markup.
- `src/styles/global.css` owns base styles, reusable patterns, and semantic component classes.
- Reuse existing tokens, utilities, and shared classes before adding new ones. Extract repeated
  values into CSS custom properties or Tailwind-compatible theme tokens.
- Do not add CSS Modules, component-scoped `<style>` blocks, CSS-in-JS, or `style` attributes. Use
  semantic classes, state/data attributes, or typed HTML attributes instead. Runtime rendering
  geometry, such as canvas pan and zoom, may update DOM styles only when class-based CSS cannot
  express the value; keep every static declaration in the stylesheet.
- Prefer readable semantic class groups. Define component-specific selectors in `global.css` under
  the appropriate Tailwind layer and reuse existing classes before adding new ones.
- Preserve responsive, hover, focus, reduced-motion, and dark-theme behavior during refactors.

## Components and Reuse

- Keep components focused on one responsibility with small, typed public interfaces.
- Extract a shared component, helper, constant, or data structure when the same behavior or markup
  is meaningfully repeated. Do not create abstractions for a single trivial use.
- Keep one source of truth for shared navigation, content metadata, theme values, and repeated UI
  configuration.
- Prefer composition over large components with many conditional branches.
- Separate data transformation and side effects from rendering where practical.
- Handle empty, loading, and error states for interactive functionality. Do not silently swallow
  errors.

## Icons and SVGs

- Use `lucide-astro` for interface icons in Astro files and `lucide-react` in React files.
- Replace hand-authored inline SVG interface icons with the closest semantic Lucide icon.
- Decorative or content SVGs such as diagrams, illustrations, logos, and data visualizations are
  assets, not interface icons; keep them when Lucide is not an appropriate replacement.
- Give icon-only controls an accessible name. Mark purely decorative icons as hidden from assistive
  technology.

## Code Quality

- Optimize for readable, reusable, extensible, modular, and less error-prone code.
- Prefer descriptive names, early returns, and straightforward control flow.
- Avoid duplication, hidden coupling, magic values, dead code, and oversized files.
- Use immutable data and pure functions where they make behavior easier to understand and test.
- Maintain semantic HTML, keyboard support, visible focus states, and appropriate ARIA attributes.
- Preserve public URLs, content rendering, SEO metadata, and existing user-facing functionality.

## Formatting and Imports

- Every supported file must follow the repository Prettier configuration in `.prettierrc`.
- Configure Prettier's Tailwind CSS plugin as the canonical class-ordering mechanism. Let the
  formatter sort utility classes instead of manually maintaining a competing order.
- Run `bun run format:check` before completing a step. Format only files in scope when unrelated
  content is intentionally excluded from formatting.
- Follow the existing import conventions and use the `@/*` alias for stable cross-directory source
  imports when it improves clarity.
- Keep imports ordered consistently: external packages, internal modules, then types or assets as
  appropriate. Remove unused imports and exports.

## Linting and Static Analysis

- Use ESLint with TypeScript-, React-, Astro-, accessibility-, and import-aware rules appropriate to
  the files being checked.
- Treat lint errors as blockers. Fix the underlying problem instead of broadly disabling a rule.
- Keep any necessary lint suppression narrow, local, and accompanied by a short explanation.
- Keep Astro's strict TypeScript checking enabled and run `astro check` for template and type
  diagnostics.
- Add or update repository scripts so formatting, linting, type checking, and tests have stable
  commands that local development and CI share.

## Testing

- Add focused component tests for interactive React components and behavior with meaningful
  branching, state, events, or error handling.
- Test observable behavior and accessibility semantics rather than private implementation details or
  brittle snapshots.
- Add a regression test when fixing a reproducible bug when practical.
- Keep static Astro components lightweight; test shared logic directly and add rendered component or
  integration coverage only where it protects meaningful behavior.
- Tests must be deterministic and must not depend on live external services. Mock network and browser
  boundaries explicitly.

## Accessibility

- Target WCAG 2.1 AA for pages and components.
- Include automated accessibility checks for representative rendered pages and interactive
  components, using an axe-based tool or an equivalent maintained checker.
- Manually verify keyboard navigation, focus order and visibility, accessible names, heading
  hierarchy, landmarks, form labels, status announcements, and color contrast for affected UI.
- Do not rely on color, hover, or pointer input alone to communicate meaning or expose functionality.
- Treat serious automated accessibility violations and keyboard blockers as release-blocking issues.

## Continuous Integration

- CI must run on pull requests and protected-branch pushes using the same pinned runtime and lockfile
  used by local development.
- The required CI path should install dependencies with a frozen lockfile, then run formatting,
  linting, Astro/type checks, focused tests, accessibility checks, and the production build.
- Cache dependencies or build artifacts only when cache invalidation is tied to the lockfile and
  relevant configuration.
- Do not merge with required checks failing. Do not weaken or skip a check merely to make CI pass.
- Keep CI jobs focused enough that failures clearly identify the broken quality gate.

## Verification

- For page, component, style, or content changes, run `bun run verify:site` before you say you're
  done, and follow `.cursor/skills/verify-gsavitha-in/SKILL.md`. The site layout and where to add
  content are in `.cursor/skills/verify-gsavitha-in/features/README.md`.
- Run the smallest relevant checks while developing, then run the broader project checks before a
  step is committed.
- For source changes, normally run `bun run format:check`, `bunx astro check`, and `bun run build`.
- Once lint, test, class-sorting, accessibility, and CI tooling is added, run its repository scripts
  as required checks. Do not claim a check passed when its tool or script is not yet configured.
- Run relevant focused tests when changing tested functionality, and add tests for non-trivial logic
  or regressions when practical.
- When you report back, show what you ran and what you saw (the command, its result, the
  screenshots you looked at). Don't say "this should work".
- Report checks that could not be run and any known risk or follow-up work.

## Diagrams

Blog diagrams are hand-drawn Excalidraw scenes, shipped as SVG images.

- Sources: `diagrams/src/<post>/<name>.excalidraw`. Open and edit them in any Excalidraw editor
  (the VS Code extension works). Don't share or upload them anywhere.
- Output: `public/diagrams/<post>/<name>.svg`, committed. The site build never runs Chromium.
- Re-render: `npm run diagrams` (or `bun run diagrams`), or `npm run diagrams -- kafka` for one post,
  and `-- --png=/tmp/diagrams` for PNG previews. `scripts/diagrams/render.mjs` uses the real
  `@excalidraw/excalidraw` export in headless Chromium, blocks all network, and fails when a label
  doesn't fit its shape. It needs a Playwright Chromium (`bunx playwright-core install chromium`).
- Libraries: `diagrams/libraries/*.excalidrawlib`, public MIT Excalidraw libraries (list in the
  README there). Icons: it-icons, system-design, data-sources, robots. Low-level design: uml-er
  (class, ER), uml-activity (states, actions, notes), flowchart, data-structures (arrays, linked
  lists, trees, hash tables), graphs, network-topology, message-queue. Use them before drawing your
  own.
- Embed: `![plain alt text that says what the diagram shows](/diagrams/<post>/<name>.svg)`. CSS in
  `src/styles/global.css` keeps the natural width when it fits and shrinks it to the column when
  it doesn't. Diagrams are plain images, not links.

Rules:

- Keep every node and every relationship from the idea you're drawing. Never drop meaning to make it
  fit. Redesign the layout instead.
- Hand-drawn style: roughness 1, Virgil font (fontFamily 1). Transparent background.
- Colours: bright strokes with dark fills of the same hue, so they read on the dark site
  (`#18181b`). Text is light (`#e5e5e5`). Keep a colour meaning the same across a diagram (green is
  good or done, red is failure or miss, amber is a decision).
- Group containers: transparent fill, thin light outline, readable title. Don't let arrows cross
  the title (put it at the bottom or right if they would).
- Icons only where they add meaning: people (user, client, requests), databases and caches, queues
  and Kafka topics, AI or cloud services (LLM). No icons on plain steps, layers, files, or generic
  services and servers. Take them from the shared libraries, recolour them to the node's stroke
  colour, and keep the label next to the icon.
- Labels: fontSize 16, secondary text 14 or 15 at minimum. Short and plain.
- Size: flow diagrams are about 360 to 400 scene units wide, vertical and stacked. Rendered labels
  must be no bigger than body text (16px) on desktop and around 13 to 15px on a 390px phone.
- One diagram for both widths. No desktop/mobile variants, and never a horizontal scroll at 390px.
- Sequence diagrams are real sequence diagrams: actor header boxes, dashed lifelines, horizontal
  labelled arrows (requests solid, returns dashed), notes as comment boxes. Keep every message.
  They can be wider than the phone column (aim for 700 units or less so they stay readable on
  desktop); they scale down to fit the column.
- Charts and timelines are fine. Draw curves with line elements and points.
- Before merging a diagram change, run `bun run verify:site` (it checks every diagram loads and
  causes no sideways scroll at 390px). Then open the posts at 390px and
  1280px and look at every diagram: readable labels, no overlap, text inside shapes, arrows
  connected, nothing cut off.

## Commit Discipline

- Do not stage or commit until the current step has been presented for review and approved.
- Use one focused commit per approved step with a concise message describing the outcome.
- Before committing, review the staged diff and confirm it contains only the approved step.
- After each commit, stop and report the result before beginning the next step.
