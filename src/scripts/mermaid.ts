import mermaid from 'mermaid';

const CLASS_DEF_BLOCK = [
	'classDef primary fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#ffffff',
	'classDef secondary fill:#4b5563,stroke:#374151,stroke-width:2px,color:#ffffff',
	'classDef accent fill:#eab308,stroke:#ca8a04,stroke-width:2px,color:#000000',
	'classDef info fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#000000',
	'classDef success fill:#22c55e,stroke:#16a34a,stroke-width:2px,color:#000000',
	'classDef warning fill:#f97316,stroke:#ea580c,stroke-width:2px,color:#000000',
	'classDef danger fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#ffffff',
].join('\n');

function prepareMermaidContent(raw: string): string {
	const content = raw.trim();
	if (!/\b(flowchart|graph)\b/.test(content)) return content;
	if (content.includes('classDef')) return content;
	if (!content.includes(':::')) return content;

	const lines = content.split('\n');
	lines.splice(1, 0, CLASS_DEF_BLOCK);
	return lines.join('\n');
}

function getSource(el: HTMLElement): string {
	return el.dataset.mermaidSource ?? el.textContent?.trim() ?? '';
}

function renderMermaid() {
	mermaid.initialize({
		startOnLoad: false,
		theme: 'dark',
		themeVariables: {
			fontFamily: 'Dank Mono, ui-monospace, monospace',
		},
		securityLevel: 'loose',
	});

	const nodes = document.querySelectorAll<HTMLElement>('.mermaid');
	nodes.forEach((el) => {
		const raw = getSource(el);
		if (!el.dataset.mermaidSource) {
			el.dataset.mermaidSource = raw;
		}
		el.removeAttribute('data-processed');
		el.textContent = prepareMermaidContent(raw);
	});

	return mermaid.run({ nodes: [...nodes] });
}

function initMermaid() {
	renderMermaid().catch((err) =>
		console.error('Mermaid render failed:', err),
	);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initMermaid, { once: true });
} else {
	initMermaid();
}

if (import.meta.hot) {
	import.meta.hot.accept(() => {
		initMermaid();
	});
}
