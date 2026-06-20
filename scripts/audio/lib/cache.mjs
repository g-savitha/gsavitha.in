import { createHash } from 'node:crypto';
import { narrationHash, resolveVoices, voiceGenerationSettings } from './narration.mjs';

// ─── Text chunking ───────────────────────────────────────────────────────────
//
// Kokoro has a hard per-call token limit, so long paragraphs are split at
// sentence (then word) boundaries before synthesis.

export function splitLongText(text, maxLen = 420) {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= maxLen) { current = candidate; continue; }
    if (current) chunks.push(current);
    if (sentence.length <= maxLen) { current = sentence.trim(); continue; }
    current = '';
    for (const word of sentence.trim().split(/\s+/)) {
      const wc = `${current} ${word}`.trim();
      if (wc.length > maxLen && current) { chunks.push(current); current = word; }
      else current = wc;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildSpeechChunks(segments, maxLen = 420) {
  const chunks = [];
  let current = '';
  for (const seg of segments) {
    const punctuated = /[.!?]$/.test(seg.text) ? seg.text : `${seg.text}.`;
    for (const part of splitLongText(punctuated, maxLen)) {
      const candidate = `${current} ${part}`.trim();
      if (candidate.length <= maxLen) { current = candidate; }
      else { if (current) chunks.push(current); current = part; }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ─── Segment-cache keys ──────────────────────────────────────────────────────
//
// Each synthesised text chunk is stored as a raw Float32LE file keyed by a
// hash of (text, model, dtype, voice, speed).

export function chunkCacheHash(text, settings) {
  return createHash('sha256')
    .update(JSON.stringify({
      text,
      model: settings.model,
      dtype: settings.dtype,
      voice: settings.voice,
      speed: settings.speed,
    }))
    .digest('hex');
}

// The set of chunk hashes referenced by the given active narrations — i.e. every
// segment file that should be retained in the cache.  Chunk text is independent
// of voice, so it is computed once per narration and reused across voices.
export function liveChunkHashes(narrations) {
  const live = new Set();
  for (const narration of narrations) {
    const chunks = buildSpeechChunks(narration.segments);
    for (const voiceConfig of resolveVoices(narration)) {
      const settings = voiceGenerationSettings(voiceConfig);
      for (const text of chunks) live.add(chunkCacheHash(text, settings));
    }
  }
  return live;
}

// Given the `.f32` filenames present in the cache and the live hash set, return
// the filenames that are no longer referenced and may be deleted.
export function selectStaleSegmentFiles(f32Files, liveHashes) {
  return f32Files.filter((file) => !liveHashes.has(file.replace(/\.f32$/, '')));
}

// ─── Resumable-worker recovery ───────────────────────────────────────────────
//
// A slug can be recovered from a previous partial run when every configured
// language is already satisfied — either current in the manifest, already
// staged with its output on disk, or present in the per-slug result file with a
// matching hash and an existing output file.

export function isSlugRecoverable(languageStates) {
  return languageStates.every((state) =>
    state.manifestCurrent
    || state.stagedCurrent
    || (state.resultHashMatches && state.resultFileExists));
}

// Build the per-language recovery facts for a slug.  `fileExists` is injected so
// the decision logic stays pure and testable; production passes the real
// filesystem probe.
export async function resultFileLanguageStates({
  narration,
  manifestEntry,
  generatedEntry,
  resultEntry,
  fileExists,
}) {
  return Promise.all(
    resolveVoices(narration).map(async (voiceConfig) => {
      const { language } = voiceConfig;
      const expected = narrationHash(narration, voiceGenerationSettings(voiceConfig));
      const staged = generatedEntry?.[language];
      const result = resultEntry?.[language];
      return {
        language,
        manifestCurrent: manifestEntry?.[language]?.hash === expected,
        stagedCurrent: staged?.hash === expected && await fileExists(staged.outputPath),
        resultHashMatches: result?.hash === expected,
        resultFileExists: result ? await fileExists(result.outputPath) : false,
      };
    }),
  );
}
