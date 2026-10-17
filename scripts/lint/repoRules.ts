/**
 * Repository rules that ESLint/Prettier cannot express. Each rule's message names the fix,
 * so an agent that trips it knows exactly which file or API to use instead.
 *
 * Exceptions go on the offending line: `repo-rules-allow <rule-id>: <reason> (expires YYYY-MM-DD)`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface Violation {
  file: string;
  line: number;
  rule: string;
  message: string;
}

interface Rule {
  id: string;
  /** Directory to scan and the file extensions the rule applies to. */
  files: { dir: string; ext: RegExp };
  check(file: string, source: string): Omit<Violation, 'file' | 'rule'>[];
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function allowed(source: string, line: number, ruleId: string): boolean {
  const text = source.split('\n')[line - 1] ?? '';
  const match = text.match(
    new RegExp(`repo-rules-allow ${ruleId}:.*\\(expires (\\d{4}-\\d{2}-\\d{2})\\)`),
  );
  return match !== null && new Date(match[1]) >= new Date();
}

const rules: Rule[] = [
  {
    // PR #12 / Bugbot: KaTeX CSS was imported on the papers index, which never renders bodies.
    id: 'katex-css-where-rendered',
    files: { dir: 'src', ext: /\.(astro|tsx?)$/ },
    check(file, source) {
      const KATEX_CSS_OWNER = 'src/layouts/BlogPost.astro';
      const importAt = source.search(/import\s+['"]katex\/dist\/katex(\.min)?\.css['"]/);
      if (importAt === -1 || file === KATEX_CSS_OWNER) return [];
      return [
        {
          line: lineOf(source, importAt),
          message:
            `${file} imports KaTeX CSS. Only rendered Markdown bodies can contain math, and the ` +
            `only layout that wraps them is ${KATEX_CSS_OWNER}. Papershelf entries are link-only. ` +
            'Remove this import.',
        },
      ];
    },
  },
];

const violations: Violation[] = [];
for (const rule of rules) {
  const entries = await readdir(rule.files.dir, { recursive: true });
  for (const entry of entries) {
    const file = path.join(rule.files.dir, entry);
    if (!rule.files.ext.test(file)) continue;
    const source = await readFile(file, 'utf8');
    for (const v of rule.check(file, source)) {
      if (!allowed(source, v.line, rule.id)) violations.push({ ...v, file, rule: rule.id });
    }
  }
}

for (const v of violations) console.error(`${v.file}:${v.line} [${v.rule}] ${v.message}`);
if (violations.length > 0) {
  console.error(`\nrepo rules: ${violations.length} violation(s).`);
  process.exit(1);
}
console.log('repo rules: ok');
