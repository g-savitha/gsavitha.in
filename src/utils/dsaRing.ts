import type { LeetCodeDifficultyStat } from './leetcode';

/** SVG geometry for the DSA progress ring (viewBox is 0 0 VIEWBOX VIEWBOX). */
export const DSA_RING = {
  viewBox: 140,
  radius: 54,
  stroke: 8,
  /** Angular gap (degrees) between segments; leaves room for round line caps. */
  gapDeg: 16,
  /** Smallest fill (fraction of a segment) once solved > 0; round caps keep even this visible. */
  minVisibleFraction: 0.02,
} as const;

export interface DsaRingSegment extends LeetCodeDifficultyStat {
  trackPath: string;
  fillPath: string | null;
}

const FULL_TURN_DEG = 360;

function pointOnRing(angleDeg: number): string {
  const { viewBox, radius } = DSA_RING;
  const center = viewBox / 2;
  const radians = (angleDeg * Math.PI) / 180;
  const x = center + radius * Math.sin(radians);
  const y = center - radius * Math.cos(radians);
  return `${x.toFixed(3)} ${y.toFixed(3)}`;
}

/** Clockwise arc path; 0° is 12 o'clock. */
function arcPath(startDeg: number, endDeg: number): string {
  const { radius } = DSA_RING;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${pointOnRing(startDeg)} A ${radius} ${radius} 0 ${largeArc} 1 ${pointOnRing(endDeg)}`;
}

function fillFraction({ solved, total }: LeetCodeDifficultyStat): number {
  if (solved <= 0 || total <= 0) return 0;
  return Math.min(1, Math.max(solved / total, DSA_RING.minVisibleFraction));
}

/**
 * LeetCode-style ring: each difficulty owns an equal share of the circle, with a dim track for
 * the share and a bright fill for solved / total in that difficulty.
 */
export function buildDsaRingSegments(rows: LeetCodeDifficultyStat[]): DsaRingSegment[] {
  if (rows.length === 0) return [];
  const sweep = FULL_TURN_DEG / rows.length;

  return rows.map((row, index) => {
    const start = index * sweep + DSA_RING.gapDeg / 2;
    const end = (index + 1) * sweep - DSA_RING.gapDeg / 2;
    const fraction = fillFraction(row);
    return {
      ...row,
      trackPath: arcPath(start, end),
      fillPath: fraction > 0 ? arcPath(start, start + (end - start) * fraction) : null,
    };
  });
}
