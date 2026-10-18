/**
 * Single source of truth for Mermaid diagram colours. Edit this file to restyle every diagram.
 *
 * The palette restores the hand-picked colours the posts used before the shared theme: the
 * classDefs `src/scripts/mermaid.ts` used to inject (Tailwind 500 fills, 600 borders, 2px, yellow
 * accent; used by the Kafka and context-window posts) plus the audio-player post's own
 * `decision` / `storage` / `content` swatches. Diagrams render on Mermaid's `dark` theme, as they
 * did originally. Colours only move where `mermaid.test.ts` needs them to:
 *
 * - `primary` #3b82f6 -> #2563eb: white text on it was 3.7:1 (AA needs 4.5:1).
 * - `danger` / `miss` #ef4444 -> rose #fb7185 with black text: no harsh bright red, and white on
 *   #ef4444 was 3.8:1.
 * - `storage` #0891b2 -> #0e7490: white text on it was 3.7:1.
 *
 * Text rule: dark fills take white text, light fills (yellow, rose, mint, cyan) take black text.
 *
 * Posts never need to declare colours: flowcharts get `SHARED_CLASS_NAMES` injected by
 * `withSharedClassDefs`, so `A:::hit` or `class A,B miss` just works. See README "Mermaid diagrams".
 */
type Hex = `#${string}`;

interface Swatch {
  fill: Hex;
  stroke: Hex;
  text: Hex;
  /** Border width; the original injected classDefs used 2px, the audio-player ones the default. */
  strokeWidth: '1px' | '2px';
}

export const WHITE: Hex = '#ffffff';
export const BLACK: Hex = '#000000';

/** Mermaid's built-in theme; `dark` is what every diagram used before the shared palette. */
export const MERMAID_THEME = 'dark';

/** Overrides on top of the `dark` theme. Only the font; the rest is Mermaid's own dark look. */
export const MERMAID_THEME_VARIABLES = {
  fontFamily: 'Dank Mono, ui-monospace, monospace',
} as const;

const SWATCHES = {
  primary: { fill: '#2563eb', stroke: '#1d4ed8', text: WHITE, strokeWidth: '2px' },
  secondary: { fill: '#4b5563', stroke: '#374151', text: WHITE, strokeWidth: '2px' },
  accent: { fill: '#eab308', stroke: '#ca8a04', text: BLACK, strokeWidth: '2px' },
  info: { fill: '#06b6d4', stroke: '#0891b2', text: BLACK, strokeWidth: '2px' },
  success: { fill: '#22c55e', stroke: '#16a34a', text: BLACK, strokeWidth: '2px' },
  warning: { fill: '#f97316', stroke: '#ea580c', text: BLACK, strokeWidth: '2px' },
  danger: { fill: '#fb7185', stroke: '#e11d48', text: BLACK, strokeWidth: '2px' },
  decision: { fill: '#d97706', stroke: '#fcd34d', text: '#111827', strokeWidth: '1px' },
  storage: { fill: '#0e7490', stroke: '#67e8f9', text: WHITE, strokeWidth: '1px' },
  content: { fill: '#334155', stroke: '#94a3b8', text: WHITE, strokeWidth: '1px' },
} as const satisfies Record<string, Swatch>;

type SwatchName = keyof typeof SWATCHES;

/** Class name usable in any flowchart -> swatch. Aliases keep older posts' names working. */
const CLASS_SWATCH = {
  primary: 'primary',
  secondary: 'secondary',
  accent: 'accent',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  decision: 'decision',
  storage: 'storage',
  content: 'content',
  neutral: 'secondary',
  hit: 'success',
  miss: 'danger',
} as const satisfies Record<string, SwatchName>;

export type SharedClassName = keyof typeof CLASS_SWATCH;

export const SHARED_CLASS_NAMES = Object.keys(CLASS_SWATCH) as SharedClassName[];

export function sharedClassSwatch(name: SharedClassName): Swatch {
  return SWATCHES[CLASS_SWATCH[name]];
}

const SHARED_CLASS_DEFS = SHARED_CLASS_NAMES.map((name) => {
  const { fill, stroke, text, strokeWidth } = sharedClassSwatch(name);
  return `classDef ${name} fill:${fill},stroke:${stroke},stroke-width:${strokeWidth},color:${text}`;
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
