import { visit } from 'unist-util-visit';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Wide tables would push the page sideways on a phone. Wrap every table in a
 * `.table-scroll` region that scrolls horizontally on its own (styles in
 * `src/styles/global.css`). The region is focusable so keyboard users can
 * scroll it too, and labelled so screen readers announce it.
 */
export function rehypeTableScroll() {
  return (tree: HastNode) => {
    visit(tree, 'element', (node: HastNode, index, parent: HastNode | undefined) => {
      if (node.tagName !== 'table' || !parent?.children || index === undefined) return;
      if (parent.tagName === 'div' && hasClass(parent, 'table-scroll')) return;

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: 'Table',
        },
        children: [node],
      };
    });
  };
}

function hasClass(node: HastNode, name: string): boolean {
  const className = node.properties?.className;
  return Array.isArray(className) ? className.map(String).includes(name) : className === name;
}
