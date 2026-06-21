import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { BLOG_DIRECTORY } from './lib/narration.mjs';

const files = (await readdir(BLOG_DIRECTORY)).filter((file) => /\.(md|mdx)$/i.test(file));
let enabled = 0;

for (const file of files) {
  const filePath = path.join(BLOG_DIRECTORY, file);
  const source = await readFile(filePath, 'utf8');
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) continue;

  const frontmatter = parseYaml(frontmatterMatch[1]) ?? {};
  if (frontmatter.draft || frontmatter.audio) continue;

  const updated = source.replace(
    /^(draft:\s*false\s*)$/m,
    '$1\naudio:\n  enabled: true\n  voice: af_heart\n  codeSummaryMode: contextual',
  );

  if (updated === source) {
    console.warn(`Skipped ${file}: no explicit draft: false field.`);
    continue;
  }

  await writeFile(filePath, updated);
  enabled += 1;
}

console.log(`Enabled audio for ${enabled} published posts.`);
