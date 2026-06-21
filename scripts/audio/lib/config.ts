import type { GenerationSettings } from './types.ts';

export const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const DTYPE = 'q8';
export const DEFAULT_VOICE = 'af_heart';
export const GENERATION_SPEED = 1;
export const SAMPLE_RATE = 24_000;
export const MP3_BITRATE = 64;
export const GENERATOR_VERSION = 2;

// Floor for a plausibly valid narration MP3. Real clips are tens to hundreds of
// KB; anything smaller is treated as corrupted/truncated (an empty or
// header-only file) so it is neither uploaded nor recorded in the manifest.
export const MIN_AUDIO_BYTES = 1024;

export function generationSettings(voice = DEFAULT_VOICE): GenerationSettings {
  return {
    model: MODEL,
    dtype: DTYPE,
    voice,
    speed: GENERATION_SPEED,
    bitrate: MP3_BITRATE,
    generatorVersion: GENERATOR_VERSION,
  };
}
