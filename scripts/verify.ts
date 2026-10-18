/**
 * End-to-end site verification against a fresh `dist/` build.
 *
 * Usage: `bun run verify:site` (builds first), or `node --experimental-strip-types scripts/verify.ts`
 * when `dist/` is already fresh. Evidence (screenshots + summary.json) goes to `VERIFY_OUT`
 * (default `verify-artifacts/`, gitignored). Exits 1 when any check fails.
 *
 * Steps: static checks on dist/ (newest papers, goodies, newest posts, internal links), then
 * `astro preview` + system Chrome via playwright-core (key pages, console errors, theme picker).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_THEME, PALETTE, THEME_NAMES } from '../src/theme/palette.ts';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.env.VERIFY_OUT ?? 'verify-artifacts');
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const PORT = Number(process.env.VERIFY_PORT ?? 4329);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const NEWEST = 3;

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------- helpers ----------

type Entry = { id: string; data: Record<string, unknown> };

function readCollection(dir: string): Entry[] {
  const base = path.join(ROOT, 'src/content', dir);
  return readdirSync(base)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const raw = readFileSync(path.join(base, file), 'utf8');
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const data = (match ? parseYaml(match[1]) : {}) as Record<string, unknown>;
      return { id: file.replace(/\.mdx?$/, ''), data };
    });
}

function newestFirst(entries: Entry[]): Entry[] {
  const time = (entry: Entry) =>
    entry.data.date ? new Date(String(entry.data.date)).valueOf() : 0;
  return [...entries].sort((a, b) => time(b) - time(a));
}

/** Visible text of an HTML file with common entities decoded, for "does this title render" checks. */
function pageText(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function distPage(route: string): string {
  return path.join(DIST, route.replace(/^\/|\/$/g, ''), 'index.html');
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function resolvesInDist(urlPath: string): boolean {
  const clean = decodeURIComponent(urlPath.split(/[?#]/)[0]).replace(/^\/+/, '');
  const target = path.join(DIST, clean);
  return [target, path.join(target, 'index.html'), `${target}.html`].some(
    (candidate) => existsSync(candidate) && !candidate.endsWith(path.sep),
  );
}

// ---------- static checks on dist/ ----------

function staticChecks(): void {
  check('dist/index.html exists (fresh build)', existsSync(path.join(DIST, 'index.html')));

  const papersText = pageText(distPage('/papers'));
  const homeText = pageText(path.join(DIST, 'index.html'));
  const papersHtml = readFileSync(distPage('/papers'), 'utf8');
  for (const paper of newestFirst(readCollection('papers')).slice(0, NEWEST)) {
    const title = String(paper.data.title);
    const url = typeof paper.data.url === 'string' ? paper.data.url : null;
    check(`papers: "${title}" on /papers`, papersText.includes(title));
    check(`papers: "${title}" on home (recent papers)`, homeText.includes(title));
    if (url) check(`papers: ${paper.id} links to its url`, papersHtml.includes(url), url);
  }

  const goodiesText = pageText(distPage('/goodies'));
  for (const goodie of readCollection('goodies')) {
    const title = String(goodie.data.title);
    const href = String(goodie.data.href);
    check(`goodies: "${title}" listed on /goodies`, goodiesText.includes(title));
    const page = distPage(href);
    check(`goodies: ${href} built`, existsSync(page));
    if (existsSync(page)) check(`goodies: ${href} shows its title`, pageText(page).includes(title));
  }

  const blogText = pageText(distPage('/blog'));
  const posts = readCollection('blog').filter((post) => post.data.draft !== true);
  for (const post of newestFirst(posts).slice(0, NEWEST)) {
    const title = String(post.data.title);
    check(`writings: /blog/${post.id}/ built`, existsSync(distPage(`/blog/${post.id}`)));
    check(`writings: "${title}" listed on /blog`, blogText.includes(title));
  }

  const broken = new Map<string, Set<string>>();
  const files = htmlFiles(DIST);
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const [, url] of html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      if (resolvesInDist(url)) continue;
      const from = `/${path.relative(DIST, file)}`;
      if (!broken.has(url)) broken.set(url, new Set());
      broken.get(url)!.add(from);
    }
  }
  const sample = [...broken].slice(0, 10).map(([url, from]) => `${url} (from ${[...from][0]})`);
  check(
    `internal links: ${files.length} HTML files crawled, ${broken.size} broken targets`,
    broken.size === 0,
    sample.join('; '),
  );
}

// ---------- browser checks ----------

async function startPreview(): Promise<ChildProcess> {
  const child = spawn('bunx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  child.stdout?.on('data', (chunk: Buffer) => (log += chunk));
  child.stderr?.on('data', (chunk: Buffer) => (log += chunk));
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`astro preview exited:\n${log}`);
    try {
      if ((await fetch(`${ORIGIN}/`)).ok) return child;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stopPreview(child);
  throw new Error(`astro preview not ready on ${ORIGIN} after 30s (port taken?):\n${log}`);
}

function stopPreview(child: ChildProcess): void {
  // Kill only the process group we started.
  if (child.pid && child.exitCode === null) process.kill(-child.pid, 'SIGTERM');
}

/** Opens a route and records console errors, uncaught exceptions, and failed same-origin requests. */
async function visit(browser: Browser, route: string): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`console: ${msg.text()}`));
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('response', (res) => {
    if (res.url().startsWith(ORIGIN) && res.status() >= 400)
      errors.push(`${res.status()} ${res.url()}`);
  });
  const response = await page.goto(`${ORIGIN}${route}`, { waitUntil: 'networkidle' });
  check(`page ${route} responds 200`, response?.status() === 200, `status ${response?.status()}`);
  return { page, errors };
}

/** Resolved accent. `--theme-color` is `var(--theme-<name>)`, so read the used colour, not the alias. */
const themeColor = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--theme-color)';
    document.documentElement.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const match = computed.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!match) return computed.trim().toLowerCase();
    const hex = [match[1], match[2], match[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('');
    return `#${hex}`;
  });

