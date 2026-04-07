import { describe, expect, it } from 'vitest';

import { parseCategoryHierarchyBody } from '@/lib/categoryHierarchyBody';

describe('parseCategoryHierarchyBody', () => {
  it('returns null for null, undefined, primitives, and arrays', () => {
    expect(parseCategoryHierarchyBody(null)).toBeNull();
    expect(parseCategoryHierarchyBody(undefined)).toBeNull();
    expect(parseCategoryHierarchyBody('x')).toBeNull();
    expect(parseCategoryHierarchyBody(1)).toBeNull();
    expect(parseCategoryHierarchyBody(true)).toBeNull();
    expect(parseCategoryHierarchyBody([])).toBeNull();
  });

  it('returns null for unknown or missing action', () => {
    expect(parseCategoryHierarchyBody({})).toBeNull();
    expect(parseCategoryHierarchyBody({ action: 'nope' })).toBeNull();
    expect(parseCategoryHierarchyBody({ action: 1 })).toBeNull();
  });

  describe('reorderSibling', () => {
    it('parses valid up/down', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: 'cat-1',
          direction: 'up',
        }),
      ).toEqual({
        action: 'reorderSibling',
        categoryId: 'cat-1',
        direction: 'up',
      });
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: 'cat-2',
          direction: 'down',
        }),
      ).toEqual({
        action: 'reorderSibling',
        categoryId: 'cat-2',
        direction: 'down',
      });
    });

    it('rejects empty or non-string categoryId', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: '',
          direction: 'up',
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: 123,
          direction: 'up',
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          direction: 'up',
        }),
      ).toBeNull();
    });

    it('rejects invalid direction', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: 'a',
          direction: 'sideways',
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'reorderSibling',
          categoryId: 'a',
        }),
      ).toBeNull();
    });
  });

  describe('setParent', () => {
    it('parses explicit null newPredecessorId (root)', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: 'child',
          newPredecessorId: null,
        }),
      ).toEqual({
        action: 'setParent',
        categoryId: 'child',
        newPredecessorId: null,
      });
    });

    it('treats omitted newPredecessorId as null', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: 'child',
        }),
      ).toEqual({
        action: 'setParent',
        categoryId: 'child',
        newPredecessorId: null,
      });
    });

    it('parses string parent id', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: 'child',
          newPredecessorId: 'parent-uuid',
        }),
      ).toEqual({
        action: 'setParent',
        categoryId: 'child',
        newPredecessorId: 'parent-uuid',
      });
    });

    it('rejects non-string non-null newPredecessorId', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: 'c',
          newPredecessorId: 99,
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: 'c',
          newPredecessorId: {},
        }),
      ).toBeNull();
    });

    it('rejects invalid categoryId', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setParent',
          categoryId: '',
          newPredecessorId: null,
        }),
      ).toBeNull();
    });
  });

  describe('setPopular', () => {
    it('parses valid categoryId and boolean popular', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setPopular',
          categoryId: 'root-1',
          popular: true,
        }),
      ).toEqual({
        action: 'setPopular',
        categoryId: 'root-1',
        popular: true,
      });
      expect(
        parseCategoryHierarchyBody({
          action: 'setPopular',
          categoryId: 'root-2',
          popular: false,
        }),
      ).toEqual({
        action: 'setPopular',
        categoryId: 'root-2',
        popular: false,
      });
    });

    it('rejects empty categoryId or non-boolean popular', () => {
      expect(
        parseCategoryHierarchyBody({
          action: 'setPopular',
          categoryId: '',
          popular: true,
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'setPopular',
          categoryId: 'a',
          popular: 'true',
        }),
      ).toBeNull();
      expect(
        parseCategoryHierarchyBody({
          action: 'setPopular',
          categoryId: 'a',
        }),
      ).toBeNull();
    });
  });
});
