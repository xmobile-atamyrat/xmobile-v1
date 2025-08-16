import { useEffect, useState } from 'react';

export type Platform = 'mobile' | 'web';

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setPlatform(window.innerWidth < 900 ? 'mobile' : 'web');
  }, []);

  return platform;
}
