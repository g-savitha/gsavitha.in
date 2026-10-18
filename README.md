# Savitha Gollamudi's Portfolio

Welcome to my digital garden! 🪴

---

Built with [Astro](https://astro.build) 🚀

## Verify changes

`bun run verify:site` builds the site, then checks the newest papers, goodies, and posts, internal links, console errors, and the theme picker in headless Chrome, saving screenshots to `verify-artifacts/`. Details: [`.cursor/skills/verify-gsavitha-in/SKILL.md`](.cursor/skills/verify-gsavitha-in/SKILL.md). Site map and where to add content: [`features/README.md`](.cursor/skills/verify-gsavitha-in/features/README.md).

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

## Math

Writings can include LaTeX. It is rendered at build time with KaTeX. (Papershelf entries are link-only, so their bodies are not rendered.)

- Inline math uses single dollars: `$E = mc^2$`.
- Display math uses a `$$` fence with the formula on its own lines.
- Escape a literal dollar with a backslash. Two bare amounts in one paragraph, such as `$5 and $10`, are parsed as math, so write `\$5 and \$10`. A lone price such as `$5` is left as text.
- Dollars inside inline code or fenced code blocks are never rendered as math.

`src/content/blog/draft-math-rendering.md` is an unpublished sample (`draft: true`). Open it with `bun run dev` at `/blog/draft-math-rendering`; production builds omit drafts.

## Embeds

`src/components/Embed.astro` embeds an X post or a YouTube video from its URL. The provider is detected from the URL, and an unsupported or malformed URL fails the build.

1. Write the post as `.mdx` (rename `my-post.md` to `my-post.mdx`; the slug, URL and audio stay the same).
2. Use the tag as its own block. No import is needed: the blog route passes `Embed` to every post, and the audio narration skips it.

```mdx
<Embed
  url="https://x.com/poteto/status/2102050467505430555"
  title="poteto on shipping 2,500 PRs a month"
/>

<Embed
  url="https://www.youtube.com/watch?v=MN9dGgmLyso"
  title="Matt Pocock interviews poteto"
  caption="Optional caption"
/>
```

- `url`: an X post (`x.com` or `twitter.com`, `/<user>/status/<id>`) or a YouTube link (`watch?v=`, `youtu.be`, `embed`, `live`, `shorts`; `t=` or `start=` is kept).
- `title`: required. It is the iframe title for YouTube and the fallback text for X.
- X posts render as a dark, do-not-track `blockquote.twitter-tweet` with a link fallback. `widgets.js` loads once per page, and only on pages with an X post.
- YouTube renders a lazy, 16:9 `youtube-nocookie.com` iframe.
- MDX does not allow HTML comments, so an `.mdx` post cannot use `<!-- audio-summary: ... -->`; keep `codeSummaryMode: contextual` or stay in `.md` if you need them.
- URL parsing lives in `src/utils/embed.ts`; run `bun run test:embed`.

## Mind maps

`src/components/goodies/MindMapSection.astro` turns a Markdown nested list into an interactive mind map. The single top-level item is the root and its children are the main branches. Astro builds the tree at build time, so only `markmap-view` loads in the browser, and only once the map scrolls into view.

1. Write the outline as the body of a content entry, such as `src/content/goodies/my-topic.md`.
2. Render it from the page:

```astro
---
import { getEntry, render } from 'astro:content';
import MindMapSection from '../../components/goodies/MindMapSection.astro';

const entry = await getEntry('goodies', 'my-topic');
if (!entry?.body) throw new Error('Missing goodies entry body: my-topic');
const { Content } = await render(entry);
---

<MindMapSection markdown={entry.body} label={`${entry.data.title} mind map`}>
  <Content />
</MindMapSection>
```

The slot becomes the collapsible text outline for readers without JavaScript or the canvas. Omit it to render the map alone. Optional props: `initialExpandLevel` (default `2`, the root plus main branches; Collapse all returns here), `showExpandControls` (default `true`; Expand all and Collapse all appear at desktop widths, 1024px and up), `size` (`default` or `compact`), `fallbackHint` (sentence shown when the map cannot load), and `outlineSummary` (default `Text outline`). The root follows the site accent (`--theme-color`) and main branches cycle through `--mindmap-branch-N` in `src/styles/variables.css`.
