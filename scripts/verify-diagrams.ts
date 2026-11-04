/**
 * Real CDP checks for 2026 blog diagrams at 390px and 1280px.
 * - diagram rendered width ≈ article content width (or natural width when narrower)
 * - no big blank gap under the SVG
 * - text bounding boxes inside each SVG don't overlap each other or overflow the figure
 * - on-screen label size (after viewBox scale) is body text size up to +2px
 * - no D2 theme-id / Dark Mauve canvas in the markup; transparent root fill
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const PORT = Number(process.env.VERIFY_DIAGRAM_PORT ?? 4331);
const ORIGIN = process.env.VERIFY_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const START_PREVIEW = !process.env.VERIFY_ORIGIN;

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

type LabelReport = {
  route: string;
  width: number;
  diagram: number;
  bodyPx: number;
  labelPx: number;
  ok: boolean;
};

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
  const reports: LabelReport[] = [];

  try {
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1200 });
      for (const route of POSTS) {
        await page.goto(`${ORIGIN}/blog/${route}/`, { waitUntil: 'networkidle' });
        const found = await page.evaluate(
          ({ routeName, viewportWidth }) => {
            const local: Issue[] = [];
            const localReports: LabelReport[] = [];
            const article = document.querySelector('article');
            const contentWidth = article?.clientWidth ?? document.body.clientWidth;
            const bodyP =
              article?.querySelector('p') ?? document.querySelector('article p, .prose p, p');
            const bodyPx = bodyP ? parseFloat(getComputedStyle(bodyP).fontSize) : 16;
            const figures = [...document.querySelectorAll<HTMLElement>('figure.diagram')];

            const userFontSize = (el: Element): number | null => {
              const styled = (el as SVGElement).style?.fontSize;
              if (styled) {
                const match = /([\d.]+)/.exec(styled);
                if (match) return parseFloat(match[1]);
              }
              const attr = el.getAttribute('font-size');
              if (attr) {
                const match = /([\d.]+)/.exec(attr);
                if (match) return parseFloat(match[1]);
              }
              const computed = getComputedStyle(el).fontSize;
              const match = /([\d.]+)/.exec(computed);
              return match ? parseFloat(match[1]) : null;
            };

            figures.forEach((figure, index) => {
              const diagram = index + 1;
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

              const figBox = figure.getBoundingClientRect();
              const svgBox = svg.getBoundingClientRect();
              // Natural-size diagrams may be narrower than the column; they must not overflow it
              // (max-width: 100% would shrink labels below body size).
              if (svgBox.width > contentWidth + 2) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: `svg width ${svgBox.width.toFixed(0)} overflows content ${contentWidth}`,
                });
              }

              const gap = figBox.height - svgBox.height;
              if (gap > 48) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: `blank gap under diagram (~${gap.toFixed(0)}px)`,
                });
              }

              const html = svg.outerHTML;
              if (/theme-id:\s*200|dark-theme-id:\s*200|#1[Ee]1[Ee]2[Ee]/.test(html)) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: 'Dark Mauve / theme 200 residue in SVG',
                });
              }

              const vb = svg.viewBox.baseVal;
              const scale = vb && vb.width > 0 ? svgBox.width / vb.width : svgBox.width > 0 ? 1 : 0;

              // Prefer leaf tspans when present; otherwise the text node. Never both —
              // a parent <text> and its <tspan> share the same glyphs and false-overlap.
              const texts = [...svg.querySelectorAll('text')].flatMap((text) => {
                const spans = [...text.querySelectorAll('tspan')];
                return spans.length ? spans : [text];
              });
              const boxes = texts
                .map((text) => {
                  const box = text.getBoundingClientRect();
                  return { text, box };
                })
                .filter(({ box }) => box.width > 1 && box.height > 1);

              // On-screen label size: font-size in user units × screen/viewBox scale.
              // Fall back to glyph box height when the attribute is missing.
              const renderedSizes: number[] = [];
              for (const { text, box } of boxes) {
                const content = (text.textContent ?? '').trim();
                if (!content) continue;
                const user = userFontSize(text);
                if (user != null && scale > 0) {
                  renderedSizes.push(user * scale);
                } else {
                  // Single-line glyph box height ≈ rendered em size.
                  renderedSizes.push(box.height);
                }
              }

              if (renderedSizes.length) {
                // Use the median node/edge label so one outlier annotation doesn't hide a shrink.
                const sorted = [...renderedSizes].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                const labelPx =
                  sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
                const minPx = sorted[0];
                const maxPx = sorted[sorted.length - 1];
                const ok = minPx >= bodyPx - 0.5 && maxPx <= bodyPx + 2.5;
                localReports.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  bodyPx,
                  labelPx: Number(labelPx.toFixed(2)),
                  ok,
                });
                if (!ok) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: `label size ${minPx.toFixed(1)}–${maxPx.toFixed(1)}px (median ${labelPx.toFixed(1)}) vs body ${bodyPx.toFixed(1)}px (need body..body+2)`,
                  });
                }
              }

              for (let i = 0; i < boxes.length; i += 1) {
                const a = boxes[i].box;
                if (
                  a.left < figBox.left - 2 ||
                  a.right > figBox.right + 2 ||
                  a.top < figBox.top - 2 ||
                  a.bottom > figBox.bottom + 2
                ) {
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: `label overflows figure: "${(boxes[i].text.textContent ?? '').slice(0, 40)}"`,
                  });
                  break;
                }
                for (let j = i + 1; j < boxes.length; j += 1) {
                  const b = boxes[j].box;
                  const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                  const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                  if (overlapX <= 4 || overlapY <= 4) continue;
                  // Sketch mode draws a second near-identical glyph; ignore near-duplicates.
                  const acx = (a.left + a.right) / 2;
                  const acy = (a.top + a.bottom) / 2;
                  const bcx = (b.left + b.right) / 2;
                  const bcy = (b.top + b.bottom) / 2;
                  if (Math.hypot(acx - bcx, acy - bcy) < 8) continue;
                  local.push({
                    route: routeName,
                    width: viewportWidth,
                    diagram,
                    detail: `overlapping labels: "${(boxes[i].text.textContent ?? '').slice(0, 24)}" vs "${(boxes[j].text.textContent ?? '').slice(0, 24)}"`,
                  });
                  i = boxes.length;
                  break;
                }
              }
            });

            return { local, localReports };
          },
          { routeName: route, viewportWidth: width },
        );

        issues.push(...found.local);
        reports.push(...found.localReports);
        console.log(
          `${found.local.length ? 'FAIL' : 'PASS'}  ${width}px /blog/${route}/ (${found.local.length} issues)`,
        );
        for (const issue of found.local)
          console.log(`       diagram ${issue.diagram}: ${issue.detail}`);
        for (const report of found.localReports) {
          console.log(
            `       size  diagram ${report.diagram}: label ${report.labelPx}px / body ${report.bodyPx}px ${report.ok ? 'OK' : 'BAD'}`,
          );
        }
      }
    }
  } finally {
    await browser.close();
    preview?.kill('SIGTERM');
  }

  console.log('\n--- label size summary ---');
  for (const report of reports) {
    console.log(
      `${report.ok ? 'OK' : 'BAD'} ${report.width}px ${report.route} #${report.diagram}: label ${report.labelPx}px body ${report.bodyPx}px`,
    );
  }

  if (issues.length) {
    console.error(`\n${issues.length} diagram check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll diagram CDP checks passed.');
}

await main();
