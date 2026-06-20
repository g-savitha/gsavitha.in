import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { KokoroTTS } from 'kokoro-js';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
} from './lib/narration.mjs';
import {
  DEFAULT_VOICE,
  DTYPE,
  GENERATION_SPEED,
  generationSettings,
  MODEL,
  MP3_BITRATE,
  SAMPLE_RATE,
} from './lib/config.mjs';
const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const GENERATED_INDEX_PATH = path.join(process.cwd(), '.cache/audio-generated.json');
const GENERATED_AUDIO_ROOT = path.join(process.cwd(), '.cache/audio-output');

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

function buildSpeechChunks(segments, maximumLength = 420) {
  const chunks = [];
  let current = '';

  for (const segment of segments) {
    const punctuated = /[.!?]$/.test(segment.text) ? segment.text : `${segment.text}.`;
    for (const part of splitLongText(punctuated, maximumLength)) {
      const candidate = `${current} ${part}`.trim();
      if (candidate.length <= maximumLength) {
        current = candidate;
      } else {
        if (current) chunks.push(current);
        current = part;
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

async function loadGeneratedIndex() {
  try {
    return JSON.parse(await readFile(GENERATED_INDEX_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
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

async function saveGeneratedIndex(index) {
  await mkdir(path.dirname(GENERATED_INDEX_PATH), { recursive: true });
  await writeFile(GENERATED_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);
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
const generated = await loadGeneratedIndex();
const availableSlugs = new Set(files.map((file) => file.replace(/\.(md|mdx)$/i, '')));
if (!requestedSlug) {
  for (const slug of Object.keys(generated)) {
    if (!availableSlugs.has(slug)) delete generated[slug];
  }
}
await saveGeneratedIndex(generated);

for (const file of files) {
  const narration = await extractNarration(path.join(BLOG_DIRECTORY, file));
  if (!narration.audio.enabled) {
    if (generated[narration.slug]) {
      delete generated[narration.slug];
      await saveGeneratedIndex(generated);
    }
    continue;
  }

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
  const settings = generationSettings(voice);
  const hash = narrationHash(narration, settings);
  let staged = generated[narration.slug]?.en;

  if (staged && staged.hash !== hash) {
    delete generated[narration.slug];
    await saveGeneratedIndex(generated);
    staged = null;
  }

  if (!force && manifest[narration.slug]?.en?.hash === hash) {
    console.log(`Unchanged: ${narration.slug}`);
    continue;
  }

  if (!force && staged?.hash === hash && await fileExists(staged.outputPath)) {
    console.log(`Already generated, awaiting upload: ${narration.slug}`);
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
  const chunks = buildSpeechChunks(job.narration.segments);

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
  const storageKey = `audio/blog/${job.narration.slug}/${job.hash}/en.mp3`;
  const outputPath = path.join(GENERATED_AUDIO_ROOT, storageKey);
  const directory = path.dirname(outputPath);
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, mp3);

  generated[job.narration.slug] = {
    ...(generated[job.narration.slug] ?? {}),
    en: {
      storageKey,
      outputPath,
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
  await saveGeneratedIndex(generated);

  console.log(`Staged ${path.relative(process.cwd(), outputPath)}`);
}

console.log(`Updated ${path.relative(process.cwd(), GENERATED_INDEX_PATH)}`);
