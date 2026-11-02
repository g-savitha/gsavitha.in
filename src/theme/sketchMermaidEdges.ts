import rough from 'roughjs';
import { MERMAID_EDGE_ROUGHNESS, MERMAID_HAND_DRAWN_SEED } from './mermaid.ts';

const generator = rough.generator();
const FLOWCHART_EDGE = /\bflowchart-link\b/;

/**
 * Redraws one smooth edge with the wobble Mermaid uses for a hand-drawn arrow.
 * The same seed starts each edge, matching Mermaid, so the sketch does not drift
 * when another edge is added.
 */
export function sketchEdgePath(d: string): string {
  const drawn = generator.path(d, {
    roughness: MERMAID_EDGE_ROUGHNESS,
    seed: MERMAID_HAND_DRAWN_SEED,
  });
  return generator.toPaths(drawn)[0]?.d || d;
}

/** Sketches flowchart arrows in a rendered diagram. Nodes, clusters, and other diagrams stay as drawn. */
export function sketchMermaidEdges(root: ParentNode): void {
  root.querySelectorAll<SVGPathElement>('path').forEach((path) => {
    const className = path.getAttribute('class') ?? '';
    if (!FLOWCHART_EDGE.test(className) || path.dataset.sketched === 'true') return;
    const d = path.getAttribute('d');
    if (!d) return;
    path.setAttribute('d', sketchEdgePath(d));
    path.dataset.sketched = 'true';
  });
}

/** Same edge sketch for a serialized SVG, so the static renderer matches the page. */
export function sketchMermaidSvg(svg: string): string {
  return svg.replace(/<path\b[^>]*>/g, (tag) => {
    const className = tag.match(/\bclass="([^"]*)"/)?.[1] ?? '';
    if (!FLOWCHART_EDGE.test(className)) return tag;
    const dMatch = tag.match(/\bd="([^"]*)"/);
    const d = dMatch?.[1];
    if (!dMatch || !d) return tag;
    return tag.replace(dMatch[0], `d="${sketchEdgePath(d)}"`);
  });
}
