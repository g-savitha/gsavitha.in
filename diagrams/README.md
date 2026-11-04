# Diagrams

Excalidraw sources for blog diagrams. `src/<post>/<name>.excalidraw` renders to
`public/diagrams/<post>/<name>.svg`:

```sh
bun run diagrams             # everything
bun run diagrams -- kafka    # one post
bun run diagrams -- --png=/tmp/diagrams   # also PNG previews on the site background
```

The drawing rules (colours, sizes, layout, how to check them) are in
[AGENTS.md](../AGENTS.md#diagrams). Icons and low-level design shapes (UML class and ER, activity and state, flowchart,
data structures, graphs, network, message queues) are in [`libraries/`](libraries/README.md).
