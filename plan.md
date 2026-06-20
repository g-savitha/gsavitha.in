# Blog Audio Architecture Plan

## Goal

Add accessible, multilingual audio to every blog post without paying a TTS provider per playback or storing large generated files in Git history.

The player will support English, Hinglish, and Tenglish narration, skip code blocks, briefly explain what each code block does, and provide playback speeds of 1×, 1.25×, 1.5×, and 2×.

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
  - skips raw code
  - inserts code-block summaries
  - creates English/Hinglish/Tenglish scripts
              │
              ├── English ─────────► Kokoro on a GitHub CPU runner
              │
              └── Hindi/Telugu ────► IndicF5 on an ephemeral cloud GPU
                                      (RunPod initially)
              │
              ▼
Generated MP3 files uploaded to Cloudflare R2
              │
              ▼
Audio manifest updated with content hashes and R2 URLs
              │
              ▼
Astro site deployed to Cloudflare Pages
```

## Platform Responsibilities

### GitHub

- Remains the source of truth for code and Markdown posts.
- Runs validation, narration extraction, English generation, and deployment workflows.
- Detects changed posts using a hash of the narration input and generation settings.
- Commits only the generated manifest and related metadata—not MP3 files.

### Cloudflare Pages

- Hosts the static Astro website.
- Provides preview deployments for pull requests.
- Can replace GitHub Pages after the audio pipeline is stable.

### Cloudflare R2

- Stores generated MP3 files.
- Serves audio without internet-egress charges.
- Uses immutable, versioned object paths:

```text
audio/blog/<slug>/<content-hash>/<language>.mp3
```

- Applies a lifecycle policy later to remove unreferenced audio versions.

### TTS Compute

- Use Kokoro for English narration.
- Run Kokoro on GitHub Actions for incremental generation; use local compute for full rebuilds if necessary.
- Use IndicF5 for Hindi and Telugu narration.
- Run IndicF5 on a temporary RunPod GPU that starts for the job and terminates immediately afterward.
- Keep the provider interface replaceable so AWS Batch, Azure Machine Learning, or another GPU provider can be added without changing the player or content parser.

AWS or Azure should not host the entire portfolio at this stage. They add infrastructure and billing complexity without improving a small static site. Consider AWS Batch or Azure Machine Learning only if GPU automation outgrows RunPod or the project is consolidated into an existing cloud account.

## Narration Pipeline

For every published post:

1. Parse the Markdown/MDX source.
2. Include the title, headings, paragraphs, lists, quotations, and meaningful image descriptions.
3. Exclude frontmatter, imports, HTML controls, tables that do not read naturally, and raw code blocks.
4. Replace each code block with a short contextual explanation of its purpose.
5. Preserve technical terminology such as API names, library names, commands, identifiers, and product names in English.
6. Produce narration scripts for:
   - `en`: English
   - `hi-en`: Hinglish
   - `te-en`: Tenglish
7. Generate audio in chunks, then concatenate and normalize the result.
8. Upload the MP3 and update the manifest only after successful validation.

Hinglish and Tenglish are adaptations, not direct translations. TTS models only speak the supplied script, so language adaptation must happen before synthesis. Begin with reviewed scripts; automate adaptation later only after terminology and quality checks are reliable.

## Audio Player

The React audio player will provide:

- Play and pause
- Seek bar
- Elapsed and total duration
- 15-second rewind and forward
- Playback speeds of 1×, 1.25×, 1.5×, and 2×
- Volume control
- English, Hinglish, and Tenglish selection when available
- Current section or chapter label when timing metadata exists
- Keyboard controls and accessible labels

The browser will stream static MP3 files from R2. It will never call a TTS API or receive cloud credentials.

## GitHub Actions Workflow

### Trigger

Run when files under the blog content directory change, with an additional manual full-rebuild trigger.

### Incremental Build

1. Check out the repository.
2. Find published posts whose narration hash is missing or has changed.
3. Build and validate narration scripts.
4. Generate English audio on the runner.
5. Trigger IndicF5 GPU generation only for requested and approved multilingual scripts.
6. Upload output to R2 using scoped credentials.
7. Update and validate the audio manifest.
8. Commit the manifest using the repository `GITHUB_TOKEN`.
9. Build and deploy the site after the manifest is current.

Use workflow concurrency to prevent two publication jobs from updating the manifest simultaneously. Cache models between runs where practical, and make every step resumable so completed audio is not regenerated after a failure.

## Security

- Store R2 credentials and cloud GPU tokens in GitHub Actions secrets.
- Prefer GitHub OIDC and short-lived cloud credentials where supported.
- Restrict R2 credentials to the audio bucket and required object operations.
- Never expose generation credentials in Astro client code.
- Do not run secret-bearing generation jobs for untrusted fork pull requests.
- Set provider spending limits and alerts.
- Ensure ephemeral GPU jobs terminate on success, failure, and timeout.

## Cost Model

- Cloudflare Pages: expected to remain within the free tier.
- Cloudflare R2: expected to remain within the free tier at portfolio scale.
- English generation: no model fee; uses GitHub Actions or local compute.
- IndicF5 generation: pay only while the temporary GPU job runs.
- A complete multilingual rebuild is expected to cost roughly $2–8 in GPU compute.
- Generating one changed article should usually cost less than $1.

These are per-run estimates, not monthly GPU charges. A persistent AWS or Azure GPU VM could cost hundreds of dollars per month, so the pipeline must use ephemeral jobs only.

## Delivery Phases

### Phase 1 — English Production Release

- Finish the React player and narration parser.
- Generate English audio with Kokoro.
- Upload audio to R2.
- Add the incremental GitHub Actions workflow.
- Deploy and verify playback on representative desktop and mobile browsers.

### Phase 2 — Multilingual Pilot

- Prepare one reviewed Hinglish and one reviewed Tenglish script.
- Test IndicF5 pronunciation, technical terminology, voice consistency, and code summaries.
- Select reference audio that is licensed and suitable for public use.
- Do not batch-generate until both samples pass listening review.

### Phase 3 — Multilingual Automation

- Add ephemeral RunPod generation to GitHub Actions.
- Generate only approved or changed multilingual scripts.
- Add retry, timeout, cleanup, and spending controls.
- Roll out Hinglish and Tenglish to high-traffic posts before the full archive.

### Phase 4 — Hosting Migration

- Move the Astro deployment from GitHub Pages to Cloudflare Pages.
- Configure the custom domain, redirects, caching, and preview deployments.
- Keep GitHub as the repository and automation control plane.

## Acceptance Criteria

- Publishing a post generates or reuses audio based on its content hash.
- Raw code is never narrated; each meaningful code block receives a concise explanation.
- Technical terminology remains in English in Hinglish and Tenglish scripts.
- The site deploys only with a valid manifest.
- Visitors can play, seek, change speed, and switch available languages.
- No TTS or cloud secret is present in the browser bundle.
- Failed workflows leave existing production audio untouched.
- GPU compute terminates automatically and remains within the configured spending limit.
