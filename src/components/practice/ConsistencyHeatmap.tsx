import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PlatformId, PlatformSeries } from '../../utils/consistency';
import {
  buildHeatmapWeeks,
  computeStats,
  formatDayLabel,
  mergeDayCounts,
  monthLabelsForWeeks,
  rollingMonthsRange,
} from '../../utils/consistency';

type FilterId = 'all' | PlatformId;

interface ConsistencyHeatmapProps {
  platforms: PlatformSeries[];
  rangeMonths: number;
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'github', label: 'GitHub' },
  { id: 'leetcode', label: 'LeetCode' },
];

/** Scroll the heatmap so the newest weeks (right edge) are in view. */
function scrollHeatmapToEnd(element: HTMLDivElement | null) {
  if (!element) return;
  element.scrollLeft = element.scrollWidth;
}

export default function ConsistencyHeatmap({ platforms, rangeMonths }: ConsistencyHeatmapProps) {
  const availablePlatforms = useMemo(
    () => platforms.filter((platform) => platform.available),
    [platforms],
  );
  const [filter, setFilter] = useState<FilterId>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => rollingMonthsRange(rangeMonths), [rangeMonths]);

  const activeDays = useMemo(() => {
    if (filter === 'all') {
      return mergeDayCounts(
        availablePlatforms.map((platform) => platform.days),
        range,
      );
    }

    const selected = platforms.find((platform) => platform.id === filter);
    return mergeDayCounts(selected ? [selected.days] : [], range);
  }, [availablePlatforms, filter, platforms, range]);

  const weeks = useMemo(() => buildHeatmapWeeks(activeDays), [activeDays]);
  const monthLabels = useMemo(() => monthLabelsForWeeks(weeks), [weeks]);
  const stats = useMemo(() => computeStats(activeDays), [activeDays]);

  const connectedCount = availablePlatforms.length;

  useEffect(() => {
    scrollHeatmapToEnd(scrollRef.current);
  }, [weeks, filter]);

  return (
    <section className="consistency-heatmap" aria-labelledby="consistency-heading">
      <header className="consistency-heatmap__header">
        <div className="consistency-heatmap__heading-group">
          <h2 id="consistency-heading" className="consistency-heatmap__title">
            Consistency
          </h2>
          <p className="consistency-heatmap__meta">
            {connectedCount} platform{connectedCount === 1 ? '' : 's'} connected · {rangeMonths}{' '}
            months
          </p>
        </div>

        <div className="consistency-heatmap__filters" role="group" aria-label="Platform filter">
          {FILTERS.map((item) => {
            const disabled =
              item.id !== 'all' &&
              !platforms.some((platform) => platform.id === item.id && platform.available);

            return (
              <button
                key={item.id}
                type="button"
                className="consistency-heatmap__filter"
                data-active={filter === item.id ? 'true' : 'false'}
                aria-pressed={filter === item.id}
                disabled={disabled}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {weeks.length === 0 ? (
        <p className="consistency-heatmap__empty">
          Contribution data is unavailable right now. Check back after the next site build.
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="consistency-heatmap__scroll"
          style={{ '--heatmap-weeks': weeks.length } as CSSProperties}
        >
          <div className="consistency-heatmap__chart" role="presentation">
            <div className="consistency-heatmap__weekdays" aria-hidden="true">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="consistency-heatmap__weekday">
                  {label}
                </span>
              ))}
            </div>

            <div className="consistency-heatmap__body">
              <div className="consistency-heatmap__months" aria-hidden="true">
                {monthLabels.map((label, index) => (
                  <span key={index} className="consistency-heatmap__month">
                    {label ?? ''}
                  </span>
                ))}
              </div>

              <div
                className="consistency-heatmap__grid"
                role="img"
                aria-label={`Contribution heatmap for the last ${rangeMonths} months. ${stats.contributions} contributions, ${stats.activeDays} active days, best streak ${stats.bestStreak}.`}
              >
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="consistency-heatmap__week">
                    {week.map((cell, dayIndex) =>
                      cell.date ? (
                        <div
                          key={cell.date}
                          className="consistency-heatmap__cell"
                          data-level={cell.level}
                          title={formatDayLabel(cell.date, cell.count)}
                        />
                      ) : (
                        <div
                          key={`pad-${weekIndex}-${dayIndex}`}
                          className="consistency-heatmap__cell consistency-heatmap__cell--empty"
                          data-level="0"
                          aria-hidden="true"
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="consistency-heatmap__footer">
        <ul className="consistency-heatmap__stats">
          <li>
            <span className="consistency-heatmap__stat-value">{stats.contributions}</span>
            <span className="consistency-heatmap__stat-label">
              Contributions · {rangeMonths} mos
            </span>
          </li>
          <li>
            <span className="consistency-heatmap__stat-value">{stats.activeDays}</span>
            <span className="consistency-heatmap__stat-label">Active days</span>
          </li>
          <li>
            <span className="consistency-heatmap__stat-value">{stats.bestStreak}</span>
            <span className="consistency-heatmap__stat-label">Best streak</span>
          </li>
        </ul>

        <div className="consistency-heatmap__legend" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className="consistency-heatmap__cell consistency-heatmap__cell--legend"
              data-level={level}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
