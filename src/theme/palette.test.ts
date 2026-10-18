import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THEME,
  DIFFICULTY_COLORS,
  PALETTE,
  SURFACE,
  THEME_NAMES,
  themeCss,
} from './palette.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('Easy, Medium and Hard use three different colours', () => {
  const colours = Object.values(DIFFICULTY_COLORS).map((name) => PALETTE[name].base);
  assert.equal(new Set(colours).size, colours.length, JSON.stringify(DIFFICULTY_COLORS));
});

test('every difficulty colour is visible on the dark surface (WCAG 1.4.11, >= 3:1)', () => {
  for (const [difficulty, name] of Object.entries(DIFFICULTY_COLORS)) {
    const ratio = contrast(PALETTE[name].base, SURFACE);
    assert.ok(ratio >= 3, `${difficulty} (${name}) contrast ${ratio.toFixed(2)} < 3`);
  }
});

test('every accent is AA as text on the dark surface and under dark text (>= 4.5:1)', () => {
  for (const name of THEME_NAMES) {
    for (const [variant, hex] of Object.entries(PALETTE[name])) {
      const ratio = contrast(hex, SURFACE);
      assert.ok(ratio >= 4.5, `${name}.${variant} ${hex} contrast ${ratio.toFixed(2)} < 4.5`);
    }
  }
});

test('difficulty colours never follow the accent', () => {
  const css = themeCss();
  for (const line of css.split('\n').filter((l) => l.includes('--dsa-'))) {
    assert.doesNotMatch(line, /--theme-color/, line);
  }
});

test('generated CSS defaults to DEFAULT_THEME and has a block per theme', () => {
  const css = themeCss();
  assert.match(css, new RegExp(`--theme-color: var\\(--theme-${DEFAULT_THEME}\\);`));
  for (const name of THEME_NAMES) assert.match(css, new RegExp(`data-theme='${name}'`));
});
