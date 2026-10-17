import { Transformer } from 'markmap-lib/no-plugins';

/**
 * Serializable mind-map node passed from Astro (build time) to the `MindMap` island.
 * Structurally compatible with markmap's `IPureNode`.
 */
export interface MindmapNode {
  /** Inline HTML rendered by markdown-it, e.g. `<code>` for backticks. */
  content: string;
  children: MindmapNode[];
  payload: {
    /** Index of the main branch this node belongs to, which picks its colour. -1 for the root. */
    branch: number;
  };
}

type TransformedNode = ReturnType<Transformer['transform']>['root'];

const transformer = new Transformer([]);

function toMindmapNode(node: TransformedNode, branch: number): MindmapNode {
  return {
    content: node.content,
    children: node.children.map((child) => toMindmapNode(child, branch)),
    payload: { branch },
  };
}

/**
 * Converts a Markdown nested list into a mind-map tree. Call it at build time so only
 * `markmap-view` ships to the browser.
 *
 * A single top-level list item becomes the root and its children become the main branches.
 * Transformer bookkeeping (source lines, tags) is dropped to keep island props small.
 *
 * @example
 * outlineToMindmap('- Kitchen\n  - Knives\n  - Pans').children.length; // 2
 */
export function outlineToMindmap(markdown: string): MindmapNode {
  const { root } = transformer.transform(markdown);
  return {
    content: root.content,
    children: root.children.map((child, index) => toMindmapNode(child, index)),
    payload: { branch: -1 },
  };
}
