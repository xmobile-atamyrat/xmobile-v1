import {
  changedFields,
  FieldChange,
  logAdminActivity,
} from '@/lib/adminActivity';
import { categoryLabel, categoryNameById } from '@/lib/categoryActivity';
import dbClient from '@/lib/dbClient';
import type { AdminActivityAction, Prisma, Product } from '@prisma/client';

type ProductSnapshot = Pick<
  Product,
  | 'id'
  | 'name'
  | 'description'
  | 'categoryId'
  | 'brandId'
  | 'tags'
  | 'videoUrls'
  | 'imgUrls'
  | 'price'
  | 'outOfStockAt'
>;

type NamePair = { from: string | null; to: string | null };

export function imageDiff(
  before: string[],
  after: string[],
): { added: number; removed: number; reordered: boolean } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const kept = before.filter((url) => afterSet.has(url));
  const keptAfter = after.filter((url) => beforeSet.has(url));
  return {
    added: after.filter((url) => !beforeSet.has(url)).length,
    removed: before.filter((url) => !afterSet.has(url)).length,
    reordered: JSON.stringify(kept) !== JSON.stringify(keptAfter),
  };
}

/**
 * One save is one decision. A save whose only effect is the image order is a
 * REORDER; anything else is a single UPDATE listing everything that moved.
 * Returns null when the save changed nothing worth recording.
 */
export function buildProductUpdateActivity(
  before: ProductSnapshot,
  after: ProductSnapshot,
  names: { category: NamePair; brand: NamePair },
): { action: AdminActivityAction; meta: Prisma.InputJsonObject } | null {
  const changes: Record<string, FieldChange> = changedFields(
    { name: categoryLabel(before.name) },
    { name: categoryLabel(after.name) },
    ['name'],
  );
  if (before.categoryId !== after.categoryId) {
    changes.category = { from: names.category.from, to: names.category.to };
  }
  if (before.brandId !== after.brandId) {
    changes.brand = { from: names.brand.from, to: names.brand.to };
  }
  const wasOut = before.outOfStockAt != null;
  const isOut = after.outOfStockAt != null;
  if (wasOut !== isOut) {
    changes.outOfStock = { from: wasOut, to: isOut };
  }

  const edited: string[] = [];
  if (before.description !== after.description) edited.push('description');
  if (JSON.stringify(before.tags) !== JSON.stringify(after.tags)) {
    edited.push('tags');
  }
  if (JSON.stringify(before.videoUrls) !== JSON.stringify(after.videoUrls)) {
    edited.push('videos');
  }
  if (before.price !== after.price) edited.push('price');

  const images = imageDiff(before.imgUrls, after.imgUrls);
  const imagesChanged = images.added > 0 || images.removed > 0;
  const name = categoryLabel(after.name);

  const nothingElse =
    Object.keys(changes).length === 0 && edited.length === 0 && !imagesChanged;
  if (nothingElse && images.reordered) {
    return { action: 'REORDER', meta: { name } };
  }
  if (nothingElse) return null;

  return {
    action: 'UPDATE',
    meta: {
      name,
      changes,
      ...(edited.length > 0 ? { edited } : {}),
      ...(images.added > 0 ? { imagesAdded: images.added } : {}),
      ...(images.removed > 0 ? { imagesRemoved: images.removed } : {}),
      ...(images.reordered ? { imagesReordered: true } : {}),
    },
  };
}

async function brandNameById(
  id: string | null | undefined,
): Promise<string | null> {
  if (!id) return null;
  try {
    const brand = await dbClient.brand.findUnique({
      where: { id },
      select: { name: true },
    });
    return brand?.name ?? null;
  } catch {
    return null;
  }
}

export async function recordProductCreated(
  userId: string | undefined,
  product: Pick<Product, 'id' | 'name' | 'categoryId' | 'imgUrls'>,
): Promise<void> {
  const category = await categoryNameById(product.categoryId);
  logAdminActivity({
    userId,
    entity: 'PRODUCT',
    action: 'CREATE',
    targetId: product.id,
    meta: {
      name: categoryLabel(product.name),
      ...(category != null ? { category } : {}),
      images: product.imgUrls.length,
    },
  });
}

export async function recordProductUpdated(
  userId: string | undefined,
  before: ProductSnapshot,
  after: ProductSnapshot,
): Promise<void> {
  const categoryMoved = before.categoryId !== after.categoryId;
  const brandMoved = before.brandId !== after.brandId;
  const [categoryFrom, categoryTo, brandFrom, brandTo] = await Promise.all([
    categoryMoved ? categoryNameById(before.categoryId) : null,
    categoryMoved ? categoryNameById(after.categoryId) : null,
    brandMoved ? brandNameById(before.brandId) : null,
    brandMoved ? brandNameById(after.brandId) : null,
  ]);
  const activity = buildProductUpdateActivity(before, after, {
    category: { from: categoryFrom, to: categoryTo },
    brand: { from: brandFrom, to: brandTo },
  });
  if (activity == null) return;
  logAdminActivity({
    userId,
    entity: 'PRODUCT',
    action: activity.action,
    targetId: after.id,
    meta: activity.meta,
  });
}

export function recordProductDeleted(
  userId: string | undefined,
  product: Pick<Product, 'id' | 'name'>,
): void {
  logAdminActivity({
    userId,
    entity: 'PRODUCT',
    action: 'DELETE',
    targetId: product.id,
    meta: { name: categoryLabel(product.name) },
  });
}
