import manifest from '../data/audioManifest.json';

export interface AudioSource {
  url: string;
  label: string;
  language: string;
  duration?: number;
}

type Manifest = Record<string, Record<string, AudioSource>>;

export function getPostAudio(slug: string): AudioSource[] {
  const post = (manifest as Manifest)[slug];
  return post ? Object.values(post) : [];
}
