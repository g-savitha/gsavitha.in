import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DIAGRAM_CONTAINER_LABEL, DIAGRAM_CONTAINER_STROKE, d2Preamble } from '../theme/diagram.ts';

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

/** Decode the leading D2 object-id token from a `<g class="...">` class list. */
function decodeD2GroupId(className: string): string | null {
  const token = className.trim().split(/\s+/)[0];
  if (!token || token === 'shape' || token.startsWith('sketch') || token.startsWith('d2-')) {
    return null;
  }
  try {
    const padded = token + '='.repeat((4 - (token.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    // Object ids are dotted paths; connection labels look like `(A -> B)[0]`.
    if (!/^[\w.-]+$/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function findBalancedGroupEnd(svg: string, openBracket: number): number {
  // openBracket points at '<' of `<g ...>`. Find the matching `</g>`.
  const afterOpen = svg.indexOf('>', openBracket);
  if (afterOpen < 0) return -1;
  let depth = 1;
  let i = afterOpen + 1;
  while (i < svg.length && depth > 0) {
    const nextOpen = svg.indexOf('<g', i);
    const nextClose = svg.indexOf('</g>', i);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 2;
    } else {
      depth -= 1;
      if (depth === 0) return nextClose + 4;
      i = nextClose + 4;
    }
  }
  return -1;
}

function styleContainerGroupInner(inner: string): string {
  let next = inner;
  // Drop sketch hatch overlays on the container chrome only (leaf nodes keep theirs).
  next = next.replace(/<rect\b[^>]*class="[^"]*sketch-overlay[^"]*"[^>]*\/?>/gi, '');
  // Force transparent fills + visible outline on container shape geometry.
  next = next.replace(
    /<(path|polygon|polyline|ellipse|circle|rect)\b([^>]*)>/gi,
    (tag, name: string, attrs: string) => {
      if (/\bsketch-overlay\b/.test(attrs)) return tag;
      const selfClosing = /\/\s*$/.test(attrs);
      let cleaned = attrs
        .replace(/\/\s*$/, '')
        .replace(/\s*\bfill="[^"]*"/gi, '')
        .replace(/\s*\bstroke="[^"]*"/gi, '')
        .replace(/\bclass="([^"]*)"/i, (_m, cls: string) => {
          const nextCls = cls
            .replace(/\bfill-[A-Z]+\d+\b/g, '')
            .replace(/\bstroke-[A-Z]+\d+\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return nextCls ? ` class="${nextCls}"` : '';
        });
      cleaned = cleaned.replace(/\s*\bstyle="([^"]*)"/i, (_m, style: string) => {
        const kept = style
          .split(';')
          .map((part: string) => part.trim())
          .filter((part: string) => part && !/^fill\s*:/i.test(part) && !/^stroke\s*:/i.test(part))
          .join('; ');
        return kept
          ? ` style="${kept}; fill: transparent; stroke: ${DIAGRAM_CONTAINER_STROKE}"`
          : '';
      });
      if (!/\bstyle=/.test(cleaned)) {
        cleaned += ` style="fill: transparent; stroke: ${DIAGRAM_CONTAINER_STROKE}"`;
      }
      cleaned += ` fill="transparent" stroke="${DIAGRAM_CONTAINER_STROKE}"`;
      return selfClosing ? `<${name}${cleaned} />` : `<${name}${cleaned}>`;
    },
  );
  // Container titles: light palette colour at the rendered font size (body-sized via preamble).
  next = next.replace(/<text\b([^>]*)>/gi, (_tag, attrs: string) => {
    let cleaned = attrs
      .replace(/\s*\bfill="[^"]*"/gi, '')
      .replace(/\bclass="([^"]*)"/i, (_m, cls: string) => {
        const nextCls = cls
          .replace(/\bfill-N\d+\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return nextCls ? ` class="${nextCls}"` : '';
      });
    cleaned = cleaned.replace(/\s*\bstyle="([^"]*)"/i, (_m, style: string) => {
      const parts = style
        .split(';')
        .map((part: string) => part.trim())
        .filter((part: string) => part && !/^fill\s*:/i.test(part));
      parts.push(`fill: ${DIAGRAM_CONTAINER_LABEL}`);
      return ` style="${parts.join('; ')}"`;
    });
    if (!/\bstyle=/.test(cleaned)) {
      cleaned += ` style="fill: ${DIAGRAM_CONTAINER_LABEL}"`;
    }
    cleaned += ` fill="${DIAGRAM_CONTAINER_LABEL}"`;
    return `<text${cleaned}>`;
  });
  return next;
}

