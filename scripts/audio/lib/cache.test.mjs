import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSpeechChunks,
  chunkCacheHash,
  isSlugRecoverable,
  liveChunkHashes,
  resultFileLanguageStates,
  selectStaleSegmentFiles,
  splitLongText,
} from './cache.mjs';

const settings = { model: 'm', dtype: 'q8', voice: 'af_heart', speed: 1 };

// ─── Chunking ────────────────────────────────────────────────────────────────

test('splitLongText returns the text unchanged when under the limit', () => {
  assert.deepEqual(splitLongText('A short sentence.', 420), ['A short sentence.']);
});

test('splitLongText splits on sentence boundaries when over the limit', () => {
  const text = `${'a'.repeat(300)}. ${'b'.repeat(300)}.`;
  const chunks = splitLongText(text, 420);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 420));
});

test('splitLongText falls back to word splitting for a single long sentence', () => {
  const text = `${'word '.repeat(200)}end`;
  const chunks = splitLongText(text, 100);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
});

test('buildSpeechChunks packs short segments together and punctuates them', () => {
  const chunks = buildSpeechChunks([{ text: 'First' }, { text: 'Second' }], 420);
  assert.deepEqual(chunks, ['First. Second.']);
});

// ─── Cache keys ──────────────────────────────────────────────────────────────

test('chunkCacheHash is deterministic for identical inputs', () => {
  assert.equal(chunkCacheHash('hello', settings), chunkCacheHash('hello', settings));
});

test('chunkCacheHash changes when text or voice changes', () => {
  assert.notEqual(chunkCacheHash('hello', settings), chunkCacheHash('world', settings));
  assert.notEqual(
    chunkCacheHash('hello', settings),
    chunkCacheHash('hello', { ...settings, voice: 'bf_emma' }),
  );
});

// ─── Live-set computation + eviction ─────────────────────────────────────────

function narrationOf(segments, audio = { enabled: true, voice: 'af_heart' }) {
  return { segments, audio };
}

test('liveChunkHashes covers every chunk of every active narration', () => {
  const narration = narrationOf([{ text: 'Hello world' }]);
  const live = liveChunkHashes([narration]);
  const expected = chunkCacheHash('Hello world.', {
    model: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    dtype: 'q8',
    voice: 'af_heart',
    speed: 1,
  });
  assert.ok(live.has(expected));
});

test('liveChunkHashes produces a distinct hash per configured voice', () => {
  const narration = narrationOf([{ text: 'Hello' }], {
    enabled: true,
    voices: [
      { voice: 'af_heart', language: 'en' },
      { voice: 'bf_emma', language: 'gb' },
    ],
  });
  assert.equal(liveChunkHashes([narration]).size, 2);
});

test('selectStaleSegmentFiles keeps live hashes and drops the rest', () => {
  const live = new Set(['aaa', 'bbb']);
  const files = ['aaa.f32', 'bbb.f32', 'ccc.f32'];
  assert.deepEqual(selectStaleSegmentFiles(files, live), ['ccc.f32']);
});

test('selectStaleSegmentFiles treats everything as stale when nothing is live', () => {
  assert.deepEqual(selectStaleSegmentFiles(['aaa.f32'], new Set()), ['aaa.f32']);
});

// ─── Recovery decision ───────────────────────────────────────────────────────

test('isSlugRecoverable requires every language to be satisfied', () => {
  assert.equal(isSlugRecoverable([{ manifestCurrent: true }]), true);
  assert.equal(isSlugRecoverable([{ stagedCurrent: true }]), true);
  assert.equal(isSlugRecoverable([{ resultHashMatches: true, resultFileExists: true }]), true);
  assert.equal(
    isSlugRecoverable([
      { manifestCurrent: true },
      { resultHashMatches: true, resultFileExists: false },
    ]),
    false,
  );
  assert.equal(isSlugRecoverable([{ resultHashMatches: true, resultFileExists: false }]), false);
});

test('resultFileLanguageStates recovers a partial result with one manifest-current language', async () => {
  const narration = narrationOf([{ text: 'Hello' }], {
    enabled: true,
    voices: [
      { voice: 'af_heart', language: 'en' },
      { voice: 'bf_emma', language: 'gb' },
    ],
  });
  // Compute the real hashes the way the pipeline does.
  const { narrationHash, resolveVoices, voiceGenerationSettings } = await import('./narration.mjs');
  const byLanguage = Object.fromEntries(
    resolveVoices(narration).map((voice) => [
      voice.language,
      narrationHash(narration, voiceGenerationSettings(voice)),
    ]),
  );

  const states = await resultFileLanguageStates({
    narration,
    manifestEntry: { en: { hash: byLanguage.en } },
    generatedEntry: undefined,
    resultEntry: { gb: { hash: byLanguage.gb, outputPath: '/tmp/gb.mp3' } },
    fileExists: async (p) => p === '/tmp/gb.mp3',
  });

  assert.equal(isSlugRecoverable(states), true);
  const gb = states.find((s) => s.language === 'gb');
  assert.equal(gb.resultHashMatches, true);
  assert.equal(gb.resultFileExists, true);
});

test('resultFileLanguageStates rejects when a result output file is missing', async () => {
  const narration = narrationOf([{ text: 'Hello' }]);
  const { narrationHash, resolveVoices, voiceGenerationSettings } = await import('./narration.mjs');
  const [voice] = resolveVoices(narration);
  const hash = narrationHash(narration, voiceGenerationSettings(voice));

  const states = await resultFileLanguageStates({
    narration,
    manifestEntry: undefined,
    generatedEntry: undefined,
    resultEntry: { en: { hash, outputPath: '/tmp/missing.mp3' } },
    fileExists: async () => false,
  });

  assert.equal(isSlugRecoverable(states), false);
});
