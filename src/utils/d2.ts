import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DIAGRAM_FONT_SIZE, DIAGRAM_MAX_WIDTH, d2Preamble } from '../theme/diagram.ts';

const execFileAsync = promisify(execFile);

/** Pinned so Vercel and CI render the same SVG. ELK is bundled in this binary. */
export const D2_VERSION = '0.7.1';

const D2_SHA256: Record<string, string> = {
  'linux-amd64': 'eb172adf59f38d1e5a70ab177591356754ffaf9bebb84e0ca8b767dfb421dad7',
  'linux-arm64': 'ce3a0b985a8f91335a826c254b3a88736fd81afcdd08b58f6c749d2add6864b0',
  'macos-amd64': 'b0178e8fdae72194d5a23aa6effd323378cc58ccd3b08d175ab80371c14e106f',
  'macos-arm64': '80de85f3b0ac7d9569acac0780ed65dd994ea78969b6b230c58bbb2c6113465b',
  'windows-amd64': 'd289c2866221c618c9fc6efcd416ee8c16e122bd0100761aea51001e3c958f57',
  'windows-arm64': 'c7ebdc7b2f6df513b715d431762105386f7c702b0b2dddff2a500a032b1bba67',
};

function targetTriple(): string {
  const os =
    process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return `${os}-${arch}`;
}

function cacheDir(): string {
  return path.join(process.cwd(), '.cache', 'd2');
}

function binaryName(): string {
  return process.platform === 'win32' ? 'd2.exe' : 'd2';
}

export function d2BinaryPath(): string {
  return path.join(cacheDir(), binaryName());
}

async function sha256(file: string): Promise<string> {
  const data = await readFile(file);
  return createHash('sha256').update(data).digest('hex');
}

async function download(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`D2 download failed (${response.status}) ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await response.arrayBuffer()));
}

/** Download the pinned D2 release into `.cache/d2` when it is not already there. */
export async function ensureD2(): Promise<string> {
  const bin = d2BinaryPath();
  try {
    await access(bin);
    const { stdout } = await execFileAsync(bin, ['--version']);
    if (stdout.includes(D2_VERSION)) return bin;
  } catch {
    // Missing or the wrong version. Download below.
  }

  const triple = targetTriple();
  const sum = D2_SHA256[triple];
  if (!sum) throw new Error(`No pinned D2 build for ${triple}.`);

  const archiveName = `d2-v${D2_VERSION}-${triple}.tar.gz`;
  const archive = path.join(cacheDir(), archiveName);
  const url = `https://github.com/d2lang/d2/releases/download/v${D2_VERSION}/${archiveName}`;
  await download(url, archive);
  const actual = await sha256(archive);
  if (actual !== sum) {
    throw new Error(`D2 checksum mismatch for ${archiveName}. Expected ${sum}, got ${actual}.`);
  }

  const extractDir = path.join(cacheDir(), 'extract');
  await mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['-xzf', archive, '-C', extractDir]);
  const unpacked = path.join(extractDir, `d2-v${D2_VERSION}`, 'bin', binaryName());
  await mkdir(cacheDir(), { recursive: true });
  const bytes = await readFile(unpacked);
  await writeFile(bin, bytes);
  await chmod(bin, 0o755);
  return bin;
}

function cacheKey(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function inlineSvg(svg: string): string {
  return svg
    .replace(/^\uFEFF?/, '')
    .replace(/<\?xml[^>]*>\s*/i, '')
    .replace(/<!DOCTYPE[^>]*>\s*/i, '')
    .trim();
}

/**
 * Keep label text near `DIAGRAM_FONT_SIZE` after the SVG is capped to `DIAGRAM_MAX_WIDTH`.
 * Wide diagrams get their font-size values boosted, then width/height are set so the browser
 * scales the whole drawing down — rendered text lands back around body size, with no
 * horizontal overflow on a phone column.
 *
 * D2 wraps the drawing in a nested `<svg class="d2-…">` that also carries width/height; both
 * the outer and inner boxes have to be capped or the inner one still overflows.
 */
export function fitDiagramSvg(svg: string, maxWidth = DIAGRAM_MAX_WIDTH): string {
  const root = svg.match(/^<svg\b[^>]*>/);
  if (!root) return svg;

  const viewBox = root[0].match(/\bviewBox="(?:[-0-9.]+\s+){2}([0-9.]+)\s+([0-9.]+)"/i);
  const widthAttr = root[0].match(/\bwidth="([0-9.]+)"/i);
  const heightAttr = root[0].match(/\bheight="([0-9.]+)"/i);
  const width = Number(widthAttr?.[1] ?? viewBox?.[1]);
  const height = Number(heightAttr?.[1] ?? viewBox?.[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return svg;
  }

  // Even narrow diagrams can carry a D2 default larger than body text — normalise fonts.
  if (width <= maxWidth) {
    return svg.replace(/font-size:\s*[0-9.]+px/gi, `font-size: ${DIAGRAM_FONT_SIZE}px`);
  }

  const boost = width / maxWidth;
  const fittedHeight = Number((height / boost).toFixed(3));
  const widthToken = String(width);
  const heightToken = heightAttr?.[1] ?? String(height);
  // Force every label to the shared body size after scale-down, even if D2 left a
  // default (e.g. 24px) on a container key.
  const fittedFont = DIAGRAM_FONT_SIZE * boost;
  const withFonts = svg.replace(
    /font-size:\s*[0-9.]+px/gi,
    `font-size: ${fittedFont.toFixed(3)}px`,
  );

  // Cap every svg box that still declares the unfitted pixel size (outer + D2 inner).
  return withFonts
    .replaceAll(`width="${widthToken}"`, `width="${maxWidth}"`)
    .replaceAll(`height="${heightToken}"`, `height="${fittedHeight}"`);
}

/** Render one author diagram. The shared preamble supplies colours, sketch, ELK, and animation. */
export async function renderD2(authorSource: string): Promise<string> {
  const source = `${d2Preamble()}\n${authorSource.trim()}\n`;
  const dir = path.join(cacheDir(), 'svg');
  // Cache key includes fit constants so bumping max width or font size busts stale SVGs.
  const file = path.join(
    dir,
    `${cacheKey(`${source}\n#fit:${DIAGRAM_MAX_WIDTH}:${DIAGRAM_FONT_SIZE}`)}.svg`,
  );
  try {
    return await readFile(file, 'utf8');
  } catch {
    // Compile below.
  }

  const bin = await ensureD2();
  const work = path.join(tmpdir(), `d2-${cacheKey(source).slice(0, 12)}`);
  await mkdir(work, { recursive: true });
  const input = path.join(work, 'diagram.d2');
  const output = path.join(work, 'diagram.svg');
  await writeFile(input, source);
  try {
    // --scale 1 locks the SVG to content pixels before we fit it to the column.
    await execFileAsync(
      bin,
      ['--layout', 'elk', '--scale', '1', '--timeout', '120', input, output],
      {
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(`D2 failed to render a diagram.\n${stderr || error}`);
  }

  const svg = fitDiagramSvg(inlineSvg(await readFile(output, 'utf8')));
  await rm(work, { recursive: true, force: true });
  if (!svg.startsWith('<svg')) throw new Error('D2 did not return an SVG.');
  await mkdir(dir, { recursive: true });
  await writeFile(file, svg);
  return svg;
}
