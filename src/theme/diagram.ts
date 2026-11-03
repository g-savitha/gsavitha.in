/**
 * Shared D2 header for every post diagram. Colours come from D2's Dark Mauve theme
 * (theme-id 200), not the site accent palette. Sketch mode, ELK, label size, container
 * chrome, and edge animation stay here so posts only write shapes and connections.
 *
 * Containers (non-leaf groups) always get a transparent fill, no hatch pattern, and a
 * plain white outline — never tied to the site accent.
 *
 * Animated edges: solid main-flow arrows animate; dashed edges (replies, side notes,
 * async) stay still.
 *
 * Wide diagrams are fitted in `fitDiagramSvg` so labels stay near body size on a phone
 * column without horizontal overflow. Prefer `direction: down` in the fence when a
 * rightward layout would be very wide — fitting then has less work to do.
 */
/** Label size in px. Matches blog body text (1rem / 16px), at most +1–2px. */
export const DIAGRAM_FONT_SIZE = 17;

/**
 * Max SVG width in CSS pixels after fitting. Blog main uses `px-4` (16px each side), so
 * a 390px phone leaves ~358px; 350 leaves a little room.
 */
export const DIAGRAM_MAX_WIDTH = 350;

/** Always-white container outline. Not the site accent. */
export const CONTAINER_STROKE = '#ffffff';

/** D2 header prepended to every post diagram. No font family: D2 keeps its default. */
export function d2Preamble(): string {
  return `vars: {
  d2-config: {
    theme-id: 200
    dark-theme-id: 200
    sketch: true
    pad: 32
    layout-engine: elk
  }
}
*: {
  style.font-size: ${DIAGRAM_FONT_SIZE}
}
*: {
  &leaf: false
  style.fill: "transparent"
  style.fill-pattern: none
  style.stroke: "${CONTAINER_STROKE}"
  style.stroke-width: 2
  style.font-color: "${CONTAINER_STROKE}"
  style.font-size: ${DIAGRAM_FONT_SIZE}
}
(* -> *)[*]: {style: {stroke-width: 2; animated: true; italic: false; font-size: ${DIAGRAM_FONT_SIZE}}}
(* -> *)[*]: {
  &style.stroke-dash: *
  style.animated: false
}
`;
}
