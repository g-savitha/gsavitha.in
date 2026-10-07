export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type PlatformId = 'github' | 'leetcode';

export interface ConsistencyDay {
  date: string;
  count: number;
}

export interface ConsistencyStats {
  contributions: number;
  activeDays: number;
  bestStreak: number;
}

export interface PlatformSeries {
  id: PlatformId;
  label: string;
  profileUrl: string;
  available: boolean;
  days: ConsistencyDay[];
}

export interface HeatmapCell {
  date: string | null;
  count: number;
  level: HeatmapLevel;
}

/** Map activity count → intensity for theme-bound heatmap cells. */
export function countToLevel(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function parseUtcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive UTC date range covering the last `months` months ending today. */
export function rollingMonthsRange(months = 12): { start: string; end: string } {
  const end = new Date();
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const startUtc = new Date(endUtc);
  startUtc.setUTCMonth(startUtc.getUTCMonth() - months);
  startUtc.setUTCDate(startUtc.getUTCDate() + 1);
  return { start: formatUtcDate(startUtc), end: formatUtcDate(endUtc) };
}

/** Merge per-day counts (sum) and optionally clip to [start, end]. */
export function mergeDayCounts(
  seriesList: ConsistencyDay[][],
  range?: { start: string; end: string },
): ConsistencyDay[] {
  const totals = new Map<string, number>();

  for (const series of seriesList) {
    for (const day of series) {
      if (range && (day.date < range.start || day.date > range.end)) continue;
      totals.set(day.date, (totals.get(day.date) ?? 0) + day.count);
    }
  }

  if (range) {
    const start = parseUtcDate(range.start);
    const end = parseUtcDate(range.end);
    const days: ConsistencyDay[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = formatUtcDate(cursor);
      days.push({ date: iso, count: totals.get(iso) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function computeStats(days: ConsistencyDay[]): ConsistencyStats {
  let contributions = 0;
  let activeDays = 0;
  let bestStreak = 0;
  let currentStreak = 0;

  for (const day of days) {
    contributions += day.count;
    if (day.count > 0) {
      activeDays += 1;
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return { contributions, activeDays, bestStreak };
}

/**
 * Build a Sunday-start week grid covering every day in `days`.
 * Leading/trailing null cells pad incomplete weeks.
 */
export function buildHeatmapWeeks(days: ConsistencyDay[]): HeatmapCell[][] {
  if (days.length === 0) return [];

  const byDate = new Map(days.map((day) => [day.date, day.count]));
  const start = parseUtcDate(days[0].date);
  const end = parseUtcDate(days[days.length - 1].date);

  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const weeks: HeatmapCell[][] = [];
  let week: HeatmapCell[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const iso = formatUtcDate(cursor);
    const inRange = cursor >= start && cursor <= end;
    const count = inRange ? (byDate.get(iso) ?? 0) : 0;

    week.push({
      date: inRange ? iso : null,
      count,
      level: inRange ? countToLevel(count) : 0,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return weeks;
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Month label for the first week that introduces a new month. */
export function monthLabelsForWeeks(weeks: HeatmapCell[][]): (string | null)[] {
  let lastMonth = -1;

  return weeks.map((week) => {
    const firstDated = week.find((cell) => cell.date !== null);
    if (!firstDated?.date) return null;

    const month = Number(firstDated.date.slice(5, 7)) - 1;
    if (month === lastMonth) return null;

    lastMonth = month;
    return MONTH_LABELS[month];
  });
}

export function formatDayLabel(iso: string, count: number): string {
  const date = parseUtcDate(iso);
  const formatted = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const noun = count === 1 ? 'contribution' : 'contributions';
  return `${formatted}: ${count} ${noun}`;
}
