import { visit } from 'unist-util-visit';
import type { Code, Root } from 'mdast';

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'mermaid') {
        const htmlNode = node as unknown as { type: 'html'; value: string };
        htmlNode.type = 'html';
        // By changing to html, it bypasses Shiki's syntax highlighting
        htmlNode.value = `<div class="mermaid not-prose">${node.value}</div>`;
      }
    });
  };
}
