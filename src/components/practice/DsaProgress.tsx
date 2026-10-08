import { useEffect, useState } from 'react';
import type { LeetCodeDifficultyStat } from '../../utils/leetcode';
import { buildDsaRingSegments, DSA_RING } from '../../utils/dsaRing';

interface DsaProgressProps {
  solved: number;
  total: number;
  byDifficulty: LeetCodeDifficultyStat[];
  profileUrl: string;
}

type RevealState = 'pending' | 'revealed';

const COUNT_UP_MS = 1100;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function difficultyModifier(difficulty: LeetCodeDifficultyStat['difficulty']) {
  switch (difficulty) {
    case 'Easy':
      return 'dsa-progress--easy';
    case 'Medium':
      return 'dsa-progress--medium';
    case 'Hard':
      return 'dsa-progress--hard';
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Ease-out count from 0 to `target` once `active` turns true. */
function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);

  return value;
}

export default function DsaProgress({ solved, total, byDifficulty, profileUrl }: DsaProgressProps) {
  const [reveal, setReveal] = useState<RevealState>('pending');
  const segments = buildDsaRingSegments(byDifficulty);
  const displayedSolved = useCountUp(solved, reveal === 'revealed');

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReveal('revealed'));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="dsa-progress" data-reveal={reveal} aria-labelledby="dsa-progress-heading">
      <header className="dsa-progress__header">
        <div className="dsa-progress__heading-group">
          <h2 id="dsa-progress-heading" className="dsa-progress__title">
            DSA Progress
          </h2>
          <p className="dsa-progress__meta">LeetCode · Easy / Medium / Hard</p>
        </div>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dsa-progress__source"
        >
          View on LeetCode
        </a>
      </header>

      <div className="dsa-progress__body">
        <div className="dsa-progress__ring-wrap">
          <svg
            className="dsa-progress__ring"
            viewBox={`0 0 ${DSA_RING.viewBox} ${DSA_RING.viewBox}`}
            role="img"
            aria-label={`${solved} of ${total} problems solved: ${byDifficulty
              .map((row) => `${row.difficulty} ${row.solved} of ${row.total}`)
              .join(', ')}`}
          >
            {segments.map((segment) => (
              <g key={segment.difficulty} className={difficultyModifier(segment.difficulty)}>
                <path
                  className="dsa-progress__track"
                  d={segment.trackPath}
                  strokeWidth={DSA_RING.stroke}
                />
                {segment.fillPath ? (
                  <path
                    className="dsa-progress__fill"
                    d={segment.fillPath}
                    strokeWidth={DSA_RING.stroke}
                    pathLength={1}
                  />
                ) : null}
              </g>
            ))}
          </svg>
          <div className="dsa-progress__center" aria-hidden="true">
            <span className="dsa-progress__solved">{displayedSolved}</span>
            <span className="dsa-progress__total">/ {total}</span>
            <span className="dsa-progress__caption">Solved</span>
          </div>
        </div>

        <ul className="dsa-progress__legend">
          {byDifficulty.map((row) => (
            <li
              key={row.difficulty}
              className={`dsa-progress__legend-item ${difficultyModifier(row.difficulty)}`}
            >
              <span className="dsa-progress__swatch" aria-hidden="true" />
              <span className="dsa-progress__legend-label">{row.difficulty}</span>
              <span className="dsa-progress__legend-value">
                {row.solved} / {row.total}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
