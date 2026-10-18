/**
 * Removes hand-written Mermaid colours from posts when the shared theme
 * (`src/theme/mermaid.ts`) already gives the same look.
 *
 *   node --experimental-strip-types scripts/mermaid/stripSharedColours.ts           # rewrite posts
 *   node --experimental-strip-types scripts/mermaid/stripSharedColours.ts --check   # report only
 *
 * Per diagram: `classDef <shared name> fill:<equivalent>` lines are dropped and
 * `style <id> fill:<equivalent>` becomes `class <id> <name>`. A diagram with any colour this
 * script does not recognise is treated as intentional one-off styling and left untouched.
 * Safe to rerun; it exits 1 in --check mode while anything is still strippable.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SHARED_CLASS_NAMES, sharedClassSwatch } from '../../src/theme/mermaid.ts';
import type { SharedClassName } from '../../src/theme/mermaid.ts';

const CONTENT_DIR = 'src/content';

/** Fills hand-written in posts before the shared theme, and the shared class that replaces each. */
const EQUIVALENT_FILLS: Record<string, SharedClassName> = {
  '#2563eb': 'primary',
  '#1565c0': 'primary',
  '#7c3aed': 'accent',
  '#0891b2': 'info',
  '#059669': 'success',
  '#2e7d32': 'success',
  '#d97706': 'warning',
  '#b71c1c': 'danger',
  '#334155': 'neutral',
};

const COLOUR_LINE = /^(\s*)(classDef|style)\s+(\S+)\s+(.*)$/;
const FENCE = /^```mermaid\s*$([\s\S]*?)^```\s*$/gm;

function fillOf(props: string): string | undefined {
  return props.match(/fill:\s*(#[0-9a-f]{3,8})/i)?.[1].toLowerCase();
}

function isShared(name: string): name is SharedClassName {
  return (SHARED_CLASS_NAMES as string[]).includes(name);
}

/** Replacement for one colour line: '' to drop it, a string to swap it, null if it is a one-off. */
function replacement(line: string): string | null {
  const [, indent, keyword, target, props] = line.match(COLOUR_LINE) ?? [];
  const fill = fillOf(props ?? '');
  const equivalent = fill ? EQUIVALENT_FILLS[fill] : undefined;
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
}
if (check && pending > 0) process.exitCode = 1;
