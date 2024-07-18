import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { useProductContext } from '@/pages/lib/ProductContext';
import { parseName } from '@/pages/lib/utils';
import { Box, CardMedia, Grid, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
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

  useEffect(() => {
    (async () => {
      if (product?.imgUrl != null) {
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
  }, [product?.imgUrl]);

  return (
    <Layout showSearch={false}>
      <Grid
        // className="flex flex-col px-6 gap-4 h-full w-full"
        container
        xs={12}
      >
        <Grid item xs={4}>
          <Typography variant="h4" className="text-center">
            {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
          </Typography>
          {imgUrl != null && (
            <Box className="flex justify-center h-1/3 w-full">
              <CardMedia
                component="img"
                image={imgUrl}
                alt={product?.name}
                sx={{
                  height: 'auto',
                  width: 'auto',
                }}
              />
            </Box>
          )}
        </Grid>
        <Grid className="flex flex-col w-full" item xs={4}>
          {parseName(product?.description ?? '{}', router.locale ?? 'tk')
            ?.split('\n')
            .map((desc, index) => (
              <Typography key={`${desc}-${index}`}>{desc}</Typography>
            ))}
        </Grid>
      </Grid>
    </Layout>
  );
}
