/**
 * Single source of truth for site colours that vary by theme or carry meaning.
 *
 * `virtual:theme.css` (see `vitePlugin.ts`) is generated from this file, so adding a theme,
 * changing the default, or recolouring a difficulty is a one-file edit. CSS must not declare
 * `--theme-*` or `--dsa-easy|medium|hard`; `bun run lint:repo` rejects it.
 */
import type { LeetCodeDifficultyStat } from '../utils/leetcode.ts';

type Hex = `#${string}`;

interface Swatch {
  base: Hex;
  hover: Hex;
}

/** Picker order is declaration order. */
export const PALETTE = {
  pink: { base: '#f472b6', hover: '#f9a8d4' },
  purple: { base: '#c084fc', hover: '#d8b4fe' },
  yellow: { base: '#facc15', hover: '#fde047' },
  green: { base: '#4ade80', hover: '#86efac' },
  blue: { base: '#60a5fa', hover: '#93c5fd' },
} as const satisfies Record<string, Swatch>;

export type ThemeName = keyof typeof PALETTE;

export const THEME_NAMES = Object.keys(PALETTE) as ThemeName[];

export const DEFAULT_THEME = 'purple' satisfies ThemeName;

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && Object.hasOwn(PALETTE, value);
}

export type Difficulty = LeetCodeDifficultyStat['difficulty'];

/**
 * DSA ring colours are fixed palette entries, never the accent (`--theme-color`): with a yellow
 * accent, an accent-derived Easy matched Medium (cae8cee). The type only admits palette names,
 * and `palette.test.ts` requires the three to differ. No glow (owner preference, 7771302).
 */
export const DIFFICULTY_COLORS = {
  Easy: 'green',
  Medium: 'yellow',
  Hard: 'pink',
} as const satisfies Record<Difficulty, ThemeName>;

/** Dark surface the ring and heatmap sit on (zinc-900), used by the contrast test. */
export const SURFACE: Hex = '#18181b';

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
}

function accentVars(name: ThemeName): Record<string, string> {
  return {
    '--theme-color': `var(--theme-${name})`,
    '--theme-color-hover': `var(--theme-${name}-hover)`,
  };
}

/** The CSS served as `virtual:theme.css`. */
export function themeCss(): string {
  const palette: Record<string, string> = {};
  for (const name of THEME_NAMES) {
    palette[`--theme-${name}`] = PALETTE[name].base;
    palette[`--theme-${name}-hover`] = PALETTE[name].hover;
  }
  const difficulties: Record<string, string> = {};
  for (const [difficulty, name] of Object.entries(DIFFICULTY_COLORS)) {
    difficulties[`--dsa-${difficulty.toLowerCase()}`] = `var(--theme-${name})`;
  }

  const blocks = [
    `:root {\n${declarations({ ...palette, ...accentVars(DEFAULT_THEME), ...difficulties })}\n}`,
    ...THEME_NAMES.map(
      (name) => `:root[data-theme='${name}'] {\n${declarations(accentVars(name))}\n}`,
    ),
    ...THEME_NAMES.map(
      (name) => `[data-swatch='${name}'] {\n  --swatch-color: var(--theme-${name});\n}`,
    ),
  ];
  return `/* Generated from src/theme/palette.ts. Do not edit. */\n${blocks.join('\n\n')}\n`;
}
