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
  codeSummaryMode: contextual
```

Code blocks are never read aloud. Every non-Mermaid code block in an audio-enabled
post using `codeSummaryMode: required` must have a reviewed summary immediately
before it:

````md
<!-- audio-summary:
This function checks the cache first and queries the database only on a miss.
-->
```js
// code omitted
```
````

With `codeSummaryMode: contextual`, blocks without an explicit summary receive a
short deterministic cue based on their language and current section. Use `skip`
to omit code without a cue. Explicit summaries always take precedence.

Useful commands:

```sh
# Preview and validate the extracted narration without loading a TTS model
bun run audio:extract --slug=post-slug

# Generate or refresh an MP3 with local Kokoro TTS
bun run audio:generate --slug=post-slug

# Upload staged MP3 files to Cloudflare R2
bun run audio:upload

# Validate available audio, or require every enabled post with --strict
bun run audio:check
bun run audio:check --strict
```

Generated narration previews are written to `.cache/audio-narration`, and MP3
files are staged under `.cache/audio-output`. `audio:upload` publishes each file
to R2 and updates `src/data/audioManifest.json` only after that upload succeeds.
The regular build validates available audio but does not block a new article
while its narration is waiting or being retried.

The deployment workflow runs `audio:check --prune-stale` before generation, so
an article whose narration changed never exposes its older recording while a
replacement is pending.

### Cloudflare R2 setup

Create an R2 bucket and attach a custom domain such as `audio.example.com`. The
bucket must allow `GET` and `HEAD` requests from the portfolio origin so browsers
can load metadata and seek through MP3 files.

Configure these GitHub Actions secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Configure these GitHub Actions variables:

- `R2_BUCKET` — the bucket name
- `AUDIO_PUBLIC_BASE_URL` — the HTTPS custom domain without a trailing slash

Scope the R2 token to object read/write access for this bucket only. Generated
objects use immutable paths:

```text
audio/blog/<slug>/<generation-hash>/en.mp3
```

For the initial archive, generate and upload from a local machine. After that
bootstrap, the deployment workflow generates only missing or stale posts:

```sh
bun run audio:generate
bun run audio:upload
```

The upload command requires the AWS CLI because R2 exposes an S3-compatible API.
Export the five R2 configuration values above before running it locally.
