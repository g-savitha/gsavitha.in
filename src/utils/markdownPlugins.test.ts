import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { compile } from '@mdx-js/mdx';
import { rehypePlugins, remarkPlugins } from './markdownPlugins.ts';

const processor = await createMarkdownProcessor({
  remarkPlugins,
  rehypePlugins,
  shikiConfig: { theme: 'github-dark' },
});

async function renderMarkdown(source: string) {
  const { code } = await processor.render(source);
  return code;
}

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, '');
}

test('renders inline and display math', async () => {
  const html = await renderMarkdown('Energy $E=mc^2$.\n\n$$\na^2+b^2=c^2\n$$\n');
  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /katex-mathml/);
  assert.equal(visibleText(html).includes('$E=mc^2$'), false);
});

test('does not render math inside fenced or inline code', async () => {
  const html = await renderMarkdown(
    [
      '```js',
      'const formula = "$E=mc^2$";',
      'const price = `$${amount}`;',
      '```',
      '',
      'Inline `$a^2$` stays code.',
    ].join('\n'),
  );
  assert.equal(html.includes('katex'), false);
  const text = visibleText(html);
  assert.match(text, /\$E=mc\^2\$/);
  assert.match(text, /\$a\^2\$/);
});

test('leaves prices as text', async () => {
  const paired = await renderMarkdown('It costs $5 and $10 today.');
  assert.equal(paired.includes('katex'), false);
  assert.match(visibleText(paired), /\$5 and \$10/);

  const single = await renderMarkdown('A lone price is $4.');
  assert.equal(single.includes('katex'), false);
  assert.match(visibleText(single), /\$4/);

  const escaped = await renderMarkdown('Write \\$5 and \\$10 when both amounts matter.');
  assert.equal(escaped.includes('katex'), false);
  assert.match(visibleText(escaped), /\$5 and \$10/);
});

test('keeps mermaid fences for the existing remark plugin', async () => {
  const html = await renderMarkdown('```mermaid\ngraph TD\n  A-->B\n```\n');
  assert.match(html, /class="mermaid not-prose"/);
  assert.match(html, /graph TD/);
  assert.equal(html.includes('katex'), false);
});

const MERMAID_WITH_MARKUP =
  '```mermaid\nflowchart TB\n  A["One<br/>Two"] --> B["x < y && y > z<br>end"]\n```\n';

/** What `src/scripts/mermaid.ts` reads: the element's text, with HTML entities decoded. */
function mermaidTextContent(html: string): string {
  const inner = html.match(/<div class="mermaid not-prose">([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.equal(
    /<[a-z]/i.test(inner),
    false,
    'mermaid source must not contain parsed HTML elements',
  );
  return inner
    .replace(/&#x3C;|&#60;|&lt;/gi, '<')
    .replace(/&#x3E;|&#62;|&gt;/gi, '>')
    .replace(/&#x26;|&#38;|&amp;/gi, '&');
}

test('keeps <br/> and other markup in mermaid source as text', async () => {
  const html = await renderMarkdown(MERMAID_WITH_MARKUP);
  assert.equal(
    mermaidTextContent(html),
    'flowchart TB\n  A["One<br/>Two"] --> B["x < y && y > z<br>end"]',
  );
});

test('renders math in MDX with the same plugins', async () => {
  const compiled = await compile('Energy $E=mc^2$.\n\n```js\nconst x = "$E=mc^2$";\n```\n', {
    remarkPlugins,
    rehypePlugins,
  });
  const source = String(compiled.value);
  assert.match(source, /katex/);
  assert.match(source, /\$E=mc\^2\$/);
});
