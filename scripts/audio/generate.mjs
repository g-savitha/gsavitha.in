import { access, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { KokoroTTS } from 'kokoro-js';
import {
  BLOG_DIRECTORY,
  extractNarration,
  narrationHash,
  resolveVoices,
  voiceGenerationSettings,
} from './lib/narration.mjs';
import {
  buildSpeechChunks,
  chunkCacheHash,
  isSlugRecoverable,
  liveChunkHashes,
  resultFileLanguageStates,
  selectStaleSegmentFiles,
} from './lib/cache.mjs';
import { DTYPE, GENERATION_SPEED, MODEL, MP3_BITRATE, SAMPLE_RATE } from './lib/config.mjs';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const MANIFEST_PATH = path.join(process.cwd(), 'src/data/audioManifest.json');
const GENERATED_INDEX_PATH = path.join(process.cwd(), '.cache/audio-generated.json');
const RESULTS_DIR = path.join(process.cwd(), '.cache/audio-results');
const GENERATED_AUDIO_ROOT = path.join(process.cwd(), '.cache/audio-output');
const SEGMENT_CACHE_DIR = path.join(process.cwd(), '.cache/audio-segments');

// ─── CLI flags ───────────────────────────────────────────────────────────────

const requestedSlug = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const force = process.argv.includes('--force');
// --worker: skip parallel dispatch; this process IS the worker
const isWorker = process.argv.includes('--worker');

// ─── lamejs (UMD bundle — load via vm sandbox) ───────────────────────────────

const lameContext = {};
vm.createContext(lameContext);
vm.runInContext(
  await readFile(new URL('../../node_modules/lamejs/lame.all.js', import.meta.url), 'utf8'),
  lameContext,
);
const { Mp3Encoder } = lameContext.lamejs;

// ─── Segment cache ───────────────────────────────────────────────────────────
//
// Each synthesised text chunk is stored as a raw Float32LE file keyed by a
// hash of (text, model, dtype, voice, speed).  On a re-run only paragraphs
// that actually changed need a TTS call; everything else is assembled from
// the cache.  This makes incremental edits — fixing a typo, adding a section
// — very fast.  Chunking and hashing live in ./lib/cache.mjs so they can be
// unit tested without loading the TTS model.

async function getCachedChunk(hash) {
  if (force) return null;
  try {
    const raw = await readFile(path.join(SEGMENT_CACHE_DIR, `${hash}.f32`));
    // Buffer may be pool-backed (byteOffset != 0) — slice to own ArrayBuffer
    const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    return new Float32Array(ab);
  } catch {
    return null;
  }
}

async function setCachedChunk(hash, audio) {
  await mkdir(SEGMENT_CACHE_DIR, { recursive: true });
  // audio.buffer may be shared; copy just the relevant bytes
  await writeFile(
    path.join(SEGMENT_CACHE_DIR, `${hash}.f32`),
    Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength),
  );
}

// ─── Streaming MP3 encoder ───────────────────────────────────────────────────
//
// Instead of collecting all Float32 audio parts and concatenating before
// encoding, we create one Mp3Encoder per file and feed it chunks as they
// arrive.  Peak memory is O(one-chunk) Float32 + O(total-file) MP3 bytes
// rather than O(total-file) Float32 + O(total-file) MP3 bytes.

const GAP = new Float32Array(Math.round(SAMPLE_RATE * 0.22)); // 220 ms silence

function encodeToMp3Buffers(encoder, samples) {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const out = [];
  const blockSize = 1152;
  for (let i = 0; i < int16.length; i += blockSize) {
    const encoded = encoder.encodeBuffer(int16.subarray(i, i + blockSize));
    if (encoded.length > 0) out.push(Buffer.from(encoded));
  }
  return out;
}

// ─── Lazy TTS model ──────────────────────────────────────────────────────────
//
// The model loads only when at least one chunk is absent from the segment
// cache.  If every chunk for every pending post is already cached, Kokoro is
// never initialised — saving several seconds on incremental CI runs.

let tts = null;

