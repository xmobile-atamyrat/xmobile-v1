import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import { getCookie } from '@/pages/lib/utils';
import { useRouter } from 'next/router';

/**
 * Hook to get the current locale from cookie or router
 * For static export compatibility, reads from cookie first, falls back to router.locale
 * @returns Current locale string (default: 'ru')
 */
export function useLocale(): string {
  const router = useRouter();

  if (typeof window !== 'undefined') {
    // Client-side: read from cookie first
    const cookieLocale = getCookie(LOCALE_COOKIE_NAME);
    if (cookieLocale) {
      return cookieLocale;
    }
  }

  // Fallback to router.locale (for backward compatibility with Next.js i18n)
  // or default to 'ru'
  return router.locale || 'ru';
}
