/**
 * Single source of truth for Mermaid diagram colours. Posts contain no hex colours: every colour a
 * diagram uses is a named entry in `PALETTE`, and flowcharts get one `classDef` per class name
 * injected by `withSharedClassDefs`, so `A:::hit` or `class A,B severity2` just works.
 *
 * To swap the palette, edit the `PALETTE` entries (fill / text / border / borderWidth). Class
 * names in `CLASS_ALIASES` point at palette entries, so posts never need to change.
 *
 * The colours are the hand-picked ones the posts used before the shared theme, with AA nudges:
 * - Shared base (`primary`, `accent`, `success`...): the classDefs `src/scripts/mermaid.ts` used
 *   to inject (Tailwind 500 fills, 600 borders, 2px, yellow accent). `primary` #3b82f6 -> #2563eb
 *   and `danger` #ef4444 -> rose #fb7185 with black text (AA, and no harsh bright red).
 * - Light-border set (`royal`, `violet`, `emerald`, `teal`, `amber`...): the audio-player post's
 *   own classDefs (Tailwind 600/700 fills, 300 borders). #059669 -> #047857 and #0891b2 ->
 *   #0e7490 for AA.
 * - Theme-border set (`peach`, `roseFlat`, `maroon`, `cobalt`, `forest`): the thundering-herd
 *   post's `style` colours, which kept Mermaid's default #ccc 1px border. Harsh red #b71c1c ->
 *   maroon #9f1239.
 *
 * Text rule (enforced by `mermaid.test.ts`, with WCAG AA): dark fills take white text, light
 * fills (yellow, rose, peach, mint, cyan) take black text. Diagrams render on Mermaid's `dark`
 * theme. See README "Mermaid diagrams".
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

/** Mermaid's built-in theme; `dark` is what every diagram used before the shared palette. */
export const MERMAID_THEME = 'dark';

/** Overrides on top of the `dark` theme. Only the font; the rest is Mermaid's own dark look. */
export const MERMAID_THEME_VARIABLES = {
  fontFamily: 'Dank Mono, ui-monospace, monospace',
} as const;

/** Mermaid's `dark` theme node border, kept by nodes that only had a fill and text colour. */
const THEME_BORDER: Hex = '#cccccc';

/** The palette: every diagram colour, by name. Each name is also usable as a class. */
export const PALETTE = {
  // Shared base: Tailwind 500 fills, darker 600 borders, 2px.
  blue: { fill: '#2563eb', text: WHITE, border: '#1d4ed8', borderWidth: '2px' },
  grey: { fill: '#4b5563', text: WHITE, border: '#374151', borderWidth: '2px' },
  yellow: { fill: '#eab308', text: BLACK, border: '#ca8a04', borderWidth: '2px' },
  cyan: { fill: '#06b6d4', text: BLACK, border: '#0891b2', borderWidth: '2px' },
  green: { fill: '#22c55e', text: BLACK, border: '#16a34a', borderWidth: '2px' },
  orange: { fill: '#f97316', text: BLACK, border: '#ea580c', borderWidth: '2px' },
  rose: { fill: '#fb7185', text: BLACK, border: '#e11d48', borderWidth: '2px' },

  // Light-border set (audio-player post): deeper fills with light 300 borders.
  royal: { fill: '#2563eb', text: WHITE, border: '#93c5fd', borderWidth: '2px' },
  violet: { fill: '#7c3aed', text: WHITE, border: '#c4b5fd', borderWidth: '2px' },
  emerald: { fill: '#047857', text: WHITE, border: '#6ee7b7', borderWidth: '2px' },
  teal: { fill: '#0e7490', text: WHITE, border: '#67e8f9', borderWidth: '2px' },
  amber: { fill: '#d97706', text: '#111827', border: '#fcd34d', borderWidth: '2px' },
  tealThin: { fill: '#0e7490', text: WHITE, border: '#67e8f9', borderWidth: '1px' },
  amberThin: { fill: '#d97706', text: '#111827', border: '#fcd34d', borderWidth: '1px' },
  slate: { fill: '#334155', text: WHITE, border: '#94a3b8', borderWidth: '1px' },

  // Theme-border set (thundering-herd post): Mermaid's default #ccc 1px border.
  peach: { fill: '#fdba74', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  roseFlat: { fill: '#fb7185', text: BLACK, border: THEME_BORDER, borderWidth: '1px' },
  maroon: { fill: '#9f1239', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  cobalt: { fill: '#1565c0', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
  forest: { fill: '#2e7d32', text: WHITE, border: THEME_BORDER, borderWidth: '1px' },
} as const satisfies Record<string, Swatch>;

export type PaletteName = keyof typeof PALETTE;

/** Semantic class names -> palette entry. Aliases keep older posts' names working. */
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

const SHARED_CLASS_DEFS = SHARED_CLASS_NAMES.map((name) => {
  const { fill, border, borderWidth, text } = sharedClassSwatch(name);
  return `classDef ${name} fill:${fill},stroke:${border},stroke-width:${borderWidth},color:${text}`;
});

const FLOWCHART_HEADER = /^\s*(flowchart|graph)\b/;

/**
 * Inserts the shared `classDef`s right after a flowchart's header line. A post's own `classDef`
 * with the same name comes later and wins, so intentional one-off styling still works.
 */
export function withSharedClassDefs(source: string): string {
  const lines = source.trim().split('\n');
  const header = lines.findIndex((line) => FLOWCHART_HEADER.test(line));
  if (header === -1) return lines.join('\n');
  return [...lines.slice(0, header + 1), ...SHARED_CLASS_DEFS, ...lines.slice(header + 1)].join(
    '\n',
  );
}
