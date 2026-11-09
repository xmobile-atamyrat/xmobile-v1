import type { Color } from '@prisma/client';

// Storefront colour filter groups brand marketing names ("Phantom Black",
// "Midnight") into a dozen basic families, the way large stores do.
export const COLOR_FAMILIES = [
  'black',
  'white',
  'silver',
  'gray',
  'gold',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export const isColorFamily = (value: string): value is ColorFamily =>
  (COLOR_FAMILIES as readonly string[]).includes(value);

export const COLOR_FAMILY_HEX: Record<ColorFamily, string> = {
  black: '#1a1a1a',
  white: '#ffffff',
  silver: '#c9ccd1',
  gray: '#7d8086',
  gold: '#d9bf8c',
  brown: '#6d4c33',
  red: '#d32f2f',
  orange: '#f57c00',
  yellow: '#fbc02d',
  green: '#3f8f4f',
  blue: '#1e63c4',
  purple: '#7b4fb5',
  pink: '#f19bbb',
};

export const COLOR_FAMILY_LABEL_KEY: Record<ColorFamily, string> = {
  black: 'colorFamilyBlack',
  white: 'colorFamilyWhite',
  silver: 'colorFamilySilver',
  gray: 'colorFamilyGray',
  gold: 'colorFamilyGold',
  brown: 'colorFamilyBrown',
  red: 'colorFamilyRed',
  orange: 'colorFamilyOrange',
  yellow: 'colorFamilyYellow',
  green: 'colorFamilyGreen',
  blue: 'colorFamilyBlue',
  purple: 'colorFamilyPurple',
  pink: 'colorFamilyPink',
};

// Matched as substrings because names run words together ("Silverblue",
// "Graygreen"). Short words that hide inside others ("ink", "tan") are left out.
const NAME_KEYWORDS: Record<ColorFamily, string[]> = {
  black: ['black', 'charcoal', 'onyx', 'obsidian'],
  white: ['white', 'snow', 'pearl'],
  silver: ['silver', 'chrome', 'platinum'],
  gray: ['gray', 'grey', 'graphite'],
  gold: ['gold', 'beige', 'cream', 'champagne'],
  brown: ['brown', 'mocha', 'coffee', 'bronze', 'chocolate'],
  red: ['red', 'ruby', 'burgundy', 'crimson', 'wine'],
  orange: ['orange', 'coral', 'peach'],
  yellow: ['yellow', 'lemon'],
  green: ['green', 'mint', 'emerald', 'sage', 'pistachio', 'olive', 'teal'],
  blue: ['blue', 'navy', 'cyan', 'sapphire', 'azure', 'aqua'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'plum', 'mauve'],
  pink: ['pink', 'rose', 'blush', 'magenta', 'fuchsia'],
};

const familiesInName = (name: string): ColorFamily[] => {
  const lower = name.toLowerCase();
  return COLOR_FAMILIES.filter((family) =>
    NAME_KEYWORDS[family].some((word) => lower.includes(word)),
  );
};

export function colorFamilyOfHex(hex: string): ColorFamily {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) return 'gray';

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Chroma rather than HSL saturation: near-whites such as cream would
  // otherwise read as fully saturated.
  const chroma = max - min;
  const lightness = (max + min) / 2;

  if (lightness < 0.12) return 'black';
  if (chroma < 0.08 || (lightness > 0.92 && chroma < 0.12)) {
    if (lightness < 0.2) return 'black';
    if (lightness > 0.88) return 'white';
    if (lightness > 0.65) return 'silver';
    return 'gray';
  }

  let hue: number;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) {
    if (lightness > 0.8) return 'pink';
    return 'red';
  }
  if (hue < 45) {
    if (lightness < 0.45) return 'brown';
    if (chroma < 0.45) return 'gold';
    return 'orange';
  }
  if (hue < 65) {
    if (lightness < 0.35) return 'brown';
    if (chroma < 0.45) return 'gold';
    return 'yellow';
  }
  if (hue < 170) return 'green';
  if (hue < 255) return 'blue';
  if (hue < 290) return 'purple';
  if (lightness < 0.35) return 'purple';
  return 'pink';
}

export function colorFamilyOf(color: Pick<Color, 'name' | 'hex'>): ColorFamily {
  const fromHex = colorFamilyOfHex(color.hex);
  const fromName = familiesInName(color.name);
  if (fromName.length === 1) return fromName[0];
  // "Titanium Whitesilver", "Mocha Gold": let the swatch break the tie.
  return fromName.includes(fromHex) || fromName.length === 0
    ? fromHex
    : fromName[0];
}

export interface ColorFamilySwatch {
  family: ColorFamily;
  hex: string;
  labelKey: string;
  ids: string[];
}

export function groupColorsByFamily(
  colors: Pick<Color, 'id' | 'name' | 'hex'>[],
): ColorFamilySwatch[] {
  const ids = new Map<ColorFamily, string[]>();
  colors.forEach((color) => {
    const family = colorFamilyOf(color);
    ids.set(family, [...(ids.get(family) ?? []), color.id]);
  });
  return COLOR_FAMILIES.filter((family) => ids.has(family)).map((family) => ({
    family,
    hex: COLOR_FAMILY_HEX[family],
    labelKey: COLOR_FAMILY_LABEL_KEY[family],
    ids: ids.get(family)!,
  }));
}
