import { visit } from 'unist-util-visit';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const DIAGRAM_PREFIX = '/diagrams/';

/**
 * Diagrams shrink to fit the column, so a wide sequence diagram can get small on a phone. Wrap
 * every `/diagrams/` image in a link that opens the full-size file in a new tab, where readers can
 * zoom. The image's alt text stays the link's accessible name.
 */
export function rehypeDiagramZoom() {
  return (tree: HastNode) => {
    visit(tree, 'element', (node: HastNode, index, parent: HastNode | undefined) => {
      const src = node.properties?.src;
      if (node.tagName !== 'img' || typeof src !== 'string' || !src.startsWith(DIAGRAM_PREFIX))
        return;
      if (!parent?.children || index === undefined || parent.tagName === 'a') return;

      parent.children[index] = {
        type: 'element',
        tagName: 'a',
        properties: {
          href: src,
          target: '_blank',
          rel: ['noopener'],
          className: ['diagram-link'],
          title: 'Open the full-size diagram in a new tab',
        },
        children: [node],
      };
    });
  };
}
