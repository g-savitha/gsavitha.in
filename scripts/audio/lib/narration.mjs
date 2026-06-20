import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_VOICE, generationSettings } from './config.mjs';

export const NARRATION_SCHEMA_VERSION = 2;
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

  // voices[] overrides single voice field when present
  const voices = Array.isArray(value.voices)
    ? value.voices.map((v) => ({
        voice: v.voice ?? null,
        language: v.language ?? 'en',
        label: v.label ?? 'English',
      }))
    : null;

  return {
    enabled: value.enabled !== false,
    voice: value.voice ?? null,
    voices,
    codeSummaryMode: value.codeSummaryMode ?? 'required',
  };
}

function codeLabel(language) {
  const labels = {
    bash: 'shell',
    css: 'CSS',
    html: 'HTML',
    js: 'JavaScript',
    javascript: 'JavaScript',
    jsx: 'JSX',
    json: 'JSON',
    mermaid: 'diagram',
    sh: 'shell',
    sql: 'SQL',
    ts: 'TypeScript',
    tsx: 'TSX',
    yaml: 'YAML',
    yml: 'YAML',
  };
  return labels[language] ?? (language ? `${language} code` : 'code');
}

const GENERIC_IDENTIFIERS = new Set([
  'arr', 'cb', 'data', 'el', 'elem', 'err', 'error', 'fn', 'i', 'item', 'items', 'j', 'k',
  'n', 'obj', 'req', 'res', 'result', 'val', 'value', 'x', 'y',
]);

function capitalizeFirst(text) {
  if (!text) return text;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function joinNatural(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function extractLeadingComment(code) {
  const trimmed = code.trim();
  const blockMatch = trimmed.match(/^\/\*\*?\s*([\s\S]*?)\*\/\s*/);
  if (blockMatch) {
    const comment = cleanText(blockMatch[1].replace(/^\*\s?/gm, ''));
    if (comment.length >= 8) return capitalizeFirst(comment);
  }

  const lineComments = [...trimmed.matchAll(/^\s*\/\/\s*(.+)$/gm)]
    .map((match) => cleanText(match[1]))
    .filter((comment) => {
      if (comment.length < 8) return false;
      if (/^expected output:/i.test(comment)) return false;
      if (/^console\.log/i.test(comment)) return false;
      return true;
    });

  if (lineComments.length >= 1) return capitalizeFirst(lineComments[0]);
  return null;
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function extractDefinedNames(code, language) {
  const lang = (language ?? '').toLowerCase();
  if (!['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx'].includes(lang)) return [];

  const names = [];
  const seen = new Set();
  const addName = (name) => {
    if (!name || seen.has(name) || GENERIC_IDENTIFIERS.has(name.toLowerCase())) return;
    seen.add(name);
    names.push(name);
  };

  const source = stripComments(code);
  for (const match of source.matchAll(/^( {0,2})(?:export\s+)?(?:async\s+function|function)\s+(\w+)/gm)) {
    addName(match[2]);
  }
  for (const match of source.matchAll(/^( {0,2})class\s+(\w+)/gm)) {
    addName(match[2]);
  }
  for (const match of source.matchAll(
    /^( {0,2})(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\(|\w)/gm,
  )) {
    addName(match[2]);
  }

  return names.slice(0, 4);
}

function extractHtmlSummary(code) {
  const tags = [...code.matchAll(/<(header|main|footer|nav|section|article|form|table)\b/gi)]
    .map((match) => match[1].toLowerCase());
  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length >= 2) {
    return `This HTML example includes ${joinNatural(uniqueTags)} elements.`;
  }
  if (uniqueTags.length === 1) {
    return `This HTML example uses a ${uniqueTags[0]} element.`;
  }
  return null;
}

function extractCssSummary(code) {
  const selectors = [...code.matchAll(/(?:^|\n)\s*([.#][\w-]+)\s*\{/g)]
    .map((match) => cleanText(match[1]))
    .filter((selector) => selector.length > 1)
    .slice(0, 3);
  if (selectors.length) {
    return `This CSS example styles ${joinNatural(selectors)}.`;
  }
  return null;
}

function extractShellSummary(code) {
  const lines = code.trim().split('\n').map((line) => line.trim()).filter(Boolean);
  const commands = lines
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.replace(/^\$\s*/, '').split(/\s+/)[0])
    .filter(Boolean)
    .slice(0, 3);
  if (commands.length) {
    return `This shell example runs ${joinNatural(commands.map((command) => `the ${command} command`))}.`;
  }

  const comment = lines.find((line) => line.startsWith('#'))?.replace(/^#\s*/, '');
  if (comment && comment.length >= 8) return capitalizeFirst(comment);
  return null;
}

function summaryFromDefinedNames(names, language) {
  const label = codeLabel(language);
  if (names.length === 1) return `This ${label} example defines ${names[0]}.`;
  return `This ${label} example defines ${joinNatural(names)}.`;
}

export function contextualCodeSummary(language, heading, code = '') {
  const lang = (language ?? '').toLowerCase();
  const label = codeLabel(language);

  if (lang === 'mermaid') return `This diagram illustrates ${heading}.`;

  const comment = extractLeadingComment(code);
  if (comment) return comment;

  if (lang === 'html' || lang === 'htm') {
    const htmlSummary = extractHtmlSummary(code);
    if (htmlSummary) return htmlSummary;
  }

  if (lang === 'css') {
    const cssSummary = extractCssSummary(code);
    if (cssSummary) return cssSummary;
  }

  if (['bash', 'sh', 'shell', 'zsh'].includes(lang)) {
    const shellSummary = extractShellSummary(code);
    if (shellSummary) return shellSummary;
  }

  const names = extractDefinedNames(code, language);
  if (names.length) return summaryFromDefinedNames(names, language);

  return `This ${label} example relates to ${heading}.`;
}

function extractSegments(tree, title, audio) {
  const segments = [];
  const missingCodeSummaries = [];
  let currentHeading = title;

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
        if (pendingCodeSummary) {
          addSegment('code-summary', pendingCodeSummary);
        } else if (audio.codeSummaryMode === 'contextual') {
          addSegment('code-summary', contextualCodeSummary(node.lang, currentHeading, node.value ?? ''));
        } else if (audio.codeSummaryMode !== 'skip' && node.lang !== 'mermaid') {
          missingCodeSummaries.push({
            language: node.lang ?? 'text',
            line: node.position?.start?.line ?? null,
          });
        }
        pendingCodeSummary = null;
        continue;
      }

      // A summary only describes the code block immediately following it.
      pendingCodeSummary = null;

      switch (node.type) {
        case 'heading':
          currentHeading = cleanText(inlineText(node)) || currentHeading;
          addSegment('heading', currentHeading);
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
    audio,
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

export function resolveVoices(narration) {
  if (Array.isArray(narration.audio.voices) && narration.audio.voices.length > 0) {
    return narration.audio.voices.map((v) => ({
      voice: v.voice ?? DEFAULT_VOICE,
      language: v.language ?? 'en',
      label: v.label ?? 'English',
    }));
  }
  return [{ voice: narration.audio.voice ?? DEFAULT_VOICE, language: 'en', label: 'English' }];
}

export function voiceGenerationSettings(voiceConfig) {
  return {
    ...generationSettings(voiceConfig.voice),
    language: voiceConfig.language,
    label: voiceConfig.label,
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
