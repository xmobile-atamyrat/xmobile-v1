import { changedFields, FieldChange } from '@/lib/adminActivity';
import type { Prisma, PromoBanner } from '@prisma/client';

/**
 * Banners have no name, so the log identifies one by its carousel position.
 * Returns null when the save changed nothing worth recording.
 */
export function buildBannerUpdateMeta(
  before: PromoBanner,
  after: PromoBanner,
): Prisma.InputJsonObject | null {
  const changes: Record<string, FieldChange> = changedFields(before, after, [
    'isActive',
    'sortOrder',
    'startsAt',
    'endsAt',
  ]);
  const redirectChanged =
    before.redirectCategoryId !== after.redirectCategoryId ||
    before.redirectProductId !== after.redirectProductId;
  const imagesChanged =
    JSON.stringify(before.imgUrls) !== JSON.stringify(after.imgUrls);

  if (Object.keys(changes).length === 0 && !redirectChanged && !imagesChanged) {
    return null;
  }

  return {
    position: after.sortOrder,
    changes,
    ...(redirectChanged ? { redirectChanged: true } : {}),
    ...(imagesChanged ? { imagesChanged: true } : {}),
  };
}
