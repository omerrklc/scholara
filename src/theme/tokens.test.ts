import { describe, expect, it } from 'vitest';
import { darkColors, lightColors } from './palettes';

describe('application theme tokens', () => {
  it('provides the same semantic colors in light and dark modes', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});
