import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
  resolveVoices,
  voiceGenerationSettings,
} from './lib/narration.mjs';

const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const GENERATED_INDEX_PATH = path.join(process.cwd(), '.cache/audio-generated.json');

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
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: storageKey,
    Body: body,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
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

    if (!await fileExists(entry.outputPath)) {
      console.warn(`Skipping ${slug}/${language}: generated MP3 is missing.`);
      failed = true;
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
if (failed) process.exit(1);
