import { rollingMonthsRange, type PlatformSeries } from './consistency';
import { fetchGithubContributionDays } from './githubContributions';
import {
  fetchLeetCodeCalendarDays,
  fetchLeetCodeProgress,
  type LeetCodeProgress,
} from './leetcode';

export const PRACTICE_GITHUB_USER = 'g-savitha';
export const PRACTICE_LEETCODE_USER = 'g-savitha';
export const PRACTICE_RANGE_MONTHS = 12;

export interface PracticeSnapshot {
  rangeMonths: number;
  platforms: PlatformSeries[];
  dsa: (LeetCodeProgress & { profileUrl: string }) | null;
}

/** Build homepage practice data (GitHub + LeetCode). TUF omitted to avoid double-counting. */
export async function fetchPracticeSnapshot(): Promise<PracticeSnapshot> {
  const range = rollingMonthsRange(PRACTICE_RANGE_MONTHS);
  const now = new Date();
  const years = [now.getUTCFullYear() - 1, now.getUTCFullYear()];

  const [github, leetcodeCalendar, leetcodeProgress] = await Promise.all([
    fetchGithubContributionDays(PRACTICE_GITHUB_USER),
    fetchLeetCodeCalendarDays(PRACTICE_LEETCODE_USER, years),
    fetchLeetCodeProgress(PRACTICE_LEETCODE_USER),
  ]);

  const platforms: PlatformSeries[] = [
    {
      id: 'github',
      label: 'GitHub',
      profileUrl: `https://github.com/${PRACTICE_GITHUB_USER}`,
      available: github.available,
      days: github.days.filter((day) => day.date >= range.start && day.date <= range.end),
    },
    {
      id: 'leetcode',
      label: 'LeetCode',
      profileUrl: `https://leetcode.com/u/${PRACTICE_LEETCODE_USER}/`,
      available: leetcodeCalendar.available,
      days: leetcodeCalendar.days.filter((day) => day.date >= range.start && day.date <= range.end),
    },
  ];

  return {
    rangeMonths: PRACTICE_RANGE_MONTHS,
    platforms,
    dsa: leetcodeProgress.progress
      ? {
          ...leetcodeProgress.progress,
          profileUrl: `https://leetcode.com/u/${PRACTICE_LEETCODE_USER}/`,
        }
      : null,
  };
}
