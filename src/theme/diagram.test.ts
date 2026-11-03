import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTAINER_STROKE, DIAGRAM_FONT_SIZE, DIAGRAM_MAX_WIDTH, d2Preamble } from './diagram.ts';

/** Every line inside a D2 block of any blog post. */
function diagramLines(): { label: string; line: string }[] {
  const dir = 'src/content/blog';
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file))
    .flatMap((file) => {
      const source = readFileSync(path.join(dir, file), 'utf8');
      return [...source.matchAll(/^```d2\s*$([\s\S]*?)^```\s*$/gm)].flatMap(([, body]) =>
        body.split('\n').map((line) => ({ label: file, line })),
      );
    });
}

test('posts contain no hex colours in D2 blocks', () => {
  const lines = diagramLines();
  assert.ok(lines.length > 0, 'expected D2 blocks in posts');
  const offenders = lines.filter(({ line }) => /#[0-9a-f]{3,8}\b/i.test(line));
  assert.deepEqual(
    offenders.map(({ label, line }) => `${label}: ${line.trim()}`),
    [],
    'leave colours to Dark Mauve / the shared preamble',
  );
});

test('posts do not set a D2 theme, fill-pattern, or font family', () => {
  for (const { label, line } of diagramLines()) {
    const lower = line.toLowerCase();
    assert.equal(lower.includes('theme-id'), false, `${label}: ${line.trim()}`);
    assert.equal(lower.includes('fill-pattern'), false, `${label}: ${line.trim()}`);
    assert.equal(lower.includes('font-family'), false, `${label}: ${line.trim()}`);
    assert.equal(/\bfont\s*:/.test(lower), false, `${label}: ${line.trim()}`);
  }
});

test('d2 preamble uses Dark Mauve, sketch, elk, and body-sized labels', () => {
  const source = d2Preamble();
  assert.match(source, /theme-id: 200/);
  assert.match(source, /dark-theme-id: 200/);
  assert.match(source, /sketch: true/);
  assert.match(source, /layout-engine: elk/);
  assert.match(source, new RegExp(`style\\.font-size: ${DIAGRAM_FONT_SIZE}`));
  assert.ok(DIAGRAM_FONT_SIZE >= 16 && DIAGRAM_FONT_SIZE <= 18);
  assert.equal(source.includes('fill-pattern'), true);
  assert.match(source, /fill-pattern: none/);
  assert.match(source, new RegExp(`stroke: "${CONTAINER_STROKE}"`));
  assert.match(source, /fill: "transparent"/);
  assert.equal(source.toLowerCase().includes('font-family'), false);
  assert.equal(/\bfont\s*:/.test(source), false);
});

test('d2 preamble animates solid edges and leaves dashed edges still', () => {
  const source = d2Preamble();
  assert.match(source, /animated: true/);
  assert.match(source, /&style\.stroke-dash:/);
  assert.match(source, /style\.animated: false/);
  assert.match(source, /italic: false/);
});

test('container outline stays white, not a site accent', () => {
  assert.equal(CONTAINER_STROKE.toLowerCase(), '#ffffff');
});

test('diagram fit budget leaves room in a 390px phone column with px-4 padding', () => {
  assert.ok(DIAGRAM_MAX_WIDTH <= 358);
  assert.ok(DIAGRAM_MAX_WIDTH >= 320);
});
