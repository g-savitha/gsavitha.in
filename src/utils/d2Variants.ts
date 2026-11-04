/**
 * Dual D2 sources in one fence:
 *
 * ```d2
 * # alt: …
 * @@@desktop
 * direction: right
 * …
 * @@@mobile
 * direction: down
 * …
 * ```
 *
 * A fence without markers is a single source shown at every breakpoint.
 */

export type D2VariantSet =
  | { kind: 'single'; source: string; alt?: string }
  | { kind: 'dual'; desktop: string; mobile: string; alt?: string };

const VARIANT_RE = /^@@@\s*(desktop|mobile)\s*$/gim;

export function parseD2Variants(raw: string): D2VariantSet {
  const alt = raw.match(/^#\s+alt:\s*(.+)\s*$/m)?.[1]?.trim();
  const stripped = raw.replace(/^#\s+alt:\s*.+\s*$/m, '').trim();

  if (!/^@@@\s*(desktop|mobile)\s*$/im.test(stripped)) {
    return { kind: 'single', source: stripped, alt };
  }

  const parts: { name: 'desktop' | 'mobile'; body: string }[] = [];
  const matches = [...stripped.matchAll(VARIANT_RE)];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const name = match[1].toLowerCase() as 'desktop' | 'mobile';
    const start = (match.index ?? 0) + match[0].length;
    const end =
      i + 1 < matches.length ? (matches[i + 1].index ?? stripped.length) : stripped.length;
    const body = stripped.slice(start, end).trim();
    if (body) parts.push({ name, body });
  }

  const desktop = parts.find((part) => part.name === 'desktop')?.body;
  const mobile = parts.find((part) => part.name === 'mobile')?.body;
  if (!desktop || !mobile) {
    throw new Error(
      'D2 dual fence needs both @@@desktop and @@@mobile sections (or omit markers for a single diagram).',
    );
  }
  return { kind: 'dual', desktop, mobile, alt };
}
