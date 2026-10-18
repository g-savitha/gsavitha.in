/**
 * Single source of truth for Mermaid diagram colours. Edit this file to restyle every diagram.
 *
 * Mermaid derives shades from `themeVariables` with its own colour maths, so it needs literal hex
 * values (CSS custom properties do not work here). The palette is standalone, tuned for the dark
 * page surface, and does not follow the site accent. Swatch fills are the Tailwind 600/700 tones
 * first hand-written in `blog-audio-player.md`; `mermaid.test.ts` keeps every text/fill pair at
 * WCAG AA (>= 4.5:1).
 *
 * Posts never declare colours: flowcharts get `SHARED_CLASS_NAMES` injected by
 * `withSharedClassDefs`, so `A:::hit` or `class A,B miss` just works. See README "Mermaid diagrams".
 */
type Hex = `#${string}`;

interface Swatch {
  fill: Hex;
  stroke: Hex;
  text: Hex;
}

/** Dark surface diagrams sit on (page background, zinc-900). */
export const MERMAID_SURFACE: Hex = '#18181b';

const SWATCHES = {
  primary: { fill: '#2563eb', stroke: '#93c5fd', text: '#ffffff' },
  accent: { fill: '#7c3aed', stroke: '#c4b5fd', text: '#ffffff' },
  info: { fill: '#0e7490', stroke: '#67e8f9', text: '#ffffff' },
  success: { fill: '#047857', stroke: '#6ee7b7', text: '#ffffff' },
  warning: { fill: '#d97706', stroke: '#fcd34d', text: '#111827' },
  danger: { fill: '#b91c1c', stroke: '#fca5a5', text: '#ffffff' },
  neutral: { fill: '#334155', stroke: '#94a3b8', text: '#ffffff' },
} as const satisfies Record<string, Swatch>;

type SwatchName = keyof typeof SWATCHES;

/** Class name usable in any flowchart -> swatch. Aliases keep older posts' names working. */
const CLASS_SWATCH = {
  primary: 'primary',
  accent: 'accent',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral',
  hit: 'success',
  miss: 'danger',
  secondary: 'neutral',
  content: 'neutral',
  decision: 'warning',
  storage: 'info',
} as const satisfies Record<string, SwatchName>;

export type SharedClassName = keyof typeof CLASS_SWATCH;

export const SHARED_CLASS_NAMES = Object.keys(CLASS_SWATCH) as SharedClassName[];

export function sharedClassSwatch(name: SharedClassName): Swatch {
  return SWATCHES[CLASS_SWATCH[name]];
}

const SLATE = {
  50: '#f8fafc',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
} as const satisfies Record<number, Hex>;

const FONT_FAMILY = 'Dank Mono, ui-monospace, monospace';

/** Passed to `mermaid.initialize` with `theme: 'base'` (the only theme Mermaid lets you recolour). */
export const MERMAID_THEME_VARIABLES = {
  darkMode: true,
  fontFamily: FONT_FAMILY,
  background: MERMAID_SURFACE,
  textColor: SLATE[200],

  // Unclassed nodes: quiet slate boxes; classed nodes stand out against them.
  primaryColor: SLATE[800],
  primaryTextColor: SLATE[50],
  primaryBorderColor: SLATE[400],
  secondaryColor: '#2e1065',
  secondaryTextColor: SLATE[50],
  secondaryBorderColor: SWATCHES.accent.stroke,
  tertiaryColor: '#172033',
  tertiaryTextColor: SLATE[50],
  tertiaryBorderColor: SLATE[500],

  lineColor: SLATE[400],
  edgeLabelBackground: SLATE[800],
  clusterBkg: '#172033',
  clusterBorder: SLATE[500],
  titleColor: SLATE[50],

  noteBkgColor: '#422006',
  noteTextColor: '#fde68a',
  noteBorderColor: SWATCHES.warning.fill,

  // Sequence diagrams
  actorBkg: SLATE[800],
  actorBorder: SWATCHES.primary.stroke,
  actorTextColor: SLATE[50],
  actorLineColor: SLATE[500],
  signalColor: SLATE[300],
  signalTextColor: SLATE[200],
  labelBoxBkgColor: SLATE[800],
  labelBoxBorderColor: SWATCHES.accent.stroke,
  labelTextColor: SLATE[50],
  loopTextColor: SLATE[200],
  activationBkgColor: SLATE[700],
  activationBorderColor: SLATE[400],
  sequenceNumberColor: SLATE[900],

  // Chart lines use the light swatch strokes so they stand out on the dark surface.
  // Mermaid replaces (does not merge) this object, so axis and title colours are set here too.
  xyChart: {
    backgroundColor: MERMAID_SURFACE,
    titleColor: SLATE[50],
    xAxisTitleColor: SLATE[200],
    xAxisLabelColor: SLATE[200],
    xAxisTickColor: SLATE[400],
    xAxisLineColor: SLATE[400],
    yAxisTitleColor: SLATE[200],
    yAxisLabelColor: SLATE[200],
    yAxisTickColor: SLATE[400],
    yAxisLineColor: SLATE[400],
    plotColorPalette: (['primary', 'danger', 'success', 'warning', 'accent', 'info'] as const)
      .map((name) => SWATCHES[name].stroke)
      .join(', '),
  },

  // Timelines, mindmaps and other scale-coloured diagrams cycle through the swatches.
  ...Object.fromEntries(
    Object.values(SWATCHES).flatMap((swatch, i) => [
      [`cScale${i}`, swatch.fill],
      [`cScaleLabel${i}`, swatch.text],
    ]),
  ),
} as const;

const SHARED_CLASS_DEFS = SHARED_CLASS_NAMES.map((name) => {
  const { fill, stroke, text } = sharedClassSwatch(name);
  return `classDef ${name} fill:${fill},stroke:${stroke},stroke-width:1.5px,color:${text}`;
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
