import { visit } from 'unist-util-visit';

export function remarkMermaid() {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang === 'mermaid') {
        node.type = 'html';
        // By changing to html, it bypasses Shiki's syntax highlighting
        node.value = `<div class="mermaid not-prose">${node.value}</div>`;
      }
    });
  };
}