async function ensureTts() {
  if (tts) return tts;
  console.log(`Loading Kokoro ${DTYPE} model…`);
  let lastPct = -1;
  tts = await KokoroTTS.from_pretrained(MODEL, {
    dtype: DTYPE,
    device: 'cpu',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.progress != null) {
        const pct = Math.round(p.progress);
        if (pct > lastPct && (pct >= lastPct + 10 || pct === 100)) {
          lastPct = pct;
          console.log(`  Downloading: ${pct}%`);
        }
      }
    },
  });
  process.stdout.write('\n');
  return tts;
}

// ─── Per-voice generation ────────────────────────────────────────────────────

async function generateForVoice(narration, voiceConfig) {
  const { voice, language, label } = voiceConfig;
  const settings = voiceGenerationSettings(voiceConfig);
  const hash = narrationHash(narration, settings);
  const chunks = buildSpeechChunks(narration.segments);

  // Pre-populate cache; count how many need synthesis
  const chunkInfos = await Promise.all(
    chunks.map(async (text) => {
      const cHash = chunkCacheHash(text, settings);
      const audio = await getCachedChunk(cHash);
      return { text, cHash, audio };
    }),
  );
  const misses = chunkInfos.filter((c) => !c.audio).length;
  console.log(`  [${language}] ${chunks.length} chunk(s), ${misses} to synthesise`);

  if (misses > 0) await ensureTts();

  const encoder = new Mp3Encoder(1, SAMPLE_RATE, MP3_BITRATE);
  const mp3Parts = [];
  let totalSamples = 0;
  let synthesised = 0;

  for (let i = 0; i < chunkInfos.length; i++) {
    let { text, cHash, audio } = chunkInfos[i];

    if (!audio) {
      process.stdout.write(`\r    Synthesising chunk ${++synthesised}/${misses}`);
      const result = await tts.generate(text, { voice, speed: GENERATION_SPEED });
      audio = result.audio;
      await setCachedChunk(cHash, audio);
    }

    totalSamples += audio.length;
    mp3Parts.push(...encodeToMp3Buffers(encoder, audio));
    if (i < chunkInfos.length - 1) {
      mp3Parts.push(...encodeToMp3Buffers(encoder, GAP));
      totalSamples += GAP.length;
    }
  }

  if (misses > 0) process.stdout.write('\n');

  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Parts.push(Buffer.from(flushed));
  const mp3 = Buffer.concat(mp3Parts);

  const storageKey = `audio/blog/${narration.slug}/${hash}/${language}.mp3`;
  const outputPath = path.join(GENERATED_AUDIO_ROOT, storageKey);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, mp3);
  console.log(
    `    Encoded ${(mp3.length / 1024).toFixed(0)} KB · ${(totalSamples / SAMPLE_RATE).toFixed(1)} s`,
  );

  return {
    storageKey,
    outputPath,
    label,
    language,
    duration: Number((totalSamples / SAMPLE_RATE).toFixed(2)),
    bytes: mp3.length,
    hash,
    model: settings.model,
    voice,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Per-post generation (all voices) ───────────────────────────────────────

async function generatePost(narration, manifest, generated) {
  const voices = resolveVoices(narration);
  const results = {};

  for (const voiceConfig of voices) {
    const { voice, language } = voiceConfig;
    const settings = voiceGenerationSettings(voiceConfig);
    const hash = narrationHash(narration, settings);

    const inManifest = manifest[narration.slug]?.[language];
    const staged = generated[narration.slug]?.[language];

    if (!force && inManifest?.hash === hash) {
      console.log(`Unchanged [${language}]: ${narration.slug}`);
      continue;
    }

    if (!force && staged?.hash === hash) {
      try {
        await access(staged.outputPath);
        console.log(`Already staged [${language}]: ${narration.slug}`);
        continue;
      } catch {
        // File missing from disk — fall through and regenerate
      }
    }

    console.log(`Generating ${narration.slug}…`);
    results[language] = await generateForVoice(narration, voiceConfig);
  }

  return Object.keys(results).length > 0 ? results : null;
}

// ─── Segment-cache eviction ───────────────────────────────────────────────────
//
// After a full orchestrator pass, any .f32 file that is no longer referenced
// by an active narration is stale.  We enumerate the live set of chunk hashes
// (one per unique (text, settings) combination across all enabled posts) and
// delete everything in SEGMENT_CACHE_DIR that isn't in that set.
//
// The pass is cheap: hashing is pure CPU with no I/O beyond the readdir.

async function evictStaleSegments(activeNarrations) {
  let files;
  try {
    files = await readdir(SEGMENT_CACHE_DIR);
  } catch {
    return; // Cache dir doesn't exist yet — nothing to evict
  }

  const f32Files = files.filter((f) => f.endsWith('.f32'));
  if (f32Files.length === 0) return;

  const stale = selectStaleSegmentFiles(f32Files, liveChunkHashes(activeNarrations));
  if (stale.length === 0) return;

  await Promise.allSettled(stale.map((f) => unlink(path.join(SEGMENT_CACHE_DIR, f))));
  console.log(`Evicted ${stale.length} stale segment(s) from cache.`);
}

// ─── JSON utilities ──────────────────────────────────────────────────────────

async function loadJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
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

async function saveJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

// Return true when a slug's result file from a previous partial run already
// satisfies the current content hash for every voice — meaning the worker
// completed successfully before and the orchestrator can skip re-dispatching.
async function isResultFileValid(slug, narration, manifest, generated) {
  if (force) return false;
  const result = await loadJson(path.join(RESULTS_DIR, `${slug}.json`), null);
  if (!result) return false;

  const languageStates = await resultFileLanguageStates({
    narration,
    manifestEntry: manifest[slug],
    generatedEntry: generated[slug],
    resultEntry: result,
    fileExists,
  });
  return isSlugRecoverable(languageStates);
}

// Merge per-post result files (written by workers) into the generated index.
// Only merges slugs that were part of the current job run to avoid picking up
// stale files from earlier aborted runs.
async function mergeResultFiles(generated, slugs) {
  for (const slug of slugs) {
    const resultPath = path.join(RESULTS_DIR, `${slug}.json`);
    const results = await loadJson(resultPath, null);
    if (results) {
      generated[slug] = { ...(generated[slug] ?? {}), ...results };
    }
  }
  return generated;
}

// ─── Parallel worker dispatch ────────────────────────────────────────────────
//
// When there are multiple posts to generate and enough CPU cores available,
// the orchestrator spawns N child processes (each running this same script
// with --worker) and distributes slugs across them like a work-stealing queue.
// Each worker operates independently: it loads the model, reads the segment
// cache, synthesises any cache-miss chunks, and writes a per-post result file.
// The orchestrator merges those result files into the generated index once all
// workers complete.  No shared mutable state between workers.

function spawnWorker(slug) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, `--slug=${slug}`, '--worker'], {
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited ${code} for: ${slug}`));
    });
  });
}

async function runParallel(slugs, workerCount) {
  console.log(`Spawning ${workerCount} worker(s) for ${slugs.length} post(s)…\n`);
  const queue = [...slugs];
  const failures = [];

  // Each "virtual worker" pulls slugs from the shared queue until it's empty.
  // Actual CPU parallelism comes from the child processes spawned by spawnWorker.
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const slug = queue.shift();
        try {
          await spawnWorker(slug);
        } catch (err) {
          console.error(err.message);
          failures.push(slug);
        }
      }
    }),
  );

  if (failures.length > 0) {
    console.error(`\nGeneration failed for: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const manifest = await loadJson(MANIFEST_PATH);
const generated = await loadJson(GENERATED_INDEX_PATH);

const allFiles = (await readdir(BLOG_DIRECTORY)).filter((f) => /\.(md|mdx)$/i.test(f));
const files = allFiles.filter(
  (f) => !requestedSlug || f.replace(/\.(md|mdx)$/i, '') === requestedSlug,
);

if (requestedSlug && files.length === 0) {
  console.error(`No blog post found for slug "${requestedSlug}".`);
  process.exit(1);
}

// Prune generated index entries for posts that no longer exist on disk.
// Only the orchestrator does this; workers operate on a single slug.
if (!requestedSlug && !isWorker) {
  const available = new Set(allFiles.map((f) => f.replace(/\.(md|mdx)$/i, '')));
  let pruned = false;
  for (const slug of Object.keys(generated)) {
    if (!available.has(slug)) {
      delete generated[slug];
      pruned = true;
    }
  }
  if (pruned) await saveJson(GENERATED_INDEX_PATH, generated);
}

// Parse narrations for all in-scope files
const narrations = await Promise.all(
  files.map((f) => extractNarration(path.join(BLOG_DIRECTORY, f))),
);

// Validate and build job list
const jobs = [];

for (const narration of narrations) {
  if (!narration.audio.enabled) {
    if (generated[narration.slug]) {
      delete generated[narration.slug];
      await saveJson(GENERATED_INDEX_PATH, generated);
    }
    continue;
  }

  if (narration.missingCodeSummaries.length > 0) {
    for (const block of narration.missingCodeSummaries) {
      console.error(
        `${narration.slug}:${block.line ?? '?'} needs <!-- audio-summary: ... --> before its ${block.language} code block.`,
      );
    }
    process.exitCode = 1;
    continue;
  }

  const voices = resolveVoices(narration);
  let needsGeneration = false;
  for (const voiceConfig of voices) {
    const { language } = voiceConfig;
    const hash = narrationHash(narration, voiceGenerationSettings(voiceConfig));
    const staged = generated[narration.slug]?.[language];
    if (!force && manifest[narration.slug]?.[language]?.hash === hash) continue;
    if (!force && staged?.hash === hash && (await fileExists(staged.outputPath))) continue;
    needsGeneration = true;
    break;
  }

  if (needsGeneration) jobs.push(narration);
}

if (process.exitCode) process.exit(process.exitCode);

if (jobs.length === 0) {
  console.log('No audio needs generating.');
  // Even when nothing needs generating, evict segments left behind by deleted
  // or modified posts (e.g. a paragraph was removed but the .f32 remained).
  if (!isWorker && !requestedSlug) {
    await evictStaleSegments(narrations.filter((n) => n.audio.enabled));
  }
  process.exit(0);
}

// ─── Dispatch: parallel or serial ────────────────────────────────────────────

if (!isWorker && jobs.length >= 2) {
  const cpuCount = os.cpus().length;
  const workerCount = Math.min(jobs.length, Math.max(1, Math.floor(cpuCount / 2)), 4);

  if (workerCount >= 2) {
    await mkdir(RESULTS_DIR, { recursive: true });

    // Resumable workers: if a result file from a previous partial run already
    // satisfies the current hash for every voice, skip re-dispatching that slug.
    const validFlags = await Promise.all(
      jobs.map((n) => isResultFileValid(n.slug, n, manifest, generated)),
    );
    const pending = jobs.filter((_, i) => !validFlags[i]);
    const recovered = jobs.filter((_, i) => validFlags[i]);

    if (recovered.length > 0) {
      console.log(`Recovered ${recovered.length} post(s) from previous partial run.`);
    }

    // Clear result files only for slugs we're actually re-dispatching.
    await Promise.allSettled(pending.map((n) => unlink(path.join(RESULTS_DIR, `${n.slug}.json`))));

    if (pending.length > 0) {
      const actualWorkers = Math.min(pending.length, workerCount);
      await runParallel(
        pending.map((n) => n.slug),
        actualWorkers,
      );
    }

    // Merge result files for all jobs (newly dispatched + recovered).
    const merged = await mergeResultFiles(
      generated,
      jobs.map((n) => n.slug),
    );
    await saveJson(GENERATED_INDEX_PATH, merged);
    console.log(`\nUpdated ${path.relative(process.cwd(), GENERATED_INDEX_PATH)}`);

    await evictStaleSegments(narrations.filter((n) => n.audio.enabled));
    process.exit(process.exitCode ?? 0);
  }
}

// Serial path — also used when isWorker (single-slug child process)
for (const narration of jobs) {
  const results = await generatePost(narration, manifest, generated);
  if (!results) continue;

  // Workers write only the per-post result file; the orchestrator owns the index.
  await mkdir(RESULTS_DIR, { recursive: true });
  await saveJson(path.join(RESULTS_DIR, `${narration.slug}.json`), results);

  if (!isWorker) {
    generated[narration.slug] = { ...(generated[narration.slug] ?? {}), ...results };
    await saveJson(GENERATED_INDEX_PATH, generated);
  }
}

if (!isWorker) {
  console.log(`Updated ${path.relative(process.cwd(), GENERATED_INDEX_PATH)}`);
  if (!requestedSlug) {
    await evictStaleSegments(narrations.filter((n) => n.audio.enabled));
  }
}
