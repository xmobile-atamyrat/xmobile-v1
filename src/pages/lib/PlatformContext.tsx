import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createContext, ReactNode, useContext, useMemo } from 'react';

export type Platform = 'mobile' | 'web';

interface PlatformContextType {
  platform: Platform;
}

const PlatformContext = createContext<PlatformContextType | undefined>(
  undefined,
);

export default function PlatformContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const theme = useTheme();
  // Most visitors are on phones, so the server renders the mobile layout and
  // desktops switch once hydration has read the real media query.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), {
    defaultMatches: true,
  });

  const value = useMemo<PlatformContextType>(
    () => ({ platform: isMobile ? 'mobile' : 'web' }),
    [isMobile],
  );

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}

export const usePlatform = (): Platform => {
  const context = useContext(PlatformContext);
  if (!context) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(
        'usePlatform must be used within <PlatformContextProvider />',
      );
    }
    return 'mobile';
  }
  return context.platform;
};
