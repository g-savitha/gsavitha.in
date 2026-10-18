/**
 * Single owner of the environment the production build needs.
 *
 * Every variable a build-time fetch reads is declared here once. The Astro integration in
 * `buildEnvGuard.ts` fails `astro build` in CI when one is missing, and `buildEnv.test.ts`
 * fails when `.github/workflows/deploy.yml` does not pass it to the build step. Read values
 * through `readBuildEnv`, never `process.env` / `import.meta.env` directly.
 */

export interface BuildEnvVar {
  /** Fail the CI build when missing (a missing value silently empties a homepage widget). */
  requiredInCI: boolean;
  /** Who reads it, so the error points at the consumer. */
  usedBy: string;
  /** Where the value comes from in the deploy workflow. */
  workflowValue: string;
}

export const BUILD_ENV = {
  GITHUB_TOKEN: {
    requiredInCI: true,
    usedBy: 'src/utils/githubContributions.ts (homepage Consistency heatmap)',
    workflowValue: '${{ secrets.GITHUB_TOKEN }}',
  },
} as const satisfies Record<string, BuildEnvVar>;

export type BuildEnvName = keyof typeof BUILD_ENV;

type EnvSource = Record<string, string | undefined>;

export function readBuildEnv(name: BuildEnvName, env: EnvSource = process.env): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

export function isCI(env: EnvSource = process.env): boolean {
  return env.CI === 'true' || env.GITHUB_ACTIONS === 'true';
}

/** Names that are required in this environment but missing. */
export function missingBuildEnv(env: EnvSource = process.env): BuildEnvName[] {
  if (!isCI(env)) return [];
  return (Object.keys(BUILD_ENV) as BuildEnvName[]).filter(
    (name) => BUILD_ENV[name].requiredInCI && readBuildEnv(name, env) === undefined,
  );
}

export function describeMissing(names: BuildEnvName[]): string {
  const lines = names.map((name) => {
    const spec = BUILD_ENV[name];
    return (
      `  - ${name} (read by ${spec.usedBy}). Add it to the env of the "Build with Astro" step ` +
      `in .github/workflows/deploy.yml: ${name}: ${spec.workflowValue}`
    );
  });
  return [
    'Production build is missing required environment variables:',
    ...lines,
    'Agents cannot edit workflow files; ask the repo owner to apply this change.',
  ].join('\n');
}
