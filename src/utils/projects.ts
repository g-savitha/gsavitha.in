import { projectsList, type ProjectEntry } from '../data/projectsList';
import { fetchGitHubRepos, normalizeHomepage, type GitHubRepo } from './github';

export interface Project {
	name: string;
	slug: string;
	tagline: string;
	date: string;
	stars: number;
	githubUrl: string;
	demoUrl?: string;
	writeup?: string;
	highlight?: boolean;
}

function getProjectYear(repo: GitHubRepo | undefined, entry: ProjectEntry): string {
	if (entry.date) return entry.date;
	return repo?.created_at.slice(0, 4) ?? '';
}

function mergeProject(entry: ProjectEntry, repo: GitHubRepo | undefined, username: string): Project {
	const demoUrl = entry.url ?? normalizeHomepage(repo?.homepage ?? null);

	return {
		name: entry.name,
		slug: entry.slug,
		tagline: entry.tagline ?? repo?.description ?? '',
		date: getProjectYear(repo, entry),
		stars: repo?.stargazers_count ?? 0,
		githubUrl: repo?.html_url ?? `https://github.com/${username}/${entry.slug}`,
		demoUrl,
		writeup: entry.writeup,
		highlight: entry.highlight,
	};
}

export async function getProjects(username: string): Promise<Project[]> {
	const slugs = projectsList.map((entry) => entry.slug);
	const repos = await fetchGitHubRepos(username, slugs);
	const repoMap = new Map(repos.map((repo) => [repo.name, repo]));

	return projectsList.map((entry) => mergeProject(entry, repoMap.get(entry.slug), username));
}
