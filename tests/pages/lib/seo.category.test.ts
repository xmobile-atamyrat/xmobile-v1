import { describe, expect, it } from 'vitest';

import { generateCategoryTitle } from '@/pages/lib/seo';
import type { ExtendedCategory } from '@/pages/lib/types';

function cat(id: string, nameJson: string): ExtendedCategory {
  return { id, name: nameJson } as ExtendedCategory;
}

describe('generateCategoryTitle', () => {
  it('returns business name only for an empty path', () => {
    expect(generateCategoryTitle([], 'in TM', 'ru')).toBe('Xmobile');
  });

  it('reverses path and joins localized names', () => {
    const path = [
      cat('1', '{"ru":"Root","en":"RootEn"}'),
      cat('2', '{"ru":"Child","en":"ChildEn"}'),
    ];
    const title = generateCategoryTitle(path, 'in Turkmenistan', 'ru');
    expect(title).toContain('Child');
    expect(title).toContain('Root');
    expect(title).toContain('in Turkmenistan');
    expect(title).toContain('Xmobile');
  });
});
