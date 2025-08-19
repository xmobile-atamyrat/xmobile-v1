import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createContext, ReactNode, useContext } from 'react';

export type Platform = 'mobile' | 'web';

interface PlatformContextType {
  platform: Platform;
}

const PlatformContext = createContext<PlatformContextType | undefined>(
  undefined,
);

export const PlatformProvider = ({ children }: { children: ReactNode }) => {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const platform: Platform = isMobile ? 'mobile' : 'web';

  return (
    <PlatformContext.Provider value={{ platform }}>
      {children}
    </PlatformContext.Provider>
  );
};

export const usePlatform = (): Platform => {
  const context = useContext(PlatformContext);
  return context.platform;
};
