interface DifficultyStat {
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solved: number;
  total: number;
}

interface DsaProgressProps {
  solved: number;
  total: number;
  byDifficulty: DifficultyStat[];
  profileUrl: string;
}

const RADIUS = 54;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function segmentClass(difficulty: DifficultyStat['difficulty']) {
  switch (difficulty) {
    case 'Easy':
      return 'dsa-progress__segment--easy';
    case 'Medium':
      return 'dsa-progress__segment--medium';
    case 'Hard':
      return 'dsa-progress__segment--hard';
  }
}

export default function DsaProgress({ solved, total, byDifficulty, profileUrl }: DsaProgressProps) {
  const safeTotal = Math.max(total, 1);
  let accumulated = 0;

  const segments = byDifficulty.map((row) => {
    const length = (row.solved / safeTotal) * CIRCUMFERENCE;
    const dashoffset = -accumulated;
    accumulated += length;
    return { ...row, length, dashoffset };
  });

  return (
    <section className="dsa-progress" aria-labelledby="dsa-progress-heading">
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
            viewBox="0 0 140 140"
            role="img"
            aria-label={`${solved} of ${total} problems solved`}
          >
            <circle
              className="dsa-progress__track"
              cx="70"
              cy="70"
              r={RADIUS}
              strokeWidth={STROKE}
            />
            {segments.map((segment) =>
              segment.solved > 0 ? (
                <circle
                  key={segment.difficulty}
                  className={`dsa-progress__segment ${segmentClass(segment.difficulty)}`}
                  cx="70"
                  cy="70"
                  r={RADIUS}
                  strokeWidth={STROKE}
                  strokeDasharray={`${segment.length} ${CIRCUMFERENCE}`}
                  strokeDashoffset={segment.dashoffset}
                />
              ) : null,
            )}
          </svg>
          <div className="dsa-progress__center">
            <span className="dsa-progress__solved">{solved}</span>
            <span className="dsa-progress__total">/ {total}</span>
          </div>
        </div>

        <ul className="dsa-progress__legend">
          {byDifficulty.map((row) => (
            <li key={row.difficulty} className="dsa-progress__legend-item">
              <span
                className={`dsa-progress__swatch ${segmentClass(row.difficulty)}`}
                aria-hidden="true"
              />
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
