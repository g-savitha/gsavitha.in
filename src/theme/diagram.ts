/**
 * Diagram colours for every post. Posts name a class (`class: hit`) and never a hex value.
 * `d2Preamble()` turns this palette into the D2 header the remark plugin prepends.
 *
 * No D2 built-in themes — colours come from this site palette only, and the canvas fill is
 * transparent so diagrams sit on the portfolio background. Sketch mode, ELK, and the
 * animated-edge rule stay here too.
 *
 * Animated edges: solid main-flow arrows animate; dashed edges (replies, side notes,
 * async) stay still.
 *
 * Posts should ship `@@@desktop` / `@@@mobile` variants when a wide layout would shrink
 * below body-sized labels on a phone. Natural SVG size + 16px fonts; never CSS scale-down.
 */
type Hex = `#${string}`;

export interface Swatch {
  fill: Hex;
  text: Hex;
  border: Hex;
  borderWidth: '1px' | '2px';
}

export const WHITE: Hex = '#ffffff';
export const BLACK: Hex = '#000000';

/** Arrow and edge-label colour. */
export const DIAGRAM_EDGE: Hex = '#cccccc';

/** Light grey border for nodes that only have a fill and text colour. */
const THEME_BORDER: Hex = '#cccccc';

/**
 * Group/container chrome (parents that wrap other nodes). Transparent fill + no sketch
 * hatch, with a light outline and body-sized label so titles stay readable on the dark site.
 */
export const DIAGRAM_CONTAINER_STROKE: Hex = DIAGRAM_EDGE;
export const DIAGRAM_CONTAINER_LABEL: Hex = WHITE;

/**
 * Every diagram colour, by name. Each name is also a D2 class.
 * Base set tracks the portfolio accents (pink / purple / yellow / green / blue / orange)
 * plus the extra hues posts already use for hits, storage, severity, and so on.
 */
export const PALETTE = {
  blue: { fill: '#60a5fa', text: BLACK, border: '#93c5fd', borderWidth: '2px' },
  grey: { fill: '#4b5563', text: WHITE, border: '#9ca3af', borderWidth: '2px' },
  yellow: { fill: '#facc15', text: BLACK, border: '#fde047', borderWidth: '2px' },
  cyan: { fill: '#22d3ee', text: BLACK, border: '#67e8f9', borderWidth: '2px' },
  green: { fill: '#4ade80', text: BLACK, border: '#86efac', borderWidth: '2px' },
  orange: { fill: '#fb923c', text: BLACK, border: '#fdba74', borderWidth: '2px' },
  rose: { fill: '#f472b6', text: BLACK, border: '#f9a8d4', borderWidth: '2px' },
  purple: { fill: '#c084fc', text: BLACK, border: '#d8b4fe', borderWidth: '2px' },

  royal: { fill: '#60a5fa', text: BLACK, border: '#93c5fd', borderWidth: '2px' },
  violet: { fill: '#c084fc', text: BLACK, border: '#d8b4fe', borderWidth: '2px' },
  emerald: { fill: '#4ade80', text: BLACK, border: '#86efac', borderWidth: '2px' },
  teal: { fill: '#2dd4bf', text: BLACK, border: '#5eead4', borderWidth: '2px' },
  amber: { fill: '#fbbf24', text: BLACK, border: '#fcd34d', borderWidth: '2px' },
  tealThin: { fill: '#2dd4bf', text: BLACK, border: '#5eead4', borderWidth: '1px' },
  amberThin: { fill: '#fbbf24', text: BLACK, border: '#fcd34d', borderWidth: '1px' },
  slate: { fill: '#64748b', text: WHITE, border: '#94a3b8', borderWidth: '1px' },

  peach: { fill: '#fdba74', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  roseFlat: { fill: '#f472b6', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  maroon: { fill: '#e11d48', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  cobalt: { fill: '#1d4ed8', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  forest: { fill: '#15803d', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
} as const satisfies Record<string, Swatch>;

export type PaletteName = keyof typeof PALETTE;

/** Semantic class names -> palette entry. Aliases keep the old diagram names working. */
const CLASS_ALIASES = {
  primary: 'blue',
  secondary: 'grey',
  neutral: 'grey',
  accent: 'yellow',
  info: 'cyan',
  success: 'green',
  hit: 'green',
  warning: 'orange',
  danger: 'rose',
  miss: 'rose',
  decision: 'amberThin',
  storage: 'tealThin',
  content: 'slate',
  severity1: 'peach',
  severity2: 'roseFlat',
  severity3: 'maroon',
} as const satisfies Record<string, PaletteName>;

export type SharedClassName = keyof typeof CLASS_ALIASES | PaletteName;

export const SHARED_CLASS_NAMES = [
  ...Object.keys(CLASS_ALIASES),
  ...Object.keys(PALETTE),
] as SharedClassName[];

export function sharedClassSwatch(name: SharedClassName): Swatch {
  return name in CLASS_ALIASES
    ? PALETTE[CLASS_ALIASES[name as keyof typeof CLASS_ALIASES]]
    : PALETTE[name as PaletteName];
}

/**
 * Body text on the site is 1rem (16px). Diagrams render at this font size and keep their
 * natural width (see prepareDiagramSvg) so CSS never shrinks glyphs below body size.
 * Keep `pad` tight — large padding forces wide viewBoxes that cannot fit a phone column.
 */
export const DIAGRAM_FONT_SIZE = 16;

/** D2 header prepended to every post diagram. */
export function d2Preamble(): string {
  const classes = SHARED_CLASS_NAMES.map((name) => {
    const { fill, border, borderWidth, text } = sharedClassSwatch(name);
    const width = borderWidth === '1px' ? 1 : 2;
    return `  ${name}: {style: {fill: "${fill}"; stroke: "${border}"; stroke-width: ${width}; font-color: "${text}"; font-size: ${DIAGRAM_FONT_SIZE}}}`;
  }).join('\n');

  const fallback = sharedClassSwatch('neutral');

  // Do not set `*: style.fill` — in D2 that overrides `class:` fills and greys every node.
  // Container chrome is finished in `styleDiagramContainers` after render: D2 sketch still
  // paints a dark hatch on parents even when fill is transparent, and flattens children out
  // of the parent `<g>`, so SVG post-process is what actually clears every container.
  return `vars: {
  d2-config: {
    sketch: true
    pad: 8
    layout-engine: elk
  }
}
style.fill: "transparent"
*: {
  style.font-size: ${DIAGRAM_FONT_SIZE}
  style.stroke-width: 2
}
classes: {
${classes}
  container: {style: {fill: "transparent"; stroke: "${DIAGRAM_CONTAINER_STROKE}"; stroke-width: 2; font-color: "${DIAGRAM_CONTAINER_LABEL}"; font-size: ${DIAGRAM_FONT_SIZE}}}
  unmarked: {style: {fill: "${fallback.fill}"; stroke: "${fallback.border}"; stroke-width: 2; font-color: "${fallback.text}"; font-size: ${DIAGRAM_FONT_SIZE}}}
}
(* -> *)[*]: {style: {stroke: "${DIAGRAM_EDGE}"; stroke-width: 2; animated: true; font-color: "${DIAGRAM_EDGE}"; font-size: ${DIAGRAM_FONT_SIZE}; italic: false}}
(* -> *)[*]: {
  &style.stroke-dash: *
  style.animated: false
}
`;
}
