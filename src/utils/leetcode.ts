import { formatUtcDate, type ConsistencyDay } from './consistency';

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

export interface LeetCodeDifficultyStat {
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solved: number;
  total: number;
}

export interface LeetCodeProgress {
  solved: number;
  total: number;
  byDifficulty: LeetCodeDifficultyStat[];
}

interface CalendarPayload {
  data?: {
    matchedUser?: {
      userCalendar?: {
        streak?: number;
        totalActiveDays?: number;
        submissionCalendar?: string;
      };
    };
  };
}

interface ProgressPayload {
  data?: {
    allQuestionsCount?: { difficulty: string; count: number }[];
    matchedUser?: {
      submitStatsGlobal?: {
        acSubmissionNum?: { difficulty: string; count: number; submissions: number }[];
      };
    };
  };
}

async function leetCodeQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(LEETCODE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://leetcode.com/',
      Origin: 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode GraphQL HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function parseSubmissionCalendar(raw: string | undefined): ConsistencyDay[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.entries(parsed)
      .map(([timestamp, count]) => ({
        date: formatUtcDate(new Date(Number(timestamp) * 1000)),
        count: Number(count) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/** Fetch submission calendars for the given years and merge by date. */
export async function fetchLeetCodeCalendarDays(
  username: string,
  years: number[],
): Promise<{ days: ConsistencyDay[]; available: boolean }> {
  const query = `
    query ($username: String!, $year: Int) {
      matchedUser(username: $username) {
        userCalendar(year: $year) {
          streak
          totalActiveDays
          submissionCalendar
        }
      }
    }
  `;

  try {
    const results = await Promise.all(
      years.map((year) => leetCodeQuery<CalendarPayload>(query, { username, year })),
    );

    const byDate = new Map<string, number>();
    for (const result of results) {
      const calendar = result.data?.matchedUser?.userCalendar?.submissionCalendar;
      for (const day of parseSubmissionCalendar(calendar)) {
        byDate.set(day.date, (byDate.get(day.date) ?? 0) + day.count);
      }
    }

    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return { days, available: true };
  } catch (error) {
    console.warn('LeetCode calendar unavailable.', error instanceof Error ? error.message : error);
    return { days: [], available: false };
  }
}

/** Fetch Easy / Medium / Hard accepted totals for the DSA progress ring. */
export async function fetchLeetCodeProgress(
  username: string,
): Promise<{ progress: LeetCodeProgress | null; available: boolean }> {
  const query = `
    query ($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
        }
      }
    }
  `;

  try {
    const payload = await leetCodeQuery<ProgressPayload>(query, { username });
    const totals = payload.data?.allQuestionsCount ?? [];
    const solved = payload.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum ?? [];

    const totalByDifficulty = new Map(totals.map((row) => [row.difficulty, row.count]));
    const solvedByDifficulty = new Map(solved.map((row) => [row.difficulty, row.count]));

    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    const byDifficulty = difficulties.map((difficulty) => ({
      difficulty,
      solved: solvedByDifficulty.get(difficulty) ?? 0,
      total: totalByDifficulty.get(difficulty) ?? 0,
    }));

    return {
      available: true,
      progress: {
        solved:
          solvedByDifficulty.get('All') ?? byDifficulty.reduce((sum, row) => sum + row.solved, 0),
        total:
          totalByDifficulty.get('All') ?? byDifficulty.reduce((sum, row) => sum + row.total, 0),
        byDifficulty,
      },
    };
  } catch (error) {
    console.warn('LeetCode progress unavailable.', error instanceof Error ? error.message : error);
    return { progress: null, available: false };
  }
}
