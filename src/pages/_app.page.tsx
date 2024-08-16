import CategoryContextProvider from '@/pages/lib/CategoryContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
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
      <UserContextProvider>
        <CategoryContextProvider>
          <ProductContextProvider>
            <NextIntlClientProvider
              locale={router.locale}
              timeZone="Asia/Ashgabat"
              messages={pageProps.messages}
            >
              <Component {...pageProps} />
            </NextIntlClientProvider>
          </ProductContextProvider>
        </CategoryContextProvider>
      </UserContextProvider>
    </ThemeProvider>
  );
}
