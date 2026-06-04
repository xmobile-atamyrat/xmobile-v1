import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

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
  const isMobileQuery = useMediaQuery(theme.breakpoints.down('md'));
  const [platform, setPlatform] = useState<Platform>('web');

  useEffect(() => {
    setPlatform(isMobileQuery ? 'mobile' : 'web');
  }, [isMobileQuery]);

  return (
    <PlatformContext.Provider value={{ platform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export const usePlatform = (): Platform => {
  const context = useContext(PlatformContext);
  if (!context) {
    return 'web';
  }
  return context.platform;
};
