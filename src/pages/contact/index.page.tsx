import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

const phoneNumbers = ['+99361004933', '+99371211717', '+99342230620'];

const handleClick = (number: string) => {
  const userAgent = navigator.userAgent;

  if (/android/i.test(userAgent)) {
    // Android
    window.location.href = `tel:${number}`;
  } else if (/iPad|iPhone|iPod/.test(userAgent)) {
    // iOS
    window.location.href = `tel:${number}`;
  } else {
    // Web
    console.info('Running on Web');
  }
};

export default function Contact() {
  const router = useRouter();
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        className="flex flex-col justify-between h-full min-h-screen"
        sx={{
          pt: `${(isMdUp ? appBarHeight : mobileAppBarHeight) + 10}px`,
          px: 2,
        }}
      >
        <Box className="flex flex-col">
          <Typography fontSize={isMdUp ? 20 : 18} fontWeight={600}>
            {t('contact')}
          </Typography>
          <List>
            {phoneNumbers.map((number) => (
              <ListItemButton key={number} onClick={() => handleClick(number)}>
                <ListItemText primary={number} />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box
          sx={{
            pb: `${(isMdUp ? appBarHeight : mobileAppBarHeight) + 10}px`,
            px: 2,
          }}
        >
          <Typography fontWeight={400} fontSize={isMdUp ? 16 : 14}>
            {t('address')}
          </Typography>
        </Box>
      </Box>
    </Layout>
  );
}
