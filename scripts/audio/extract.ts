import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BLOG_DIRECTORY, extractNarration } from './lib/narration.ts';

const outputDirectory = path.join(process.cwd(), '.cache/audio-narration');
const requestedSlug = process.argv
  .find((argument) => argument.startsWith('--slug='))
  ?.split('=')[1];
const checkOnly = process.argv.includes('--check');

const files = (await readdir(BLOG_DIRECTORY))
  .filter((file) => /\.(md|mdx)$/i.test(file))
  .filter((file) => !requestedSlug || file.replace(/\.(md|mdx)$/i, '') === requestedSlug);

if (!checkOnly) await mkdir(outputDirectory, { recursive: true });

let hasErrors = false;

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) continue;

  if (narration.missingCodeSummaries.length > 0) {
    hasErrors = true;
    for (const block of narration.missingCodeSummaries) {
      console.error(
        `${file}:${block.line ?? '?'} needs an <!-- audio-summary: ... --> before its ${block.language} code block.`,
      );
    }
  }

  if (!checkOnly) {
    const outputPath = path.join(outputDirectory, `${narration.slug}.en.json`);
    await writeFile(outputPath, `${JSON.stringify(narration, null, 2)}\n`);
    console.log(`Extracted ${narration.slug}: ${narration.segments.length} segments`);
  }
}

if (requestedSlug && files.length === 0) {
  console.error(`No blog post found for slug "${requestedSlug}".`);
  process.exit(1);
}

if (hasErrors) process.exit(1);
