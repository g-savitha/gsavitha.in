// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.
import type { IconName } from './utils/icons';

export interface NavigationLink {
  href: string;
  label: string;
  icon: IconName;
}

export interface SocialLink extends NavigationLink {
  href: `https://${string}` | `mailto:${string}` | `/${string}`;
}

export const SITE_TITLE = 'Savitha Gollamudi';
export const SITE_DESCRIPTION = "Savitha's Digital Garden";
export const USER_NAME = 'Savitha';
export const USER_FULL_NAME = 'G. Savitha';

export const NAV_LINKS = [
  { href: '/blog', label: 'Blog', icon: 'PenTool' },
  { href: '/projects', label: 'Projects', icon: 'FolderGit2' },
  { href: '/papers', label: 'Papershelf', icon: 'BookOpen' },
  { href: '/certifications', label: 'Certifications', icon: 'Award' },
  { href: '/goodies', label: 'Goodies', icon: 'Sparkles' },
  { href: '/about', label: 'About Me', icon: 'User' },
] as const satisfies readonly NavigationLink[];

/** Public LinkedIn recommendations tab — source for About page testimonials */
export const LINKEDIN_RECOMMENDATIONS_URL =
  'https://www.linkedin.com/in/g-savitha/details/recommendations/';

export const SOCIAL_LINKS = [
  { href: 'https://github.com/g-savitha', label: 'GitHub', icon: 'Github' },
  { href: 'https://www.linkedin.com/in/g-savitha/', label: 'LinkedIn', icon: 'Linkedin' },
  { href: 'https://leetcode.com/u/g-savitha/', label: 'LeetCode', icon: 'LeetCode' },
  {
    href: 'https://takeuforward.org/profile/gsavitha',
    label: 'TakeUForward',
    icon: 'TakeUForward',
  },
  { href: 'mailto:gsavitha@protonmail.com', label: 'Email', icon: 'Mail' },
  { href: '/rss.xml', label: 'RSS Feed', icon: 'Rss' },
] as const satisfies readonly SocialLink[];

/** Desktop sidebar order (LeetCode below TakeUForward; footer uses `SOCIAL_LINKS` order). */
const SIDEBAR_SOCIAL_LINK_LABELS = [
  'GitHub',
  'LinkedIn',
  'TakeUForward',
  'LeetCode',
  'Email',
  'RSS Feed',
] as const satisfies readonly SocialLink['label'][];

export const SIDEBAR_SOCIAL_LINKS = SIDEBAR_SOCIAL_LINK_LABELS.map((label) => {
  const link = SOCIAL_LINKS.find((entry) => entry.label === label);
  if (!link) {
    throw new Error(`Missing social link for sidebar: ${label}`);
  }
  return link;
});
