/**
 * Astro's content data store caches rendered Markdown/MDX HTML under
 * `node_modules/.astro`. Remark plugin and diagram-theme changes do not
 * invalidate that store, so stale diagram markup (wrong classes, old SVGs)
 * can survive `rm -rf .astro dist`. Clear it before every production build.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';

const target = path.join(process.cwd(), 'node_modules', '.astro');
await rm(target, { recursive: true, force: true });
console.log(`cleared ${target}`);
