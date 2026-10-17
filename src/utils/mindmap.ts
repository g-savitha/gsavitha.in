import { Transformer } from 'markmap-lib/no-plugins';

/**
 * Serializable mind-map node passed from Astro (build time) to the Markmap island.
 * Structurally compatible with markmap's `IPureNode`.
 */
export interface MindmapNode {
  /** Inline HTML rendered by markdown-it (e.g. `<code>` for backticks). */
  content: string;
  children: MindmapNode[];
  payload: {
    /** Index of the main branch this node belongs to; drives branch colours. -1 for the root. */
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
 * Converts a nested Markdown list into a Markmap tree at build time, so only
 * `markmap-view` has to ship to the browser. Transformer bookkeeping (source
 * line numbers, tags) is dropped to keep the serialized props small.
 */
export function outlineToMindmap(markdown: string): MindmapNode {
  const { root } = transformer.transform(markdown);
  return {
    content: root.content,
    children: root.children.map((child, index) => toMindmapNode(child, index)),
    payload: { branch: -1 },
  };
}

/** Total number of nodes in a mind-map tree, including the root. */
export function countMindmapNodes(node: MindmapNode): number {
  return node.children.reduce((total, child) => total + countMindmapNodes(child), 1);
}
