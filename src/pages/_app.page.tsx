import Loader from '@/pages/components/Loader';
import AbortControllerContextProvider from '@/pages/lib/AbortControllerContext';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import { ChatContextProvider } from '@/pages/lib/ChatContext';
import DollarRateContextProvider from '@/pages/lib/DollarRateContext';
import NetworkContextProvider from '@/pages/lib/NetworkContext';
import PlatformContextProvider from '@/pages/lib/PlatformContext';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
import { theme } from '@/pages/lib/utils';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    if (hasShownSplash) {
      setIsLoading(false);
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasShownSplash', 'true');
    }, 1000);

    return () => clearTimeout(timer);
  });

  return (
    <ThemeProvider theme={theme}>
      <NetworkContextProvider>
        <AbortControllerContextProvider>
          <UserContextProvider>
            <ChatContextProvider>
              <CategoryContextProvider>
                <ProductContextProvider>
                  <PrevProductContextProvider>
                    <DollarRateContextProvider>
                      <PlatformContextProvider>
                        <NextIntlClientProvider
                          locale={router.locale}
                          timeZone="Asia/Ashgabat"
                          messages={pageProps.messages}
                        >
                          <Component {...pageProps} />
                        </NextIntlClientProvider>
                      </PlatformContextProvider>
                    </DollarRateContextProvider>
                  </PrevProductContextProvider>
                </ProductContextProvider>
              </CategoryContextProvider>
            </ChatContextProvider>
          </UserContextProvider>
        </AbortControllerContextProvider>
      </NetworkContextProvider>
    </ThemeProvider>
  );
}
