# Blog diagrams (Excalidraw)

Posts show hand-drawn Excalidraw diagrams as SVG images. The same file serves desktop and phone.

## Sub-features

- `diagram-render` every `diagrams/src/<post>/<name>.excalidraw` has a matching
  `public/diagrams/<post>/<name>.svg`, and `bun run diagrams` reports no label problems.
- `diagram-embed` posts reference `/diagrams/<post>/<name>.svg` with real alt text, as plain
  images (not links). The context-window post reuses its hero image
  (`src/assets/context-window-hero.png`) for the complete architecture.
- `diagram-fit` at 390px no page scrolls sideways. Flow diagrams land around 13 to 15px labels on
  the phone and natural width (16px labels) on desktop. Sequence diagrams are wider and shrink to
  the 556px desktop column (about 12 to 16px labels) and further on the phone.
- `diagram-icons` icons only on people, databases and caches, queues and Kafka topics, and AI
  services. Plain steps have none.

## How to get to it (user POV)

- `/blog/kafka-explained-like-you-are-5`, `/blog/thundering-herd`, `/blog/caching-strategies`,
  `/blog/prompt-caching`, `/blog/context-management-window`, `/blog/blog-audio-player`,
  `/blog/making-coding-agents-trustworthy`.

## Driving it

Preconditions: `bun install`, a Playwright Chromium, fresh `bun run build`, `bun run preview`.

- **Edit a diagram.** Change the `.excalidraw` source, run `bun run diagrams -- <post>`, and commit
  both files. A label that doesn't fit its shape fails the script.
- **Check it.** `bun run verify:site` checks every source has an SVG, and that each diagram post
  loads all its diagrams at 390px and has no sideways scroll (evidence in
  `verify-artifacts/diagrams-<post>-390.png`). Then screenshot each post above at 390px and
  1280px and look at every diagram: labels readable, no overlap, text inside shapes, arrows connected, nothing cut off. On the phone,
  `document.documentElement.scrollWidth` must be 390 or less. Rendered label px is
  `16 * img.clientWidth / img.naturalWidth`.

## Gotchas

- The site build never renders diagrams. Forgetting to re-run `bun run diagrams` ships the old SVG.
- Virgil has no arrow glyphs (`→`, `≤`). Write words instead or the text falls back to another font.
- Excalidraw only gives diamond and ellipse labels part of the shape's width. Keep diamond labels
  short or make the diamond wider.
- Sequence diagrams: actor header boxes, dashed lifelines, solid request arrows, dashed return
  arrows, notes in the dog-eared comment shape. Keep the longest message label to two lines and
  the whole diagram around 700 units wide or less, or desktop labels drop below 12px.
- Icons and low-level shapes (UML, ER, flowchart, data structures, network) come from
  `diagrams/libraries/`. Don't fetch icons from the network at render time; the
  renderer blocks all outside requests.
