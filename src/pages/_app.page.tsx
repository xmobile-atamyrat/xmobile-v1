import AbortControllerContextProvider from '@/pages/lib/AbortControllerContext';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import DollarRateContextProvider from '@/pages/lib/DollarRateContext';
import NetworkContextProvider from '@/pages/lib/NetworkContext';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
import { PlatformProvider } from '@/pages/lib/usePlatform';
import { theme } from '@/pages/lib/utils';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <ThemeProvider theme={theme}>
      <PlatformProvider>
        <NetworkContextProvider>
          <AbortControllerContextProvider>
            <UserContextProvider>
              <CategoryContextProvider>
                <ProductContextProvider>
                  <PrevProductContextProvider>
                    <DollarRateContextProvider>
                      <NextIntlClientProvider
                        locale={router.locale}
                        timeZone="Asia/Ashgabat"
                        messages={pageProps.messages}
                      >
                        <Component {...pageProps} />
                      </NextIntlClientProvider>
                    </DollarRateContextProvider>
                  </PrevProductContextProvider>
                </ProductContextProvider>
              </CategoryContextProvider>
            </UserContextProvider>
          </AbortControllerContextProvider>
        </NetworkContextProvider>
      </PlatformProvider>
    </ThemeProvider>
  );
}
