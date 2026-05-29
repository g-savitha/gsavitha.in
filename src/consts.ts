// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Savitha Gollamudi';
export const SITE_DESCRIPTION = 'Savitha\'s Digital Garden';
export const USER_NAME = 'Savitha';
export const USER_FULL_NAME = 'G. Savitha';

export const NAV_LINKS = [
  { href: '/blog', label: 'Blog', icon: 'PenTool' },
  { href: '/projects', label: 'Projects', icon: 'FolderGit2' },
  { href: '/papers', label: 'Notes', icon: 'BookOpen' },
  { href: '/certifications', label: 'Certifications', icon: 'Award' },
  { href: '/goodies', label: 'Goodies', icon: 'Sparkles' },
  { href: '/about', label: 'About Me', icon: 'User' },
] as const;

/** Public LinkedIn recommendations tab — source for About page testimonials */
export const LINKEDIN_RECOMMENDATIONS_URL =
  'https://www.linkedin.com/in/g-savitha/details/recommendations/';

export const SOCIAL_LINKS = [
  { href: 'https://github.com/g-savitha', label: 'GitHub', icon: 'Github' },
  { href: 'https://www.linkedin.com/in/g-savitha/', label: 'LinkedIn', icon: 'Linkedin' },
  { href: 'https://takeuforward.org/profile/gsavitha', label: 'TakeUForward', icon: 'Terminal' },
  { href: 'mailto:gsavitha@protonmail.com', label: 'Email', icon: 'Mail' },
  { href: '/rss.xml', label: 'RSS Feed', icon: 'Rss' },
] as const;
