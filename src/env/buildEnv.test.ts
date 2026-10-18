import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import { BUILD_ENV, describeMissing, missingBuildEnv, type BuildEnvName } from './buildEnv.ts';

interface WorkflowStep {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

const names = Object.keys(BUILD_ENV) as BuildEnvName[];

test('CI build without GITHUB_TOKEN is reported as missing', () => {
  assert.deepEqual(missingBuildEnv({ CI: 'true' }), ['GITHUB_TOKEN']);
  assert.deepEqual(missingBuildEnv({ CI: 'true', GITHUB_TOKEN: '  ' }), ['GITHUB_TOKEN']);
  assert.deepEqual(missingBuildEnv({ CI: 'true', GITHUB_TOKEN: 'x' }), []);
});

test('local builds may run without tokens', () => {
  assert.deepEqual(missingBuildEnv({}), []);
});

test('error message names the workflow file and the exact line to add', () => {
  const message = describeMissing(['GITHUB_TOKEN']);
  assert.match(message, /\.github\/workflows\/deploy\.yml/);
  assert.match(message, /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
});

test('deploy.yml passes every required build variable to the step that runs the build', async () => {
  const workflow = parse(await readFile('.github/workflows/deploy.yml', 'utf8'));
  const steps: WorkflowStep[] = workflow.jobs.build.steps;
  const buildStep = steps.find((step) => step.run?.includes('run build'));
  assert.ok(buildStep, 'deploy.yml has no step running `bun run build`');
  const passed = { ...workflow.env, ...workflow.jobs.build.env, ...buildStep.env };
  const missing = names.filter((name) => BUILD_ENV[name].requiredInCI && !(name in passed));
  assert.deepEqual(missing, [], describeMissing(missing));
});
