import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { access, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
  resolveVoices,
  voiceGenerationSettings,
} from './lib/narration.mjs';
import { MIN_AUDIO_BYTES } from './lib/config.mjs';

const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const GENERATED_INDEX_PATH = path.join(process.cwd(), '.cache/audio-generated.json');

// When set, no objects are uploaded or deleted — actions are only logged.
const dryRun = process.argv.includes('--dry-run');

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
if (!/^https:\/\//.test(publicBaseUrl)) {
  console.error('AUDIO_PUBLIC_BASE_URL must be an HTTPS URL.');
  process.exit(1);
}

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(storageKey, filePath) {
  const body = await readFile(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: storageKey,
      Body: body,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

// Recover the R2 object key from a published manifest URL (drops the public
// base and any query string), or null when the URL points elsewhere.
function storageKeyFromUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(publicBaseUrl)) return null;
  return url.slice(publicBaseUrl.length).replace(/^\/+/, '').split('?')[0] || null;
}

async function listStorageKeys(prefix) {
  const keys = [];
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
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// Delete every object under a post's prefix that the current manifest no longer
// references. A content edit produces a new hash (so a new object) and this
// removes the previous one — i.e. the file is replaced rather than accumulated.
// Distinct voices keep distinct keys, so each is preserved.
async function pruneStaleObjects(slug, keepKeys) {
  const existing = await listStorageKeys(`audio/blog/${slug}/`);
  const stale = existing.filter((key) => !keepKeys.has(key));
  if (stale.length === 0) return 0;

  if (dryRun) {
    for (const key of stale) console.log(`[dry-run] would delete ${key}`);
    return stale.length;
  }

  await s3.send(
    new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET,
      Delete: { Objects: stale.map((Key) => ({ Key })), Quiet: true },
    }),
  );
  return stale.length;
}

const generated = await readJson(GENERATED_INDEX_PATH);
const manifest = await readJson(MANIFEST_PATH);
const blogFiles = new Map(
  (await readdir(BLOG_DIRECTORY))
    .filter((file) => /\.(md|mdx)$/i.test(file))
    .map((file) => [file.replace(/\.(md|mdx)$/i, ''), path.join(BLOG_DIRECTORY, file)]),
);
let uploaded = 0;
let failed = false;

for (const [slug, languages] of Object.entries(generated)) {
  const blogFile = blogFiles.get(slug);
  let voiceByLanguage = null;

  for (const [language, entry] of Object.entries(languages)) {
    if (!entry || manifest[slug]?.[language]?.hash === entry.hash) continue;

    if (!blogFile) {
      console.warn(`Skipping ${slug}/${language}: source post no longer exists.`);
      failed = true;
      continue;
    }

    const narration = await extractNarration(blogFile);
    voiceByLanguage ??= new Map(resolveVoices(narration).map((voice) => [voice.language, voice]));
    const voiceConfig = voiceByLanguage.get(language);
    if (!voiceConfig) {
      console.warn(`Skipping ${slug}/${language}: language is no longer configured.`);
      continue;
    }

    const expectedHash = narrationHash(narration, voiceGenerationSettings(voiceConfig));
    if (!narration.audio.enabled || entry.hash !== expectedHash) {
      console.warn(`Skipping ${slug}/${language}: staged audio does not match current narration.`);
      failed = true;
      continue;
    }

    if (!(await fileExists(entry.outputPath))) {
      console.warn(`Skipping ${slug}/${language}: generated MP3 is missing.`);
      failed = true;
      continue;
    }

    // Integrity check: the file on disk must exactly match the byte count that
    // generation recorded for this render. A mismatch means the MP3 was
    // truncated/corrupted after encoding, so we refuse to upload it (and
    // therefore never record its hash in the manifest). Fall back to a minimum
    // size floor only when an older generated index lacks the byte count.
    const { size: stagedBytes } = await stat(entry.outputPath);
    const expectedBytes = typeof entry.bytes === 'number' ? entry.bytes : null;
    const corrupted =
      expectedBytes !== null ? stagedBytes !== expectedBytes : stagedBytes < MIN_AUDIO_BYTES;
    if (corrupted) {
      const detail =
        expectedBytes !== null
          ? `${stagedBytes} bytes on disk vs ${expectedBytes} expected`
          : `${stagedBytes} bytes, below ${MIN_AUDIO_BYTES} floor`;
      console.warn(`Skipping ${slug}/${language}: generated MP3 looks corrupted (${detail}).`);
      failed = true;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would upload ${slug} [${language}] → ${entry.storageKey}`);
      continue;
    }

    console.log(`Uploading ${slug} [${language}] to R2…`);
    try {
      await uploadToR2(entry.storageKey, entry.outputPath);
    } catch (error) {
      console.error(`Upload failed for ${slug}/${language}: ${error.message}`);
      failed = true;
      continue;
    }

    const { outputPath, storageKey, ...metadata } = entry;
    manifest[slug] = {
      ...(manifest[slug] ?? {}),
      [language]: {
        ...metadata,
        url: `${publicBaseUrl}/${storageKey}`,
      },
    };
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    uploaded += 1;
    console.log(`Published ${publicBaseUrl}/${storageKey}`);
  }
}

console.log(uploaded > 0 ? `Uploaded ${uploaded} audio file(s).` : 'No audio needs uploading.');

// Prune superseded R2 objects so each post keeps only the files the manifest
// currently points to (one per voice). Best-effort: cleanup failures never
// block publishing.
let removed = 0;
for (const [slug, languages] of Object.entries(manifest)) {
  const keepKeys = new Set();
  for (const entry of Object.values(languages)) {
    const key = storageKeyFromUrl(entry?.url);
    if (key) keepKeys.add(key);
  }
  if (keepKeys.size === 0) continue;

  try {
    removed += await pruneStaleObjects(slug, keepKeys);
  } catch (error) {
    console.warn(`Cleanup failed for ${slug}: ${error.message}`);
  }
}
if (removed > 0) {
  console.log(`${dryRun ? '[dry-run] would remove' : 'Removed'} ${removed} stale R2 object(s).`);
}

if (failed) process.exit(1);
