// Reconcile src/data/audioManifest.json against what's published in R2.
//
// Runs after the R2 upload step in CI as an authoritative manifest sync, and is
// also handy as a manual recovery tool when a manifest commit was lost (e.g. a
// CI run was cancelled before pushing). For every audio-enabled post it computes
// the current narration hash and:
//   - preserves the existing manifest entry verbatim when it already matches the
//     current hash (keeps the exact duration written by the upload step, and
//     avoids dropping a just-uploaded object due to list-after-write lag);
//   - otherwise rebuilds the entry from R2 object metadata when the object exists
//     at audio/blog/<slug>/<hash>/<language>.mp3 — no regeneration required;
//   - otherwise drops the entry and reports it as needing generation.
//
// Dry-run by default; pass --apply to write the manifest.

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
  resolveVoices,
  voiceGenerationSettings,
} from './lib/narration.mjs';
import { MIN_AUDIO_BYTES, MP3_BITRATE } from './lib/config.mjs';

const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const apply = process.argv.includes('--apply');

const requiredEnvironment = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'AUDIO_PUBLIC_BASE_URL',
];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  console.error(`Missing R2 configuration: ${missingEnvironment.join(', ')}`);
  process.exit(1);
}

const publicBaseUrl = process.env.AUDIO_PUBLIC_BASE_URL.replace(/\/+$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function listAll(prefix) {
  const out = new Map();
  let continuationToken;
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of response.Contents ?? []) {
      out.set(object.Key, { size: object.Size, lastModified: object.LastModified });
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

const r2Objects = await listAll('audio/blog/');
const files = (await readdir(BLOG_DIRECTORY)).filter((file) => /\.(md|mdx)$/i.test(file));
const existingManifest = await readJson(MANIFEST_PATH);

const manifest = {};
let preserved = 0;
let recovered = 0;
let missing = 0;

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) continue;

  for (const voiceConfig of resolveVoices(narration)) {
    const settings = voiceGenerationSettings(voiceConfig);
    const hash = narrationHash(narration, settings);
    const storageKey = `audio/blog/${narration.slug}/${hash}/${voiceConfig.language}.mp3`;
    const object = r2Objects.get(storageKey);
    const existing = existingManifest[narration.slug]?.[voiceConfig.language];

    // Happy path: the upload step already wrote a current entry with the exact
    // duration. Keep it verbatim so we don't downgrade to an approximation, and
    // so a just-uploaded object isn't dropped by any list-after-write lag.
    if (existing?.hash === hash) {
      manifest[narration.slug] = {
        ...(manifest[narration.slug] ?? {}),
        [voiceConfig.language]: existing,
      };
      preserved += 1;
      continue;
    }

    if (!object) {
      console.warn(`MISSING in R2 (needs generation): ${narration.slug} [${voiceConfig.language}]`);
      missing += 1;
      continue;
    }

    // A truncated/empty object means the upload was corrupted or interrupted —
    // don't reconstruct a manifest entry that would point at broken audio.
    if (object.size < MIN_AUDIO_BYTES) {
      console.warn(
        `CORRUPTED in R2 (needs regeneration): ${narration.slug} [${voiceConfig.language}] — ${object.size} bytes`,
      );
      missing += 1;
      continue;
    }

    // Recovery path: object exists in R2 but the manifest is stale/lost. CBR
    // encoding means duration ≈ bytes * 8 / bitrate; the player overwrites this
    // with the exact value once the audio element loads its metadata.
    const duration = Number(((object.size * 8) / (MP3_BITRATE * 1000)).toFixed(2));

    manifest[narration.slug] = {
      ...(manifest[narration.slug] ?? {}),
      [voiceConfig.language]: {
        label: voiceConfig.label,
        language: voiceConfig.language,
        duration,
        bytes: object.size,
        hash,
        model: settings.model,
        voice: voiceConfig.voice,
        generatedAt: (object.lastModified ?? new Date()).toISOString(),
        url: `${publicBaseUrl}/${storageKey}`,
      },
    };
    recovered += 1;
  }
}

console.log(
  `Manifest synced: ${preserved} preserved, ${recovered} recovered from R2; ${missing} still need generation.`,
);

if (apply) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);
} else {
  console.log('Dry run — re-run with --apply to write the manifest.');
}