/**
 * D2 emits parent containers as sibling `<g>`s (child ids are `parent.child` in base64) and
 * still paints a dark sketch hatch on transparent parents. Make every container chrome
 * transparent with a light outline and a light, readable title.
 */
export function styleDiagramContainers(svg: string): string {
  const ids = new Map<string, string>(); // decoded id -> encoded class token
  for (const match of svg.matchAll(/<g\b[^>]*\bclass="([^"]+)"/g)) {
    const encoded = match[1].trim().split(/\s+/)[0];
    const decoded = decodeD2GroupId(match[1]);
    if (decoded) ids.set(decoded, encoded);
  }

  const isStructuralChild = (parentId: string, otherId: string): boolean => {
    if (!otherId.startsWith(`${parentId}.`)) return false;
    const rest = otherId.slice(parentId.length + 1);
    // D2 notes hang off an id as `Foo.note` — that is not a nested diagram node.
    return rest !== 'note' && !rest.startsWith('note.');
  };

  const containerIds = [...ids.keys()].filter((id) =>
    [...ids.keys()].some((other) => isStructuralChild(id, other)),
  );
  if (containerIds.length === 0) return svg;

  let result = svg;
  for (const id of containerIds) {
    const encoded = ids.get(id);
    if (!encoded) continue;
    // Do not use `\b` around base64 tokens — padding `=` is a non-word char, so `\b` after
    // it never matches. Match the leading class token exactly instead.
    const opens: number[] = [];
    for (const match of result.matchAll(/<g\b([^>]*)>/g)) {
      const cls = /\bclass="([^"]*)"/.exec(match[1])?.[1];
      if (!cls) continue;
      const token = cls.trim().split(/\s+/)[0];
      if (token === encoded) opens.push(match.index ?? -1);
    }
    // Restyle from the end so earlier offsets stay valid.
    for (let i = opens.length - 1; i >= 0; i -= 1) {
      const start = opens[i];
      if (start < 0) continue;
      const end = findBalancedGroupEnd(result, start);
      if (end < 0) continue;
      const openEnd = result.indexOf('>', start) + 1;
      const inner = result.slice(openEnd, end - 4);
      const styled = styleContainerGroupInner(inner);
      result = `${result.slice(0, openEnd)}${styled}${result.slice(end - 4)}`;
    }
  }
  return result;
}

/**
 * Keep the SVG at its natural viewBox size so 16px D2 labels stay 16px on screen.
 * CSS applies max-width: 100% only as a safety cap — diagrams that would shrink must be
 * re-laid out narrower in the markdown source instead.
 */
export function prepareDiagramSvg(svg: string): string {
  let index = 0;
  let outerViewBox: { w: number; h: number } | null = null;

  const sized = svg.replace(/<svg\b([^>]*)>/gi, (_tag, attrs: string) => {
    const isOuter = index === 0;
    index += 1;

    const vb = /\bviewBox="\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*"/.exec(attrs);
    if (isOuter && vb) {
      outerViewBox = { w: parseFloat(vb[3]), h: parseFloat(vb[4]) };
    }

    let next = attrs.replace(/\s*\bwidth="[^"]*"/gi, '').replace(/\s*\bheight="[^"]*"/gi, '');

    if (isOuter && outerViewBox && outerViewBox.w > 0 && outerViewBox.h > 0) {
      // Intrinsic CSS size = viewBox; never stretch to 100% (that shrinks or enlarges glyphs).
      next += ` width="${outerViewBox.w}" height="${outerViewBox.h}"`;
    } else if (!isOuter) {
      next += ' width="100%" height="100%"';
    }

    return `<svg${next}>`;
  });

  return styleDiagramContainers(sized);
}

/** Render one author diagram. The shared preamble supplies colours, sketch, ELK, and animation. */
export async function renderD2(authorSource: string): Promise<string> {
  const source = `${d2Preamble()}\n${authorSource.trim()}\n`;
  const dir = path.join(cacheDir(), 'svg');
  const file = path.join(dir, `${cacheKey(`${source}\n#prepare:v5-containers`)}.svg`);
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
    await execFileAsync(bin, ['--layout', 'elk', '--timeout', '120', input, output], {
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(`D2 failed to render a diagram.\n${stderr || error}`);
  }

  const svg = prepareDiagramSvg(inlineSvg(await readFile(output, 'utf8')));
  await rm(work, { recursive: true, force: true });
  if (!svg.startsWith('<svg')) throw new Error('D2 did not return an SVG.');
  await mkdir(dir, { recursive: true });
  await writeFile(file, svg);
  return svg;
}
