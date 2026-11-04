import { PALETTE as SITE } from '../theme/palette.ts';
import { DIAGRAM_EDGE, PALETTE as DIAGRAM, WHITE } from '../theme/diagram.ts';

export interface SketchSeries {
  name?: string;
  values: number[];
}

export interface SketchChartSpec {
  title: string;
  xLabel?: string;
  yLabel?: string;
  x: string[];
  yMin?: number;
  yMax?: number;
  series: SketchSeries[];
}

/** Portfolio accents for chart strokes — same family as the D2 class palette. */
const CHART = {
  text: '#e4e4e7',
  muted: '#a1a1aa',
  axis: DIAGRAM_EDGE,
  line: SITE.purple.base,
  lineAlt: SITE.pink.base,
  fill: DIAGRAM.blue.fill,
} as const;

/** Tiny deterministic wobble so the stroke looks hand-drawn without Rough.js. */
function wobble(seed: number, amount: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 2 * amount;
}

function polyline(points: { x: number; y: number }[], seed: number): string {
  if (points.length === 0) return '';
  const parts = points.map((point, index) => {
    const x = point.x + wobble(seed + index * 3, 1.4);
    const y = point.y + wobble(seed + index * 3 + 1, 1.4);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const overlay = points.map((point, index) => {
    const x = point.x + wobble(seed + 90 + index * 5, 0.8);
    const y = point.y + wobble(seed + 91 + index * 5, 0.8);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `${parts.join(' ')} ${overlay.join(' ')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a sketchy line chart SVG using the site palette, with a transparent background
 * so it sits on the portfolio surface like the D2 diagrams.
 */
export function renderSketchChart(spec: SketchChartSpec): string {
  const width = 640;
  const height = 360;
  const pad = { top: 48, right: 28, bottom: 64, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allValues = spec.series.flatMap((series) => series.values);
  const yMin = spec.yMin ?? 0;
  const yMax = spec.yMax ?? Math.max(...allValues, 1) * 1.1;
  const xCount = Math.max(spec.x.length, 2);

  const xAt = (index: number) => pad.left + (plotW * index) / (xCount - 1);
  const yAt = (value: number) => pad.top + plotH * (1 - (value - yMin) / (yMax - yMin));

  const colours = [CHART.line, CHART.lineAlt, CHART.fill];
  const seriesPaths = spec.series
    .map((series, seriesIndex) => {
      const points = series.values.map((value, index) => ({
        x: xAt(index),
        y: yAt(value),
      }));
      const d = polyline(points, 11 + seriesIndex * 17);
      const colour = colours[seriesIndex % colours.length];
      const dots = points
        .map(
          (point, index) =>
            `<circle cx="${(point.x + wobble(seriesIndex * 40 + index, 0.6)).toFixed(1)}" cy="${(point.y + wobble(seriesIndex * 40 + index + 2, 0.6)).toFixed(1)}" r="3.2" fill="${colour}" stroke="${WHITE}" stroke-width="0.6" />`,
        )
        .join('');
      const label =
        series.name != null
          ? `<text x="${pad.left + 8 + seriesIndex * 180}" y="${height - 18}" fill="${colour}" font-size="13">${escapeXml(series.name)}</text>`
          : '';
      return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />${dots}${label}`;
    })
    .join('');

  const xLabels = spec.x
    .map((label, index) => {
      const x = xAt(index);
      return `<text x="${x.toFixed(1)}" y="${(height - 36).toFixed(1)}" text-anchor="middle" fill="${CHART.muted}" font-size="12">${escapeXml(label)}</text>
      <line x1="${x.toFixed(1)}" y1="${(pad.top + plotH).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(pad.top + plotH + 5).toFixed(1)}" stroke="${CHART.axis}" stroke-width="1.5" />`;
    })
    .join('');

  const yLabel = spec.yLabel
    ? `<text x="16" y="${(pad.top + plotH / 2).toFixed(1)}" fill="${CHART.muted}" font-size="13" text-anchor="middle" transform="rotate(-90 16 ${(pad.top + plotH / 2).toFixed(1)})">${escapeXml(spec.yLabel)}</text>`
    : '';
  const xLabel = spec.xLabel
    ? `<text x="${(pad.left + plotW / 2).toFixed(1)}" y="${height - 12}" text-anchor="middle" fill="${CHART.muted}" font-size="13">${escapeXml(spec.xLabel)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeXml(spec.title)}">
  <rect width="${width}" height="${height}" fill="transparent" />
  <text x="${width / 2}" y="28" text-anchor="middle" fill="${CHART.text}" font-size="16">${escapeXml(spec.title)}</text>
  <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="${CHART.axis}" stroke-width="2" />
  <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="${CHART.axis}" stroke-width="2" />
  ${yLabel}
  ${xLabel}
  ${xLabels}
  ${seriesPaths}
</svg>`;
}

/** Parse a compact sketch-chart fence body into a chart spec. */
export function parseSketchChart(source: string): SketchChartSpec {
  const lines = source
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith('#'));

  let title = 'Chart';
  let xLabel: string | undefined;
  let yLabel: string | undefined;
  let x: string[] = [];
  let yMin: number | undefined;
  let yMax: number | undefined;
  const series: SketchSeries[] = [];
  let currentSeries: SketchSeries | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    const titled = line.match(/^title:\s*(.+)$/i);
    if (titled) {
      title = titled[1].replace(/^["']|["']$/g, '');
      continue;
    }
    const xl = line.match(/^xLabel:\s*(.+)$/i);
    if (xl) {
      xLabel = xl[1].replace(/^["']|["']$/g, '');
      continue;
    }
    const yl = line.match(/^yLabel:\s*(.+)$/i);
    if (yl) {
      yLabel = yl[1].replace(/^["']|["']$/g, '');
      continue;
    }
    const ymin = line.match(/^yMin:\s*(-?[0-9.]+)$/i);
    if (ymin) {
      yMin = Number(ymin[1]);
      continue;
    }
    const ymax = line.match(/^yMax:\s*(-?[0-9.]+)$/i);
    if (ymax) {
      yMax = Number(ymax[1]);
      continue;
    }
    const xs = line.match(/^x:\s*\[(.*)\]\s*$/i);
    if (xs) {
      x = xs[1].split(',').map((part) => part.trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const seriesName = line.match(/^-\s*name:\s*(.+)$/i);
    if (seriesName) {
      currentSeries = { name: seriesName[1].replace(/^["']|["']$/g, ''), values: [] };
      series.push(currentSeries);
      continue;
    }
    const values = line.match(/^(?:-\s*)?values:\s*\[(.*)\]\s*$/i);
    if (values) {
      const parsed = values[1].split(',').map((part) => Number(part.trim()));
      if (currentSeries) currentSeries.values = parsed;
      else series.push({ values: parsed });
      continue;
    }
  }

  if (x.length === 0 || series.length === 0) {
    throw new Error('sketch-chart needs an x: [...] axis and at least one values: [...] series');
  }
  return { title, xLabel, yLabel, x, yMin, yMax, series };
}
