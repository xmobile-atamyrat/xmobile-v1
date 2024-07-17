import Layout from '@/pages/components/Layout';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Product() {
  const router = useRouter();
  const { id: productId } = router.query;
  return (
    <Layout showSearch={false}>
      <h1>Product #{productId}</h1>
    </Layout>
  );
}
