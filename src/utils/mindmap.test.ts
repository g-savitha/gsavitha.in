import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { outlineToMindmap, type MindmapNode } from './mindmap.ts';

const kitchen = `- Kitchen
  - Knives
    - Chef's knife
    - \`honing rod\`
  - Cookware
    - Cast iron
      - Seasoning
  - Pantry
`;

const countNodes = (node: MindmapNode): number =>
  node.children.reduce((total, child) => total + countNodes(child), 1);

const branchesOf = (node: MindmapNode): number[] => [
  node.payload.branch,
  ...node.children.flatMap(branchesOf),
];

test('uses the single top-level list item as the root and its children as main branches', () => {
  const root = outlineToMindmap(kitchen);
  assert.equal(root.content, 'Kitchen');
  assert.deepEqual(
    root.children.map((child) => child.content),
    ['Knives', 'Cookware', 'Pantry'],
  );
  assert.equal(countNodes(root), 8);
});

test('tags the root with -1 and every descendant with its main-branch index', () => {
  const [knives, cookware, pantry] = outlineToMindmap(kitchen).children;
  assert.equal(outlineToMindmap(kitchen).payload.branch, -1);
  assert.deepEqual(branchesOf(knives), [0, 0, 0]);
  assert.deepEqual(branchesOf(cookware), [1, 1, 1]);
  assert.deepEqual(branchesOf(pantry), [2]);
});

test('renders inline markdown and keeps only serializable fields', () => {
  const root = outlineToMindmap(kitchen);
  const rod = root.children[0].children[1];
  assert.equal(rod.content, '<code>honing rod</code>');
  assert.deepEqual(Object.keys(rod).sort(), ['children', 'content', 'payload']);
  assert.deepEqual(Object.keys(rod.payload), ['branch']);
  assert.deepEqual(JSON.parse(JSON.stringify(root)), root);
});

test('GCP ACE cheat sheet outline keeps 396 nodes in 23 main branches', () => {
  const file = readFileSync(
    new URL('../content/goodies/gcp-ace-cheatsheet.md', import.meta.url),
    'utf8',
  );
  const body = file.replace(/^---\n[\s\S]*?\n---\n/, '');
  const root = outlineToMindmap(body);
  assert.equal(root.content, 'GCP Services');
  assert.equal(root.children.length, 23);
  assert.equal(countNodes(root), 396);
});
