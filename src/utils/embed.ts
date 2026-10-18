/**
 * Parses the URL an author pastes into `<Embed url="…" />` into the one embed
 * the site knows how to render. Kept pure so it can be tested without Astro.
 */
export type EmbedTarget =
  | { provider: 'x'; postUrl: string }
  | { provider: 'youtube'; videoId: string; embedUrl: string };

const X_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const YOUTUBE_SHORT_HOST = 'youtu.be';
const YOUTUBE_ID = /^[\w-]{11}$/;
const X_STATUS_PATH = /^\/([\w]{1,15})\/status\/(\d+)\/?$/;
const YOUTUBE_PATH_ID = /^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/;

export const X_WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';
const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com/embed/';

function parseX(url: URL): EmbedTarget | null {
  const match = X_STATUS_PATH.exec(url.pathname);
  if (!match) return null;
  const [, handle, postId] = match;
  return { provider: 'x', postUrl: `https://x.com/${handle}/status/${postId}` };
}

function youtubeVideoId(url: URL): string | null {
  if (url.hostname === YOUTUBE_SHORT_HOST) return url.pathname.slice(1).replace(/\/$/, '');
  if (url.pathname === '/watch') return url.searchParams.get('v');
  return YOUTUBE_PATH_ID.exec(url.pathname)?.[1] ?? null;
}

/** Accepts `t=90`, `t=90s`, `t=1m30s`, or `start=90`; returns whole seconds. */
function youtubeStartSeconds(url: URL): number | null {
  const raw = url.searchParams.get('start') ?? url.searchParams.get('t');
  if (!raw) return null;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (!match) return null;
  const [, hours = '0', minutes = '0', seconds = '0'] = match;
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return total > 0 ? total : null;
}

function parseYouTube(url: URL): EmbedTarget | null {
  const videoId = youtubeVideoId(url);
  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  const start = youtubeStartSeconds(url);
  const embedUrl = `${YOUTUBE_EMBED_ORIGIN}${videoId}${start ? `?start=${start}` : ''}`;
  return { provider: 'youtube', videoId, embedUrl };
}

/** Throws on anything unsupported so a bad URL fails the build, not the reader. */
export function parseEmbedUrl(input: string): EmbedTarget {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Embed: "${input}" is not a valid URL.`);
  }

  const hostname = url.hostname.toLowerCase();
  const target = X_HOSTS.has(hostname)
    ? parseX(url)
    : YOUTUBE_HOSTS.has(hostname) || hostname === YOUTUBE_SHORT_HOST
      ? parseYouTube(url)
      : null;

  if (!target) {
    throw new Error(
      `Embed: unsupported URL "${input}". Use an X post (x.com/<user>/status/<id>) or a YouTube video.`,
    );
  }
  return target;
}
