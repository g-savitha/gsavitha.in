import assert from 'node:assert/strict';
import test from 'node:test';
import { sketchEdgePath, sketchMermaidSvg } from './sketchMermaidEdges.ts';

const SMOOTH = 'M0 0 L40 0';
const SVG = `<svg><path class="basic label-container" d="${SMOOTH}"></path><path class="edge-thickness-normal flowchart-link" d="${SMOOTH}"></path></svg>`;

test('a sketched edge differs from the smooth path and stays stable', () => {
  const sketched = sketchEdgePath(SMOOTH);
  assert.notEqual(sketched, SMOOTH);
  assert.equal(sketchEdgePath(SMOOTH), sketched);
});

test('only flowchart edges are sketched', () => {
  const once = sketchMermaidSvg(SVG);
  const node = once.match(/class="basic label-container" d="([^"]*)"/)?.[1];
  const edge = once.match(/class="edge-thickness-normal flowchart-link" d="([^"]*)"/)?.[1];
  assert.equal(node, SMOOTH);
  assert.ok(edge);
  assert.notEqual(edge, SMOOTH);
  assert.equal(sketchMermaidSvg(SVG), once);
});
