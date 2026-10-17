import assert from 'node:assert/strict';
import test from 'node:test';
import { SOCIAL_LINKS } from './consts.ts';

test('social links include the LeetCode profile', () => {
  assert.ok(SOCIAL_LINKS.some((link) => link.href === 'https://leetcode.com/u/g-savitha/'));
});

test('every social link has a distinct accessible label', () => {
  const labels = SOCIAL_LINKS.map((link) => link.label);
  assert.equal(new Set(labels).size, labels.length);
});
