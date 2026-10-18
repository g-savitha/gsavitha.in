/**
 * Removes hand-written Mermaid colours from posts when the shared theme
 * (`src/theme/mermaid.ts`) already gives the same look.
 *
 *   node --experimental-strip-types scripts/mermaid/stripSharedColours.ts           # rewrite posts
 *   node --experimental-strip-types scripts/mermaid/stripSharedColours.ts --check   # report only
 *
 * Per diagram: a `classDef <shared name>` or `style <id>` whose fill, stroke and text colour all
 * equal a shared class is dropped (classDef) or becomes `class <id> <name>` (style). A diagram with any colour this
 * script does not recognise is left untouched and reported.
 *
 * Posts must not contain hex colours in Mermaid blocks at all: add a named entry to `PALETTE` in
 * `src/theme/mermaid.ts` instead. `--check` exits 1 while anything is strippable or any Mermaid
 * block still contains a hex colour.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SHARED_CLASS_NAMES, sharedClassSwatch } from '../../src/theme/mermaid.ts';
import type { SharedClassName } from '../../src/theme/mermaid.ts';

const CONTENT_DIR = 'src/content';

/** A colour line is redundant only when fill, border and text all match a shared class exactly. */
function colourKey(fill: string, stroke: string, text: string): string {
  return [fill, stroke, text].map((c) => c.toLowerCase()).join('|');
}

const EQUIVALENT: Map<string, SharedClassName> = new Map(
  SHARED_CLASS_NAMES.map((name) => {
    const { fill, border, text } = sharedClassSwatch(name);
    return [colourKey(fill, border, text), name] as const;
  }).reverse(), // first-listed name wins for swatches shared by aliases
);

const HEX_COLOUR = /#[0-9a-f]{3,8}\b/i;
const COLOUR_LINE = /^(\s*)(classDef|style)\s+(\S+)\s+(.*)$/;
const FENCE = /^```mermaid\s*$([\s\S]*?)^```\s*$/gm;

function colourOf(props: string, key: string): string {
  return props.match(new RegExp(`${key}:\\s*(#[0-9a-f]{3,8})`, 'i'))?.[1] ?? '';
}

function isShared(name: string): name is SharedClassName {
  return (SHARED_CLASS_NAMES as string[]).includes(name);
}

/** Replacement for one colour line: '' to drop it, a string to swap it, null if it is a one-off. */
function replacement(line: string): string | null {
  const [, indent, keyword, target, props] = line.match(COLOUR_LINE) ?? [];
  const key = colourKey(
    colourOf(props ?? '', 'fill'),
    colourOf(props ?? '', 'stroke'),
    colourOf(props ?? '', 'color'),
  );
  const equivalent = EQUIVALENT.get(key);
  if (!equivalent) return null;
  if (keyword === 'style') return `${indent}class ${target} ${equivalent}`;
  if (!isShared(target)) return null;
  return sharedClassSwatch(target) === sharedClassSwatch(equivalent) ? '' : null;
}

function stripDiagram(body: string): { body: string; changed: number; oneOffs: string[] } {
  const lines = body.split('\n');
  const colourLines = lines.filter((line) => COLOUR_LINE.test(line));
  if (colourLines.length === 0) return { body, changed: 0, oneOffs: [] };
  if (colourLines.some((line) => replacement(line) === null)) {
    return { body, changed: 0, oneOffs: colourLines };
  }

  const out: string[] = [];
  for (const line of lines) {
    if (!COLOUR_LINE.test(line)) {
      out.push(line);
      continue;
    }
    const next = replacement(line);
    if (next) out.push(next);
  }
  // `body` ends with a newline; drop blank lines a removed classDef block left before the fence.
  while (out.length > 2 && out.at(-2)?.trim() === '') out.splice(-2, 1);
  return { body: out.join('\n'), changed: colourLines.length, oneOffs: [] };
}

async function posts(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
    .map((e) => path.join(e.parentPath, e.name))
    .sort();
}

const check = process.argv.includes('--check');
let pending = 0;
let hexLines = 0;
for (const file of await posts(CONTENT_DIR)) {
  const source = await readFile(file, 'utf8');
  let changed = 0;
  const oneOffs: string[] = [];
  const next = source.replace(FENCE, (block, body: string) => {
    const result = stripDiagram(body);
    changed += result.changed;
    oneOffs.push(...result.oneOffs);
    return block.replace(body, result.body);
  });
  if (changed > 0) {
    pending += changed;
    console.log(`${check ? 'would strip' : 'stripped'} ${changed} colour line(s): ${file}`);
    if (!check) await writeFile(file, next);
  }
  for (const line of oneOffs) console.log(`kept one-off: ${file}: ${line.trim()}`);
  for (const [, body] of next.matchAll(FENCE)) {
    for (const line of body.split('\n').filter((l) => HEX_COLOUR.test(l))) {
      hexLines += 1;
      console.error(`hex colour in mermaid block: ${file}: ${line.trim()}`);
    }
  }
}
if (hexLines > 0) {
  console.error(`${hexLines} line(s) use hex colours; use a named PALETTE class instead.`);
}
if (check && (pending > 0 || hexLines > 0)) process.exitCode = 1;
