import assert from 'node:assert/strict';
import test from 'node:test';
import { DIAGRAM_CONTAINER_LABEL, DIAGRAM_CONTAINER_STROKE } from '../theme/diagram.ts';
import { prepareDiagramSvg, styleDiagramContainers } from './d2.ts';

test('prepareDiagramSvg keeps the outer svg at its natural viewBox size', () => {
  const svg =
    '<svg viewBox="0 0 800 400" width="800" height="400"><svg class="d2-x" width="800" height="400" viewBox="-20 -20 800 400"></svg></svg>';
  const prepared = prepareDiagramSvg(svg);
  const roots = [...prepared.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(roots.length, 2);
  assert.match(roots[0], /width="800"/);
  assert.match(roots[0], /height="400"/);
  assert.equal(/width="100%"/.test(roots[0]), false);
  assert.match(roots[1], /width="100%"/);
  assert.match(roots[1], /height="100%"/);
});

test('styleDiagramContainers clears parent hatch and lightens the title', () => {
  // consumers / consumers.C1 in D2's base64 group ids (flattened siblings).
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <g class="Y29uc3VtZXJz"><g class="shape"><path class="shape stroke-B1 fill-B4" fill="#E3E9FD" stroke="#0D32B2"/><rect class=" sketch-overlay-B4" width="10" height="10"/></g><text class="text fill-N1" fill="#0A0F25">Consumers</text></g>
  <g class="Y29uc3VtZXJzLkMx info"><g class="shape"><path class="shape" fill="#22d3ee"/><rect class=" sketch-overlay-B4" width="10" height="10"/></g><text fill="#000000">Inventory</text></g>
</svg>`;
  const styled = styleDiagramContainers(svg);
  const container = styled.slice(
    styled.indexOf('class="Y29uc3VtZXJz"'),
    styled.indexOf('class="Y29uc3VtZXJzLkMx'),
  );
  const child = styled.slice(styled.indexOf('class="Y29uc3VtZXJzLkMx'));
  assert.equal(/sketch-overlay/.test(container), false);
  assert.match(container, new RegExp(`fill="${DIAGRAM_CONTAINER_LABEL}"`));
  assert.match(container, new RegExp(`stroke="${DIAGRAM_CONTAINER_STROKE}"`));
  assert.match(container, /fill: transparent/);
  assert.match(container, />Consumers</);
  assert.match(child, /sketch-overlay/);
  assert.match(child, /fill="#22d3ee"/);
  assert.match(child, />Inventory</);
});

test('styleDiagramContainers ignores sequence-diagram notes', () => {
  // App / App.note — note annotations must not strip participant chrome.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <g class="QXBw"><g class="shape"><path fill="#fff"/><rect class=" sketch-overlay-B4" width="10" height="10"/></g><text fill="#0A0F25">App</text></g>
  <g class="QXBwLm5vdGU"><g class="shape"><path fill="#eee"/></g><text>note</text></g>
</svg>`;
  const styled = styleDiagramContainers(svg);
  assert.match(styled, /sketch-overlay-B4/);
  assert.match(styled, /fill="#0A0F25"/);
});

test('styleDiagramContainers matches base64 ids that end with padding equals', () => {
  // "parts" / "parts.P0" encode with trailing `=`.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <g class="cGFydHM="><g class="shape"><path class="shape fill-B4" fill="#E3E9FD"/><rect class=" sketch-overlay-B4" width="10" height="10"/></g><text class="text fill-N1" fill="#0A0F25">Partitions</text></g>
  <g class="cGFydHMuUDA="><g class="shape"><path fill="#4b5563"/><rect class=" sketch-overlay-B4" width="10" height="10"/></g><text>P0</text></g>
</svg>`;
  const styled = styleDiagramContainers(svg);
  const container = styled.slice(0, styled.indexOf('cGFydHMuUDA='));
  assert.equal(/sketch-overlay/.test(container), false);
  assert.match(container, new RegExp(`fill="${DIAGRAM_CONTAINER_LABEL}"`));
  assert.match(container, />Partitions</);
});
