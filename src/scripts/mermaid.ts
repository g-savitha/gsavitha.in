import mermaid from 'mermaid';
import { MERMAID_THEME_VARIABLES, withSharedClassDefs } from '../theme/mermaid.ts';

function getSource(el: HTMLElement): string {
  return el.dataset.mermaidSource ?? el.textContent?.trim() ?? '';
}

let renderQueue = Promise.resolve();

async function renderMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: MERMAID_THEME_VARIABLES,
    securityLevel: 'loose',
  });

  const nodes = document.querySelectorAll<HTMLElement>('.mermaid:not([data-processed="true"])');
  if (nodes.length === 0) return;

  nodes.forEach((el) => {
    const raw = getSource(el);
    if (!el.dataset.mermaidSource) {
      el.dataset.mermaidSource = raw;
    }
    el.textContent = withSharedClassDefs(raw);
  });

  await mermaid.run({ nodes: [...nodes] });
}

function initMermaid() {
  renderQueue = renderQueue
    .then(renderMermaid)
    .catch((error) => console.error('Mermaid render failed:', error));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMermaid, { once: true });
} else {
  initMermaid();
}

document.addEventListener('astro:page-load', initMermaid);

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    initMermaid();
  });
}
