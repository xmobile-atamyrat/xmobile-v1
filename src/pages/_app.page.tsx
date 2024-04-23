import Layout from '@/pages/components/Layout';
import CategoryContextProvider from '@/pages/lib/CategoryContext';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CategoryContextProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </CategoryContextProvider>
  );
}
