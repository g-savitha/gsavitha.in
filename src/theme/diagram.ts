/**
 * Diagram colours for every post. Posts name a class (`class: hit`) and never a hex value.
 * `d2Preamble()` turns this palette into the D2 header the remark plugin prepends, so sketch
 * mode, ELK, the canvas, and edge animation stay in one place.
 *
 * The colours are the hand-picked ones the posts used before the shared theme, with AA nudges:
 * - Shared base (`primary`, `accent`, `success`...): Tailwind 500 fills, 600 borders, 2px, yellow
 *   accent. `primary` #3b82f6 -> #2563eb and `danger` #ef4444 -> rose #fb7185 with black text.
 * - Light-border set (`royal`, `violet`, `emerald`, `teal`, `amber`...): deeper fills with light
 *   300 borders. #059669 -> #047857 and #0891b2 -> #0e7490 for AA.
 * - Theme-border set (`peach`, `roseFlat`, `maroon`, `cobalt`, `forest`): 1px #ccc borders.
 *   Harsh red #b71c1c -> maroon #9f1239.
 *
 * Text rule (enforced by `diagram.test.ts`, WCAG AA): dark fills take white text, light fills
 * (yellow, rose, peach, mint, cyan) take black text. The canvas is the site surface. D2 draws
 * its own sketch hatch; this file does not set `fill-pattern`.
 */
import { SURFACE } from './palette.ts';

type Hex = `#${string}`;

export interface Swatch {
  fill: Hex;
  text: Hex;
  border: Hex;
  borderWidth: '1px' | '2px';
}

export const WHITE: Hex = '#ffffff';
export const BLACK: Hex = '#000000';

/** Arrow and edge-label colour. Same light grey the dark diagrams used for lines. */
export const DIAGRAM_EDGE: Hex = '#cccccc';

/** Light grey border for nodes that only have a fill and text colour. */
const THEME_BORDER: Hex = '#cccccc';

/** Every diagram colour, by name. Each name is also a D2 class. */
export const PALETTE = {
  blue: { fill: '#2563eb', text: WHITE, border: '#1d4ed8', borderWidth: '2px' },
  grey: { fill: '#4b5563', text: WHITE, border: '#374151', borderWidth: '2px' },
  yellow: { fill: '#eab308', text: BLACK, border: '#ca8a04', borderWidth: '2px' },
  cyan: { fill: '#06b6d4', text: BLACK, border: '#0891b2', borderWidth: '2px' },
  green: { fill: '#22c55e', text: BLACK, border: '#16a34a', borderWidth: '2px' },
  orange: { fill: '#f97316', text: BLACK, border: '#ea580c', borderWidth: '2px' },
  rose: { fill: '#fb7185', text: BLACK, border: '#e11d48', borderWidth: '2px' },

  royal: { fill: '#2563eb', text: WHITE, border: '#93c5fd', borderWidth: '2px' },
  violet: { fill: '#7c3aed', text: WHITE, border: '#c4b5fd', borderWidth: '2px' },
  emerald: { fill: '#047857', text: WHITE, border: '#6ee7b7', borderWidth: '2px' },
  teal: { fill: '#0e7490', text: WHITE, border: '#67e8f9', borderWidth: '2px' },
  amber: { fill: '#d97706', text: '#111827', border: '#fcd34d', borderWidth: '2px' },
  tealThin: { fill: '#0e7490', text: WHITE, border: '#67e8f9', borderWidth: '1px' },
  amberThin: { fill: '#d97706', text: '#111827', border: '#fcd34d', borderWidth: '1px' },
  slate: { fill: '#334155', text: WHITE, border: '#94a3b8', borderWidth: '1px' },

  peach: { fill: '#fdba74', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  roseFlat: { fill: '#fb7185', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  maroon: { fill: '#9f1239', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  cobalt: { fill: '#1565c0', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  forest: { fill: '#2e7d32', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
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

/** D2 header prepended to every post diagram. No font flags: D2 keeps Source Sans. */
export function d2Preamble(): string {
  const classes = SHARED_CLASS_NAMES.map((name) => {
    const { fill, border, borderWidth, text } = sharedClassSwatch(name);
    const width = borderWidth === '1px' ? 1 : 2;
    return `  ${name}: {style: {fill: "${fill}"; stroke: "${border}"; stroke-width: ${width}; font-color: "${text}"}}`;
  }).join('\n');

  return `vars: {
  d2-config: {
    theme-id: 200
    dark-theme-id: 200
    sketch: true
    pad: 40
    layout-engine: elk
  }
}
style.fill: "${SURFACE}"
classes: {
${classes}
}
(* -> *)[*]: {style: {stroke: "${DIAGRAM_EDGE}"; stroke-width: 2; animated: true; font-color: "${DIAGRAM_EDGE}"; italic: false}}
`;
}
