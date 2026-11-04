import { visit } from 'unist-util-visit';
import type { Code, Root } from 'mdast';
import { renderD2 } from './src/utils/d2.ts';
import { parseD2Variants } from './src/utils/d2Variants.ts';
import { parseSketchChart, renderSketchChart } from './src/utils/sketchChart.ts';

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Phone column ~340px; desktop prose column with sidebar ~556px. */
const MOBILE_FIT_PX = 340;
const DESKTOP_FIT_PX = 540;

function svgNaturalWidth(svg: string): number {
  const widthAttr = /\bwidth="([\d.]+)"/.exec(svg);
  if (widthAttr) return Number(widthAttr[1]);
  const viewBox = /\bviewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)/.exec(svg);
  return viewBox ? Number(viewBox[1]) : 0;
}

function variantClass(kind: 'mobile' | 'desktop' | 'solo', svg: string): string {
  const limit = kind === 'mobile' ? MOBILE_FIT_PX : DESKTOP_FIT_PX;
  const scroll = svgNaturalWidth(svg) > limit ? ' diagram-variant--scroll' : '';
  return `diagram-variant diagram-variant--${kind}${scroll}`;
}

/**
 * Renders ```d2 and ```sketch-chart fences to inline SVG at build time.
 * D2 fences may declare @@@desktop / @@@mobile variants; CSS swaps them so neither
 * is scaled below body-sized labels. Curve charts use the site palette.
 */
export function remarkD2() {
  return async (tree: Root) => {
    const nodes: Code[] = [];
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'd2' || node.lang === 'sketch-chart') nodes.push(node);
    });

    for (const node of nodes) {
      const htmlNode = node as unknown as { type: 'html'; value: string };
      htmlNode.type = 'html';

      if (node.lang === 'sketch-chart') {
        const spec = parseSketchChart(node.value);
        const alt = node.value.match(/^#\s+alt:\s*(.+)\s*$/m)?.[1]?.trim();
        const label = alt ? ` aria-label="${escapeAttribute(alt)}"` : '';
        const mobile = renderSketchChart(spec, 'mobile');
        const desktop = renderSketchChart(spec, 'desktop');
        htmlNode.value = `<figure class="diagram not-prose"${label}><div class="${variantClass('desktop', desktop)}">${desktop}</div><div class="${variantClass('mobile', mobile)}">${mobile}</div></figure>`;
        continue;
      }

      const variants = parseD2Variants(node.value);
      const label = variants.alt ? ` aria-label="${escapeAttribute(variants.alt)}"` : '';

      if (variants.kind === 'single') {
        const svg = await renderD2(variants.source);
        htmlNode.value = `<figure class="diagram not-prose"${label}><div class="${variantClass('solo', svg)}">${svg}</div></figure>`;
        continue;
      }

      const [desktop, mobile] = await Promise.all([
        renderD2(variants.desktop),
        renderD2(variants.mobile),
      ]);
      htmlNode.value = `<figure class="diagram not-prose"${label}><div class="${variantClass('desktop', desktop)}">${desktop}</div><div class="${variantClass('mobile', mobile)}">${mobile}</div></figure>`;
    }
  };
}
