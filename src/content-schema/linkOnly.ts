import type { Loader } from 'astro/loaders';

/**
 * Wraps a loader for collections whose entries are links, not documents (Papershelf).
 * No page renders their bodies, so a body (or LaTeX in it) would silently never appear
 * (PR #12 Bugbot). Fail the content sync instead.
 */
export function linkOnly(inner: Loader): Loader {
  return {
    name: `link-only(${inner.name})`,
    load: async (context) => {
      await inner.load(context);
      const withBody = context.store
        .values()
        .filter((entry) => entry.body !== undefined && entry.body.trim() !== '');
      if (withBody.length === 0) return;
      const files = withBody.map((entry) => `  - ${entry.filePath ?? entry.id}`).join('\n');
      throw new Error(
        `${context.collection} entries are link-only (frontmatter title/url/date/tags); ` +
          `their bodies are never rendered. Move notes into a blog post instead, or remove the body:\n${files}`,
      );
    },
  };
}
