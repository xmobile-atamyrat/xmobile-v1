import {
  changedFields,
  FieldChange,
  logAdminActivity,
} from '@/lib/adminActivity';
import dbClient from '@/lib/dbClient';
import type { Category, Prisma } from '@prisma/client';

type CategorySnapshot = Pick<
  Category,
  'id' | 'name' | 'popular' | 'predecessorId' | 'imgUrl'
>;

/**
 * Category names are stored as a JSON blob keyed by locale. The activity log
 * keeps one readable label, preferring English, so a row stays meaningful after
 * the category is renamed or deleted.
 */
export function categoryLabel(rawName: string | null | undefined): string {
  if (!rawName) return '';
  try {
    const parsed = JSON.parse(rawName) as unknown;
    if (parsed !== null && typeof parsed === 'object') {
      const names = parsed as Record<string, unknown>;
      if (typeof names.en === 'string' && names.en.trim() !== '') {
        return names.en;
      }
      const first = Object.values(names).find(
        (value) => typeof value === 'string' && value.trim() !== '',
      );
      return typeof first === 'string' ? first : '';
    }
  } catch {
    // Not JSON: legacy plain-string name.
  }
  return rawName;
}

/** Never throws: a failed lookup must not break the save being logged. */
export async function categoryNameById(
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  try {
    const category = await dbClient.category.findUnique({
      where: { id },
      select: { name: true },
    });
    return category ? categoryLabel(category.name) : null;
  } catch {
    return null;
  }
}

export function buildCategoryUpdateMeta(
  before: CategorySnapshot,
  after: CategorySnapshot,
  parentNames: { from: string | null; to: string | null },
): Prisma.InputJsonObject | null {
  const changes: Record<string, FieldChange> = changedFields(
    { name: categoryLabel(before.name), popular: before.popular },
    { name: categoryLabel(after.name), popular: after.popular },
    ['name', 'popular'],
  );
  if (before.predecessorId !== after.predecessorId) {
    changes.parent = { from: parentNames.from, to: parentNames.to };
  }
  const imageChanged = before.imgUrl !== after.imgUrl;
  if (Object.keys(changes).length === 0 && !imageChanged) return null;

  return {
    name: categoryLabel(after.name),
    changes,
    ...(imageChanged ? { imageChanged: true } : {}),
  };
}

export async function recordCategoryCreated(
  userId: string | undefined,
  category: Pick<Category, 'id' | 'name' | 'predecessorId'>,
): Promise<void> {
  const parent = await categoryNameById(category.predecessorId);
  logAdminActivity({
    userId,
    entity: 'CATEGORY',
    action: 'CREATE',
    targetId: category.id,
    meta: {
      name: categoryLabel(category.name),
      ...(parent != null ? { parent } : {}),
    },
  });
}

export async function recordCategoryUpdated(
  userId: string | undefined,
  before: CategorySnapshot,
  after: CategorySnapshot,
): Promise<void> {
  const moved = before.predecessorId !== after.predecessorId;
  const [from, to] = moved
    ? await Promise.all([
        categoryNameById(before.predecessorId),
        categoryNameById(after.predecessorId),
      ])
    : [null, null];
  const meta = buildCategoryUpdateMeta(before, after, { from, to });
  if (meta == null) return;
  logAdminActivity({
    userId,
    entity: 'CATEGORY',
    action: 'UPDATE',
    targetId: after.id,
    meta,
  });
}

export function recordCategoryDeleted(
  userId: string | undefined,
  category: { id: string; name: string | null },
  counts: { subcategories: number; products: number },
): void {
  logAdminActivity({
    userId,
    entity: 'CATEGORY',
    action: 'DELETE',
    targetId: category.id,
    meta: { name: categoryLabel(category.name), ...counts },
  });
}

export function recordCategoryReordered(
  userId: string | undefined,
  category: { id: string; name: string | null },
  direction: 'up' | 'down',
): void {
  logAdminActivity({
    userId,
    entity: 'CATEGORY',
    action: 'REORDER',
    targetId: category.id,
    meta: { name: categoryLabel(category.name), direction },
  });
}
