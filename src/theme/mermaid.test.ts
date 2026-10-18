import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MERMAID_SURFACE,
  MERMAID_THEME_VARIABLES,
  SHARED_CLASS_NAMES,
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

test('requested shared classes exist', () => {
  for (const name of ['hit', 'miss', 'neutral', 'accent']) {
    assert.ok((SHARED_CLASS_NAMES as string[]).includes(name), name);
  }
});

test('every shared class has AA text contrast on its fill', () => {
  for (const name of SHARED_CLASS_NAMES) {
    const { text, fill } = sharedClassSwatch(name);
    assertAA(text, fill, name);
  }
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
