import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BLACK,
  MERMAID_THEME,
  PALETTE,
  SHARED_CLASS_NAMES,
  WHITE,
  sharedClassSwatch,
  withSharedClassDefs,
} from './mermaid.ts';
import type { Swatch } from './mermaid.ts';

/** `#abc` -> `#aabbcc`, lower case. */
function normalise(hex: string): string {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h;
}

function luminance(hex: string): number {
  const full = normalise(hex);
  const channels = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or near-black text such as #000, #111 or #111827. */
const MAX_DARK_TEXT_LUMINANCE = 0.015;

/** Dark fills take white text and light fills black: whichever contrasts more with the fill. */
function fillIsLight(fill: string): boolean {
  return contrast(BLACK, fill) > contrast(WHITE, fill);
}

function assertSwatch(fill: string, text: string, label: string) {
  const ratio = contrast(text, fill);
  assert.ok(ratio >= 4.5, `${label}: ${text} on ${fill} is ${ratio.toFixed(2)}:1 (< 4.5)`);
  if (fillIsLight(fill)) {
    assert.ok(
      luminance(text) <= MAX_DARK_TEXT_LUMINANCE,
      `${label}: light fill ${fill} needs black/#111 text, got ${text}`,
    );
  } else {
    assert.equal(normalise(text), WHITE, `${label}: dark fill ${fill} needs white text`);
  }
}

/** Every line inside a Mermaid block of any blog post. */
function mermaidLines(): { label: string; line: string }[] {
  const dir = 'src/content/blog';
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .flatMap((file) => {
      const source = readFileSync(path.join(dir, file), 'utf8');
      return [...source.matchAll(/^```mermaid\s*$([\s\S]*?)^```\s*$/gm)].flatMap(([, body]) =>
        body.split('\n').map((line) => ({ label: file, line })),
      );
    });
}

test('requested shared classes exist', () => {
  for (const name of ['hit', 'miss', 'neutral', 'accent']) {
    assert.ok((SHARED_CLASS_NAMES as string[]).includes(name), name);
  }
});

test('every palette entry is AA and uses white text on dark fills, black on light', () => {
  for (const [name, { text, fill }] of Object.entries(PALETTE)) assertSwatch(fill, text, name);
});

test('every class name resolves to a palette entry', () => {
  const swatches = new Set<Swatch>(Object.values(PALETTE));
  for (const name of SHARED_CLASS_NAMES) assert.ok(swatches.has(sharedClassSwatch(name)), name);
});

test('the text rule picks black for light fills and white for dark fills', () => {
  assert.equal(fillIsLight('#eab308'), true, 'yellow');
  assert.equal(fillIsLight('#fb7185'), true, 'rose');
  assert.equal(fillIsLight('#9f1239'), false, 'maroon');
  assert.equal(fillIsLight('#2563eb'), false, 'blue');
  assert.equal(sharedClassSwatch('accent').text, BLACK);
  assert.equal(sharedClassSwatch('primary').text, WHITE);
});

test('posts contain no hex colours in Mermaid blocks', () => {
  const lines = mermaidLines();
  assert.ok(lines.length > 0, 'expected Mermaid blocks in posts');
  const offenders = lines.filter(({ line }) => /#[0-9a-f]{3,8}\b/i.test(line));
  assert.deepEqual(
    offenders.map(({ label, line }) => `${label}: ${line.trim()}`),
    [],
    'use a named PALETTE class instead of a hex colour',
  );
});

test('every class a post uses exists in the palette', () => {
  const known = new Set<string>(SHARED_CLASS_NAMES);
  for (const { label, line } of mermaidLines()) {
    const used = [
      ...[...line.matchAll(/:::(\w+)/g)].map((m) => m[1]),
      ...(line.match(/^\s*class\s+\S+\s+(\w+)\s*$/)?.slice(1) ?? []),
    ];
    for (const name of used) assert.ok(known.has(name), `${label}: unknown class ${name}`);
  }
});

test('miss and danger are not a harsh bright red', () => {
  for (const name of ['miss', 'danger'] as const) {
    const { fill } = sharedClassSwatch(name);
    assert.ok(!['#ef4444', '#f44336', '#b71c1c', '#b91c1c', '#dc2626'].includes(fill), name);
  }
});

test('hit and miss are visibly different', () => {
  assert.notEqual(sharedClassSwatch('hit').fill, sharedClassSwatch('miss').fill);
});

test('accent is the original yellow and diagrams use the dark theme', () => {
  assert.equal(sharedClassSwatch('accent').fill, '#eab308');
  assert.equal(MERMAID_THEME, 'dark');
});

test('shared classDefs go right after the flowchart header', () => {
  const out = withSharedClassDefs(
    "%%{init: {'flowchart': {'curve': 'basis'}}}%%\nflowchart LR\n  A:::hit --> B",
  );
  const lines = out.split('\n');
  assert.equal(lines[1], 'flowchart LR');
  assert.match(lines[2], /^classDef /);
  assert.equal(lines.at(-1), '  A:::hit --> B');
  for (const name of SHARED_CLASS_NAMES) assert.match(out, new RegExp(`^classDef ${name} `, 'm'));
});

test('non-flowchart diagrams are left alone', () => {
  const source = 'sequenceDiagram\n  A->>B: hi';
  assert.equal(withSharedClassDefs(source), source);
});
