import Layout from '@/pages/components/Layout';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import ProductContextProvider from '@/pages/lib/ProductContext';
import UserContextProvider from '@/pages/lib/UserContext';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserContextProvider>
      <CategoryContextProvider>
        <ProductContextProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </ProductContextProvider>
      </CategoryContextProvider>
    </UserContextProvider>
  );
}
