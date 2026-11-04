import assert from 'node:assert/strict';
import test from 'node:test';
import { parseD2Variants } from './d2Variants.ts';

test('parseD2Variants treats unmarked fences as a single source', () => {
  const parsed = parseD2Variants('# alt: hello\ndirection: down\nA -> B');
  assert.equal(parsed.kind, 'single');
  if (parsed.kind !== 'single') return;
  assert.equal(parsed.alt, 'hello');
  assert.match(parsed.source, /direction: down/);
  assert.equal(parsed.source.includes('# alt:'), false);
});

test('parseD2Variants splits desktop and mobile sections', () => {
  const parsed = parseD2Variants(`# alt: kafka
@@@desktop
direction: right
A -> B
@@@mobile
direction: down
A -> B
`);
  assert.equal(parsed.kind, 'dual');
  if (parsed.kind !== 'dual') return;
  assert.equal(parsed.alt, 'kafka');
  assert.match(parsed.desktop, /direction: right/);
  assert.match(parsed.mobile, /direction: down/);
});
