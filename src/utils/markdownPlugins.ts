import rehypeKatex from 'rehype-katex';
import remarkGemoji from 'remark-gemoji';
import remarkMath from 'remark-math';
import { remarkMermaid } from '../../remark-mermaid.ts';
import { rehypeKatexDisplay } from './rehypeKatexDisplay.ts';
import { remarkProtectCurrency } from './remarkProtectCurrency.ts';

/**
 * Shared by Markdown and MDX. Astro applies `markdown.remarkPlugins` and
 * `markdown.rehypePlugins` to both unless the MDX integration overrides them.
 * KaTeX errors use the `--math-error` token from `src/styles/variables.css`.
 */
const katexOptions = {
  errorColor: 'var(--math-error)',
  output: 'htmlAndMathml' as const,
  strict: 'ignore' as const,
};

function withOptions<Plugin, Options>(plugin: Plugin, options: Options): [Plugin, Options] {
  return [plugin, options];
}

export const remarkPlugins = [remarkGemoji, remarkMermaid, remarkMath, remarkProtectCurrency];

export const rehypePlugins = [withOptions(rehypeKatex, katexOptions), rehypeKatexDisplay];
