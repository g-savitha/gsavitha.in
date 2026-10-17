import type { Plugin } from 'vite';
import { themeCss } from './palette.ts';

const PUBLIC_ID = 'virtual:theme.css';
const RESOLVED_ID = `\0${PUBLIC_ID}`;

/** Serves `virtual:theme.css`, generated from `palette.ts`. Imported once, by BaseHead. */
export function themeCssPlugin(): Plugin {
  return {
    name: 'theme-css',
    resolveId: (id) => (id === PUBLIC_ID ? RESOLVED_ID : undefined),
    load: (id) => (id === RESOLVED_ID ? themeCss() : undefined),
  };
}
