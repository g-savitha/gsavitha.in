import assert from 'node:assert/strict';
import test from 'node:test';
import { DIAGRAM_MAX_WIDTH } from '../theme/diagram.ts';
import { fitDiagramSvg } from './d2.ts';

test('fitDiagramSvg keeps narrow diagrams sized but normalises fonts to body size', () => {
  const svg =
    '<svg viewBox="0 0 200 100" width="200" height="100"><text style="font-size:24px">Hi</text></svg>';
  const fitted = fitDiagramSvg(svg);
  assert.match(fitted, /width="200"/);
  assert.match(fitted, /font-size: 17px/);
});

test('fitDiagramSvg caps width and boosts fonts so text stays near body size', () => {
  const svg =
    '<svg viewBox="0 0 700 100" width="700" height="100"><svg class="d2-x d2-svg" width="700" height="100" viewBox="-21 -21 700 100"><text style="font-size:17px">Hi</text></svg></svg>';
  const fitted = fitDiagramSvg(svg, DIAGRAM_MAX_WIDTH);
  const widths = [...fitted.matchAll(/\bwidth="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(widths, [String(DIAGRAM_MAX_WIDTH), String(DIAGRAM_MAX_WIDTH)]);
  const font = fitted.match(/font-size:\s*([0-9.]+)px/i);
  assert.ok(font);
  const boost = 700 / DIAGRAM_MAX_WIDTH;
  assert.ok(Math.abs(Number(font[1]) - 17 * boost) < 0.01);
  // After the browser scales width from 700 → max, rendered size ≈ 17.
  const rendered = Number(font[1]) * (DIAGRAM_MAX_WIDTH / 700);
  assert.ok(Math.abs(rendered - 17) < 0.01);
});
