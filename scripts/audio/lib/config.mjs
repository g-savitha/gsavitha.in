export const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
export const DTYPE = 'q8';
export const DEFAULT_VOICE = 'af_heart';
export const GENERATION_SPEED = 1;
export const SAMPLE_RATE = 24_000;
export const MP3_BITRATE = 64;
export const GENERATOR_VERSION = 2;

export function generationSettings(voice = DEFAULT_VOICE) {
  return {
    model: MODEL,
    dtype: DTYPE,
    voice,
    speed: GENERATION_SPEED,
    bitrate: MP3_BITRATE,
    generatorVersion: GENERATOR_VERSION,
  };
}
