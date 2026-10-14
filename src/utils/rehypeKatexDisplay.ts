import { visit } from 'unist-util-visit';

type HastProperties = {
  className?: Array<string | number> | string;
  tabIndex?: number;
};

type HastElement = {
  type: 'element';
  properties?: HastProperties;
};

/**
 * Display math is wider than a phone on purpose. Make the KaTeX block a
 * keyboard-scrollable region so overflow can be reached without a pointer.
 */
export function rehypeKatexDisplay() {
  return (tree: { type: string }) => {
    visit(tree, 'element', (node: HastElement) => {
      const className = node.properties?.className;
      const classes = Array.isArray(className)
        ? className.map(String)
        : typeof className === 'string'
          ? className.split(/\s+/)
          : [];
      if (!classes.includes('katex-display')) return;

      node.properties = {
        ...node.properties,
        tabIndex: 0,
      };
    });
  };
}
