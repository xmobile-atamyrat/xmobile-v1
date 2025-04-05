import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import Suppliers from '@/pages/procurement/components/Suppliers';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function Procurement() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user } = useUserContext();
  useEffect(() => {
    if (user?.grade !== 'SUPERUSER') {
      router.push('/');
    }
  }, [user]);
  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {user?.grade === 'SUPERUSER' && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            p: isMdUp ? 8 : 2,
          }}
          className="flex flex-col gap-4 w-full h-full"
        >
          <Typography fontWeight={600} fontSize={20}>
            {t('procurement')}
          </Typography>
          <Suppliers />
        </Box>
      )}
    </Layout>
  );
}
