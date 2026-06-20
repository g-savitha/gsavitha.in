import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';

export const NARRATION_SCHEMA_VERSION = 1;
export const BLOG_DIRECTORY = path.join(process.cwd(), 'src/content/blog');

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm);

function cleanText(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:!?])/g, '$1')
    .trim();
}

function inlineText(node) {
  if (!node) return '';

  switch (node.type) {
    case 'text':
    case 'inlineCode':
      return node.value ?? '';
    case 'break':
      return ' ';
    case 'image':
    case 'imageReference':
    case 'footnoteReference':
      return '';
    case 'link': {
      const label = cleanText((node.children ?? []).map(inlineText).join(' '));
      return label === node.url ? '' : label;
    }
    default:
      return (node.children ?? []).map(inlineText).join(' ');
  }
}

function audioSummaryFromHtml(value) {
  const match = value.match(/<!--\s*audio-summary\s*:\s*([\s\S]*?)-->/i);
  return match ? cleanText(match[1]) : null;
}

function frontmatterFromTree(tree) {
  const node = tree.children.find((child) => child.type === 'yaml');
  if (!node) return {};

  try {
    return parseYaml(node.value) ?? {};
  } catch (error) {
    throw new Error(`Invalid YAML frontmatter: ${error.message}`);
  }
}

function normalizedAudioConfig(value) {
  if (value === true) return { enabled: true };
  if (!value || value === false) return { enabled: false };
  return {
    enabled: value.enabled !== false,
    voice: value.voice,
  };
}

function extractSegments(tree, title) {
  const segments = [];
  const missingCodeSummaries = [];

  const addSegment = (type, text) => {
    const cleaned = cleanText(text);
    if (cleaned) segments.push({ type, text: cleaned });
  };

  addSegment('title', title);

  function walkChildren(children) {
    let pendingCodeSummary = null;

    for (const node of children ?? []) {
      if (node.type === 'html') {
        pendingCodeSummary = audioSummaryFromHtml(node.value) ?? pendingCodeSummary;
        continue;
      }

      if (node.type === 'code') {
        // Mermaid is a visual diagram, not executable source code.
        if (node.lang !== 'mermaid') {
          if (pendingCodeSummary) {
            addSegment('code-summary', pendingCodeSummary);
          } else {
            missingCodeSummaries.push({
              language: node.lang ?? 'text',
              line: node.position?.start?.line ?? null,
            });
          }
        }
        pendingCodeSummary = null;
        continue;
      }

      // A summary only describes the code block immediately following it.
      pendingCodeSummary = null;

      switch (node.type) {
        case 'heading':
          addSegment('heading', inlineText(node));
          break;
        case 'paragraph':
          addSegment('prose', inlineText(node));
          break;
        case 'blockquote':
          walkChildren(node.children);
          break;
        case 'list':
          for (const item of node.children ?? []) walkChildren(item.children);
          break;
        case 'table':
          for (const row of node.children ?? []) {
            addSegment('prose', (row.children ?? []).map(inlineText).join('. '));
          }
          break;
        default:
          break;
      }
    }
  }

  walkChildren(tree.children);
  return { segments, missingCodeSummaries };
}

export async function extractNarration(filePath) {
  const source = await readFile(filePath, 'utf8');
  const tree = processor.parse(source);
  const frontmatter = frontmatterFromTree(tree);
  const slug = path.basename(filePath).replace(/\.(md|mdx)$/i, '');
  const audio = normalizedAudioConfig(frontmatter.audio);
  const { segments, missingCodeSummaries } = extractSegments(
    tree,
    frontmatter.title ?? slug,
  );

  return {
    schemaVersion: NARRATION_SCHEMA_VERSION,
    slug,
    title: frontmatter.title ?? slug,
    audio,
    segments,
    missingCodeSummaries,
    text: segments.map((segment) => segment.text).join('\n\n'),
  };
}

export function narrationHash(narration, settings) {
  return createHash('sha256')
    .update(JSON.stringify({
      schemaVersion: NARRATION_SCHEMA_VERSION,
      segments: narration.segments,
      settings,
    }))
    .digest('hex');
}
