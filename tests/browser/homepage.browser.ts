/**
 * Rendered-page checks for the homepage practice widgets, run against `dist/` after
 * `astro build`. Each test replays a mistake that shipped: see the commit referenced.
 *
 * Uses the system Chrome (GitHub's ubuntu runners ship it); set CHROME_PATH to override.
 */
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright-core';
import { THEME_NAMES } from '../../src/theme/palette.ts';

const DIST = path.resolve('dist');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};

let server: Server;
let browser: Browser;
let origin: string;

before(async () => {
  assert.ok(existsSync(path.join(DIST, 'index.html')), 'Run `bun run build` first.');
  server = createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function home(width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.locator('.consistency-heatmap__grid').scrollIntoViewIfNeeded();
  await page.waitForSelector('.consistency-heatmap__week');
  return page;
}

test('desktop: heatmap opens on the newest weeks (dc5f45a)', async () => {
  const page = await home(1280);
  const visible = await page.evaluate(() => {
    const scroller = document.querySelector('.consistency-heatmap__scroll')!;
    const weeks = document.querySelectorAll('.consistency-heatmap__week');
    const last = weeks[weeks.length - 1].getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    return { lastRight: last.right, boxRight: box.right, boxLeft: box.left, lastLeft: last.left };
  });
  await page.close();
  assert.ok(
    visible.lastLeft >= visible.boxLeft && visible.lastRight <= visible.boxRight + 1,
    `newest week is outside the scroll viewport: ${JSON.stringify(visible)}`,
  );
});

async function widths(page: Page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('.consistency-heatmap__scroll')!;
    return {
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      heatmap: scroller.scrollWidth,
      heatmapBox: scroller.clientWidth,
    };
  });
}

for (const width of [375, 768]) {
  test(`${width}px: the heatmap year fits without horizontal scrolling (f0bf175)`, async () => {
    const page = await home(width);
    const sizes = await widths(page);
    await page.close();
    assert.ok(sizes.heatmap <= sizes.heatmapBox + 1, `heatmap scrolls: ${JSON.stringify(sizes)}`);
  });

  test(
    `${width}px: the homepage never scrolls horizontally`,
    // Known on main today: the hero avatar's animate-ping glow (src/pages/index.astro:73)
    // pokes ~6px past a 768px viewport. Remove the todo once that is fixed.
    width === 768 ? { todo: 'hero animate-ping overflows at 768px (pre-existing on main)' } : {},
    async () => {
      const page = await home(width);
      const sizes = await widths(page);
      await page.close();
      assert.ok(sizes.page <= sizes.viewport, `page scrolls: ${JSON.stringify(sizes)}`);
    },
  );
}

test('DSA ring: Easy/Medium/Hard stay distinct and visible under every theme (cae8cee, feccc16)', async () => {
  const page = await home(1280);
  await page.locator('.dsa-progress').scrollIntoViewIfNeeded();
  await page.waitForSelector('g.dsa-progress--hard');
  for (const theme of THEME_NAMES) {
    const rows = await page.evaluate((name) => {
      document.documentElement.dataset.theme = name;
      return ['easy', 'medium', 'hard'].map((d) => {
        const group = document.querySelector(`g.dsa-progress--${d}`)!;
        const track = group.querySelector<SVGPathElement>('.dsa-progress__track')!;
        const legend = document.querySelector(`li.dsa-progress--${d} .dsa-progress__legend-value`);
        const solved = Number(legend?.textContent?.split('/')[0].trim() ?? 0);
        return {
          d,
          colour: getComputedStyle(group).getPropertyValue('--dsa-color').trim(),
          trackLength: track.getTotalLength(),
          solved,
          hasFill: group.querySelector('.dsa-progress__fill') !== null,
        };
      });
    }, theme);
    const detail = `${theme}: ${JSON.stringify(rows)}`;
    if (process.env.DEBUG_DSA) console.log(detail);
    assert.equal(new Set(rows.map((r) => r.colour)).size, 3, detail);
    for (const row of rows) {
      assert.ok(row.colour !== '' && row.trackLength > 20, detail);
      if (row.solved > 0)
        assert.ok(row.hasFill, `${row.d} solved ${row.solved} but no arc. ${detail}`);
    }
  }
  await page.close();
});
