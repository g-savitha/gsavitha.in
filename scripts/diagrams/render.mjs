/**
 * Renders every Excalidraw source in diagrams/src/<post>/<name>.excalidraw to
 * public/diagrams/<post>/<name>.svg with the real @excalidraw/excalidraw export.
 *
 * Runs headless Chromium on a local server and blocks all other network access.
 * The site build does not run this: the SVGs are committed.
 *
 *   npm run diagrams                 # render everything
 *   npm run diagrams -- kafka        # only sources whose path contains "kafka"
 *   npm run diagrams -- --png=/tmp/x # also write PNG previews on the site background
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'diagrams/src');
const outDir = path.join(root, 'public/diagrams');
const cacheDir = path.join(root, 'node_modules/.cache/diagrams');
const assets = path.join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/');

const args = process.argv.slice(2);
const pngDir = args.find((a) => a.startsWith('--png='))?.slice(6);
const filters = args.filter((a) => !a.startsWith('--'));

const sources = fs
  .readdirSync(srcDir, { recursive: true })
  .filter((f) => f.endsWith('.excalidraw'))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

fs.mkdirSync(cacheDir, { recursive: true });
const bundle = path.join(cacheDir, 'bundle.js');
await esbuild.build({
  entryPoints: [path.join(root, 'scripts/diagrams/browser-entry.js')],
  bundle: true,
  outfile: bundle,
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  loader: { '.woff2': 'file', '.ttf': 'file' },
  logLevel: 'error',
});

const server = http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
      res.setHeader('content-type', 'text/html');
      return res.end(
        '<script>window.EXCALIDRAW_ASSET_PATH=location.origin+"/assets/"</script><script src="/bundle.js"></script>',
      );
    }
    const file =
      url === '/bundle.js'
        ? bundle
        : url.startsWith('/assets/')
          ? path.join(assets, url.slice(8))
          : null;
    if (!file || !fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'font/woff2');
    fs.createReadStream(file).pipe(res);
  })
  .listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const blocked = [];
await page.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  blocked.push(url);
  return route.abort();
});
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(origin);
await page.waitForFunction('window.ready');

let failed = false;
for (const rel of sources) {
  const data = JSON.parse(fs.readFileSync(path.join(srcDir, rel), 'utf8'));
  const result = await page.evaluate((d) => window.render(d), data);
  const out = path.join(outDir, rel.replace(/\.excalidraw$/, '.svg'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.svg + '\n');
  const width = result.svg.match(/width="([\d.]+)"/)?.[1];
  console.log(
    `${rel} -> ${path.relative(root, out)} (width ${width}, font sizes ${result.sizes.join('/')})`,
  );
  for (const p of result.problems) {
    console.error(`  label problem: ${p}`);
    failed = true;
  }
  if (pngDir) {
    const shot = await browser.newPage({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: 1,
    });
    await shot.setContent(`<body style="margin:0;background:#18181b">${result.svg}</body>`);
    const png = path.join(pngDir, rel.replace(/\.excalidraw$/, '.png'));
    fs.mkdirSync(path.dirname(png), { recursive: true });
    await shot.locator('svg').first().screenshot({ path: png, omitBackground: false });
    await shot.close();
  }
}

await browser.close();
server.close();
if (blocked.length) console.error('blocked external requests:', blocked);
if (failed) process.exit(1);
