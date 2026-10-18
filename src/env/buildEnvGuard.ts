import type { AstroIntegration } from 'astro';
import { loadEnv } from 'vite';
import { describeMissing, missingBuildEnv } from './buildEnv.ts';

/** Fails `astro build` in CI instead of shipping an empty widget (PR #8/#9, fixed by hand in c91ccb8). */
export function buildEnvGuard(): AstroIntegration {
  return {
    name: 'build-env-guard',
    hooks: {
      'astro:config:setup': ({ command }) => {
        if (command !== 'build') return;
        // Same sources the build reads: process env plus any local .env file.
        const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
        const missing = missingBuildEnv(env);
        if (missing.length > 0) throw new Error(describeMissing(missing));
      },
    },
  };
}
