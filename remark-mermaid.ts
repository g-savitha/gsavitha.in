import { visit } from 'unist-util-visit';
import type { Code, Root } from 'mdast';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/**
 * Escapes Mermaid source for use as HTML text. Unescaped, the browser parses label markup such as
 * `<br/>` into real elements, and `src/scripts/mermaid.ts` (which reads `textContent`) never sees
 * it, so line breaks vanish. Escaped, `textContent` returns the exact source.
 */
export function escapeMermaidSource(source: string): string {
  return source.replace(/[&<>]/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'mermaid') {
        const htmlNode = node as unknown as { type: 'html'; value: string };
        htmlNode.type = 'html';
        // By changing to html, it bypasses Shiki's syntax highlighting
        htmlNode.value = `<div class="mermaid not-prose">${escapeMermaidSource(node.value)}</div>`;
      }
    });
  };
}
