import { visit } from 'unist-util-visit';
import type { Code, Root } from 'mdast';
import { renderD2 } from './src/utils/d2.ts';

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Renders ```d2 fences to inline SVG at build time. Authors write the shapes only; colours,
 * sketch mode, ELK, and animated edges come from `d2Preamble()`.
 */
export function remarkD2() {
  return async (tree: Root) => {
    const nodes: Code[] = [];
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'd2') nodes.push(node);
    });

    for (const node of nodes) {
      const svg = await renderD2(node.value);
      const alt = node.value.match(/^#\s+alt:\s*(.+)\s*$/m)?.[1]?.trim();
      const label = alt ? ` aria-label="${escapeAttribute(alt)}"` : '';
      const htmlNode = node as unknown as { type: 'html'; value: string };
      htmlNode.type = 'html';
      htmlNode.value = `<figure class="diagram not-prose"${label}>${svg}</figure>`;
    }
  };
}
