import assert from 'node:assert/strict';
import test from 'node:test';
import { SIDEBAR_SOCIAL_LINKS, SOCIAL_LINKS } from './consts.ts';

test('social links include the LeetCode profile', () => {
  assert.ok(SOCIAL_LINKS.some((link) => link.href === 'https://leetcode.com/u/g-savitha/'));
});

test('every social link has a distinct accessible label', () => {
  const labels = SOCIAL_LINKS.map((link) => link.label);
  assert.equal(new Set(labels).size, labels.length);
});

test('sidebar social links list LeetCode below TakeUForward', () => {
  const tufIndex = SIDEBAR_SOCIAL_LINKS.findIndex((link) => link.label === 'TakeUForward');
  const leetCodeIndex = SIDEBAR_SOCIAL_LINKS.findIndex((link) => link.label === 'LeetCode');
  assert.ok(tufIndex >= 0 && leetCodeIndex >= 0);
  assert.ok(leetCodeIndex > tufIndex);
});
