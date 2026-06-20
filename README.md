# Savitha Gollamudi's Portfolio

Welcome to my digital garden! 🪴 


---

Built with [Astro](https://astro.build) 🚀

## Article audio

Audio narration is opt-in. Add this to a blog post's frontmatter:

```yaml
audio:
  enabled: true
  voice: af_heart
```

Code blocks are never read aloud. Every non-Mermaid code block in an audio-enabled
post must have a reviewed summary immediately before it:

````md
<!-- audio-summary:
This function checks the cache first and queries the database only on a miss.
-->
```js
// code omitted
```
````

Useful commands:

```sh
# Preview and validate the extracted narration without loading a TTS model
bun run audio:extract --slug=post-slug

# Generate or refresh the MP3 with local Kokoro TTS
bun run audio:generate --slug=post-slug

# Confirm enabled posts have reviewed summaries and current audio
bun run audio:check
```

Generated narration previews are written to `.cache/audio-narration`. MP3 files
live under `public/audio/blog/<slug>/`, and metadata lives in
`src/data/audioManifest.json`. The regular build runs `audio:check` and rejects
missing or stale narration rather than publishing mismatched audio.
