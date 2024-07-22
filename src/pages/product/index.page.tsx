import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { useProductContext } from '@/pages/lib/ProductContext';
import { parseName } from '@/pages/lib/utils';
import { Box, CardMedia, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Product() {
  const { selectedProduct: product } = useProductContext();
  const router = useRouter();
  const [imgUrl, setImgUrl] = useState<string | null>();
  const t = useTranslations();

  useEffect(() => {
    if (product == null) {
      router.push('/');
      return;
    }

    (async () => {
      if (product.imgUrl != null) {
        if (product.imgUrl.startsWith('http')) {
          setImgUrl(product.imgUrl);
        } else {
          const imgFetcher = fetch(
            `${BASE_URL}/api/localImage?imgUrl=${product.imgUrl}`,
          );

          setImgUrl(URL.createObjectURL(await (await imgFetcher).blob()));
        }
      }
    })();
  }, [product]);

  return (
    product && (
      <Layout showSearch={false}>
        <Box className="w-full h-full flex flex-col px-4 gap-4">
          <Box className="w-full flex flex-col gap-2">
            <Typography variant="h5" className="text-center">
              {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
            </Typography>
            {imgUrl != null && (
              <Box className="flex justify-center h-full w-full">
                <CardMedia
                  component="img"
                  image={imgUrl}
                  alt={product?.name}
                  sx={{
                    width: '100%',
                  }}
                />
              </Box>
            )}
          </Box>
          <Box className="w-full">
            <Typography
              fontWeight={600}
            >{`${product?.price} ${t('manat')}`}</Typography>
          </Box>
          <Box className="w-full">
            {parseName(product?.description ?? '{}', router.locale ?? 'tk')
              ?.split('\n')
              .map((desc, index) => (
                <Typography key={`${desc}-${index}`}>{desc}</Typography>
              ))}
          </Box>
        </Box>
      </Layout>
    )
  );
}
