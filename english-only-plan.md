# English-Only Blog Audio Plan

## Decision

Ship English narration first using Kokoro, GitHub Actions, and Cloudflare R2.

Keep the existing Astro site on GitHub Pages. Do not introduce multilingual models, GPU infrastructure, AWS, Azure, RunPod, or a Cloudflare Pages migration for this release.

## Goals

- Add audio to every published English blog post.
- Skip raw code while providing a short, accurate description of meaningful code blocks.
- Generate audio without a paid TTS API.
- Avoid storing MP3 files in Git history.
- Automatically generate audio when a post is published or materially changed.
- Let the website deploy even if audio generation temporarily fails.

## Architecture

```text
Markdown post pushed to GitHub
              │
              ▼
GitHub Actions detects new or changed posts
              │
              ▼
Narration builder
  - extracts readable prose
  - removes raw code
  - inserts code summaries
              │
              ▼
Kokoro generates English MP3 on the CPU runner
              │
              ▼
MP3 uploaded to Cloudflare R2
              │
              ▼
Astro site built and deployed to GitHub Pages
```

## Responsibilities

### GitHub

- Stores the Astro application and Markdown posts.
- Runs narration validation, incremental audio generation, and deployment.
- Keeps credentials in GitHub Actions secrets.
- Remains the only deployment control plane.

### Kokoro

- Generates English speech using an open-weight model.
- Runs locally for the initial archive build.
- Runs on a GitHub Actions CPU runner for individual new or changed posts.
- Uses a pinned model version, voice, and generation configuration for reproducible output.

### Cloudflare R2

- Stores generated MP3 files.
- Delivers audio through a custom public audio domain.
- Keeps large binary files out of Git history.
- Uses immutable object paths:

```text
audio/blog/<slug>/<generation-hash>/en.mp3
```

### GitHub Pages

- Continues hosting the static portfolio.
- Receives the same Astro deployment artifact as it does today.
- Does not depend on Cloudflare Pages, AWS, or Azure.

## Narration Rules

For every published post:

1. Include the title, description, headings, paragraphs, lists, quotations, and useful image descriptions.
2. Exclude frontmatter, imports, raw HTML controls, navigation, and raw code.
3. Replace meaningful code blocks with a brief English summary.
4. Skip decorative, repetitive, or trivial code blocks when a summary adds no value.
5. Preserve technical names, commands, identifiers, abbreviations, and product names.
6. Normalize URLs, symbols, and formatting into speech-friendly text.
7. Split long narration into stable chunks before synthesis.
8. Concatenate chunks, normalize loudness, and export a browser-compatible MP3.

## Code Summaries

Do not add an LLM dependency for the first release.

Use two summary sources, in priority order:

1. An optional author-written summary associated with the code block.
2. A conservative generated fallback based on the code language and surrounding heading.

Example fallback:

> This JavaScript example demonstrates asynchronous request handling.

Fallback summaries must describe only what can be determined safely. They should not invent intent, behaviour, or guarantees that are not visible from the code and surrounding text.

## Generation Hash

The generation hash must include:

- Final narration text
- Parser and narration-builder version
- Code summaries
- Kokoro model and model version
- Voice identifier
- Generation parameters
- Audio encoding settings

Changing any of these inputs produces a new immutable R2 object rather than overwriting existing audio.

## GitHub Actions Workflow

### Triggers

- A push that changes published blog content
- A manual full-rebuild workflow
- A manual retry for failed audio generation

### Incremental Workflow

1. Check out the repository.
2. Identify new or changed published posts.
3. Build and validate narration text.
4. Calculate the generation hash.
5. Check whether the corresponding R2 object already exists.
6. Reuse existing audio when present.
7. Otherwise, download/cache Kokoro and generate the MP3.
8. Validate that the MP3 is playable, non-empty, and has a plausible duration.
9. Upload it to the immutable R2 path with the correct metadata.
10. Build Astro with audio metadata for successfully generated objects.
11. Deploy the site to GitHub Pages.

Do not commit generated MP3 files or an automatically rewritten manifest to the repository. Create any required deployment metadata inside the workflow and include it in the deployment artifact.

Use workflow concurrency so only the newest publication workflow deploys. Completed R2 objects make retries resumable and prevent duplicate generation.

## Failure Behaviour

Audio generation must not block publication.

- If audio generation succeeds, deploy the post with the player.
- If generation fails, deploy the post without the player for that content version.
- Keep existing audio for unchanged posts available.
- Preserve failed narration and logs as short-lived workflow artifacts for diagnosis.
- Allow a manual retry that generates audio and redeploys the site.

Never replace or delete known-good production audio during a failed run.

## Audio Delivery

Configure R2 with:

- A custom audio domain
- Correct `audio/mpeg` content type
- HTTP byte-range support for seeking
- CORS restricted to the production and preview origins
- Long-lived immutable cache headers
- Lifecycle cleanup for unreferenced historical objects, with a safe retention period

## React Audio Player

The player will provide:

- Play and pause
- Seek bar
- Elapsed and total duration
- 15-second rewind and forward
- Playback speeds of 1×, 1.25×, 1.5×, and 2×
- Volume control
- Keyboard support
- Accessible names, focus states, and status updates

The player streams the static MP3 from R2. It does not call a TTS service or receive cloud credentials.

## Security and Cost Controls

- Store scoped R2 credentials in GitHub Actions secrets.
- Restrict credentials to the audio bucket and required object operations.
- Never expose R2 write credentials in the browser bundle.
- Do not expose secrets to workflows from untrusted fork pull requests.
- Pin third-party GitHub Actions to reviewed versions or commit SHAs.
- Set workflow timeouts to prevent runaway CPU jobs.

Expected recurring infrastructure cost is effectively zero at portfolio scale when usage remains within the GitHub Actions and R2 free allowances.

## Delivery Phases

### Phase 1 — Production Pilot

- Finalize the narration parser and React player.
- Generate three representative posts locally: short, long, and code-heavy.
- Review pronunciation, code summaries, pacing, loudness, and mobile playback.
- Configure the R2 bucket and custom audio domain.

### Phase 2 — Existing Archive

- Generate all published posts locally with resumable caching.
- Upload validated MP3 files to R2.
- Deploy the player across posts with available audio.

### Phase 3 — Publication Automation

- Add the incremental GitHub Actions workflow.
- Validate model caching and generation time on a typical post.
- Add retry, timeout, concurrency, and non-blocking deployment behaviour.

### Phase 4 — Maintenance

- Add pronunciation overrides when recurring issues are found.
- Monitor R2 storage and GitHub Actions duration.
- Periodically remove unreferenced audio after the rollback retention window.
- Reconsider multilingual support only after the English pipeline is stable.

## Acceptance Criteria

- Every published post with validated audio displays the React player.
- Raw code is never spoken.
- Meaningful code blocks receive accurate, conservative summaries.
- Playback, seeking, volume, and all requested speeds work on desktop and mobile.
- Changed narration produces a new content-addressed audio URL.
- Unchanged narration reuses existing audio.
- Publishing succeeds when audio generation fails.
- No MP3 files or cloud credentials are committed to the repository.
- No TTS credentials or R2 write credentials reach the browser.
- Failed workflows never overwrite known-good audio.
