import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { contextualCodeSummary, extractNarration } from './narration.mjs';

test('explicit audio-summary still wins over contextual fallback', async () => {
  const narration = await extractNarration(
    path.join(process.cwd(), 'src/content/blog/footer.md'),
  );
  const summaries = narration.segments.filter((segment) => segment.type === 'code-summary');
  assert.equal(summaries[0]?.text, 'This HTML establishes a page with a header, a main content area, and a footer.');
});

test('contextual summary uses the first meaningful line comment', () => {
  const summary = contextualCodeSummary('js', 'await', `
//get the list of planets

function getPlanets() {
  return axios.get("https://swapi.dev/api/planets/");
}
`);
  assert.equal(summary, 'Get the list of planets');
});

test('contextual summary ignores function keywords inside comments when naming symbols', () => {
  const summary = contextualCodeSummary('js', 'Multiple awaits', `
const moveX = (element, amount, delay) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const bodyBoundary = document.body.clientWidth;
      resolve();
    }, delay);
  });
};

async function animateRight(el) {
  await moveX(el, 100, 1000); //we can await this function since it returns a promise
}
`);
  assert.equal(summary, 'This JavaScript example defines animateRight and moveX.');
});

test('contextual summary names multiple functions in one block', () => {
  const summary = contextualCodeSummary('js', 'async', `
async function hello() {
  return "hello world";
}

async function ohNo() {
  throw new Error("oh no!");
}
`);
  assert.equal(summary, 'This JavaScript example defines hello and ohNo.');
});

test('contextual summary names a single exported helper', () => {
  const summary = contextualCodeSummary('js', 'async', `
async function greet() {
  return "Hello!!";
}
`);
  assert.equal(summary, 'This JavaScript example defines greet.');
});

test('contextual summary describes HTML structure', () => {
  const summary = contextualCodeSummary('html', 'Layout', `
<body>
  <header class="header"></header>
  <main class="main"></main>
  <footer class="footer"></footer>
</body>
`);
  assert.equal(summary, 'This HTML example includes header, main, and footer elements.');
});

test('contextual summary falls back to the section heading', () => {
  const summary = contextualCodeSummary('json', 'Configuration', '{"enabled": true}');
  assert.equal(summary, 'This JSON example relates to Configuration.');
});

test('async-await uses distinct contextual summaries instead of repeated headings', async () => {
  const narration = await extractNarration(
    path.join(process.cwd(), 'src/content/blog/async-await.md'),
  );
  const summaries = narration.segments
    .filter((segment) => segment.type === 'code-summary')
    .map((segment) => segment.text);

  assert.ok(summaries.includes('This JavaScript example defines resolveAfter2Seconds and asyncCall.'));
  assert.ok(summaries.includes('This JavaScript example defines hello and ohNo.'));
  assert.ok(summaries.includes('Throw an exception or an error to reject a promise'));
  assert.ok(summaries.includes('Get the list of planets'));
  assert.ok(!summaries.every((text) => text === 'This JavaScript example illustrates async.'));
});
