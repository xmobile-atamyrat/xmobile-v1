import { fetchProducts, fetchProductsCount } from '@/pages/lib/apis';
import { HOME_IMAGELESS_PRODUCTS } from '@/pages/lib/constants';
import { ExtendedProduct } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { UserRole } from '@prisma/client';
import { useEffect, useRef, useState } from 'react';

export interface ImagelessProducts {
  products: ExtendedProduct[];
  /** Every product without an image, not just the ones listed. */
  total: number;
}

/**
 * For ADMIN and SUPERUSER only: the products still missing a photo (which the
 * storefront hides), so home can list them for fixing. Null for everyone else
 * and until loaded. Loaded on the client because home's server render is the
 * same for every visitor.
 */
export function useImagelessProducts(
  locale: string | undefined,
): ImagelessProducts | null {
  const { user, accessToken } = useUserContext();
  const isStaff =
    user?.grade === UserRole.ADMIN || user?.grade === UserRole.SUPERUSER;
  const hasToken = accessToken != null;
  // Through a ref so a silent token refresh doesn't trigger a refetch.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const [result, setResult] = useState<ImagelessProducts | null>(null);

  useEffect(() => {
    if (!isStaff || !hasToken) {
      setResult(null);
      return undefined;
    }
    let active = true;
    const staffToken = tokenRef.current;
    Promise.all([
      fetchProducts({
        imageless: true,
        staffToken,
        locale,
        limit: HOME_IMAGELESS_PRODUCTS,
      }),
      fetchProductsCount({ imageless: true, staffToken }),
    ])
      .then(([products, total]) => {
        if (active) setResult({ products, total });
      })
      .catch((error) => {
        // Best-effort admin aid: home works the same without it.
        console.error('Failed to load products without images:', error);
      });
    return () => {
      active = false;
    };
  }, [isStaff, hasToken, locale]);

  return result;
}
