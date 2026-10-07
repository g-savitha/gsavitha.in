import type { ConsistencyDay } from './consistency';

const GITHUB_GRAPHQL = 'https://api.github.com/graphql';

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface GithubCalendarResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          totalContributions: number;
          weeks: { contributionDays: ContributionDay[] }[];
        };
      };
    };
  };
  errors?: { message: string }[];
}

function getGithubToken(): string | undefined {
  const fromImport = import.meta.env.GITHUB_TOKEN;
  if (typeof fromImport === 'string' && fromImport.trim()) return fromImport.trim();

  const fromProcess = process.env.GITHUB_TOKEN;
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();

  return undefined;
}

/**
 * Fetch the authenticated-visible contribution calendar for a public user.
 * Returns an empty series when `GITHUB_TOKEN` is missing or the API fails.
 */
export async function fetchGithubContributionDays(
  username: string,
): Promise<{ days: ConsistencyDay[]; total: number; available: boolean }> {
  const token = getGithubToken();
  if (!token) {
    console.warn('GITHUB_TOKEN missing — GitHub contribution heatmap will be empty.');
    return { days: [], total: 0, available: false };
  }

  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables: { login: username } }),
    });

    if (!response.ok) {
      throw new Error(`GitHub GraphQL HTTP ${response.status}`);
    }

    const payload = (await response.json()) as GithubCalendarResponse;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join('; '));
    }

    const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      return { days: [], total: 0, available: false };
    }

    const days: ConsistencyDay[] = calendar.weeks.flatMap((week) =>
      week.contributionDays.map((day) => ({
        date: day.date,
        count: day.contributionCount,
      })),
    );

    return {
      days,
      total: calendar.totalContributions,
      available: true,
    };
  } catch (error) {
    console.warn(
      'GitHub contribution calendar unavailable.',
      error instanceof Error ? error.message : error,
    );
    return { days: [], total: 0, available: false };
  }
}
