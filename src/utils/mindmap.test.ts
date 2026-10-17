import assert from 'node:assert/strict';
import test from 'node:test';
import { countMindmapNodes, outlineToMindmap } from './mindmap.ts';

const outline = `- GCP Services
  - Compute Engine
    - Instance Templates
    - \`gcloud compute\`
  - Storage
    - Signed URL
`;

test('uses the single top-level list item as the root', () => {
  const root = outlineToMindmap(outline);
  assert.equal(root.content, 'GCP Services');
  assert.deepEqual(
    root.children.map((child) => child.content),
    ['Compute Engine', 'Storage'],
  );
  assert.equal(countMindmapNodes(root), 6);
});

test('tags every descendant with its main-branch index', () => {
  const root = outlineToMindmap(outline);
  assert.equal(root.payload.branch, -1);
  const [compute, storage] = root.children;
  assert.deepEqual(
    compute.children.map((child) => child.payload.branch),
    [0, 0],
  );
  assert.equal(storage.children[0].payload.branch, 1);
});

test('renders inline markdown and drops transformer bookkeeping', () => {
  const root = outlineToMindmap(outline);
  const code = root.children[0].children[1];
  assert.equal(code.content, '<code>gcloud compute</code>');
  assert.deepEqual(Object.keys(code.payload), ['branch']);
});
