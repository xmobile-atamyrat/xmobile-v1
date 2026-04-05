export type CategoryHierarchyBody =
  | {
      action: 'reorderSibling';
      categoryId: string;
      direction: 'up' | 'down';
    }
  | {
      action: 'setParent';
      categoryId: string;
      newPredecessorId: string | null;
    };

/**
 * Parse JSON body for POST /api/category/hierarchy.
 */
export function parseCategoryHierarchyBody(
  raw: unknown,
): CategoryHierarchyBody | null {
  if (raw == null || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const action = b.action;
  if (action === 'reorderSibling') {
    const categoryId = b.categoryId;
    const direction = b.direction;
    if (typeof categoryId !== 'string' || categoryId.length === 0) {
      return null;
    }
    if (direction !== 'up' && direction !== 'down') return null;
    return { action: 'reorderSibling', categoryId, direction };
  }
  if (action === 'setParent') {
    const categoryId = b.categoryId;
    if (typeof categoryId !== 'string' || categoryId.length === 0) {
      return null;
    }
    const rawParent = b.newPredecessorId;
    let newPredecessorId: string | null;
    if (rawParent === null || rawParent === undefined) {
      newPredecessorId = null;
    } else if (typeof rawParent === 'string') {
      newPredecessorId = rawParent;
    } else {
      return null;
    }
    return { action: 'setParent', categoryId, newPredecessorId };
  }
  return null;
}
