import {
  colorFamilyOf,
  colorFamilyOfHex,
  groupColorsByFamily,
} from '@/pages/lib/colorFamilies';
import { describe, expect, it } from 'vitest';

describe('colorFamilyOfHex', () => {
  it.each([
    ['#000000', 'black'],
    ['#1a1c2e', 'black'],
    ['#f7f7f7', 'white'],
    ['#E8F3FF', 'white'],
    ['#c0c0c0', 'silver'],
    ['#4a4a4a', 'gray'],
    ['#f00a0a', 'red'],
    ['#800020', 'red'],
    ['#ff7518', 'orange'],
    ['#ffc801', 'yellow'],
    ['#eed690', 'gold'],
    ['#fdf9ed', 'white'],
    ['#5c4033', 'brown'],
    ['#2e8b57', 'green'],
    ['#0f52ba', 'blue'],
    ['#a37dd1', 'purple'],
    ['#f5d2d5', 'pink'],
    ['#fff', 'white'],
  ])('%s is %s', (hex, family) => {
    expect(colorFamilyOfHex(hex)).toBe(family);
  });

  it('falls back to gray for an unreadable hex', () => {
    expect(colorFamilyOfHex('not-a-color')).toBe('gray');
  });
});

describe('colorFamilyOf', () => {
  it('trusts the name over a misleading swatch', () => {
    // Stored as a near-white tint, but the shopper is looking for blue.
    expect(colorFamilyOf({ name: 'Blue', hex: '#E8F2FF' })).toBe('blue');
    expect(colorFamilyOf({ name: 'Light Gold', hex: '#fffcf5' })).toBe('gold');
  });

  it('reads keywords run together in one word', () => {
    expect(colorFamilyOf({ name: 'Awesome Icyblue', hex: '#d4e6f1' })).toBe(
      'blue',
    );
  });

  it('uses the swatch when the name names two families', () => {
    expect(colorFamilyOf({ name: 'Reddish Brown', hex: '#5c3a21' })).toBe(
      'brown',
    );
    expect(colorFamilyOf({ name: 'Mocha Gold', hex: '#c3a687' })).toBe('gold');
  });

  it('uses the swatch when the name is pure marketing', () => {
    expect(colorFamilyOf({ name: 'Night Pulse', hex: '#1a1c1e' })).toBe(
      'black',
    );
    expect(colorFamilyOf({ name: 'Jungle Breath', hex: '#2e8b57' })).toBe(
      'green',
    );
  });

  it('does not read "pink" as containing "ink"', () => {
    expect(colorFamilyOf({ name: 'Alpine Pink', hex: '#e6c3c3' })).toBe('pink');
  });
});

describe('groupColorsByFamily', () => {
  it('folds shades into one row per family, in a fixed order', () => {
    const groups = groupColorsByFamily([
      { id: 'blue', name: 'Sapphire Blue', hex: '#0f52ba' },
      { id: 'midnight', name: 'Midnight Black', hex: '#000002' },
      { id: 'phantom', name: 'Phantom Black', hex: '#1a1a1a' },
    ]);

    expect(groups.map((g) => [g.family, g.ids])).toEqual([
      ['black', ['midnight', 'phantom']],
      ['blue', ['blue']],
    ]);
    expect(groups[0].labelKey).toBe('colorFamilyBlack');
  });

  it('returns nothing for no colors', () => {
    expect(groupColorsByFamily([])).toEqual([]);
  });
});
