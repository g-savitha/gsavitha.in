import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEmbedUrl } from './embed.ts';

test('normalizes X and Twitter post URLs to x.com', () => {
  for (const input of [
    'https://x.com/poteto/status/2102050467505430555',
    'https://twitter.com/poteto/status/2102050467505430555?s=20',
    'https://mobile.twitter.com/poteto/status/2102050467505430555/',
  ]) {
    assert.deepEqual(parseEmbedUrl(input), {
      provider: 'x',
      postUrl: 'https://x.com/poteto/status/2102050467505430555',
    });
  }
});

test('builds privacy-enhanced YouTube embed URLs from common link shapes', () => {
  const expected = 'https://www.youtube-nocookie.com/embed/MN9dGgmLyso';
  for (const input of [
    'https://www.youtube.com/watch?v=MN9dGgmLyso',
    'https://youtu.be/MN9dGgmLyso',
    'https://www.youtube.com/embed/MN9dGgmLyso',
    'https://www.youtube.com/live/MN9dGgmLyso',
    'https://m.youtube.com/watch?v=MN9dGgmLyso&feature=share',
  ]) {
    assert.deepEqual(parseEmbedUrl(input), {
      provider: 'youtube',
      videoId: 'MN9dGgmLyso',
      embedUrl: expected,
    });
  }
});

test('keeps a YouTube start time', () => {
  const target = parseEmbedUrl('https://youtu.be/MN9dGgmLyso?t=1m30s');
  assert.equal(target.provider, 'youtube');
  assert.equal(
    target.provider === 'youtube' && target.embedUrl,
    'https://www.youtube-nocookie.com/embed/MN9dGgmLyso?start=90',
  );
});

test('rejects unsupported or malformed URLs', () => {
  for (const input of [
    'not a url',
    'https://example.com/video',
    'https://x.com/poteto',
    'https://x.com/i/article/123',
    'https://www.youtube.com/watch?v=short',
  ]) {
    assert.throws(() => parseEmbedUrl(input), /Embed:/);
  }
});
