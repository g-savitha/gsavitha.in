import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BLACK,
  PALETTE,
  SHARED_CLASS_NAMES,
  WHITE,
  d2Preamble,
  sharedClassSwatch,
} from './diagram.ts';
import type { Swatch } from './diagram.ts';

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

const MAX_DARK_TEXT_LUMINANCE = 0.015;

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

function diagramLines(): { label: string; line: string }[] {
  const dir = 'src/content/blog';
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .flatMap((file) => {
      const source = readFileSync(path.join(dir, file), 'utf8');
      return [...source.matchAll(/^```(?:d2|sketch-chart)\s*$([\s\S]*?)^```\s*$/gm)].flatMap(
        ([, body]) => body.split('\n').map((line) => ({ label: file, line })),
      );
    });
}

test('requested shared classes exist', () => {
  for (const name of ['hit', 'miss', 'neutral', 'accent', 'purple']) {
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

test('posts contain no hex colours in d2 / sketch-chart blocks', () => {
  const lines = diagramLines();
  assert.ok(lines.length > 0, 'expected diagram blocks in posts');
  const offenders = lines.filter(({ line }) => /#[0-9a-f]{3,8}\b/i.test(line));
  assert.deepEqual(
    offenders.map(({ label, line }) => `${label}: ${line.trim()}`),
    [],
    'use a named PALETTE class / sketch-chart series instead of a hex colour',
  );
});

test('every class a d2 post uses exists in the palette', () => {
  const known = new Set<string>(SHARED_CLASS_NAMES);
  for (const { label, line } of diagramLines()) {
    const used = [...line.matchAll(/\bclass:\s*(\w+)/g)].map((m) => m[1]);
    for (const name of used) assert.ok(known.has(name), `${label}: unknown class ${name}`);
  }
});

test('d2 preamble uses site palette, transparent canvas, no built-in theme', () => {
  const source = d2Preamble();
  assert.match(source, /sketch: true/);
  assert.match(source, /layout-engine: elk/);
  assert.match(source, /style\.fill: "transparent"/);
  assert.equal(/theme-id:/.test(source), false);
  assert.equal(/dark-theme-id:/.test(source), false);
  assert.match(source, /animated: true/);
  assert.match(source, /&style\.stroke-dash:/);
  assert.match(source, /style\.animated: false/);
  assert.match(source, /#4ade80/);
  assert.match(source, /#c084fc/);
  assert.match(source, /#60a5fa/);
  assert.match(source, /#facc15/);
  assert.equal(source.includes('fill-pattern'), false);
  assert.equal(source.toLowerCase().includes('font-family'), false);
  assert.match(source, /^  container: \{style: \{fill: "transparent"/m);
  for (const name of SHARED_CLASS_NAMES) assert.match(source, new RegExp(`^  ${name}: `, 'm'));
});

test('hit and miss are visibly different', () => {
  assert.notEqual(sharedClassSwatch('hit').fill, sharedClassSwatch('miss').fill);
});

test('accent tracks the site yellow', () => {
  assert.equal(sharedClassSwatch('accent').fill, '#facc15');
});
