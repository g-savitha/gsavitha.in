# Theme picker

The paint-bucket button in the sidebar switches the accent colour (pink, purple, yellow, green,
blue, orange) on a dark surface; purple is the default and the choice persists.

## Sub-features

- `theme-default` first visit: no `data-theme`, `--theme-color` is purple, dark background.
- `theme-switch` choosing a swatch sets `html[data-theme]` and `--theme-color`.
- `theme-persist` the choice survives reloads via `localStorage['theme-color']`.

## How to get to it (user POV)

- Sidebar button `Theme picker` (desktop sidebar at 1024px and up, mobile header below), then
  `Select <name> theme`.

## Driving it with scripts/verify.ts

Preconditions: fresh profile (the script uses a new browser context).

- **Default.** `theme: default accent is purple` and `theme: dark surface by default` pass;
  `$VERIFY_OUT/home.png` is purple.
- **Switch and persist.** The script clicks the visible `Theme picker` and `Select pink theme`;
  the `picker sets data-theme`, `accent changes`, and `persists after reload` lines pass;
  `$VERIFY_OUT/home-theme-pink.png` is pink.

## Gotchas

- Two pickers exist in the DOM (desktop and mobile); target the `:visible` one.
- Compare the resolved `--theme-color` against `PALETTE` in `src/theme/palette.ts`, not a hardcoded
  hex. The custom property is `var(--theme-<name>)`; resolve the used colour before comparing.
