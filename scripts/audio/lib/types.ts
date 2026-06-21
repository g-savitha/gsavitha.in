export interface AudioVoiceConfig {
  voice: string | null;
  language: string;
  label: string;
}

export interface AudioConfig {
  enabled: boolean;
  voice: string | null;
  voices: AudioVoiceConfig[] | null;
  codeSummaryMode: 'required' | 'contextual' | 'skip';
}

export interface NarrationSegment {
  type: string;
  text: string;
}

export interface MissingCodeSummary {
  language: string;
  line: number | null;
}

export interface Narration {
  schemaVersion: number;
  slug: string;
  title: string;
  audio: AudioConfig;
  segments: NarrationSegment[];
  missingCodeSummaries: MissingCodeSummary[];
  text: string;
}

export interface GenerationSettings {
  model: string;
  dtype: string;
  voice: string;
  speed: number;
  bitrate: number;
  generatorVersion: number;
}

export interface VoiceGenerationSettings extends GenerationSettings {
  language: string;
  label: string;
}

export interface ResolvedVoice {
  voice: string;
  language: string;
  label: string;
}

export interface ChunkGenerationSettings {
  model: string;
  dtype: string;
  voice: string;
  speed: number;
}

export interface LanguageRecoveryState {
  language: string;
  manifestCurrent: boolean;
  stagedCurrent: boolean;
  resultHashMatches: boolean;
  resultFileExists: boolean;
}

export interface MdNode {
  type: string;
  value?: string;
  url?: string;
  lang?: string | null;
  children?: MdNode[];
  position?: { start?: { line?: number } };
}

export interface MdRoot {
  children: MdNode[];
}

export type AudioManifest = Record<
  string,
  Record<
    string,
    {
      hash?: string;
      url?: string;
      label?: string;
      language?: string;
      duration?: number;
      bytes?: number;
      model?: string;
      voice?: string;
      generatedAt?: string;
    }
  >
>;

export type GeneratedAudioIndex = Record<
  string,
  Record<
    string,
    {
      hash: string;
      outputPath: string;
      storageKey?: string;
      label?: string;
      language?: string;
      duration?: number;
      bytes?: number;
      model?: string;
      voice?: string;
      generatedAt?: string;
    }
  >
>;
