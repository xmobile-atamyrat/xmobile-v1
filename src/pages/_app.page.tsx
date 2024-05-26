import CategoryContextProvider from '@/pages/lib/CategoryContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
import '@/styles/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  return (
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
  );
}
