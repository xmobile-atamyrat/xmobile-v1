import CategoryContextProvider from '@/pages/lib/CategoryContext';
import NetworkContextProvider from '@/pages/lib/NetworkContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import PrevProductContextProvider from '@/pages/lib/PrevProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
import AbortControllerContextProvider from '@/pages/lib/AbortControllerContext';
import { theme } from '@/pages/lib/utils';
import '@/styles/globals.css';
import { ThemeProvider } from '@mui/material';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
// import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // useEffect(() => {
  //   const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  //     event.preventDefault();
  //   };

  //   window.addEventListener('beforeunload', handleBeforeUnload);

  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //   };
  // }, []);

  return (
    <ThemeProvider theme={theme}>
      <NetworkContextProvider>
        <AbortControllerContextProvider>
          <UserContextProvider>
            <CategoryContextProvider>
              <ProductContextProvider>
                <PrevProductContextProvider>
                  <NextIntlClientProvider
                    locale={router.locale}
                    timeZone="Asia/Ashgabat"
                    messages={pageProps.messages}
                  >
                    <Component {...pageProps} />
                  </NextIntlClientProvider>
                </PrevProductContextProvider>
              </ProductContextProvider>
            </CategoryContextProvider>
          </UserContextProvider>
        </AbortControllerContextProvider>
      </NetworkContextProvider>
    </ThemeProvider>
  );
}
