import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MERMAID_SURFACE,
  MERMAID_THEME_VARIABLES,
  NEAR_BLACK,
  SHARED_CLASS_NAMES,
  WHITE,
  sharedClassSwatch,
  withSharedClassDefs,
} from './mermaid.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function assertAA(text: string, fill: string, label: string) {
  const ratio = contrast(text, fill);
  assert.ok(ratio >= 4.5, `${label}: ${text} on ${fill} is ${ratio.toFixed(2)}:1 (< 4.5)`);
}

/** Spread between the strongest and weakest RGB channel, 0..1. Bright reds like #b91c1c are ~0.6. */
function chroma(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(...channels) - Math.min(...channels);
}

const MAX_CHROMA = 0.45;

/** Dark fills take white text, light/pastel fills near-black: whichever contrasts more. */
function expectedText(fill: string): string {
  return contrast(WHITE, fill) >= contrast(NEAR_BLACK, fill) ? WHITE : NEAR_BLACK;
}

function assertSwatch(fill: string, text: string, label: string) {
  assertAA(text, fill, label);
  assert.equal(
    text.toLowerCase(),
    expectedText(fill),
    `${label}: ${fill} needs ${expectedText(fill)} text`,
  );
  assert.ok(chroma(fill) <= MAX_CHROMA, `${label}: ${fill} is too saturated`);
}

/** `style`/`classDef` lines with their own fill and text colour in any blog post. */
function postColourLines(): { label: string; fill: string; text: string }[] {
  const dir = 'src/content/blog';
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .flatMap((file) =>
      readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .flatMap((line, i) => {
          if (!/^\s*(style|classDef)\s/.test(line)) return [];
          const fill = line.match(/fill:\s*(#[0-9a-f]{6})/i)?.[1];
          const text = line.match(/color:\s*(#[0-9a-f]{6})/i)?.[1];
          return fill && text ? [{ label: `${file}:${i + 1}`, fill, text }] : [];
        }),
    );
}

test('requested shared classes exist', () => {
  for (const name of ['hit', 'miss', 'neutral', 'accent']) {
    assert.ok((SHARED_CLASS_NAMES as string[]).includes(name), name);
  }
});

test('every shared class is muted, AA, and uses white text on dark / near-black on light', () => {
  for (const name of SHARED_CLASS_NAMES) {
    const { text, fill } = sharedClassSwatch(name);
    assertSwatch(fill, text, name);
  }
});

test('light fills get near-black text and dark fills get white text', () => {
  assert.equal(expectedText('#f2d28b'), NEAR_BLACK);
  assert.equal(expectedText('#7a2e3e'), WHITE);
  assert.equal(sharedClassSwatch('warning').text, NEAR_BLACK);
  assert.equal(sharedClassSwatch('miss').text, WHITE);
});

test('one-off colours in posts follow the same rules', () => {
  const lines = postColourLines();
  assert.ok(lines.length > 0, 'expected the thundering-herd death-spiral styles');
  for (const { label, fill, text } of lines) assertSwatch(fill, text, label);
});

test('theme text colours are AA on their backgrounds', () => {
  const v = MERMAID_THEME_VARIABLES;
  const pairs: [string, string, string][] = [
    [v.textColor, MERMAID_SURFACE, 'text on page'],
    [v.primaryTextColor, v.primaryColor, 'default node'],
    [v.secondaryTextColor, v.secondaryColor, 'secondary'],
    [v.tertiaryTextColor, v.tertiaryColor, 'tertiary'],
    [v.textColor, v.clusterBkg, 'subgraph title'],
    [v.noteTextColor, v.noteBkgColor, 'note'],
    [v.actorTextColor, v.actorBkg, 'actor'],
    [v.signalTextColor, MERMAID_SURFACE, 'message label'],
    [v.labelTextColor, v.labelBoxBkgColor, 'loop label'],
    [v.textColor, v.edgeLabelBackground, 'edge label'],
  ];
  for (const [text, bg, label] of pairs) assertAA(text, bg, label);
});

test('hit and miss are visibly different', () => {
  assert.notEqual(sharedClassSwatch('hit').fill, sharedClassSwatch('miss').fill);
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
