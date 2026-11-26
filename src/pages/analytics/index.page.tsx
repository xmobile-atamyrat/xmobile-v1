import dbClient from '@/lib/dbClient';
import { fetchTelekomBalance } from '@/lib/telekom';
import { currentGrade, verifyToken } from '@/pages/api/utils/authMiddleware';
import { isStaff } from '@/pages/api/utils/staffAuth';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = (async (context) => {
  const home = {
    redirect: { destination: `/${context.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = context.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;
  try {
    const { userId } = await verifyToken(refreshToken, REFRESH_SECRET);
    // Go by the account's current grade, not the one baked into the cookie.
    if (!isStaff((await currentGrade(userId)) ?? undefined)) return home;
  } catch {
    return home;
  }

  let userCount = 0;
  let errorMessage: string | null = null;
  let balance: number | null = null;

  try {
    userCount = await dbClient.user.count();
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  try {
    balance = await fetchTelekomBalance();
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  return {
    props: {
      userCount,
      errorMessage,
      balance,
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  userCount: number;
  errorMessage: string | null;
  balance: number | null;
}>;

export default function Analytics({
  userCount,
  balance,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 1,
        }}
        className="flex flex-col gap-8 w-full h-full"
      >
        <Typography fontWeight={600} fontSize={20}>
          {t('analytics')}
        </Typography>
        {balance && (
          <Box className="flex flex-row gap-4">
            <Typography className="w-2/3">{t('telekomBalance')}</Typography>
            <Typography fontWeight={600}>{`${balance} TMT`}</Typography>
          </Box>
        )}
        <Box className="flex flex-row gap-4">
          <Typography className="w-2/3">{t('totalUserCount')}</Typography>
          <Typography fontWeight={600}>{userCount}</Typography>
        </Box>
      </Box>
    </Layout>
  );
}
