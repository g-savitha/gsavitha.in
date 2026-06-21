export interface ProjectEntry {
  /** GitHub repo name */
  slug: string;
  name: string;
  tagline?: string;
  date?: string;
  /** Live demo URL */
  url?: string;
  /** Blog post path on this site */
  writeup?: string;
  highlight?: boolean;
}

/**
 * Hand-picked projects to display. Only repos listed here appear on /projects.
 * Star counts are fetched from GitHub at build time.
 */
export const projectsList: ProjectEntry[] = [
  {
    slug: 'agentic-crew',
    name: 'Agentic Crew',
    tagline: 'Scaffold a full AI engineering team into any Agentic IDE project.',
    highlight: true,
    url: 'https://www.npmjs.com/package/agentic-crew',
  },
  {
    slug: 'gsavitha.in',
    name: 'gsavitha.in',
    tagline: 'This portfolio site, built with Astro.',
    highlight: true,
  },
  {
    slug: 'bolt',
    name: 'Bolt',
    tagline: 'Peer-to-peer chat and file sharing app.',
    highlight: true,
  },
  {
    slug: 'hustler',
    name: 'Hustler',
    tagline: 'Chrome extension to keep hustling and crush your goals.',
    url: 'https://chromewebstore.google.com/detail/hustler/eijpnpjndmhdpjcckdjijmlcjeeededl',
    highlight: true,
  },
  {
    slug: 'bookmark-gpt-pro',
    name: 'Bookmark GPT Pro',
    url: 'https://chromewebstore.google.com/detail/bookmark-gpt-pro/denedgfcamlbiodkmbmdaifoaijgdimn',
    highlight: true,
  },
  {
    slug: 'config-driven-ui',
    name: 'Config Driven UI',
    writeup: '/blog/config-driven-ui',
  },
  {
    slug: 'http-server',
    name: 'Build Your own HTTP Server',
    writeup: '/blog/http-server',
  },
  {
    slug: 'coffee-shop-ui',
    name: 'RBAC and ABAC',
    writeup: '/blog/rbac-node',
  },
  {
    slug: 'Wordle-clone',
    name: 'Wordle Clone',
  },
  {
    slug: 'ArthaChakra-telegram-bot',
    name: 'ArthaChakra',
    tagline: 'Telegram expenses tracker bot.',
    writeup: '/blog/telegram-bot',
  },
  {
    slug: 'practical-system-design',
    name: 'Practical Frontend System Design',
  },
  {
    slug: 'Maze-generator',
    name: 'Maze Generator',
  },
];
