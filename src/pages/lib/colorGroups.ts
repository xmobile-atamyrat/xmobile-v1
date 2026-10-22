import type { Color } from '@prisma/client';

type GroupableColor = Pick<Color, 'id' | 'name' | 'hex' | 'brandId'>;

export interface ColorGroup<T extends GroupableColor> {
  brandId: string | null;
  brandName: string | null;
  colors: T[];
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

export function groupColorsByBrand<T extends GroupableColor>(
  colors: T[],
  brands: { id: string; name: string }[],
  priorityBrandId?: string | null,
): ColorGroup<T>[] {
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));
  const buckets = new Map<string | null, T[]>();

  colors.forEach((color) => {
    const key =
      color.brandId != null && brandById.has(color.brandId)
        ? color.brandId
        : null;
    const bucket = buckets.get(key) ?? [];
    bucket.push(color);
    buckets.set(key, bucket);
  });

  const toGroup = (brandId: string | null): ColorGroup<T> => ({
    brandId,
    brandName: brandId == null ? null : brandById.get(brandId)!.name,
    colors: [...buckets.get(brandId)!].sort(byName),
  });

  const priority =
    priorityBrandId != null && buckets.has(priorityBrandId)
      ? [toGroup(priorityBrandId)]
      : [];
  const unbranded = buckets.has(null) ? [toGroup(null)] : [];
  const rest = brands
    .filter((brand) => brand.id !== priorityBrandId && buckets.has(brand.id))
    .sort(byName)
    .map((brand) => toGroup(brand.id));

  return [...priority, ...unbranded, ...rest];
}
