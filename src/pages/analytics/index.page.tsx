import dbClient from '@/lib/dbClient';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useUserContext } from '@/pages/lib/UserContext';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = (async (context) => {
  let userCount = 0;
  let dailyVisitCount = 0;
  let lastWeekVisitCount = 0;
  let lastMonthVisitCount = 0;
  let errorMessage: string | null = null;
  let balance: number | null = null;

  const telekomUsername = process.env.TELEKOM_USERNAME;
  const telekomPassword = process.env.TELEKOM_PASSWORD;

  try {
    userCount = await dbClient.user.count();
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to 00:00:00.000

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // Set to 23:59:59.999
    dailyVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  try {
    const now = new Date();
    const startOfWeekAgo = new Date(now);
    startOfWeekAgo.setDate(now.getDate() - 7);

    lastWeekVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfWeekAgo,
          lte: now,
        },
      },
    });
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  try {
    const now = new Date();
    const startOfMonthAgo = new Date(now);
    startOfMonthAgo.setMonth(now.getMonth() - 1);

    lastMonthVisitCount = await dbClient.userVisitRecord.count({
      where: {
        createdAt: {
          gte: startOfMonthAgo,
          lte: now,
        },
      },
    });
  } catch (error) {
    console.error(error);
    errorMessage = (error as Error).message;
  }

  if (telekomPassword != null && telekomPassword != null) {
    try {
      const loginResponse = await fetch(
        'https://os.telecom.tm:5000/api/v1/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: telekomUsername,
            password: telekomPassword,
          }),
        },
      );

      if (!loginResponse.ok) {
        throw new Error('Login request failed');
      }

      const loginData = await loginResponse.json();
      const accessToken = loginData.result.accessToken;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };
      const clientResponse = await fetch(
        'https://os.telecom.tm:5000/api/v1/clients/self',
        { headers },
      );
      if (!clientResponse.ok) {
        throw new Error('Client data request failed');
      }
      const clientData = await clientResponse.json();
      balance = Math.floor(clientData.result.client.balance);
    } catch (error) {
      console.error(error);
      errorMessage = (error as Error).message;
    }
  }

  return {
    props: {
      userCount,
      dailyVisitCount,
      lastMonthVisitCount,
      lastWeekVisitCount,
      errorMessage,
      balance,
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  userCount: number;
  dailyVisitCount: number;
  lastWeekVisitCount: number;
  lastMonthVisitCount: number;
  errorMessage: string | null;
  balance: number | null;
}>;

export default function Analytics({
  userCount,
  dailyVisitCount,
  lastWeekVisitCount,
  lastMonthVisitCount,
  balance,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const { user } = useUserContext();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
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
          <Box className="flex flex-row gap-4">
            <Typography className="w-2/3">{t('dailyVisitCount')}</Typography>
            <Typography fontWeight={600}>{dailyVisitCount}</Typography>
          </Box>
          <Box className="flex flex-row gap-4">
            <Typography className="w-2/3">{t('lastWeekVisitCount')}</Typography>
            <Typography fontWeight={600}>{lastWeekVisitCount}</Typography>
          </Box>
          <Box className="flex flex-row gap-4">
            <Typography className="w-2/3">
              {t('lastMonthVisitCount')}
            </Typography>
            <Typography fontWeight={600}>{lastMonthVisitCount}</Typography>
          </Box>
        </Box>
      )}
    </Layout>
  );
}
