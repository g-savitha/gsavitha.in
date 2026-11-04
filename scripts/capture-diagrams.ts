/**
 * Capture every 2026 blog diagram/chart at mobile (390) and desktop (1280) widths.
 * Saves <slug>-<n>-mobile.png and <slug>-<n>-desktop.png under VERIFY_OUT.
 * Each shot includes nearby article text above/below the figure.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const PORT = Number(process.env.CAPTURE_PORT ?? 4332);
const ORIGIN = process.env.VERIFY_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const START_PREVIEW = !process.env.VERIFY_ORIGIN;
const OUT = path.resolve(process.env.VERIFY_OUT ?? '/opt/cursor/artifacts/diagram-shots');

const POSTS = [
  'prompt-caching',
  'context-management-window',
  'blog-audio-player',
  'caching-strategies',
  'kafka-explained-like-you-are-5',
  'thundering-herd',
  'making-coding-agents-trustworthy',
];

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
  mkdirSync(OUT, { recursive: true });
  let preview: ChildProcess | undefined;
  if (START_PREVIEW) {
    preview = spawn('bunx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForPreview(preview);
  }

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const saved: string[] = [];

  try {
    for (const [label, width] of [
      ['mobile', 390],
      ['desktop', 1280],
    ] as const) {
      await page.setViewportSize({ width, height: 2000 });
      for (const slug of POSTS) {
        await page.goto(`${ORIGIN}/blog/${slug}/`, { waitUntil: 'networkidle' });
        const count = await page.locator('figure.diagram').count();
        for (let i = 0; i < count; i += 1) {
          const figure = page.locator('figure.diagram').nth(i);
          await figure.scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);

          // Build a temporary wrapper around prev text + figure + next text for one shot.
          const handle = await figure.evaluateHandle((el) => {
            let prev: Element | null = el.previousElementSibling;
            while (prev && (prev.tagName === 'FIGURE' || prev.classList.contains('diagram'))) {
              prev = prev.previousElementSibling;
            }
            let next: Element | null = el.nextElementSibling;
            while (next && (next.tagName === 'FIGURE' || next.classList.contains('diagram'))) {
              next = next.nextElementSibling;
            }
            const wrap = document.createElement('div');
            wrap.setAttribute('data-diagram-shot', '1');
            wrap.style.display = 'block';
            wrap.style.width = '100%';
            const parent = el.parentElement!;
            parent.insertBefore(wrap, el);
            if (prev) wrap.appendChild(prev.cloneNode(true));
            wrap.appendChild(el.cloneNode(true));
            if (next) wrap.appendChild(next.cloneNode(true));
            return wrap;
          });

          const name = `${slug}-${i + 1}-${label}.png`;
          const file = path.join(OUT, name);
          await handle.asElement()!.screenshot({ path: file });
          await figure.evaluate(() => {
            document.querySelector('[data-diagram-shot="1"]')?.remove();
          });
          saved.push(name);
          console.log(`saved ${name}`);
        }
      }
    }
  } finally {
    await browser.close();
    preview?.kill('SIGTERM');
  }

  console.log(`\n${saved.length} screenshots in ${OUT}`);
}

await main();
