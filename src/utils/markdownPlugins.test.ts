import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { codeTheme } from './codeTheme.ts';
import { rehypePlugins, remarkPlugins } from './markdownPlugins.ts';

const processor = await createMarkdownProcessor({
  remarkPlugins,
  rehypePlugins,
  shikiConfig: { theme: codeTheme() },
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

test('renders code comments in italic', async () => {
  const html = await renderMarkdown('```js\nconst ok = 1 // note\n```\n');
  assert.match(html, /#6[Aa]737[Dd]/);
  assert.match(html, /font-style:\s*italic/i);
  assert.equal(/font-style:\s*italic/i.test(html.split('const')[0] ?? ''), false);
});

test('wraps tables in a focusable horizontal scroll region', async () => {
  const html = await renderMarkdown('| a | b |\n| --- | --- |\n| `x` | y |\n');
  assert.match(
    html,
    /<div class="table-scroll" tabindex="0" role="region" aria-label="Table">\s*<table>[\s\S]*<\/table><\/div>/,
  );
  assert.match(html, /<td><code>x<\/code><\/td>/);
});

test('wraps tables in MDX too', async () => {
  const compiled = await compile('| a | b |\n| --- | --- |\n| x | y |\n', {
    remarkPlugins: [remarkGfm, ...remarkPlugins],
    rehypePlugins,
  });
  assert.match(String(compiled.value), /table-scroll/);
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
