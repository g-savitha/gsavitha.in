import fs from 'node:fs/promises';
import path from 'node:path';

export interface GitHubRepo {
  name: string;
  description: string | null;
  stargazers_count: number;
  html_url: string;
  homepage: string | null;
  created_at: string;
  fork: boolean;
  archived: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_DIR = path.join(process.cwd(), '.cache');

type CachePayload = {
  fetchedAt: string;
  repos: GitHubRepo[];
};

let memoryCache: { key: string; repos: GitHubRepo[]; fetchedAt: number } | null = null;

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = import.meta.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function getCacheKey(username: string, slugs: string[]): string {
  return `${username}:${[...slugs].sort().join(',')}`;
}

function cacheFilePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `github-repos-${cacheKey.replace(/[^a-zA-Z0-9,-]/g, '_')}.json`);
}

async function readFileCache(cacheKey: string, allowStale = false): Promise<GitHubRepo[] | null> {
  try {
    const raw = await fs.readFile(cacheFilePath(cacheKey), 'utf-8');
    const payload = JSON.parse(raw) as CachePayload;
    const age = Date.now() - new Date(payload.fetchedAt).getTime();

    if (!allowStale && age > CACHE_TTL_MS) return null;
    return payload.repos;
  } catch {
    return null;
  }
}

async function writeFileCache(cacheKey: string, repos: GitHubRepo[]): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const payload: CachePayload = {
    fetchedAt: new Date().toISOString(),
    repos,
  };
  await fs.writeFile(cacheFilePath(cacheKey), JSON.stringify(payload, null, 2));
}

async function fetchRepo(
  username: string,
  slug: string,
  headers: HeadersInit,
): Promise<GitHubRepo | null> {
  const response = await fetch(`https://api.github.com/repos/${username}/${slug}`, { headers });

  if (response.status === 404) return null;

  if (!response.ok) {
    const hint =
      response.status === 403 && !import.meta.env.GITHUB_TOKEN
        ? ' Add GITHUB_TOKEN to .env for a higher rate limit.'
        : '';
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}.${hint}`);
  }

  return response.json();
}

async function fetchFromGitHub(username: string, slugs: string[]): Promise<GitHubRepo[]> {
  const headers = getAuthHeaders();
  const results = await Promise.all(slugs.map((slug) => fetchRepo(username, slug, headers)));

  return results.filter((repo): repo is GitHubRepo => repo !== null);
}

export async function fetchGitHubRepos(username: string, slugs: string[]): Promise<GitHubRepo[]> {
  const cacheKey = getCacheKey(username, slugs);
  const now = Date.now();

  if (memoryCache?.key === cacheKey && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.repos;
  }

  const fileCache = await readFileCache(cacheKey);
  if (fileCache) {
    memoryCache = { key: cacheKey, repos: fileCache, fetchedAt: now };
    return fileCache;
  }

  try {
    const repos = await fetchFromGitHub(username, slugs);
    memoryCache = { key: cacheKey, repos, fetchedAt: now };
    await writeFileCache(cacheKey, repos);
    return repos;
  } catch (error) {
    const staleCache = await readFileCache(cacheKey, true);
    if (staleCache) {
      console.warn('GitHub API unavailable — using cached repo data.');
      memoryCache = { key: cacheKey, repos: staleCache, fetchedAt: now };
      return staleCache;
    }

    console.warn(
      'GitHub API unavailable — rendering projects without live star counts.',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export function normalizeHomepage(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;

  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}
