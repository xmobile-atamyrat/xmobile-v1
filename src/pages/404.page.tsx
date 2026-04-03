import Layout from '@/pages/components/Layout';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { notFoundClasses } from '@/styles/classMaps/not-found.page';
import { img, interClassname } from '@/styles/theme';
import { Box, Button, CardMedia, Typography } from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Custom404() {
  const platform = usePlatform();
  const router = useRouter();
  const t = useTranslations();
  const button = {
    web: 'homepage',
    mobile: 'startShopping',
  };

  const handleHome = () => {
    router.push('/');
  };

  return (
    <Layout handleHeaderBackButton={() => router.back()}>
      <Box className={notFoundClasses.container[platform]}>
        <Box className={notFoundClasses.content[platform]}>
          <CardMedia
            component="img"
            src={img.not_found[platform]}
            className={notFoundClasses.image[platform]}
          />
          <Typography
            className={`${interClassname.className} ${notFoundClasses.heading[platform]}`}
          >
            {t('pageNotFound')}
          </Typography>
          <Box className={notFoundClasses.buttonContainer[platform]}>
            <Button
              variant="contained"
              disableElevation
              onClick={handleHome}
              className={`${interClassname.className} ${notFoundClasses.button[platform]}`}
            >
              {t(button[platform])}
            </Button>
          </Box>
        </Box>
      </Box>
    </Layout>
  );
}
