/**
 * Nginx-served media paths (/media/...) for product and category images.
 * Stored DB paths are absolute filesystem paths or remote URLs.
 */

export const PRODUCT_IMAGE_FALLBACK = '/logo/xmobile-original-logo.jpeg';

export type ProductMediaTier = 'bad' | 'good' | 'original';

export function isRemoteImageUrl(storedPath: string): boolean {
  return /^https?:\/\//i.test(storedPath);
}

export function getBasename(storedPath: string): string {
  const trimmed = storedPath.trim().replace(/\\/g, '/');
  const idx = trimmed.lastIndexOf('/');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export function getProductMediaUrl(
  tier: ProductMediaTier,
  storedPath: string | null | undefined,
): string | undefined {
  if (!storedPath) return undefined;
  if (isRemoteImageUrl(storedPath)) return storedPath;
  const base = getBasename(storedPath);
  if (!base) return undefined;
  return `/media/product/${tier}/${encodeURIComponent(base)}`;
}

export function getCategoryMediaUrl(
  storedPath: string | null | undefined,
): string | undefined {
  if (!storedPath) return undefined;
  if (isRemoteImageUrl(storedPath)) return storedPath;
  const base = getBasename(storedPath);
  if (!base) return undefined;
  return `/media/category/${encodeURIComponent(base)}`;
}

export function getBannerMediaUrl(
  storedPath: string | null | undefined,
): string | undefined {
  if (!storedPath) return undefined;
  if (isRemoteImageUrl(storedPath)) return storedPath;
  const base = getBasename(storedPath);
  if (!base) return undefined;
  return `/media/banner/${encodeURIComponent(base)}`;
}

/**
 * Cards and line items never render wider than ~260 CSS px, so the 600px tier
 * already covers 2x screens. The full-width tier was 4x oversized there.
 */
export const PRODUCT_THUMBNAIL_TIER: ProductMediaTier = 'bad';

export function productThumbnailUrl(
  storedPath: string | null | undefined,
): string | undefined {
  if (storedPath == null) return undefined;
  return (
    getProductMediaUrl(PRODUCT_THUMBNAIL_TIER, storedPath) ??
    PRODUCT_IMAGE_FALLBACK
  );
}

/** Product page gallery: bad when slow or unknown; good when fast. */
export function tierForProductGallery(
  network: 'slow' | 'fast' | 'unknown',
): 'bad' | 'good' {
  return network === 'fast' ? 'good' : 'bad';
}

export function toAbsoluteMediaUrl(
  origin: string,
  pathOrUrl: string | undefined,
): string | undefined {
  if (!pathOrUrl) return undefined;
  if (isRemoteImageUrl(pathOrUrl)) return pathOrUrl;
  const trimmedOrigin = origin.replace(/\/$/, '');
  if (!pathOrUrl.startsWith('/')) return `${trimmedOrigin}/${pathOrUrl}`;
  return `${trimmedOrigin}${pathOrUrl}`;
}

export function getAbsoluteProductMediaUrl(
  origin: string,
  tier: ProductMediaTier,
  storedPath: string,
): string | undefined {
  const rel = getProductMediaUrl(tier, storedPath);
  return toAbsoluteMediaUrl(origin, rel);
}

export function getAbsoluteCategoryMediaUrl(
  origin: string,
  storedPath: string,
): string | undefined {
  const rel = getCategoryMediaUrl(storedPath);
  return toAbsoluteMediaUrl(origin, rel);
}
