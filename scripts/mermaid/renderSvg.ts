/**
 * Renders Mermaid sources to static SVG files at author time, so a diagram shows up without
 * JavaScript (reader mode, RSS, link previews) and never depends on client-side rendering.
 *
 *   node --experimental-strip-types scripts/mermaid/renderSvg.ts path/to/diagram.mmd [...]
 *
 * Each `<name>.mmd` becomes `<name>.svg` next to it. Uses the site's shared theme
 * (`src/theme/mermaid.ts`), plain SVG text labels (no `foreignObject`, so `<img>` renders them),
 * and a dark background baked in so the diagram stays readable on light readers too.
 * Commit both files and reference the SVG from the post with alt text.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import {
  MERMAID_THEME,
  MERMAID_THEME_VARIABLES,
  withSharedClassDefs,
} from '../../src/theme/mermaid.ts';

/** zinc-900: one step lighter than the page, so the diagram reads as a card. */
const BACKGROUND = '#18181b';
const PADDING = 16;
/** zinc-200 text and zinc-400 axes: Mermaid's xychart doesn't pick these up from the dark theme. */
const TEXT = '#e4e4e7';
const AXIS = '#a1a1aa';
const XY_CHART = {
  backgroundColor: BACKGROUND,
  titleColor: TEXT,
  xAxisTitleColor: TEXT,
  xAxisLabelColor: TEXT,
  xAxisTickColor: AXIS,
  xAxisLineColor: AXIS,
  yAxisTitleColor: TEXT,
  yAxisLabelColor: TEXT,
  yAxisTickColor: AXIS,
  yAxisLineColor: AXIS,
};

const sources = process.argv.slice(2).filter((file) => file.endsWith('.mmd'));
if (sources.length === 0) {
  console.error('Usage: renderSvg.ts <diagram.mmd> [...]');
  process.exit(1);
}

const mermaidBundle = createRequire(import.meta.url).resolve('mermaid/dist/mermaid.min.js');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
});

try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ path: mermaidBundle });

  for (const source of sources) {
    const definition = withSharedClassDefs(await readFile(source, 'utf8'));
    const svg = await page.evaluate(
      async ({ definition, theme, themeVariables, xyChart, background, padding }) => {
        const { mermaid } = window as unknown as {
          mermaid: {
            initialize(config: object): void;
            render(id: string, text: string): Promise<{ svg: string }>;
          };
        };
        mermaid.initialize({
          startOnLoad: false,
          theme,
          themeVariables: { ...themeVariables, xyChart },
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        const { svg } = await mermaid.render('diagram', definition);

        // Re-measure, pad, and add the background so the file stands on its own.
        const host = document.createElement('div');
        host.innerHTML = svg;
        document.body.append(host);
        const root = host.querySelector('svg') as SVGSVGElement;
        const box = root.getBBox();
        const [x, y, w, h] = [
          box.x - padding,
          box.y - padding,
          box.width + padding * 2,
          box.height + padding * 2,
        ];
        root.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
        root.setAttribute('width', String(Math.ceil(w)));
        root.setAttribute('height', String(Math.ceil(h)));
        root.removeAttribute('style');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        Object.entries({ x, y, width: w, height: h, rx: 12, fill: background }).forEach(
          ([name, value]) => rect.setAttribute(name, String(value)),
        );
        root.prepend(rect);
        const out = root.outerHTML;
        host.remove();
        return out;
      },
      {
        definition,
        theme: MERMAID_THEME,
        themeVariables: MERMAID_THEME_VARIABLES,
        xyChart: XY_CHART,
        background: BACKGROUND,
        padding: PADDING,
      },
    );

    const target = source.replace(/\.mmd$/, '.svg');
    await writeFile(target, `${svg}\n`);
    console.log(`${source} -> ${target}`);
  }
} finally {
  await browser.close();
}
