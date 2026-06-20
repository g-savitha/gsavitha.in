import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
} from './lib/narration.mjs';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';
const DEFAULT_VOICE = 'af_heart';
const GENERATION_SPEED = 1;
const MP3_BITRATE = 64;
const manifest = JSON.parse(
  await readFile(path.join(process.cwd(), 'src/data/audioManifest.json'), 'utf8'),
);

let failed = false;
const files = (await readdir(BLOG_DIRECTORY)).filter((file) => /\.(md|mdx)$/i.test(file));

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) continue;

  for (const block of narration.missingCodeSummaries) {
    console.error(`${file}:${block.line ?? '?'} is missing an audio summary.`);
    failed = true;
  }

  const voice = narration.audio.voice ?? DEFAULT_VOICE;
  const hash = narrationHash(narration, {
    model: MODEL,
    dtype: DTYPE,
    voice,
    speed: GENERATION_SPEED,
    bitrate: MP3_BITRATE,
  });
  const entry = manifest[narration.slug]?.en;

  if (!entry || entry.hash !== hash) {
    console.error(`Audio is missing or stale for ${narration.slug}. Run: bun run audio:generate --slug=${narration.slug}`);
    failed = true;
    continue;
  }

  try {
    await access(path.join(process.cwd(), 'public', entry.url.replace(/^\//, '')));
  } catch {
    console.error(`Audio file is missing for ${narration.slug}: ${entry.url}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Audio narration is up to date.');

