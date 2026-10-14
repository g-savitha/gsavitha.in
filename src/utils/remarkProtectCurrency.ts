import type { InlineMath } from 'mdast-util-math';
import type { Parent, Text } from 'mdast';
import { visit } from 'unist-util-visit';

type MarkdownFile = {
  value?: string | Uint8Array | undefined;
};

/**
 * remark-math treats `$5 and $10` as inline math because the second dollar
 * closes the span opened by the first. Pandoc rejects a closing dollar that
 * is followed by a digit; this restores those spans to literal text.
 * A lone `$5` never opens math, and `$E = mc^2$` is unchanged.
 */
export function remarkProtectCurrency() {
  return (tree: Parent, file: MarkdownFile) => {
    const source = typeof file.value === 'string' ? file.value : '';
    if (!source) return;

    visit(tree, 'inlineMath', (node: InlineMath, index, parent) => {
      if (!parent || index === undefined) return;

      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start === undefined || end === undefined) return;

      const next = source[end];
      if (!next || next < '0' || next > '9') return;

      const text: Text = {
        type: 'text',
        value: source.slice(start, end),
      };
      parent.children[index] = text;
    });
  };
}
