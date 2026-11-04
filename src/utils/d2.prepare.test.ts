import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareDiagramSvg } from './d2.ts';

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
