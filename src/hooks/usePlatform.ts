import { useEffect, useState } from 'react';

export type Platform = 'mobile' | 'tablet' | 'web' | 'unknown';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    if (typeof window === 'undefined') return; // In order to prevent SSR issues

    const ua = navigator.userAgent.toLowerCase();

    if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
      setPlatform('tablet');
    } else if (
      /mobi|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(
        ua,
      )
    ) {
      setPlatform('mobile');
    } else {
      setPlatform('web');
    }
  }, []);

  return platform;
}
