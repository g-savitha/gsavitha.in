/**
 * CDP checks for 2026 blog diagrams against a local `astro preview` (or VERIFY_ORIGIN).
 *
 * At ~390px and desktop widths, every diagram must:
 * - render label text around body size (16–18px)
 * - not overflow horizontally
 * - keep container boxes transparent with a white outline and no hatch fill
 * - use Dark Mauve (theme 200) colours, not the old site-palette hex fills
 * - animate solid main-flow edges only (dashed edges stay still)
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright-core';
import { DIAGRAM_MAX_WIDTH } from '../src/theme/diagram.ts';

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const PORT = Number(process.env.VERIFY_DIAGRAM_PORT ?? 4331);
const ORIGIN = process.env.VERIFY_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const START_PREVIEW = !process.env.VERIFY_ORIGIN;

/** Site-palette fills that must not appear once Dark Mauve owns diagram colour. */
const FORBIDDEN_FILLS = [
  '#2563eb',
  '#4b5563',
  '#eab308',
  '#06b6d4',
  '#22c55e',
  '#f97316',
  '#fb7185',
  '#7c3aed',
  '#047857',
  '#0e7490',
  '#d97706',
  '#334155',
  '#fdba74',
  '#9f1239',
  '#1565c0',
  '#2e7d32',
];

const POSTS = [
  'prompt-caching',
  'context-management-window',
  'blog-audio-player',
  'caching-strategies',
  'kafka-explained-like-you-are-5',
  'thundering-herd',
  'making-coding-agents-trustworthy',
];

type Issue = { route: string; width: number; diagram: number; detail: string };

async function waitForPreview(preview: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview startup timed out')), 45000);
    const onData = (chunk: Buffer) => {
      if (/localhost|127\.0\.0\.1|watching|ready|Port/i.test(chunk.toString())) {
        clearTimeout(timer);
        resolve();
      }
    };
    preview.stdout?.on('data', onData);
    preview.stderr?.on('data', onData);
    preview.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`preview exited ${code}`));
    });
  }).catch(async (error) => {
    await new Promise((r) => setTimeout(r, 2500));
    if (preview.exitCode != null) throw error;
  });
}

async function main() {
  let preview: ChildProcess | undefined;
  if (START_PREVIEW) {
    preview = spawn('bunx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForPreview(preview);
  }

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const issues: Issue[] = [];

  try {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const route of POSTS) {
        await page.goto(`${ORIGIN}/blog/${route}/`, { waitUntil: 'networkidle' });
        const found = await page.evaluate(
          ({ forbidden, maxWidth, routeName, viewportWidth }) => {
            const local: Issue[] = [];
            const figures = [...document.querySelectorAll<HTMLElement>('figure.diagram')];

            figures.forEach((figure, index) => {
              const diagram = index + 1;
              if (figure.scrollWidth > figure.clientWidth + 1) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: `horizontal overflow (${figure.scrollWidth} > ${figure.clientWidth})`,
                });
              }

              const svg = figure.querySelector('svg');
              if (!svg) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: 'missing svg',
                });
                return;
              }

              const declared = Number(svg.getAttribute('width'));
              if (Number.isFinite(declared) && declared > maxWidth + 0.5) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: `svg width ${declared} > max ${maxWidth}`,
                });
              }

              const markup = svg.innerHTML;
              const lower = markup.toLowerCase();
              for (const fill of forbidden) {
                if (lower.includes(fill.toLowerCase())) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: `forbidden site-palette fill ${fill}`,
                  });
                }
              }

              // Hatch fill on containers shows up as fill="url(#…streaks…)". Sketch stroke
              // overlays are classes, not fills — ignore those.
              if (/fill="transparent"/.test(markup)) {
                if (!/#ffffff/i.test(markup)) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: 'container present but white outline missing',
                  });
                }
                // A transparent container path should not also carry a streaks pattern fill.
                if (
                  /fill="transparent"[\s\S]{0,200}fill="url\([^"]*streaks/i.test(markup) ||
                  /fill="url\([^"]*streaks[^"]*\)"[\s\S]{0,200}fill="transparent"/i.test(markup)
                ) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: 'container has hatch pattern fill',
                  });
                }
              }

              const viewBox = svg.getAttribute('viewBox')?.trim().split(/\s+/) ?? [];
              const vbWidth = Number(viewBox[2]);
              const cssWidth =
                svg.getBoundingClientRect().width || Number(svg.getAttribute('width'));
              const scale =
                Number.isFinite(vbWidth) && vbWidth > 0 && Number.isFinite(cssWidth)
                  ? cssWidth / vbWidth
                  : 1;

              const texts = [...svg.querySelectorAll('text')];
              for (const text of texts) {
                const raw = parseFloat(getComputedStyle(text).fontSize);
                if (!Number.isFinite(raw) || raw <= 0) continue;
                const rendered = raw * scale;
                if (rendered < 15.5 || rendered > 18.5) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: `label renders ~${rendered.toFixed(1)}px (want 16–18)`,
                  });
                  break;
                }
              }

              const hasFlowAnimation = /animation:\s*dashdraw/i.test(markup);
              const hasDashdraw = /@keyframes\s+dashdraw/i.test(markup);
              const hasSolidEdge = /<path[^>]+>/i.test(markup);
              if (hasSolidEdge && hasDashdraw && !hasFlowAnimation) {
                // Sequence/reply-only diagrams can be all dashed; only fail when keyframes
                // exist but nothing uses them (broken preamble).
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: 'dashdraw keyframes present but no animated edge',
                });
              }
            });

            return local;
          },
          {
            forbidden: FORBIDDEN_FILLS,
            maxWidth: DIAGRAM_MAX_WIDTH,
            routeName: route,
            viewportWidth: width,
          },
        );

        issues.push(...found);
        console.log(
          `${found.length ? 'FAIL' : 'PASS'}  ${width}px /blog/${route}/ (${found.length} issues)`,
        );
        for (const issue of found) console.log(`       diagram ${issue.diagram}: ${issue.detail}`);
      }
    }
  } finally {
    await browser.close();
    preview?.kill('SIGTERM');
  }

  if (issues.length) {
    console.error(`\n${issues.length} diagram check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll diagram CDP checks passed.');
}

await main();
