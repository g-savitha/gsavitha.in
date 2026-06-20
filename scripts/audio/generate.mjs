import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { KokoroTTS } from 'kokoro-js';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
} from './lib/narration.mjs';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE = 'q8';
const DEFAULT_VOICE = 'af_heart';
const GENERATION_SPEED = 1;
const SAMPLE_RATE = 24_000;
const MP3_BITRATE = 64;
const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const PUBLIC_AUDIO_ROOT = path.join(process.cwd(), 'public/audio/blog');

const lameContext = {};
vm.createContext(lameContext);
vm.runInContext(
  await readFile(new URL('../../node_modules/lamejs/lame.all.js', import.meta.url), 'utf8'),
  lameContext,
);
const { Mp3Encoder } = lameContext.lamejs;

const requestedSlug = process.argv.find((argument) => argument.startsWith('--slug='))?.split('=')[1];
const force = process.argv.includes('--force');

function splitLongText(text, maximumLength = 420) {
  if (text.length <= maximumLength) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= maximumLength) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    if (sentence.length <= maximumLength) {
      current = sentence.trim();
      continue;
    }

    const words = sentence.trim().split(/\s+/);
    current = '';
    for (const word of words) {
      const wordCandidate = `${current} ${word}`.trim();
      if (wordCandidate.length > maximumLength && current) {
        chunks.push(current);
        current = word;
      } else {
        current = wordCandidate;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function concatenateAudio(parts) {
  const gap = new Float32Array(Math.round(SAMPLE_RATE * 0.22));
  const length = parts.reduce((total, part) => total + part.length, 0)
    + Math.max(0, parts.length - 1) * gap.length;
  const result = new Float32Array(length);
  let offset = 0;

  parts.forEach((part, index) => {
    result.set(part, offset);
    offset += part.length;
    if (index < parts.length - 1) {
      result.set(gap, offset);
      offset += gap.length;
    }
  });

  return result;
}

function encodeMp3(samples) {
  const int16 = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    int16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, SAMPLE_RATE, MP3_BITRATE);
  const chunks = [];
  const blockSize = 1152;

  for (let index = 0; index < int16.length; index += blockSize) {
    const encoded = encoder.encodeBuffer(int16.subarray(index, index + blockSize));
    if (encoded.length > 0) chunks.push(Buffer.from(encoded));
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(Buffer.from(finalChunk));
  return Buffer.concat(chunks);
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

const files = (await readdir(BLOG_DIRECTORY))
  .filter((file) => /\.(md|mdx)$/i.test(file))
  .filter((file) => !requestedSlug || file.replace(/\.(md|mdx)$/i, '') === requestedSlug);

if (requestedSlug && files.length === 0) {
  console.error(`No blog post found for slug "${requestedSlug}".`);
  process.exit(1);
}

const jobs = [];
const manifest = await loadManifest();

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) continue;

  if (narration.missingCodeSummaries.length > 0) {
    for (const block of narration.missingCodeSummaries) {
      console.error(
        `${file}:${block.line ?? '?'} needs an <!-- audio-summary: ... --> before its ${block.language} code block.`,
      );
    }
    process.exitCode = 1;
    continue;
  }

  const voice = narration.audio.voice ?? DEFAULT_VOICE;
  const settings = { model: MODEL, dtype: DTYPE, voice, speed: GENERATION_SPEED, bitrate: MP3_BITRATE };
  const hash = narrationHash(narration, settings);

  if (!force && manifest[narration.slug]?.en?.hash === hash) {
    console.log(`Unchanged: ${narration.slug}`);
    continue;
  }

  jobs.push({ narration, voice, hash, settings });
}

if (process.exitCode) process.exit(process.exitCode);
if (jobs.length === 0) {
  console.log('No audio needs generating.');
  process.exit(0);
}

console.log(`Loading Kokoro ${DTYPE} model for ${jobs.length} post(s)…`);
let lastDownloadProgress = -1;
const tts = await KokoroTTS.from_pretrained(MODEL, {
  dtype: DTYPE,
  device: 'cpu',
  progress_callback: (progress) => {
    if (progress.status === 'progress' && progress.progress != null) {
      const rounded = Math.round(progress.progress);
      if (rounded > lastDownloadProgress && (rounded >= lastDownloadProgress + 10 || rounded === 100)) {
        lastDownloadProgress = rounded;
        console.log(`Downloading model: ${rounded}%`);
      }
    }
  },
});
process.stdout.write('\n');

for (const job of jobs) {
  console.log(`Generating ${job.narration.slug}…`);
  const audioParts = [];
  const chunks = job.narration.segments.flatMap((segment) => splitLongText(segment.text));

  for (let index = 0; index < chunks.length; index += 1) {
    process.stdout.write(`\r  Segment ${index + 1}/${chunks.length}`);
    const audio = await tts.generate(chunks[index], {
      voice: job.voice,
      speed: GENERATION_SPEED,
    });
    audioParts.push(audio.audio);
  }
  process.stdout.write('\n');

  const totalGeneratedSamples = audioParts.reduce((total, part) => total + part.length, 0);
  console.log(`  Combining ${(totalGeneratedSamples / SAMPLE_RATE).toFixed(1)} seconds of speech…`);
  const samples = concatenateAudio(audioParts);
  console.log('  Encoding MP3…');
  const mp3 = encodeMp3(samples);
  console.log(`  Encoded ${(mp3.length / 1024).toFixed(0)} KB`);
  const directory = path.join(PUBLIC_AUDIO_ROOT, job.narration.slug);
  const outputPath = path.join(directory, 'en.mp3');
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, mp3);

  manifest[job.narration.slug] = {
    ...(manifest[job.narration.slug] ?? {}),
    en: {
      url: `/audio/blog/${job.narration.slug}/en.mp3`,
      label: 'English',
      language: 'en',
      duration: Number((samples.length / SAMPLE_RATE).toFixed(2)),
      bytes: mp3.length,
      hash: job.hash,
      model: job.settings.model,
      voice: job.voice,
      generatedAt: new Date().toISOString(),
    },
  };

  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
}

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated ${path.relative(process.cwd(), MANIFEST_PATH)}`);
