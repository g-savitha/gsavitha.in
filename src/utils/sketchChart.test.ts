import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSketchChart, renderSketchChart } from './sketchChart.ts';

test('parseSketchChart reads title, axes, and series', () => {
  const spec = parseSketchChart(`
title: Trust curve
xLabel: Agents
yLabel: Trust
yMin: 0
yMax: 10
x: [1, 1-5, 1k+]
- name: trust
  values: [1, 4, 9]
`);
  assert.equal(spec.title, 'Trust curve');
  assert.deepEqual(spec.x, ['1', '1-5', '1k+']);
  assert.equal(spec.series[0]?.name, 'trust');
  assert.deepEqual(spec.series[0]?.values, [1, 4, 9]);
});

test('renderSketchChart is transparent and uses site purple/pink strokes', () => {
  const svg = renderSketchChart(
    {
      title: 'Demo',
      x: ['a', 'b'],
      series: [{ values: [1, 2] }],
    },
    'mobile',
  );
  assert.match(svg, /fill="transparent"/);
  assert.match(svg, /#c084fc/i);
  assert.equal(/#1[Ee]1[Ee]2[Ee]/.test(svg), false);
});

test('single-series charts omit a legend name under the axis', () => {
  const svg = renderSketchChart(
    {
      title: 'Illustration: trust vs agents',
      x: ['1', '1k+'],
      series: [{ name: 'trust', values: [1, 9] }],
    },
    'mobile',
  );
  assert.equal(/>trust</.test(svg), false);
  assert.match(svg, /1k\+/);
});