function themeHexes(): Record<string, string> {
  return Object.fromEntries(THEME_NAMES.map((name) => [name, PALETTE[name].base.toLowerCase()]));
}

/** Settles fonts and CSS transitions first so screenshots show the final state, not a fade. */
async function screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), animations: 'disabled' });
}

async function browserChecks(browser: Browser): Promise<void> {
  const hex = themeHexes();
  const routes: [string, string][] = [
    ['/', 'home'],
    ['/papers', 'papers'],
    ['/blog', 'writings'],
    ['/goodies', 'goodies'],
    ['/goodies/gcp-ace-cheatsheet', 'goodies-gcp-ace-mindmap'],
    ['/goodies/pstack-cheatsheet', 'goodies-pstack-cheatsheet'],
  ];

  for (const [route, shot] of routes) {
    const { page, errors } = await visit(browser, route);
    if (route === '/') {
      check(
        'home: h1 rendered',
        (await page.locator('h1').first().innerText()).includes('Savitha'),
      );
      const theme = await themeColor(page);
      check(
        `theme: default accent is ${DEFAULT_THEME} (${hex[DEFAULT_THEME]})`,
        theme === hex[DEFAULT_THEME],
        `--theme-color=${theme}`,
      );
      // Paint the computed background (may be oklch) onto a canvas to read real RGB.
      const [r, g, b] = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      });
      const bg = `rgb(${r}, ${g}, ${b})`;
      check('theme: dark surface by default', r + g + b < 150, `body background ${bg}`);
    }
    if (route === '/papers') {
      const newest = String(newestFirst(readCollection('papers'))[0].data.title);
      check(
        `papers: newest "${newest}" visible in browser`,
        await page.getByText(newest).first().isVisible(),
      );
    }
    if (route === '/goodies/gcp-ace-cheatsheet') {
      await page.locator('.mindmap__canvas').scrollIntoViewIfNeeded();
      const nodes = await page
        .waitForFunction(
          () => document.querySelectorAll('.mindmap__canvas g.markmap-node').length,
          null,
          { timeout: 10_000 },
        )
        .then((handle) => handle.jsonValue())
        .catch(() => 0);
      check('goodies: mind map renders nodes', nodes > 0, `${nodes} markmap nodes`);
    }
    check(`console: no errors on ${route}`, errors.length === 0, errors.slice(0, 5).join(' | '));
    await screenshot(page, shot);
    await page.close();
  }

  // Theme switch through the real ThemePicker UI.
  const target = THEME_NAMES.find((name) => name !== DEFAULT_THEME)!;
  const { page, errors } = await visit(browser, '/');
  await page.locator('button[aria-label="Theme picker"]:visible').click();
  await page.getByRole('menuitem', { name: `Select ${target} theme` }).click();
  check(
    `theme: picker sets data-theme=${target}`,
    (await page.getAttribute('html', 'data-theme')) === target,
  );
  const switched = await themeColor(page);
  check(
    `theme: accent changes to ${target} (${hex[target]})`,
    switched === hex[target],
    `--theme-color=${switched}`,
  );
  await screenshot(page, `home-theme-${target}`);
  await page.reload({ waitUntil: 'networkidle' });
  check(`theme: ${target} persists after reload`, (await themeColor(page)) === hex[target]);
  check(
    'console: no errors during theme switch',
    errors.length === 0,
    errors.slice(0, 5).join(' | '),
  );
  await page.close();
}

// ---------- main ----------

mkdirSync(OUT, { recursive: true });
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/ is missing. Run `bun run build` first (or use `bun run verify:site`).');
  process.exit(1);
}
if (!process.env.GITHUB_TOKEN)
  console.warn('note: GITHUB_TOKEN unset, so the build used the empty GitHub heatmap fallback.');

console.log('— static checks (dist/) —');
staticChecks();

console.log(`— browser checks (${ORIGIN}, ${CHROME}) —`);
const preview = await startPreview();
let browser: Browser | undefined;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  await browserChecks(browser);
} catch (error) {
  check('browser run completed', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close();
  stopPreview(preview);
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  path.join(OUT, 'summary.json'),
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed. Evidence: ${path.relative(ROOT, OUT) || OUT}`,
);
process.exit(failed.length ? 1 : 0);
