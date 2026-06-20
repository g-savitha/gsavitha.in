import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
  resolveVoices,
  voiceGenerationSettings,
} from './lib/narration.mjs';

const strict = process.argv.includes('--strict');
const pruneStale = process.argv.includes('--prune-stale');
const manifestPath = path.join(process.cwd(), 'src/data/audioManifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

let failed = false;
let pruned = false;

const files = (await readdir(BLOG_DIRECTORY)).filter((file) => /\.(md|mdx)$/i.test(file));

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) continue;

  for (const block of narration.missingCodeSummaries) {
    console.error(`${file}:${block.line ?? '?'} is missing an audio summary.`);
    failed = true;
  }

  const voices = resolveVoices(narration);
  const configuredLanguages = new Set(voices.map((voice) => voice.language));
  const manifestLanguages = Object.keys(manifest[narration.slug] ?? {});

  for (const language of manifestLanguages) {
    if (configuredLanguages.has(language)) continue;

    const message = `Audio is configured for removed language ${narration.slug} [${language}].`;
    if (pruneStale) {
      delete manifest[narration.slug][language];
      if (Object.keys(manifest[narration.slug]).length === 0) {
        delete manifest[narration.slug];
      }
      pruned = true;
      console.warn(`Removed stale audio metadata for ${narration.slug} [${language}].`);
    } else if (strict) {
      console.error(message);
      failed = true;
    } else {
      console.warn(`Warning: ${message}`);
    }
  }

  for (const voiceConfig of voices) {
    const { language } = voiceConfig;
    const hash = narrationHash(narration, voiceGenerationSettings(voiceConfig));
    const entry = manifest[narration.slug]?.[language];

    if (!entry || entry.hash !== hash) {
      const message = `Audio is missing or stale for ${narration.slug} [${language}]. Run: bun run audio:generate --slug=${narration.slug}`;

      if (entry && pruneStale) {
        delete manifest[narration.slug][language];
        if (Object.keys(manifest[narration.slug]).length === 0) {
          delete manifest[narration.slug];
        }
        pruned = true;
        console.warn(`Removed stale audio metadata for ${narration.slug} [${language}].`);
      }

      if (strict) {
        console.error(message);
        failed = true;
      } else {
        console.warn(`Warning: ${message}`);
      }
      continue;
    }

    if (entry.url.startsWith('/')) {
      try {
        await access(path.join(process.cwd(), 'public', entry.url.replace(/^\//, '')));
      } catch {
        console.error(`Audio file is missing for ${narration.slug} [${language}]: ${entry.url}`);
        failed = true;
      }
    } else if (!entry.url.startsWith('https://')) {
      console.error(`Audio URL must be root-relative or HTTPS for ${narration.slug} [${language}]: ${entry.url}`);
      failed = true;
    }
  }
}

if (pruned) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (failed) process.exit(1);
console.log(strict ? 'Audio narration is up to date.' : 'Available audio narration is valid.');
