import { groupColorsByBrand } from '@/pages/lib/colorGroups';
import { describe, expect, it } from 'vitest';

const brands = [
  { id: 'samsung', name: 'Samsung' },
  { id: 'apple', name: 'Apple' },
  { id: 'xiaomi', name: 'Xiaomi' },
];

const colors = [
  { id: 'c1', name: 'Black', hex: '#000000', brandId: 'samsung' },
  { id: 'c2', name: 'Midnight', hex: '#111111', brandId: 'apple' },
  { id: 'c3', name: 'White', hex: '#ffffff', brandId: null },
  { id: 'c4', name: 'Blue', hex: '#0000ff', brandId: 'xiaomi' },
  { id: 'c5', name: 'Alpine', hex: '#00ff00', brandId: 'apple' },
  { id: 'c6', name: 'Gray', hex: '#888888', brandId: 'deleted-brand' },
];

const groupIds = (groups: ReturnType<typeof groupColorsByBrand>) =>
  groups.map((group) => group.brandId);

describe('groupColorsByBrand', () => {
  it('puts unbranded first, then brands alphabetically, without a priority brand', () => {
    const groups = groupColorsByBrand(colors, brands);
    expect(groupIds(groups)).toEqual([null, 'apple', 'samsung', 'xiaomi']);
  });

  it('puts the priority brand first and unbranded second', () => {
    const groups = groupColorsByBrand(colors, brands, 'samsung');
    expect(groupIds(groups)).toEqual(['samsung', null, 'apple', 'xiaomi']);
  });

  it('sorts colors by name inside each group', () => {
    const apple = groupColorsByBrand(colors, brands).find(
      (group) => group.brandId === 'apple',
    );
    expect(apple?.colors.map((color) => color.name)).toEqual([
      'Alpine',
      'Midnight',
    ]);
  });

  it('treats a color whose brand is unknown as unbranded', () => {
    const unbranded = groupColorsByBrand(colors, brands).find(
      (group) => group.brandId == null,
    );
    expect(unbranded?.colors.map((color) => color.id)).toEqual(['c6', 'c3']);
  });

  it('leaves out brands that have no colors', () => {
    const groups = groupColorsByBrand(
      colors,
      [...brands, { id: 'nokia', name: 'Nokia' }],
      'nokia',
    );
    expect(groupIds(groups)).not.toContain('nokia');
  });

  it('carries the brand name on each group', () => {
    const groups = groupColorsByBrand(colors, brands);
    expect(groups.map((group) => group.brandName)).toEqual([
      null,
      'Apple',
      'Samsung',
      'Xiaomi',
    ]);
  });
});
