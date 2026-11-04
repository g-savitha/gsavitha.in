/**
 * Real CDP checks for 2026 blog diagrams at ~390px (and optionally desktop).
 * - diagram rendered width ≈ article content width
 * - no big blank gap under the SVG
 * - text bounding boxes inside each SVG don't overlap each other or overflow the figure
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
      await page.setViewportSize({ width, height: 1200 });
      for (const route of POSTS) {
        await page.goto(`${ORIGIN}/blog/${route}/`, { waitUntil: 'networkidle' });
        const found = await page.evaluate(
          ({ routeName, viewportWidth }) => {
            const local: Issue[] = [];
            const article = document.querySelector('article');
            const contentWidth = article?.clientWidth ?? document.body.clientWidth;
            const figures = [...document.querySelectorAll<HTMLElement>('figure.diagram')];

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
              // Should fill most of the article column (allow padding / scrollbars).
              if (svgBox.width < contentWidth * 0.85) {
                local.push({
                  route: routeName,
                  width: viewportWidth,
                  diagram,
                  detail: `svg width ${svgBox.width.toFixed(0)} << content ${contentWidth}`,
                });
              }

              // Blank gap: figure height should be close to the svg's rendered height.
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

              const texts = [...svg.querySelectorAll('text')];
              const boxes = texts
                .map((text) => {
                  const box = text.getBoundingClientRect();
                  return { text, box };
                })
                .filter(({ box }) => box.width > 1 && box.height > 1);

              for (let i = 0; i < boxes.length; i += 1) {
                const a = boxes[i].box;
                // Overflow past the figure (clipped labels).
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
                  // Ignore tiny overlaps from shared baselines; require a real collision.
                  if (overlapX > 4 && overlapY > 4) {
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
              }
            });

            return local;
          },
          { routeName: route, viewportWidth: width },
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
